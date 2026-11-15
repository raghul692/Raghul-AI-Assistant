import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  initDatabase,
  listChatsDb,
  listArchivedChatsDb,
  archiveChatDb,
  unarchiveChatDb,
  archiveAllChatsDb,
  deleteAllChatsDb,
  getChatDb,
  createOrUpdateChatDb,
  renameChatDb,
  deleteChatDb,
  searchFullText as searchFullTextDb
} from './db.js';
import { getPostgresPool, pgQuery, pgQueryAll } from './database/postgresPool.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, 'data');
const CHATS_FILE = path.join(DATA_DIR, 'chats.json');

// Initialize SQLite schema & auto-migrate from chats.json if needed
initDatabase();

// In-memory cache for ultra-fast access
const chatsCache = new Map();

function loadCacheFromDb() {
  try {
    const list = listChatsDb();
    for (const item of list) {
      const fullChat = getChatDb(item.id);
      if (fullChat) {
        chatsCache.set(fullChat.id, fullChat);
      }
    }
  } catch (err) {
    console.warn('Cache warm-up notice:', err.message);
  }
}

loadCacheFromDb();

// Hydrate from Supabase PostgreSQL when running in production cloud mode
async function hydrateChatsFromPostgres() {
  if (!getPostgresPool()) return;
  try {
    const chats = await pgQueryAll('SELECT * FROM chats ORDER BY updated_at DESC LIMIT 200');
    if (!chats || chats.length === 0) return;

    const chatIds = chats.map(c => c.id);
    const messages = await pgQueryAll(
      'SELECT id, chat_id, role, text, timestamp, metadata FROM messages WHERE chat_id = ANY($1) ORDER BY timestamp ASC',
      [chatIds]
    );

    const msgsByChatId = new Map();
    for (const m of messages) {
      if (!msgsByChatId.has(m.chat_id)) msgsByChatId.set(m.chat_id, []);
      let meta = {};
      try { meta = JSON.parse(m.metadata || '{}'); } catch (_) {}
      msgsByChatId.get(m.chat_id).push({
        id: m.id,
        role: m.role,
        text: m.text,
        timestamp: Number(m.timestamp),
        ...meta
      });
    }

    for (const c of chats) {
      const fullChat = {
        id: c.id,
        title: c.title,
        persona: c.persona || 'assistant',
        createdAt: Number(c.created_at),
        updatedAt: Number(c.updated_at),
        is_archived: c.is_archived ? 1 : 0,
        archived_at: c.archived_at ? Number(c.archived_at) : null,
        history: msgsByChatId.get(c.id) || []
      };

      chatsCache.set(fullChat.id, fullChat);
      try {
        createOrUpdateChatDb(fullChat);
      } catch (_) {}
    }
  } catch (err) {
    if (!/Cannot use a pool after calling end/i.test(err.message)) {
      console.warn('[Storage] Notice hydrating from PostgreSQL:', err.message);
    }
  }
}

if (process.env.DATABASE_URL || process.env.SUPABASE_DATABASE_URL) {
  hydrateChatsFromPostgres().catch(() => {});
}

function syncJsonBackup() {
  try {
    const list = Array.from(chatsCache.values());
    fs.writeFileSync(CHATS_FILE, JSON.stringify(list, null, 2), 'utf-8');
  } catch (err) {
    // Non-blocking JSON backup notice
  }
}

export function listChats() {
  return listChatsDb();
}

export function listArchivedChats() {
  return listArchivedChatsDb();
}

export function archiveChat(id) {
  const ok = archiveChatDb(id);
  if (ok && chatsCache.has(id)) {
    const c = chatsCache.get(id);
    c.is_archived = 1;
    c.archived_at = Date.now();
    if (getPostgresPool()) {
      pgQuery('UPDATE chats SET is_archived = 1, archived_at = $1, updated_at = $1 WHERE id = $2', [c.archived_at, id]).catch(() => {});
    }
  }
  return ok;
}

export function unarchiveChat(id) {
  const ok = unarchiveChatDb(id);
  if (ok && chatsCache.has(id)) {
    const c = chatsCache.get(id);
    c.is_archived = 0;
    c.archived_at = null;
    if (getPostgresPool()) {
      pgQuery('UPDATE chats SET is_archived = 0, archived_at = NULL, updated_at = $1 WHERE id = $2', [Date.now(), id]).catch(() => {});
    }
  }
  return ok;
}

