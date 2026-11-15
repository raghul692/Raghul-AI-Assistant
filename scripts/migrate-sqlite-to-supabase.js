/**
 * RAGHUL AI — SQLITE TO SUPABASE POSTGRESQL DATA MIGRATION ENGINE
 * 
 * Safely transfers all existing SQLite records to Supabase PostgreSQL:
 * - Batched streaming inserts
 * - Replicates parent and child data cleanly with session_replication_role
 * - Column alignment between SQLite and PostgreSQL
 * - Row count verification before and after
 * - Zero modification to original SQLite database
 */

import Database from 'better-sqlite3';
import dns from 'dns';
import dotenv from 'dotenv';
import pg from 'pg';
import path from 'path';
import { fileURLToPath } from 'url';

try {
  dns.setDefaultResultOrder('ipv4first');
} catch (_) {}

dotenv.config();

const { Pool } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SQLITE_DB_PATH = path.resolve(__dirname, '..', 'data', 'nexus.db');

const MIGRATION_ORDER = [
  'projects',
  'chats',
  'messages',
  'project_files',
  'user_settings',
  'settings_audit_logs',
  'user_memories',
  'conversation_summaries',
  'provider_settings',
  'operator_keystore',
  'audit_logs',
  'pending_approvals',
  'audit_ledger_checkpoints',
  'github_connections',
  'github_automations',
  'github_automation_runs',
  'github_webhooks',
  'github_approvals',
  'github_audit_ledger',
  'portfolio_config',
  'portfolio_content_drafts',
  'portfolio_deployments',
  'portfolio_analytics_cache',
  'portfolio_knowledge_index',
  'portfolio_contacts_cache',
  'portfolio_analytics_events',
  'portfolio_live_activity',
  'portfolio_automation_tasks',
  'portfolio_notifications',
  'portfolio_incidents',
  'portfolio_user_settings',
  'portfolio_system_state',
  'portfolio_job_queue',
  'emails',
  'calendar_events',
  'reminders',
  'autonomous_tasks',
  'image_assets',
  'rag_documents',
  'rag_chunks',
  'rag_embeddings',
  'research_jobs',
  'research_plans',
  'research_queries',
  'research_sources',
  'source_fetches',
  'evidence_items',
  'research_claims',
  'claim_evidence',
  'research_sections',
  'research_citations',
  'research_artifacts',
  'research_runs',
  'research_quality_checks',
  'research_contradictions'
];

