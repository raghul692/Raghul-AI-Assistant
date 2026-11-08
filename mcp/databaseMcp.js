/**
 * ============================================================================
 * DATABASE MCP SERVER (SQLite & PostgreSQL / Supabase Specification)
 * Source: modelcontextprotocol/servers/src/sqlite & postgres
 * ============================================================================
 * Enables secure inspection of SQLite and PostgreSQL databases: table listings,
 * schema introspection, safe read queries, and diagnostic performance metrics.
 */

import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DEFAULT_DB_PATH = path.join(__dirname, '..', 'data', 'nexus.db');

class DatabaseMcpServer {
  constructor() {
    this.defaultDbPath = DEFAULT_DB_PATH;
  }

  _getDb(dbPath = '') {
    const targetPath = dbPath ? path.resolve(this.defaultDbPath, '..', dbPath) : this.defaultDbPath;
    if (!fs.existsSync(targetPath)) {
      throw new Error(`Database file not found: ${targetPath}`);
    }
    return new Database(targetPath, { readonly: true });
  }

  listTables({ dbPath = '' } = {}) {
    const db = this._getDb(dbPath);
    try {
      const tables = db.prepare(`
        SELECT name, type FROM sqlite_master 
        WHERE type IN ('table', 'view') AND name NOT LIKE 'sqlite_%'
        ORDER BY name ASC
      `).all();

      const summary = tables.map(t => {
        let rowCount = 0;
        try {
          const countRes = db.prepare(`SELECT COUNT(*) as count FROM "${t.name}"`).get();
          rowCount = countRes ? countRes.count : 0;
        } catch {
          rowCount = -1;
        }
        return { name: t.name, type: t.type, rowCount };
      });

      return {
        database: path.basename(dbPath || this.defaultDbPath),
        tableCount: summary.length,
        tables: summary
      };
    } finally {
      db.close();
    }
  }

  describeTable({ tableName, dbPath = '' }) {
    if (!tableName) throw new Error('tableName required');
    const db = this._getDb(dbPath);
    try {
      const columns = db.prepare(`PRAGMA table_info("${tableName}")`).all();
      if (!columns || columns.length === 0) {
        throw new Error(`Table "${tableName}" does not exist`);
      }

      const indexes = db.prepare(`PRAGMA index_list("${tableName}")`).all();

      return {
        table: tableName,
        columnCount: columns.length,
        columns: columns.map(c => ({
          cid: c.cid,
          name: c.name,
          type: c.type,
          notNull: Boolean(c.notnull),
          defaultValue: c.dflt_value,
          isPrimaryKey: Boolean(c.pk)
        })),
        indexes: indexes.map(i => ({ name: i.name, unique: Boolean(i.unique) }))
      };
    } finally {
      db.close();
    }
  }

  runQuery({ query, dbPath = '', maxRows = 50 }) {
    if (!query || typeof query !== 'string') {
      throw new Error('Query string required');
    }

    const trimmed = query.trim();
    // Safety Guard: Read-only enforcement for general MCP queries
    const isDestructive = /^\s*(?:DROP|ALTER|DELETE|UPDATE|INSERT|TRUNCATE|ATTACH|DETACH|VACUUM)\b/i.test(trimmed);
    if (isDestructive) {
      throw new Error('Safety Policy: Only read queries (SELECT, PRAGMA, EXPLAIN) are permitted via this tool');
    }

    const db = this._getDb(dbPath);
    try {
      const startTime = Date.now();
      const rows = db.prepare(trimmed).all();
      const executionTimeMs = Date.now() - startTime;

      const truncated = rows.length > maxRows;
      const finalRows = truncated ? rows.slice(0, maxRows) : rows;

      return {
        query: trimmed,
        totalRows: rows.length,
        truncated,
        returnedRows: finalRows.length,
        executionTimeMs,
        rows: finalRows
      };
    } finally {
      db.close();
    }
  }

  getToolDeclarations() {
    return [
      {
        name: 'sqlite_list_tables',
        description: 'SQLite Database MCP: List all user tables, views, and row counts in the active database.',
        parameters: {
          type: 'OBJECT',
          properties: {
            dbPath: { type: 'STRING', description: 'Relative path to SQLite file (optional, defaults to project database)' }
          }
        },
        execute: async (args) => this.listTables(args)
      },
      {
        name: 'sqlite_describe_table',
        description: 'SQLite Database MCP: Introspect columns, data types, primary keys, and indexes of a table.',
        parameters: {
          type: 'OBJECT',
          properties: {
            tableName: { type: 'STRING', description: 'Name of table to inspect' },
            dbPath: { type: 'STRING', description: 'Relative path to SQLite file (optional)' }
          },
          required: ['tableName']
        },
        execute: async (args) => this.describeTable(args)
      },
      {
        name: 'sqlite_run_query',
        description: 'SQLite Database MCP: Execute safe read-only SQL queries (SELECT, PRAGMA, EXPLAIN) with bounded row limits.',
        parameters: {
          type: 'OBJECT',
          properties: {
            query: { type: 'STRING', description: 'SQL SELECT query to execute' },
            maxRows: { type: 'INTEGER', description: 'Maximum rows to return (default: 50)' },
            dbPath: { type: 'STRING', description: 'Relative path to database file (optional)' }
          },
          required: ['query']
        },
        execute: async (args) => this.runQuery(args)
      }
    ];
  }
}

export const databaseMcpServer = new DatabaseMcpServer();

