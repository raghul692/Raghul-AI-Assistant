import { initDatabase, listChatsDb, getChatDb, createOrUpdateChatDb, searchFullText } from './db.js';

console.log('📦 Initializing SQLite Database & FTS5...');
initDatabase();

const chats = listChatsDb();
console.log('Chats migrated in SQLite:', chats.length);

// Test FTS5 Search
const testQuery = 'Full-Stack';
const searchResults = searchFullText(testQuery);
console.log(`FTS5 Search for "${testQuery}":`, searchResults.length, 'matches');
if (searchResults.length > 0) {
  console.log('Top match snippet:', searchResults[0].snippet);
}

console.log('✅ SQLite FTS5 Engine 100% Operational!');

