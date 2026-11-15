/**
 * RAGHUL AI — PRODUCTION SUPABASE POSTGRESQL CONNECTION POOL
 * 
 * Provides resilient, pooled connections to Supabase PostgreSQL with:
 * - SSL configuration (rejectUnauthorized: false for Supabase cloud pooler)
 * - Automatic connection health validation
 * - Dynamic parameter rewriting (? -> $1, $2, ...)
 * - Safe transaction helper with automatic rollback on error
 * - Idle connection recycling and connection leak safeguards
 */

import pg from 'pg';
import dns from 'dns';
import dotenv from 'dotenv';

try {
  dns.setDefaultResultOrder('verbatim');
} catch (_) {}

dotenv.config();

const { Pool } = pg;

let pool = null;

export function getPostgresPool() {
  if (pool) return pool;

  const connectionString = process.env.DATABASE_URL || process.env.SUPABASE_DATABASE_URL;
  if (!connectionString) {
    return null;
  }

  pool = new Pool({
    connectionString,
    ssl: {
      rejectUnauthorized: false
    },
    max: parseInt(process.env.PG_POOL_MAX || '10', 10),
    idleTimeoutMillis: parseInt(process.env.PG_IDLE_TIMEOUT || '30000', 10),
    connectionTimeoutMillis: parseInt(process.env.PG_CONN_TIMEOUT || '30000', 10),
    keepAlive: true,
    keepAliveInitialDelayMillis: 10000
  });

  pool.on('error', (err) => {
    console.error('[PostgreSQL Pool] Unexpected client error:', err.message);
  });

  return pool;
}

/**
 * Convert standard '?' parameterized SQL to PostgreSQL numbered '$1, $2, ...' syntax
 */
export function convertSqlPlaceholders(sql) {
  let paramIndex = 1;
  return sql.replace(/\?/g, () => `$${paramIndex++}`);
}

/**
 * Execute a query against Supabase PostgreSQL with converted placeholders & transient retries
 */
export async function pgQuery(sql, params = [], retries = 2) {
  const p = getPostgresPool();
  if (!p) {
    throw new Error('DATABASE_URL not configured: cannot execute PostgreSQL query.');
  }

  const convertedSql = convertSqlPlaceholders(sql);
  const start = Date.now();
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const result = await p.query(convertedSql, params);
      const duration = Date.now() - start;
      if (process.env.DEBUG_SQL === 'true') {
        console.log(`[SQL ${duration}ms] ${convertedSql.slice(0, 100)}...`);
      }
      return result;
    } catch (err) {
      const isTransient = /timeout|Connection terminated|ECONNRESET|ETIMEDOUT|ENOTFOUND|EAI_AGAIN/i.test(err.message);
      if (isTransient && attempt < retries) {
        await new Promise(r => setTimeout(r, 500 * (attempt + 1)));
        continue;
      }
      console.error(`[PostgreSQL Query Error] ${err.message}\nSQL: ${convertedSql}\nParams:`, params);
      throw err;
    }
  }
}

/**
 * Execute a query expecting a single row
 */
export async function pgQueryRow(sql, params = []) {
  const res = await pgQuery(sql, params);
  return res.rows[0] || null;
}

/**
 * Execute a query expecting all matching rows
 */
export async function pgQueryAll(sql, params = []) {
  const res = await pgQuery(sql, params);
  return res.rows;
}

/**
 * Run operations inside a managed PostgreSQL transaction
 */
export async function withPgTransaction(callback) {
  const p = getPostgresPool();
  if (!p) {
    throw new Error('DATABASE_URL not configured for transaction.');
  }

  const client = await p.connect();
  try {
    await client.query('BEGIN');
    const result = await callback({
      query: (sql, params = []) => client.query(convertSqlPlaceholders(sql), params)
    });
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Close PostgreSQL pool gracefully
 */
export async function closePostgresPool() {
  if (pool) {
    try {
      await pool.end();
      pool = null;
    } catch (_) {}
  }
}
