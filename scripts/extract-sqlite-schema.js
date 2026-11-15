import Database from 'better-sqlite3';
import fs from 'fs';

const db = new Database('data/nexus.db', { readonly: true });
const tables = db.prepare("SELECT name, sql FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all();

console.log(`Found ${tables.length} tables in data/nexus.db`);

const schemaInventory = [];

for (const t of tables) {
  // If it's an FTS shadow table, record as FTS shadow
  const isFtsShadow = t.name.includes('_fts_') || t.name.endsWith('_fts');
  const count = db.prepare(`SELECT count(*) as count FROM "${t.name}"`).get().count;
  const colInfo = db.prepare(`PRAGMA table_info("${t.name}")`).all();
  const fkInfo = db.prepare(`PRAGMA foreign_key_list("${t.name}")`).all();
  const indexInfo = db.prepare(`PRAGMA index_list("${t.name}")`).all();

  schemaInventory.push({
    name: t.name,
    isFtsShadow,
    count,
    sql: t.sql,
    columns: colInfo.map(c => ({ cid: c.cid, name: c.name, type: c.type, notnull: c.notnull, dflt_value: c.dflt_value, pk: c.pk })),
    foreignKeys: fkInfo.map(f => ({ table: f.table, from: f.from, to: f.to, on_delete: f.on_delete })),
    indexes: indexInfo.map(i => ({ name: i.name, unique: i.unique }))
  });
}

fs.writeFileSync('scripts/sqlite_schema_inventory.json', JSON.stringify(schemaInventory, null, 2));
console.log('Saved sqlite_schema_inventory.json successfully.');
