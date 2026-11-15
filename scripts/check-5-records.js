import Database from 'better-sqlite3';
import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const db = new Database('data/nexus.db');
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function check() {
  console.log('--- audit_ledger_checkpoints in SQLite ---');
  const sChk = db.prepare('SELECT * FROM audit_ledger_checkpoints').all();
  console.log(sChk);

  console.log('--- audit_ledger_checkpoints table info in SQLite ---');
  console.log(db.prepare('PRAGMA table_info(audit_ledger_checkpoints)').all());

  console.log('--- provider_settings in SQLite ---');
  const sProv = db.prepare('SELECT * FROM provider_settings').all();
  console.log(sProv);

  console.log('--- provider_settings table info in SQLite ---');
  console.log(db.prepare('PRAGMA table_info(provider_settings)').all());

  const client = await pool.connect();
  try {
    console.log('--- audit_ledger_checkpoints columns in PostgreSQL ---');
    const pgChkCols = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'audit_ledger_checkpoints'
    `);
    console.log(pgChkCols.rows);

    console.log('--- provider_settings columns in PostgreSQL ---');
    const pgProvCols = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'provider_settings'
    `);
    console.log(pgProvCols.rows);

    console.log('\nTrying dry insert of audit_ledger_checkpoints into PG:');
    for (const row of sChk) {
      try {
        const keys = Object.keys(row);
        const placeholders = keys.map((_, i) => '$' + (i+1)).join(', ');
        // Don't commit yet, use ROLLBACK
        await client.query('BEGIN');
        await client.query(`INSERT INTO audit_ledger_checkpoints (${keys.map(k=>'"'+k+'"').join(',')}) VALUES (${placeholders})`, Object.values(row));
        await client.query('ROLLBACK');
        console.log('Valid insert for checkpoint_id:', row.checkpoint_id);
      } catch (e) {
        await client.query('ROLLBACK').catch(()=>{});
        console.error('Insert error on checkpoint_id ' + row.checkpoint_id + ':', e.message);
      }
    }

    console.log('\nTrying dry insert of provider_settings into PG:');
    for (const row of sProv) {
      try {
        const keys = Object.keys(row);
        const placeholders = keys.map((_, i) => '$' + (i+1)).join(', ');
        await client.query('BEGIN');
        await client.query(`INSERT INTO provider_settings (${keys.map(k=>'"'+k+'"').join(',')}) VALUES (${placeholders})`, Object.values(row));
        await client.query('ROLLBACK');
        console.log('Valid insert for provider_settings id:', row.id);
      } catch (e) {
        await client.query('ROLLBACK').catch(()=>{});
        console.error('Insert error on provider_settings id ' + row.id + ':', e.message);
      }
    }
  } finally {
    client.release();
    await pool.end();
  }
}
check().catch(console.error);