async function migrateData() {
  const isDryRun = process.argv.includes('--dry-run');
  console.log('================================================================');
  console.log(`📦 RAGHUL AI — SQLITE TO SUPABASE MIGRATION ${isDryRun ? '(DRY RUN)' : ''}`);
  console.log('================================================================\n');

  const sqliteDb = new Database(SQLITE_DB_PATH, { readonly: true });
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL || process.env.SUPABASE_DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 30000
  });

  const report = [];

  try {
    const pgClient = await pool.connect();
    console.log('PostgreSQL connected.\n');

    // Fetch all existing PostgreSQL column definitions in one single query
    const allPgColsRes = await pgClient.query(`
      SELECT table_name, column_name 
      FROM information_schema.columns 
      WHERE table_schema = 'public'
    `);
    const pgTableCols = new Map();
    for (const r of allPgColsRes.rows) {
      if (!pgTableCols.has(r.table_name)) {
        pgTableCols.set(r.table_name, new Set());
      }
      pgTableCols.get(r.table_name).add(r.column_name);
    }

    try {
      if (!isDryRun) {
        // Disable foreign key triggers during bulk copy for fast and conflict-free ingestion
        try {
          await pgClient.query("SET session_replication_role = 'replica';");
        } catch (_) {}
      }

      for (const table of MIGRATION_ORDER) {
        const sqliteTableExists = sqliteDb.prepare(
          "SELECT name FROM sqlite_master WHERE type='table' AND name = ?"
        ).get(table);

        if (!sqliteTableExists) continue;

        const sqliteCount = sqliteDb.prepare(`SELECT count(*) as count FROM "${table}"`).get().count;
        let pgCountBefore = 0;
        try {
          const pgCountRes = await pgClient.query(`SELECT count(*) as count FROM "${table}"`);
          pgCountBefore = parseInt(pgCountRes.rows[0].count, 10);
        } catch (_) {}

        if (sqliteCount === 0) {
          report.push({
            table,
            sqliteCount: 0,
            pgBefore: pgCountBefore,
            pgAfter: pgCountBefore,
            status: 'EMPTY_SOURCE'
          });
          continue;
        }

        if (isDryRun) {
          report.push({
            table,
            sqliteCount,
            pgBefore: pgCountBefore,
            pgAfter: pgCountBefore,
            status: 'WOULD_MIGRATE'
          });
          continue;
        }

        const rows = sqliteDb.prepare(`SELECT * FROM "${table}"`).all();
        const validPgCols = pgTableCols.get(table) || new Set();
        if (rows.length === 0) continue;

        // Determine common valid keys from the first row
        const firstRowKeys = Object.keys(rows[0]);
        const validKeys = firstRowKeys.filter(k => validPgCols.has(k));
        if (validKeys.length === 0) continue;

        const BATCH_SIZE = 200;
        for (let i = 0; i < rows.length; i += BATCH_SIZE) {
          const batch = rows.slice(i, i + BATCH_SIZE);
          const valueClauses = [];
          const flatValues = [];
          let paramIdx = 1;

          for (const row of batch) {
            const rowPlaceholders = [];
            for (const k of validKeys) {
              rowPlaceholders.push(`$${paramIdx++}`);
              flatValues.push(row[k] === undefined ? null : row[k]);
            }
            valueClauses.push(`(${rowPlaceholders.join(', ')})`);
          }

          const insertSql = `
            INSERT INTO "${table}" (${validKeys.map(k => `"${k}"`).join(', ')})
            VALUES ${valueClauses.join(', ')}
            ON CONFLICT DO NOTHING
          `;

          try {
            await pgClient.query(insertSql, flatValues);
          } catch (batchErr) {
            console.error(`   ⚠️ Multi-row batch failed on ${table}:`, batchErr.message);
          }
        }

        let pgCountAfter = pgCountBefore;
        try {
          const pgCountAfterRes = await pgClient.query(`SELECT count(*) as count FROM "${table}"`);
          pgCountAfter = parseInt(pgCountAfterRes.rows[0].count, 10);
        } catch (_) {}

        console.log(`✅ Migrated ${table}: SQLite=${sqliteCount}, PG=${pgCountAfter}`);

        report.push({
          table,
          sqliteCount,
          pgBefore: pgCountBefore,
          pgAfter: pgCountAfter,
          migrated: pgCountAfter - pgCountBefore,
          status: pgCountAfter >= sqliteCount ? 'VERIFIED_COMPLETE' : 'PARTIAL'
        });
      }

      if (!isDryRun) {
        // Re-enable constraint triggers
        try {
          await pgClient.query("SET session_replication_role = 'origin';");
        } catch (_) {}
      }

      console.log('\n================================================================');
      console.log('📊 MIGRATION VERIFICATION AUDIT MATRIX');
      console.log('================================================================');
      console.table(report);

      const totalSource = report.reduce((acc, r) => acc + (r.sqliteCount || 0), 0);
      const totalDest = report.reduce((acc, r) => acc + (r.pgAfter || 0), 0);
      console.log(`\nTotal SQLite Records: ${totalSource}`);
      console.log(`Total PostgreSQL Records: ${totalDest}`);
    } finally {
      pgClient.release();
    }
  } catch (err) {
    console.error('Fatal data migration error:', err);
  } finally {
    await pool.end();
  }
}

migrateData();
