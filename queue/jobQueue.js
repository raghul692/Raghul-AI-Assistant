/**
 * RAGHUL AI — DISTRIBUTED DURABLE JOB QUEUE
 * 
 * Powered by Supabase PostgreSQL (with FOR UPDATE SKIP LOCKED) & SQLite fallback:
 * - Priority scheduling (1-10)
 * - Concurrency control & worker ownership
 * - Idempotency enforcement
 * - Exponential backoff retry policies
 * - Dead-letter queue (DLQ)
 * - In-flight job progress tracking & event bus integration
 */

import dotenv from 'dotenv';
import crypto from 'crypto';
import { getPostgresPool, pgQuery, pgQueryRow, pgQueryAll } from '../database/postgresPool.js';
import { db as sqliteDb } from '../db.js';
import { eventBus } from '../services/eventBus.js';

dotenv.config();

export class JobQueue {
  constructor() {
    this.usePostgres = Boolean(process.env.DATABASE_URL || process.env.SUPABASE_DATABASE_URL);
  }

  isPostgres() {
    return this.usePostgres && Boolean(getPostgresPool());
  }

  _assertValidDriver() {
    if (process.env.NODE_ENV === 'production' && !this.isPostgres()) {
      throw new Error(
        'PRODUCTION QUEUE VIOLATION: Distributed PostgreSQL queue is required in production. ' +
        'Silent SQLite fallback is strictly blocked.'
      );
    }
  }

  /**
   * Submit a job to the queue
   */
  async enqueue({
    jobType,
    payload = {},
    priority = 5,
    idempotencyKey = null,
    maxAttempts = 3
  }) {
    if (!jobType) {
      throw new Error('jobType is required to enqueue a job');
    }

    const now = Date.now();
    const jobId = `job_${now}_${crypto.randomBytes(4).toString('hex')}`;
    const effectiveKey = idempotencyKey || null;

    if (this.isPostgres()) {
      if (effectiveKey) {
        const existing = await pgQueryRow(
          'SELECT * FROM job_queue WHERE idempotency_key = $1',
          [effectiveKey]
        );
        if (existing) {
          return { jobId: existing.id, status: existing.status, isDuplicate: true };
        }
      }

      try {
        await pgQuery(`
          INSERT INTO job_queue (
            id, idempotency_key, job_type, priority, payload, status,
            attempts, max_attempts, created_at
          ) VALUES ($1, $2, $3, $4, $5, 'pending', 0, $6, $7)
          ON CONFLICT (idempotency_key) DO NOTHING
        `, [
          jobId,
          effectiveKey,
          jobType,
          priority,
          JSON.stringify(payload),
          maxAttempts,
          now
        ]);
      } catch (insertErr) {
        if (!insertErr.message.includes('unique constraint') && insertErr.code !== '23505') {
          throw insertErr;
        }
      }

      if (effectiveKey) {
        const existing = await pgQueryRow(
          'SELECT * FROM job_queue WHERE idempotency_key = $1',
          [effectiveKey]
        );
        if (existing && existing.id !== jobId) {
          return { jobId: existing.id, status: existing.status, isDuplicate: true };
        }
      }

      await eventBus.publish(jobId, 'enqueued', { jobId, jobType, priority, status: 'pending' });
      return { jobId, status: 'pending', jobType };
    } else {
      // SQLite fallback (local development / testing only)
      this._assertValidDriver();
      if (effectiveKey) {
        const existing = sqliteDb.prepare(
          'SELECT * FROM portfolio_job_queue WHERE idempotency_key = ?'
        ).get(effectiveKey);
        if (existing) {
          return { jobId: existing.id, status: existing.status, isDuplicate: true };
        }
      }

      try {
        sqliteDb.prepare(`
          INSERT OR IGNORE INTO portfolio_job_queue (
            id, idempotency_key, name, job_type, payload, status,
            attempts, max_attempts, created_at
          ) VALUES (?, ?, ?, ?, ?, 'pending', 0, ?, ?)
        `).run(
          jobId,
          effectiveKey,
          jobType,
          jobType,
          JSON.stringify(payload),
          maxAttempts,
          now
        );
      } catch (sqliteErr) {
        if (!sqliteErr.message.includes('UNIQUE constraint')) {
          throw sqliteErr;
        }
      }

      if (effectiveKey) {
        const existing = sqliteDb.prepare(
          'SELECT * FROM portfolio_job_queue WHERE idempotency_key = ?'
        ).get(effectiveKey);
        if (existing && existing.id !== jobId) {
          return { jobId: existing.id, status: existing.status, isDuplicate: true };
        }
      }

      await eventBus.publish(jobId, 'enqueued', { jobId, jobType, priority, status: 'pending' });
      return { jobId, status: 'pending', jobType };
    }
  }

