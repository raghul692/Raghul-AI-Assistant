import Database from 'better-sqlite3';
import dotenv from 'dotenv';
import pg from 'pg';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();
const { Pool } = pg;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SQLITE_DB_PATH = path.resolve(__dirname, '..', 'data', 'nexus.db');

async function run() {
  const sqliteDb = new Database(SQLITE_DB_PATH, { readonly: true });
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL || process.env.SUPABASE_DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  const client = await pool.connect();
  try {
    const tables = sqliteDb.prepare(`
      SELECT name FROM sqlite_master 
      WHERE type='table' 
        AND name NOT LIKE 'sqlite_%' 
        AND name NOT LIKE '%_fts%' 
      ORDER BY name
    `).all().map(r => r.name);

    const results = [];
    for (const t of tables) {
      const sCount = sqliteDb.prepare(`SELECT count(*) as c FROM "${t}"`).get().c;
      const pRes = await client.query(`SELECT count(*) as c FROM "${t}"`);
      const pCount = parseInt(pRes.rows[0].c, 10);
      if (sCount !== pCount) {
        results.push({ table: t, sqlite: sCount, postgres: pCount, diff: pCount - sCount });
      }
    }

    console.log('--- TABLES WITH DIFFERING ROW COUNTS ---');
    console.table(results);

    // Specifically inspect why each of these diffs exists:
    for (const r of results) {
      console.log(`\nAnalyzing ${r.table}: sqlite=${r.sqlite}, pg=${r.postgres}`);
      const sRows = sqliteDb.prepare(`SELECT * FROM "${r.table}"`).all();
      // find primary key or identifier
      const pks = sqliteDb.prepare(`PRAGMA table_info("${r.table}")`).all().filter(c => c.pk > 0).map(c => c.name);
      const pk = pks[0] || (sRows[0] && 'id' in sRows[0] ? 'id' : null);

      if (pk) {
        const pIdsRes = await client.query(`SELECT "${pk}" FROM "${r.table}"`);
        const pIds = new Set(pIdsRes.rows.map(x => String(x[pk])));
        const missingInPg = sRows.filter(x => !pIds.has(String(x[pk])));
        console.log(`Missing in PG: ${missingInPg.length} records`);
        if (missingInPg.length > 0) {
          console.log(`Sample missing keys:`, missingInPg.slice(0, 5).map(x => ({ [pk]: x[pk] })));
        }
      }
    }
  } finally {
    sqliteDb.close();
    client.release();
    await pool.end();
  }
}

run().catch(console.error);
