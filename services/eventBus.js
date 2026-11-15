/**
 * RAGHUL AI — DISTRIBUTED REAL-TIME EVENT BUS (CROSS-PROCESS SSE)
 * 
 * Delivers live progress and execution updates from Background Worker to Web Service SSE streams:
 * - PostgreSQL LISTEN/NOTIFY and job_events persistence in production
 * - Last-Event-ID historical event replay on reconnection
 * - Resilient heartbeat keep-alive
 * - In-process EventEmitter fallback for local offline testing
 */

import { EventEmitter } from 'events';
import dotenv from 'dotenv';
import pg from 'pg';
import { getPostgresPool, pgQuery, pgQueryAll } from '../database/postgresPool.js';

dotenv.config();

class CrossProcessEventBus extends EventEmitter {
  constructor() {
    super();
    this.usePostgres = Boolean(process.env.DATABASE_URL || process.env.SUPABASE_DATABASE_URL);
    this.listenerClient = null;
    this.subscribedChannels = new Set();
    this.activeJobListeners = new Map(); // jobId -> Set(callback)
    this.activeJobSubscriptions = new Map(); // jobId -> { lastEventId: number, listeners: Set<callback> }
    this.seenEventIds = new Set();
    this.pollTimer = null;

    if (this.usePostgres) {
      this._initPostgresListener();
    }
  }

  async _initPostgresListener() {
    try {
      const connectionString = process.env.DATABASE_URL || process.env.SUPABASE_DATABASE_URL;
      if (!connectionString) return;

      const client = new pg.Client({
        connectionString,
        ssl: { rejectUnauthorized: false }
      });

      await client.connect();
      this.listenerClient = client;

      client.on('notification', (msg) => {
        try {
          const payload = JSON.parse(msg.payload);
          const jobId = payload.job_id;
          if (payload.id) {
            if (this.seenEventIds.has(payload.id)) return;
            this.seenEventIds.add(payload.id);
            if (this.seenEventIds.size > 2000) {
              const first = this.seenEventIds.values().next().value;
              this.seenEventIds.delete(first);
            }
          }
          this.emit(`job:${jobId}`, payload);
          if (this.activeJobListeners.has(jobId)) {
            for (const cb of this.activeJobListeners.get(jobId)) {
              try { cb(payload); } catch (_) {}
            }
          }
        } catch (e) {
          console.warn('[EventBus] Error parsing notification:', e.message);
        }
      });

      client.on('error', (err) => {
        console.error('[EventBus Listener Error]:', err.message);
        this.listenerClient = null;
        setTimeout(() => this._initPostgresListener(), 5000);
      });
    } catch (err) {
      console.warn('[EventBus] Could not establish dedicated LISTEN client, using active polling fallback:', err.message);
    }
  }

  _ensurePollerRunning() {
    if (this.pollTimer || !this.usePostgres) return;

    this.pollTimer = setInterval(async () => {
      if (this.activeJobSubscriptions.size === 0) {
        clearInterval(this.pollTimer);
        this.pollTimer = null;
        return;
      }

      if (!getPostgresPool()) return;

      for (const [jobId, sub] of this.activeJobSubscriptions.entries()) {
        try {
          const rows = await pgQueryAll(
            'SELECT id, job_id, event_type, payload, created_at FROM job_events WHERE job_id = $1 AND id > $2 ORDER BY id ASC',
            [jobId, sub.lastEventId || 0]
          );

          for (const row of rows) {
            const eventId = Number(row.id);
            if (eventId > sub.lastEventId) {
              sub.lastEventId = eventId;
            }

            if (this.seenEventIds.has(eventId)) continue;
            this.seenEventIds.add(eventId);
            if (this.seenEventIds.size > 2000) {
              const first = this.seenEventIds.values().next().value;
              this.seenEventIds.delete(first);
            }

            const formatted = {
              id: eventId,
              job_id: row.job_id,
              event_type: row.event_type,
              payload: typeof row.payload === 'string' ? JSON.parse(row.payload) : (row.payload || {}),
              created_at: Number(row.created_at)
            };

            this.emit(`job:${jobId}`, formatted);
            for (const cb of sub.listeners) {
              try { cb(formatted); } catch (_) {}
            }
          }
        } catch (_) {}
      }
    }, 400);
  }