  /**
   * Atomically dequeue the next available job using FOR UPDATE SKIP LOCKED
   */
  async dequeue(workerId = 'worker-1') {
    const now = Date.now();

    if (this.isPostgres()) {
      const sql = `
        UPDATE job_queue
        SET status = 'running',
            worker_id = $1,
            started_at = $2,
            locked_at = $2,
            attempts = attempts + 1
        WHERE id = (
            SELECT id FROM job_queue
            WHERE status = 'pending'
              AND (next_retry_at IS NULL OR next_retry_at <= $2)
            ORDER BY priority ASC, created_at ASC
            FOR UPDATE SKIP LOCKED
            LIMIT 1
        )
        RETURNING *;
      `;

      const row = await pgQueryRow(sql, [workerId, now]);
      if (!row) return null;

      const payload = typeof row.payload === 'string' ? JSON.parse(row.payload) : (row.payload || {});
      return {
        ...row,
        payload
      };
    } else {
      // SQLite fallback (local development / testing only)
      this._assertValidDriver();
      const candidate = sqliteDb.prepare(`
        SELECT * FROM portfolio_job_queue
        WHERE status = 'pending'
          AND (next_retry_at IS NULL OR next_retry_at <= ?)
        ORDER BY created_at ASC
        LIMIT 1
      `).get(now);

      if (!candidate) return null;

      sqliteDb.prepare(`
        UPDATE portfolio_job_queue
        SET status = 'running',
            started_at = ?,
            attempts = attempts + 1
        WHERE id = ? AND status = 'pending'
      `).run(now, candidate.id);

      const payload = typeof candidate.payload === 'string' ? JSON.parse(candidate.payload) : (candidate.payload || {});
      return {
        ...candidate,
        payload
      };
    }
  }

  /**
   * Emit progress update
   */
  async updateProgress(jobId, { progress, stage, message, data = {} }) {
    await eventBus.publish(jobId, 'progress', {
      jobId,
      progress: progress || 0,
      stage: stage || 'EXECUTING',
      message: message || '',
      ...data
    });
  }

  /**
   * Mark job as completed
   */
  async complete(jobId, result = {}) {
    const now = Date.now();
    const resultJson = JSON.stringify(result);

    if (this.isPostgres()) {
      await pgQuery(`
        UPDATE job_queue
        SET status = 'completed',
            result = $1,
            finished_at = $2,
            error_message = NULL
        WHERE id = $3
      `, [resultJson, now, jobId]);
    } else {
      this._assertValidDriver();
      sqliteDb.prepare(`
        UPDATE portfolio_job_queue
        SET status = 'completed',
            result = ?,
            finished_at = ?,
            error_message = NULL
        WHERE id = ?
      `).run(resultJson, now, jobId);
    }

    await eventBus.publish(jobId, 'completed', { jobId, status: 'completed', result });
  }