export function archiveAllChats() {
  const count = archiveAllChatsDb();
  const now = Date.now();
  for (const c of chatsCache.values()) {
    c.is_archived = 1;
    c.archived_at = now;
  }
  if (getPostgresPool()) {
    pgQuery('UPDATE chats SET is_archived = 1, archived_at = $1, updated_at = $1', [now]).catch(() => {});
  }
  return count;
}

export function deleteAllChats() {
  deleteAllChatsDb();
  chatsCache.clear();
  syncJsonBackup();
  if (getPostgresPool()) {
    pgQuery('DELETE FROM chats').catch(() => {});
  }
  return true;
}

export function getChat(id) {
  if (chatsCache.has(id)) {
    return chatsCache.get(id);
  }
  const chat = getChatDb(id);
  if (chat) {
    chatsCache.set(chat.id, chat);
  }
  return chat;
}

export function createOrUpdateChat(chat) {
  chat.updatedAt = Date.now();
  if (!chat.createdAt) chat.createdAt = Date.now();
  if (!chat.history) chat.history = [];

  // Update in SQLite FTS5 Database
  createOrUpdateChatDb(chat);
  // Update Cache & JSON Backup
  chatsCache.set(chat.id, chat);
  syncJsonBackup();

  // Durably persist to Supabase PostgreSQL when configured
  if (getPostgresPool()) {
    (async () => {
      try {
        await pgQuery(`
          INSERT INTO chats (id, title, persona, is_archived, archived_at, created_at, updated_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
          ON CONFLICT (id) DO UPDATE SET
            title = EXCLUDED.title,
            persona = EXCLUDED.persona,
            is_archived = EXCLUDED.is_archived,
            archived_at = EXCLUDED.archived_at,
            updated_at = EXCLUDED.updated_at
        `, [
          chat.id,
          chat.title || 'New Chat',
          chat.persona || 'assistant',
          chat.is_archived ? 1 : 0,
          chat.archived_at || null,
          chat.createdAt,
          chat.updatedAt
        ]);

        if (Array.isArray(chat.history)) {
          await pgQuery('DELETE FROM messages WHERE chat_id = $1', [chat.id]);
          for (let i = 0; i < chat.history.length; i++) {
            const m = chat.history[i];
            const msgId = `${chat.id}_${i}_${m.timestamp || chat.updatedAt}`;
            const meta = JSON.stringify({
              reasoning: m.reasoning || null,
              toolCalls: m.toolCalls || null,
              model: m.model || null,
              persona: m.persona || null
            });
            await pgQuery(`
              INSERT INTO messages (id, chat_id, role, text, timestamp, metadata)
              VALUES ($1, $2, $3, $4, $5, $6)
            `, [msgId, chat.id, m.role, m.text, m.timestamp || chat.updatedAt, meta]);
          }
        }
      } catch (pgErr) {
        console.warn('[Storage] Notice persisting chat to PostgreSQL:', pgErr.message);
      }
    })();
  }
  return chat;
}

export function renameChat(id, title) {
  const updated = renameChatDb(id, title);
  if (updated) {
    const chat = getChat(id);
    if (chat) {
      chat.title = title.trim();
      chat.updatedAt = Date.now();
      chatsCache.set(id, chat);
      syncJsonBackup();
      if (getPostgresPool()) {
        pgQuery('UPDATE chats SET title = $1, updated_at = $2 WHERE id = $3', [chat.title, chat.updatedAt, id]).catch(() => {});
      }
    }
    return updated;
  }
  return null;
}

export function deleteChat(id) {
  const deleted = deleteChatDb(id);
  chatsCache.delete(id);
  syncJsonBackup();
  if (getPostgresPool()) {
    pgQuery('DELETE FROM chats WHERE id = $1', [id]).catch(() => {});
  }
  return deleted;
}

export function clearChatHistory(id) {
  const chat = getChat(id);
  if (chat) {
    chat.history = [];
    chat.updatedAt = Date.now();
    createOrUpdateChatDb(chat);
    chatsCache.set(id, chat);
    syncJsonBackup();
    return true;
  }
  return false;
}

export function searchFullText(query, limit = 20) {
  return searchFullTextDb(query, limit);
}

export function exportAllChats() {
  return Array.from(chatsCache.values());
}

export function importAllChats(chatsList) {
  if (!Array.isArray(chatsList)) return [];
  const imported = [];
  for (const c of chatsList) {
    if (c && c.id) {
      createOrUpdateChat(c);
      imported.push(c);
    }
  }
  return imported;
}

export function clearAllChats() {
  const all = listChatsDb();
  for (const c of all) {
    deleteChatDb(c.id);
  }
  chatsCache.clear();
  syncJsonBackup();
  return true;
}
