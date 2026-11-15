/**
 * RAGHUL AI — UNIFIED DUAL DATABASE ADAPTER (SUPABASE POSTGRESQL & SQLITE)
 * 
 * Provides an environment-aware database abstraction:
 * - Production: Supabase PostgreSQL (via pg connection pool)
 * - Local / Testing: SQLite 3 WAL mode (via better-sqlite3)
 * 
 * Features:
 * - Automated query translation (? to $1, $2, ...)
 * - Connection health probing
 * - Row count verification
 * - Seamless fallback for local zero-dependency testing
 */

import dotenv from 'dotenv';
dotenv.config();

import { db as sqliteDb } from '../db.js';
import { getPostgresPool, pgQuery, pgQueryRow, pgQueryAll, convertSqlPlaceholders, closePostgresPool } from './postgresPool.js';

export class DatabaseAdapter {
  constructor() {
    this.usePostgres = Boolean(process.env.DATABASE_URL || process.env.SUPABASE_DATABASE_URL);
  }

  isPostgres() {
    return this.usePostgres && Boolean(getPostgresPool());
  }

  isProduction() {
    return process.env.NODE_ENV === 'production';
  }

  async healthCheck() {
    const start = Date.now();

    // Production constraint: Postgres is mandatory. Silent fallback is prohibited.
    if (this.isProduction()) {
      if (!this.usePostgres || !getPostgresPool()) {
        return {
          driver: 'postgresql',
          status: 'unhealthy',
          error: 'DATABASE_URL is required in production environment. SQLite fallback is strictly blocked.',
          latencyMs: Date.now() - start
        };
      }
      try {
        const row = await pgQueryRow('SELECT NOW() as now, version() as version');
        return {
          driver: 'postgresql',
          status: 'healthy',
          latencyMs: Date.now() - start,
          timestamp: row.now,
          version: row.version
        };
      } catch (err) {
        return {
          driver: 'postgresql',
          status: 'unhealthy',
          error: err.message,
          latencyMs: Date.now() - start
        };
      }
    }

    // Local / Testing environment
    if (this.isPostgres()) {
      try {
        const row = await pgQueryRow('SELECT NOW() as now, version() as version');
        return {
          driver: 'postgresql',
          status: 'healthy',
          latencyMs: Date.now() - start,
          timestamp: row.now,
          version: row.version
        };
      } catch (err) {
        return {
          driver: 'postgresql',
          status: 'unhealthy',
          error: err.message,
          latencyMs: Date.now() - start
        };
      }
    } else {
      try {
        const row = sqliteDb.prepare("SELECT datetime('now') as now").get();
        return {
          driver: 'sqlite',
          status: 'healthy',
          latencyMs: Date.now() - start,
          timestamp: row.now
        };
      } catch (err) {
        return {
          driver: 'sqlite',
          status: 'unhealthy',
          error: err.message,
          latencyMs: Date.now() - start
        };
      }
    }
  }

  _assertValidDriver() {
    if (this.isProduction() && !this.isPostgres()) {
      throw new Error(
        'PRODUCTION DATABASE VIOLATION: DATABASE_URL is not configured or PostgreSQL is offline. ' +
        'Silent SQLite fallback is strictly blocked in production.'
      );
    }
  }

  async query(sql, params = []) {
    if (this.isPostgres()) {
      return await pgQuery(sql, params);
    } else {
      this._assertValidDriver();
      const stmt = sqliteDb.prepare(sql);
      if (/^\s*(SELECT|PRAGMA|EXPLAIN)/i.test(sql)) {
        const rows = stmt.all(...params);
        return { rows, rowCount: rows.length };
      } else {
        const info = stmt.run(...params);
        return { rowCount: info.changes, lastInsertRowid: info.lastInsertRowid };
      }
    }
  }

  async queryRow(sql, params = []) {
    if (this.isPostgres()) {
      return await pgQueryRow(sql, params);
    } else {
      this._assertValidDriver();
      const stmt = sqliteDb.prepare(sql);
      return stmt.get(...params) || null;
    }
  }

  async queryAll(sql, params = []) {
    if (this.isPostgres()) {
      return await pgQueryAll(sql, params);
    } else {
      this._assertValidDriver();
      const stmt = sqliteDb.prepare(sql);
      return stmt.all(...params);
    }
  }

  async execute(sql, params = []) {
    if (this.isPostgres()) {
      const res = await pgQuery(sql, params);
      return { changes: res.rowCount };
    } else {
      this._assertValidDriver();
      const stmt = sqliteDb.prepare(sql);
      const info = stmt.run(...params);
      return { changes: info.changes };
    }
  }

  async close() {
    if (this.isPostgres()) {
      await closePostgresPool();
    }
  }
}

export const dbAdapter = new DatabaseAdapter();