  /**
   * Publish an event for a job (called by Background Worker or Web Service)
   */
  async publish(jobId, eventType, data = {}) {
    const now = Date.now();
    const eventPayload = {
      job_id: jobId,
      event_type: eventType,
      payload: data,
      created_at: now
    };

    if (this.usePostgres && getPostgresPool()) {
      try {
        const res = await pgQuery(
          'INSERT INTO job_events (job_id, event_type, payload, created_at) VALUES ($1, $2, $3, $4) RETURNING id',
          [jobId, eventType, JSON.stringify(data), now]
        );
        eventPayload.id = res.rows[0]?.id;
        if (eventPayload.id) {
          this.seenEventIds.add(Number(eventPayload.id));
          if (this.seenEventIds.size > 2000) {
            const first = this.seenEventIds.values().next().value;
            this.seenEventIds.delete(first);
          }
        }
      } catch (err) {
        console.warn(`[EventBus] Failed to persist job event:`, err.message);
      }
    }

    // Emit locally within this process
    this.emit(`job:${jobId}`, eventPayload);
    if (this.activeJobListeners.has(jobId)) {
      for (const cb of this.activeJobListeners.get(jobId)) {
        try { cb(eventPayload); } catch (_) {}
      }
    }

    return eventPayload;
  }

  /**
   * Subscribe to events for a specific job
   */
  async subscribe(jobId, callback) {
    if (!this.activeJobListeners.has(jobId)) {
      this.activeJobListeners.set(jobId, new Set());
    }
    this.activeJobListeners.get(jobId).add(callback);

    if (!this.activeJobSubscriptions.has(jobId)) {
      let initialLastId = 0;
      if (this.usePostgres && getPostgresPool()) {
        try {
          const maxRow = await pgQuery(
            'SELECT COALESCE(MAX(id), 0) as max_id FROM job_events WHERE job_id = $1',
            [jobId]
          );
          initialLastId = Number(maxRow.rows[0]?.max_id || 0);
        } catch (_) {}
      }
      this.activeJobSubscriptions.set(jobId, {
        lastEventId: initialLastId,
        listeners: new Set()
      });
    }
    this.activeJobSubscriptions.get(jobId).listeners.add(callback);
    this._ensurePollerRunning();

    if (this.listenerClient && !this.subscribedChannels.has(jobId)) {
      try {
        await this.listenerClient.query(`LISTEN job_event_${jobId}`);
        this.subscribedChannels.add(jobId);
      } catch (_) {}
    }

    // Return unsubscribe function
    return () => {
      if (this.activeJobListeners.has(jobId)) {
        this.activeJobListeners.get(jobId).delete(callback);
        if (this.activeJobListeners.get(jobId).size === 0) {
          this.activeJobListeners.delete(jobId);
        }
      }

      if (this.activeJobSubscriptions.has(jobId)) {
        const sub = this.activeJobSubscriptions.get(jobId);
        sub.listeners.delete(callback);
        if (sub.listeners.size === 0) {
          this.activeJobSubscriptions.delete(jobId);
        }
      }
    };
  }

  /**
   * Fetch historical events for a job since a given sequence ID (for SSE Last-Event-ID reconnection)
   */
  async getEventsSince(jobId, lastEventId = 0) {
    if (this.usePostgres && getPostgresPool()) {
      try {
        const rows = await pgQueryAll(
          'SELECT id, job_id, event_type, payload, created_at FROM job_events WHERE job_id = $1 AND id > $2 ORDER BY id ASC',
          [jobId, parseInt(lastEventId || '0', 10)]
        );
        return rows.map(r => ({
          id: r.id,
          job_id: r.job_id,
          event_type: r.event_type,
          payload: typeof r.payload === 'string' ? JSON.parse(r.payload) : r.payload,
          created_at: Number(r.created_at)
        }));
      } catch (err) {
        console.warn('[EventBus] Error fetching event backlog:', err.message);
      }
    }
    return [];
  }
}

export const eventBus = new CrossProcessEventBus();
