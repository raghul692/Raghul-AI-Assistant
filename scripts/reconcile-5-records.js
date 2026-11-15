import Database from 'better-sqlite3';
import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const db = new Database('data/nexus.db', { readonly: true });
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function fixAndMigrate() {
  const client = await pool.connect();
  try {
    console.log('Relaxing obsolete NOT NULL constraints in PostgreSQL...');
    await client.query(`
      ALTER TABLE audit_ledger_checkpoints ALTER COLUMN "timestamp" DROP NOT NULL;
      ALTER TABLE audit_ledger_checkpoints ALTER COLUMN "up_to_audit_id" DROP NOT NULL;
      ALTER TABLE audit_ledger_checkpoints ALTER COLUMN "accumulated_hash" DROP NOT NULL;
      ALTER TABLE audit_ledger_checkpoints ALTER COLUMN "signed_by" DROP NOT NULL;
      ALTER TABLE audit_ledger_checkpoints ALTER COLUMN "log_count" DROP NOT NULL;
      ALTER TABLE provider_settings ALTER COLUMN "value" DROP NOT NULL;
    `);
    console.log('Constraints updated successfully.');

    // Now insert the 4 audit_ledger_checkpoints
    const sChk = db.prepare('SELECT * FROM audit_ledger_checkpoints').all();
    for (const row of sChk) {
      const keys = Object.keys(row);
      const placeholders = keys.map((_, i) => '$' + (i+1)).join(', ');
      await client.query(`
        INSERT INTO audit_ledger_checkpoints (${keys.map(k=>'"'+k+'"').join(',')})
        VALUES (${placeholders})
        ON CONFLICT DO NOTHING
      `, Object.values(row));
      console.log('Migrated checkpoint:', row.checkpoint_id);
    }

    // Now insert the 1 provider_settings
    const sProv = db.prepare('SELECT * FROM provider_settings').all();
    for (const row of sProv) {
      const keys = Object.keys(row);
      const placeholders = keys.map((_, i) => '$' + (i+1)).join(', ');
      await client.query(`
        INSERT INTO provider_settings (${keys.map(k=>'"'+k+'"').join(',')})
        VALUES (${placeholders})
        ON CONFLICT DO NOTHING
      `, Object.values(row));
      console.log('Migrated provider_settings:', row.id);
    }

    const chkCount = await client.query('SELECT count(*) as c FROM audit_ledger_checkpoints');
    const provCount = await client.query('SELECT count(*) as c FROM provider_settings');
    console.log('Postgres audit_ledger_checkpoints count:', chkCount.rows[0].c);
    console.log('Postgres provider_settings count:', provCount.rows[0].c);
  } finally {
    db.close();
    client.release();
    await pool.end();
  }
}

fixAndMigrate().catch(console.error);
