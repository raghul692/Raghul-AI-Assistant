import Database from 'better-sqlite3';
import dotenv from 'dotenv';
import pg from 'pg';

dotenv.config();
const { Pool } = pg;

const sqliteDb = new Database('data/nexus.db');
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  const sqliteTables = sqliteDb.prepare(`
    SELECT name FROM sqlite_master 
    WHERE type='table' 
      AND name NOT LIKE 'sqlite_%' 
      AND name NOT LIKE '%_fts%' 
      AND name NOT LIKE '%_segments' 
      AND name NOT LIKE '%_segdir' 
      AND name NOT LIKE '%_docsize' 
      AND name NOT LIKE '%_stat'
      AND name NOT LIKE '%_content'
      AND name NOT LIKE '%_data'
      AND name NOT LIKE '%_idx'
      AND name NOT LIKE '%_config'
    ORDER BY name ASC
  `).all();

  console.log(`Auditing ${sqliteTables.length} physical SQLite tables against PostgreSQL...\n`);

  let totalSqlite = 0;
  let totalPg = 0;
  const discrepancies = [];

  for (const tbl of sqliteTables) {
    let sCount = 0;
    try {
      sCount = sqliteDb.prepare(`SELECT COUNT(*) as c FROM "${tbl.name}"`).get().c;
      totalSqlite += sCount;
    } catch (e) {
      console.error(`Error reading SQLite table ${tbl.name}:`, e.message);
      continue;
    }

    try {
      const pgRes = await pool.query(`SELECT COUNT(*) as c FROM "${tbl.name}"`);
      const pCount = parseInt(pgRes.rows[0].c, 10);
      totalPg += pCount;
      const diff = sCount - pCount;
      if (diff !== 0) {
        discrepancies.push({ table: tbl.name, sqlite: sCount, postgres: pCount, diff });
        console.log(`⚠️  [${tbl.name}] SQLite: ${sCount} | Postgres: ${pCount} | Diff: ${diff}`);
      } else if (sCount > 0) {
        console.log(`✅ [${tbl.name}] Matches: ${sCount} rows`);
      }
    } catch (err) {
      console.log(`❌ [${tbl.name}] Table missing in Postgres or query error: ${err.message}`);
    }
  }

  console.log(`\n================================================================`);
  console.log(`Total Physical SQLite rows: ${totalSqlite}`);
  console.log(`Total Migrated Postgres rows: ${totalPg}`);
  console.log(`Net Difference: ${totalSqlite - totalPg}`);
  console.log(`================================================================\n`);

  console.log('Discrepancy Details:');
  console.log(JSON.stringify(discrepancies, null, 2));

  // Let's deeply inspect the tables with discrepancies
  for (const item of discrepancies) {
    console.log(`\n--- Deep Inspecting Discrepant Table: ${item.table} ---`);
    const sqliteRows = sqliteDb.prepare(`SELECT * FROM "${item.table}"`).all();
    const pgRows = (await pool.query(`SELECT * FROM "${item.table}"`)).rows;

    console.log(`SQLite has ${sqliteRows.length} rows, Postgres has ${pgRows.length} rows.`);

    // Find primary key of SQLite table
    const info = sqliteDb.prepare(`PRAGMA table_info("${item.table}")`).all();
    const pkCol = info.find(c => c.pk === 1) || info[0];
    const pkName = pkCol ? pkCol.name : null;

    if (pkName) {
      console.log(`Primary Key Column: ${pkName}`);
      const pgPkSet = new Set(pgRows.map(r => String(r[pkName])));
      const missingInPg = sqliteRows.filter(r => !pgPkSet.has(String(r[pkName])));
      console.log(`Missing in Postgres (${missingInPg.length} records):`);
      console.log(JSON.stringify(missingInPg, null, 2));

      // Attempt to find why they were missing by trying an insert and capturing error
      for (const mRow of missingInPg) {
        const cols = Object.keys(mRow);
        const placeholders = cols.map((_, i) => `$${i + 1}`).join(', ');
        const values = cols.map(c => mRow[c]);
        const sql = `INSERT INTO "${item.table}" ("${cols.join('", "')}") VALUES (${placeholders})`;
        try {
          await pool.query(sql, values);
          console.log(`  -> Successfully inserted missing row ${mRow[pkName]} into Postgres!`);
        } catch (insErr) {
          console.log(`  -> INSERT FAILED for row ${mRow[pkName]}: ${insErr.message} (Detail: ${insErr.detail || 'None'})`);
        }
      }
    }
  }

  await pool.end();
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
