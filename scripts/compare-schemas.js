import fs from 'fs';
import dotenv from 'dotenv';
import pg from 'pg';

dotenv.config();
const { Pool } = pg;

async function check() {
  const inv = JSON.parse(fs.readFileSync('scripts/sqlite_schema_inventory.json', 'utf8'));
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  const client = await pool.connect();
  const alterStatements = [];

  try {
    for (const t of inv) {
      if (t.isFtsShadow) continue;
      const pgColsRes = await client.query(`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = $1
      `, [t.name]);

      const pgCols = new Set(pgColsRes.rows.map(r => r.column_name));

      for (const col of t.columns) {
        if (!pgCols.has(col.name)) {
          let pgType = 'TEXT';
          if (col.type === 'INTEGER') pgType = 'BIGINT';
          if (col.type === 'REAL') pgType = 'DOUBLE PRECISION';
          if (col.type === 'BLOB') pgType = 'BYTEA';

          alterStatements.push(`ALTER TABLE "${t.name}" ADD COLUMN IF NOT EXISTS "${col.name}" ${pgType};`);
        }
      }
    }

    console.log(`Generated ${alterStatements.length} ALTER statements to synchronize schema:`);
    console.log(alterStatements.join('\n'));

    if (alterStatements.length > 0) {
      fs.writeFileSync('migrations/008_align_schema_to_sqlite.sql', alterStatements.join('\n') + '\n');
      console.log('Saved to migrations/008_align_schema_to_sqlite.sql');
    }
  } finally {
    client.release();
    await pool.end();
  }
}

check();
