import Database from 'better-sqlite3';

const db = new Database('data/nexus.db', { readonly: true });
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all();
console.log('Total user tables in data/nexus.db:', tables.length);

const summary = [];
for (const t of tables) {
  try {
    const count = db.prepare(`SELECT count(*) as c FROM "${t.name}"`).get().c;
    summary.push({ name: t.name, count });
  } catch (err) {
    summary.push({ name: t.name, count: 'N/A: ' + err.message });
  }
}
console.table(summary);
