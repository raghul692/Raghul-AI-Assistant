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
  }
  return ok;
}

export function unarchiveChat(id) {
  const ok = unarchiveChatDb(id);
  if (ok && chatsCache.has(id)) {
    const c = chatsCache.get(id);
    c.is_archived = 0;
    c.archived_at = null;
  }
  return ok;
}

export function archiveAllChats() {
  const count = archiveAllChatsDb();
  for (const c of chatsCache.values()) {
    c.is_archived = 1;
    c.archived_at = Date.now();
  }
  return count;
}

export function deleteAllChats() {
  deleteAllChatsDb();
  chatsCache.clear();
  syncJsonBackup();
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
    }
    return updated;
  }
  return null;
}

export function deleteChat(id) {
  const deleted = deleteChatDb(id);
  chatsCache.delete(id);
  syncJsonBackup();
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