  /**
   * Fail job with exponential backoff retry or DLQ
   */
  async fail(jobId, error, { shouldRetry = true } = {}) {
    const now = Date.now();
    const job = await this.getJob(jobId);
    const attempts = (job?.attempts || 1);
    const maxAttempts = (job?.max_attempts || 3);
    const errorMsg = error?.message || String(error);

    if (shouldRetry && attempts < maxAttempts) {
      const delayMs = Math.min(1000 * Math.pow(2, attempts), 60000);
      const nextRetryAt = now + delayMs;

      if (this.isPostgres()) {
        await pgQuery(`
          UPDATE job_queue
          SET status = 'pending',
              next_retry_at = $1,
              error_message = $2
          WHERE id = $3
        `, [nextRetryAt, errorMsg, jobId]);
      } else {
        this._assertValidDriver();
        sqliteDb.prepare(`
          UPDATE portfolio_job_queue
          SET status = 'pending',
              next_retry_at = ?,
              error_message = ?
          WHERE id = ?
        `).run(nextRetryAt, errorMsg, jobId);
      }

      await eventBus.publish(jobId, 'retry', {
        jobId,
        status: 'pending',
        attempts,
        maxAttempts,
        nextRetryInMs: delayMs,
        error: errorMsg
      });
    } else {
      // Move to Dead-Letter Queue (DLQ)
      if (this.isPostgres()) {
        await pgQuery(`
          UPDATE job_queue
          SET status = 'dlq',
              finished_at = $1,
              error_message = $2
        WHERE id = $3
        `, [now, errorMsg, jobId]);
      } else {
        this._assertValidDriver();
        sqliteDb.prepare(`
          UPDATE portfolio_job_queue
          SET status = 'dlq',
              finished_at = ?,
              error_message = ?
          WHERE id = ?
        `).run(now, errorMsg, jobId);
      }

      await eventBus.publish(jobId, 'failed', {
        jobId,
        status: 'dlq',
        attempts,
        error: errorMsg
      });
    }
  }

  /**
   * Fetch current job state
   */
  async getJob(jobId) {
    if (this.isPostgres()) {
      const row = await pgQueryRow('SELECT * FROM job_queue WHERE id = $1', [jobId]);
      if (!row) return null;
      return {
        ...row,
        payload: typeof row.payload === 'string' ? JSON.parse(row.payload) : (row.payload || {}),
        result: typeof row.result === 'string' ? JSON.parse(row.result) : (row.result || null)
      };
    } else {
      this._assertValidDriver();
      const row = sqliteDb.prepare('SELECT * FROM portfolio_job_queue WHERE id = ?').get(jobId);
      if (!row) return null;
      return {
        ...row,
        payload: typeof row.payload === 'string' ? JSON.parse(row.payload) : (row.payload || {}),
        result: typeof row.result === 'string' ? JSON.parse(row.result) : (row.result || null)
      };
    }
  }

  /**
   * Heartbeat signal indicating the worker is actively executing this job
   */
  async heartbeat(jobId) {
    const now = Date.now();
    if (this.isPostgres()) {
      await pgQuery(`
        UPDATE job_queue
        SET locked_at = $1
        WHERE id = $2 AND status = 'running'
      `, [now, jobId]);
    } else {
      this._assertValidDriver();
      sqliteDb.prepare(`
        UPDATE portfolio_job_queue
        SET updated_at = ?
        WHERE id = ? AND status = 'running'
      `).run(now, jobId);
    }
  }

  /**
   * Stalled job recovery: re-queues running jobs whose heartbeats have expired
   */
  async recoverStalledJobs(stalledThresholdMs = 60000) {
    const now = Date.now();
    const staleBefore = now - stalledThresholdMs;

    if (this.isPostgres()) {
      const stalled = await pgQueryAll(`
        SELECT * FROM job_queue
        WHERE status = 'running'
          AND (locked_at IS NULL OR locked_at < $1)
      `, [staleBefore]);

      for (const j of stalled) {
        if (j.attempts < j.max_attempts) {
          await pgQuery(`
            UPDATE job_queue
            SET status = 'pending',
                next_retry_at = $1,
                error_message = 'RECOVERED_AFTER_STALLED_TIMEOUT'
            WHERE id = $2
          `, [now + 1000, j.id]);
        } else {
          await pgQuery(`
            UPDATE job_queue
            SET status = 'dlq',
                finished_at = $1,
                error_message = 'STALLED_EXCEEDED_MAX_ATTEMPTS'
            WHERE id = $2
          `, [now, j.id]);
        }
      }
      return stalled.length;
    }
    return 0;
  }

