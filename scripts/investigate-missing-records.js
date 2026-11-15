import Database from 'better-sqlite3';
import dotenv from 'dotenv';
import pg from 'pg';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();
const { Pool } = pg;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SQLITE_DB_PATH = path.resolve(__dirname, '..', 'data', 'nexus.db');

async function main() {
  const sqliteDb = new Database(SQLITE_DB_PATH, { readonly: true });
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL || process.env.SUPABASE_DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  const pgClient = await pool.connect();
  try {
    // 1. Get all tables in SQLite
    const masterTables = sqliteDb.prepare(`
      SELECT name, type, sql 
      FROM sqlite_master 
      WHERE type IN ('table', 'view') 
      ORDER BY name
    `).all();

    console.log(`=== Total objects in SQLite master: ${masterTables.length} ===`);
    const physicalTables = [];
    const virtualFtsTables = [];
    const shadowTables = [];

    for (const t of masterTables) {
      if (t.name.startsWith('sqlite_')) continue;
      if (t.sql && t.sql.toUpperCase().includes('VIRTUAL TABLE')) {
        virtualFtsTables.push(t.name);
      } else if (
        t.name.endsWith('_fts_data') ||
        t.name.endsWith('_fts_idx') ||
        t.name.endsWith('_fts_content') ||
        t.name.endsWith('_fts_docsize') ||
        t.name.endsWith('_fts_config') ||
        t.name.includes('_fts_')
      ) {
        shadowTables.push(t.name);
      } else {
        physicalTables.push(t.name);
      }
    }

    console.log(`Physical User Tables (${physicalTables.length}):`, physicalTables);
    console.log(`Virtual FTS Tables (${virtualFtsTables.length}):`, virtualFtsTables);
    console.log(`Shadow FTS Tables (${shadowTables.length}):`, shadowTables);

    // 2. Per-table count comparison
    console.log('\n=== Comparing Physical Tables ===');
    const tableComparison = [];
    let totalSqliteRows = 0;
    let totalPgRows = 0;

    for (const tbl of physicalTables) {
      const sCount = sqliteDb.prepare(`SELECT count(*) as c FROM "${tbl}"`).get().c;
      totalSqliteRows += sCount;

      let pCount = null;
      let pErr = null;
      try {
        const res = await pgClient.query(`SELECT count(*) as c FROM "${tbl}"`);
        pCount = parseInt(res.rows[0].c, 10);
        totalPgRows += pCount;
      } catch (err) {
        pErr = err.message;
      }

      tableComparison.push({
        table: tbl,
        sqliteCount: sCount,
        pgCount: pCount !== null ? pCount : 'MISSING TABLE',
        diff: pCount !== null ? (pCount - sCount) : 'N/A',
        error: pErr
      });
    }

    console.table(tableComparison);
    console.log(`\nTotal SQLite physical rows: ${totalSqliteRows}`);
    console.log(`Total PostgreSQL physical rows: ${totalPgRows}`);
    console.log(`Difference: ${totalPgRows - totalSqliteRows}`);

    // 3. Find tables where diff !== 0
    const discrepancies = tableComparison.filter(t => t.diff !== 0);
    console.log('\n=== Discrepant Tables ===', discrepancies);

    for (const d of discrepancies) {
      if (typeof d.diff === 'number' && d.diff < 0) {
        console.log(`\nInvestigating missing records in table "${d.table}" (SQLite has ${d.sqliteCount}, PG has ${d.pgCount}):`);
        // Let's identify the primary key or unique columns
        const sqliteRows = sqliteDb.prepare(`SELECT * FROM "${d.table}"`).all();
        // Check primary keys in sqlite
        const pks = sqliteDb.prepare(`PRAGMA table_info("${d.table}")`).all().filter(col => col.pk > 0).map(col => col.name);
        const pkCol = pks.length > 0 ? pks[0] : (sqliteRows[0] && 'id' in sqliteRows[0] ? 'id' : null);

        if (pkCol) {
          console.log(`Primary key column: ${pkCol}`);
          const pgIdsRes = await pgClient.query(`SELECT "${pkCol}" FROM "${d.table}"`);
          const pgIds = new Set(pgIdsRes.rows.map(r => String(r[pkCol])));

          const missingRows = sqliteRows.filter(r => !pgIds.has(String(r[pkCol])));
          console.log(`Missing rows count: ${missingRows.length}`);
          console.log('Missing rows data:', JSON.stringify(missingRows, null, 2));
        } else {
          console.log('No single PK column found, dumping comparison logic.');
        }
      }
    }

  } finally {
    sqliteDb.close();
    pgClient.release();
    await pool.end();
  }
}

main().catch(err => {
  console.error('Investigation error:', err);
});
