import dotenv from 'dotenv';
dotenv.config();
import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function run() {
  try {
    const res = await pool.query(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name"
    );
    console.log('Tables currently in public schema in Supabase:', res.rows.length);
    console.log(JSON.stringify(res.rows.map(r => r.table_name), null, 2));

    const extensions = await pool.query("SELECT extname, extversion FROM pg_extension");
    console.log('Extensions in Supabase:', extensions.rows);
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await pool.end();
  }
}

run();