  /**
   * Crash recovery: marks orphaned running jobs for retry
   */
  async recoverOrphanedJobs(workerId = null) {
    const now = Date.now();
    const staleBefore = now - 60000;

    if (this.isPostgres()) {
      const condition = workerId 
        ? '(status = \'running\' AND (worker_id = $1 OR locked_at IS NULL OR locked_at < $2))' 
        : '(status = \'running\' AND (locked_at IS NULL OR locked_at < $1))';
      const params = workerId ? [workerId, staleBefore] : [staleBefore];
      const orphaned = await pgQueryAll(`SELECT * FROM job_queue WHERE ${condition}`, params);

      for (const j of orphaned) {
        if (j.attempts < j.max_attempts) {
          await pgQuery(`
            UPDATE job_queue
            SET status = 'pending',
                next_retry_at = $1,
                error_message = 'RECOVERED_AFTER_WORKER_RESTART'
            WHERE id = $2
          `, [now + 1000, j.id]);
        } else {
          await pgQuery(`
            UPDATE job_queue
            SET status = 'dlq',
                finished_at = $1,
                error_message = 'ORPHANED_EXCEEDED_MAX_ATTEMPTS'
            WHERE id = $2
          `, [now, j.id]);
        }
      }
      return orphaned.length;
    }
    return 0;
  }

  /**
   * Cancel a pending or running job
   */
  async cancel(jobId, reason = 'cancelled_by_user') {
    const now = Date.now();
    if (this.isPostgres()) {
      const res = await pgQuery(`
        UPDATE job_queue
        SET status = 'cancelled',
            finished_at = $1,
            error_message = $2
        WHERE id = $3 AND status IN ('pending', 'running')
      `, [now, reason, jobId]);
      await eventBus.publish(jobId, 'cancelled', { jobId, reason, status: 'cancelled' });
      return { success: true, jobId, status: 'cancelled', affected: res.rowCount };
    } else {
      this._assertValidDriver();
      const info = sqliteDb.prepare(`
        UPDATE portfolio_job_queue
        SET status = 'cancelled',
            error_message = ?,
            updated_at = ?
        WHERE id = ? AND status IN ('pending', 'running')
      `).run(reason, now, jobId);
      return { success: true, jobId, status: 'cancelled', affected: info.changes };
    }
  }

  /**
   * Release an in-flight job back to pending (called during worker shutdown)
   */
  async releaseJob(jobId, reason = 'worker_shutdown') {
    const now = Date.now();
    if (this.isPostgres()) {
      await pgQuery(`
        UPDATE job_queue
        SET status = 'pending',
            worker_id = NULL,
            locked_at = NULL,
            error_message = $1
        WHERE id = $2 AND status = 'running'
      `, [`Released: ${reason}`, jobId]);
      await eventBus.publish(jobId, 'released', { jobId, reason, status: 'pending' });
    } else {
      this._assertValidDriver();
      sqliteDb.prepare(`
        UPDATE portfolio_job_queue
        SET status = 'pending',
            error_message = ?,
            updated_at = ?
        WHERE id = ? AND status = 'running'
      `).run(`Released: ${reason}`, now, jobId);
    }
  }

  /**
   * List recent jobs
   */
  async listRecentJobs(limit = 20) {
    if (this.isPostgres()) {
      const rows = await pgQueryAll('SELECT * FROM job_queue ORDER BY created_at DESC LIMIT $1', [limit]);
      return rows.map(r => ({
        ...r,
        payload: typeof r.payload === 'string' ? JSON.parse(r.payload) : (r.payload || {}),
        result: typeof r.result === 'string' ? JSON.parse(r.result) : (r.result || null)
      }));
    } else {
      this._assertValidDriver();
      const rows = sqliteDb.prepare('SELECT * FROM portfolio_job_queue ORDER BY created_at DESC LIMIT ?').all(limit);
      return rows.map(r => ({
        ...r,
        payload: typeof r.payload === 'string' ? JSON.parse(r.payload) : (r.payload || {}),
        result: typeof r.result === 'string' ? JSON.parse(r.result) : (r.result || null)
      }));
    }
  }
}

export const jobQueue = new JobQueue();
