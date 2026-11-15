/**
 * RAGHUL AI — VERSIONED POSTGRESQL MIGRATION RUNNER
 * Applies versioned SQL migrations against Supabase PostgreSQL idempotently.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import pg from 'pg';

dotenv.config();

const { Pool } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const MIGRATIONS_DIR = path.resolve(__dirname, '..', 'migrations');

async function runMigrations() {
  const isDryRun = process.argv.includes('--dry-run');
  const connectionString = process.env.DATABASE_URL || process.env.SUPABASE_DATABASE_URL;

  if (!connectionString) {
    console.error('❌ Error: DATABASE_URL is not set in environment.');
    process.exit(1);
  }

  const pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });

  console.log('================================================================');
  console.log(`🚀 RAGHUL AI — SUPABASE MIGRATION RUNNER ${isDryRun ? '(DRY RUN)' : ''}`);
  console.log('================================================================\n');

  try {
    const client = await pool.connect();
    try {
      // 1. Ensure schema_migrations ledger exists
      if (!isDryRun) {
        await client.query(`
          CREATE TABLE IF NOT EXISTS schema_migrations (
            version TEXT PRIMARY KEY,
            applied_at BIGINT NOT NULL
          );
        `);
      }

      // 2. Fetch applied versions
      let appliedVersions = new Set();
      if (!isDryRun) {
        const { rows } = await client.query('SELECT version FROM schema_migrations');
        appliedVersions = new Set(rows.map(r => r.version));
      }

      // 3. Read migration files
      const files = fs.readdirSync(MIGRATIONS_DIR)
        .filter(f => f.endsWith('.sql'))
        .sort();

      console.log(`Found ${files.length} migration files in migrations/\n`);

      for (const file of files) {
        if (appliedVersions.has(file)) {
          console.log(`⏩ [SKIPPED] ${file} (already applied)`);
          continue;
        }

        console.log(`▶️ [APPLYING] ${file}...`);
        const filePath = path.join(MIGRATIONS_DIR, file);
        const sql = fs.readFileSync(filePath, 'utf8');

        if (isDryRun) {
          console.log(`   [DRY-RUN] Would execute ${sql.length} bytes of SQL`);
          continue;
        }

        const start = Date.now();
        await client.query('BEGIN');
        try {
          await client.query(sql);
          await client.query(
            'INSERT INTO schema_migrations (version, applied_at) VALUES ($1, $2)',
            [file, Date.now()]
          );
          await client.query('COMMIT');
          console.log(`   ✅ [SUCCESS] ${file} applied in ${Date.now() - start}ms`);
        } catch (err) {
          await client.query('ROLLBACK');
          console.error(`   ❌ [FAILED] ${file}: ${err.message}`);
          throw err;
        }
      }

      console.log('\n🎉 Migration process completed successfully.');
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('\n❌ Fatal migration error:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigrations();
