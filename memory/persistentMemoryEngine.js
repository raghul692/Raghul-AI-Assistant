/**
 * Advanced Persistent Memory System (Provider-Independent)
 * 
 * Subsystems:
 * 1. Short-Term Memory: Sliding window recent turns & active session state
 * 2. Long-Term Memory: User preferences, instructions, ongoing projects & verified facts
 * 3. Semantic Memory: TF-IDF vector & cosine similarity ranking over history & facts
 * 4. Automatic Summarization: Context compression preserving critical decisions & unresolved tasks
 * 5. Memory Management: Deduplication, relevance scoring, PII/secret scrubbing, CRUD APIs
 */

import { db } from '../db.js';

// 1. Initialize Tables for Persistent Memory
export function initMemoryTables() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS user_memories (
      id TEXT PRIMARY KEY,
      category TEXT NOT NULL, -- 'preference', 'instruction', 'project', 'fact', 'context'
      content TEXT NOT NULL,
      importance REAL DEFAULT 0.5,
      access_count INTEGER DEFAULT 0,
      last_accessed INTEGER,
      expires_at INTEGER,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_memories_category ON user_memories(category);
    CREATE INDEX IF NOT EXISTS idx_memories_importance ON user_memories(importance DESC);

    CREATE TABLE IF NOT EXISTS conversation_summaries (
      chat_id TEXT PRIMARY KEY,
      summary TEXT NOT NULL,
      key_decisions TEXT,
      unresolved_tasks TEXT,
      last_summarized_msg_idx INTEGER DEFAULT 0,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (chat_id) REFERENCES chats(id) ON DELETE CASCADE
    );
  `);

  // Seed initial user profile memory if empty
  const count = db.prepare('SELECT count(*) as count FROM user_memories').get();
  if (count.count === 0) {
    saveUserMemory({
      category: 'preference',
      content: 'User prefers concise, high-signal explanations with practical code examples.',
      importance: 0.9
    });
    saveUserMemory({
      category: 'instruction',
      content: 'Bilingual proficiency: Fluent in English, Tamil, and Tanglish conversational tone.',
      importance: 0.95
    });
    saveUserMemory({
      category: 'project',
      content: 'Nexus AI Chatbot & Multi-Provider Autonomous Agent Orchestration Platform.',
      importance: 0.85
    });
  }
}

// Ensure tables exist on load
initMemoryTables();

// 2. Secret & Sensitive Data Redactor (Prevent credential leaks in memory)
export function sanitizeMemoryContent(text = '') {
  if (typeof text !== 'string') return '';
  return text
    .replace(/(?:gsk_|nvapi-|sk-or-v1-|AQ\.A|cfut_)[a-zA-Z0-9_-]{10,}/gi, '[REDACTED_API_KEY]')
    .replace(/bearer\s+[a-zA-Z0-9_\-\.]{15,}/gi, 'Bearer [REDACTED_TOKEN]')
    .replace(/(?:password|secret|pwd)\s*[:=]\s*["']?[^\s"';]+["']?/gi, 'password=[REDACTED]');
}

// 3. Long-Term Memory CRUD Operations
export function saveUserMemory({
  id = null,
  category = 'fact',
  content,
  importance = 0.5,
  expiresAt = null
}) {
  if (!content || !content.trim()) return null;
  const cleanContent = sanitizeMemoryContent(content.trim());
  const now = Date.now();
  const memId = id || `mem_${now}_${Math.random().toString(36).slice(2, 7)}`;

  // Deduplication check: check if identical or near-identical fact exists
  const existing = db.prepare('SELECT id, content FROM user_memories WHERE category = ?').all(category);
  for (const item of existing) {
    if (item.id !== memId && calculateSimilarity(item.content, cleanContent) > 0.85) {
      // Update importance of existing memory rather than duplicating
      db.prepare('UPDATE user_memories SET importance = MAX(importance, ?), updated_at = ? WHERE id = ?')
        .run(importance, now, item.id);
      return getUserMemory(item.id);
    }
  }

  const stmt = db.prepare(`
    INSERT INTO user_memories (id, category, content, importance, created_at, updated_at, expires_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      category = excluded.category,
      content = excluded.content,
      importance = excluded.importance,
      updated_at = excluded.updated_at,
      expires_at = excluded.expires_at
  `);

  stmt.run(memId, category, cleanContent, importance, now, now, expiresAt);
  return getUserMemory(memId);
}

export function getUserMemory(id) {
  return db.prepare('SELECT * FROM user_memories WHERE id = ?').get(id);
}

export function listUserMemories(category = null) {
  const now = Date.now();
  if (category) {
    return db.prepare(`
      SELECT * FROM user_memories 
      WHERE category = ? AND (expires_at IS NULL OR expires_at > ?)
      ORDER BY importance DESC, updated_at DESC
    `).all(category, now);
  }
  return db.prepare(`
    SELECT * FROM user_memories 
    WHERE (expires_at IS NULL OR expires_at > ?)
    ORDER BY importance DESC, updated_at DESC
  `).all(now);
}

export function deleteUserMemory(id) {
  const info = db.prepare('DELETE FROM user_memories WHERE id = ?').run(id);
  return info.changes > 0;
}

export function clearUserMemories() {
  db.prepare('DELETE FROM user_memories').run();
  return true;
}

// 4. Semantic Memory: Vector Cosine Similarity Search
function tokenize(text = '') {
  return text
    .toLowerCase()
    .replace(/[^\w\s\u0B80-\u0BFF]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length > 2);
}

function calculateTfIdfVector(tokens, vocabulary) {
  const vec = new Float32Array(vocabulary.length);
  const tf = {};
  for (const t of tokens) {
    tf[t] = (tf[t] || 0) + 1;
  }
  for (let i = 0; i < vocabulary.length; i++) {
    const term = vocabulary[i];
    vec[i] = tf[term] || 0;
  }
  // Normalize vector
  let norm = 0;
  for (let i = 0; i < vec.length; i++) norm += vec[i] * vec[i];
  norm = Math.sqrt(norm);
  if (norm > 0) {
    for (let i = 0; i < vec.length; i++) vec[i] /= norm;
  }
  return vec;
}

function cosineSimilarity(vecA, vecB) {
  if (vecA.length !== vecB.length) return 0;
  let dot = 0;
  for (let i = 0; i < vecA.length; i++) {
    dot += vecA[i] * vecB[i];
  }
  return dot;
}

export function calculateSimilarity(textA = '', textB = '') {
  const tokensA = tokenize(textA);
  const tokensB = tokenize(textB);
  if (tokensA.length === 0 || tokensB.length === 0) return 0;

  const vocab = [...new Set([...tokensA, ...tokensB])];
  const vecA = calculateTfIdfVector(tokensA, vocab);
  const vecB = calculateTfIdfVector(tokensB, vocab);
  return cosineSimilarity(vecA, vecB);
}

/**
 * Retrieve top relevant memories for a user query
 */
export function searchSemanticMemories(query = '', topK = 4) {
  if (!query || !query.trim()) return [];
  const memories = listUserMemories();
  if (memories.length === 0) return [];

  const scored = memories.map(mem => {
    const similarity = calculateSimilarity(query, mem.content);
    // Combined score: semantic similarity + importance weighting
    const combinedScore = (similarity * 0.7) + (mem.importance * 0.3);
    return { ...mem, similarity, combinedScore };
  });

  scored.sort((a, b) => b.combinedScore - a.combinedScore);
  const relevant = scored.filter(s => s.combinedScore > 0.15).slice(0, topK);

  // Update access count and timestamp
  if (relevant.length > 0) {
    const now = Date.now();
    const updateStmt = db.prepare('UPDATE user_memories SET access_count = access_count + 1, last_accessed = ? WHERE id = ?');
    for (const r of relevant) {
      updateStmt.run(now, r.id);
    }
  }

  return relevant;
}

// 5. Conversation Summarization & Context Compression
export function getConversationSummary(chatId) {
  if (!chatId) return null;
  return db.prepare('SELECT * FROM conversation_summaries WHERE chat_id = ?').get(chatId);
}

export function saveConversationSummary(chatId, { summary, keyDecisions = '', unresolvedTasks = '', lastIdx = 0 }) {
  if (!chatId || !summary) return null;
  const now = Date.now();
  const stmt = db.prepare(`
    INSERT INTO conversation_summaries (chat_id, summary, key_decisions, unresolved_tasks, last_summarized_msg_idx, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(chat_id) DO UPDATE SET
      summary = excluded.summary,
      key_decisions = excluded.key_decisions,
      unresolved_tasks = excluded.unresolved_tasks,
      last_summarized_msg_idx = excluded.last_summarized_msg_idx,
      updated_at = excluded.updated_at
  `);
  stmt.run(chatId, summary, keyDecisions, unresolvedTasks, lastIdx, now);
  return getConversationSummary(chatId);
}

/**
 * Checks if conversation should be summarized and compresses history
 */
export async function checkAndSummarizeConversation(chat, orchestrator) {
  if (!chat || !chat.history || chat.history.length < 12) return;
  const existing = getConversationSummary(chat.id);
  const lastIdx = existing ? existing.last_summarized_msg_idx : 0;
  
  // Summarize if 8 new turns have occurred since last summary
  if (chat.history.length - lastIdx >= 8) {
    try {
      const messagesToSummarize = chat.history.slice(lastIdx);
      const textBlock = messagesToSummarize.map(m => `${m.role.toUpperCase()}: ${m.text || ''}`).join('\n');

      const prompt = `You are a conversational context compression engine.
Summarize the key information, decisions, and any unresolved tasks from this conversation snippet into a concise briefing.
Preserve technical details, project stack, user decisions, and pending tasks.

Format as JSON:
{
  "summary": "Concise 2-3 sentence overview of what was discussed and solved",
  "keyDecisions": "Bullet points of confirmed decisions or architecture choices",
  "unresolvedTasks": "Any pending items user or assistant still need to complete"
}

Conversation:
${textBlock.slice(0, 3000)}`;

      if (orchestrator && typeof orchestrator.generateText === 'function') {
        const result = await orchestrator.generateText({
          prompt,
          taskCategory: 'summarization',
          maxTokens: 500
        });

        const jsonMatch = result.text.match(/\{[\s\S]*?\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          saveConversationSummary(chat.id, {
            summary: parsed.summary || 'Ongoing technical conversation',
            keyDecisions: parsed.keyDecisions || '',
            unresolvedTasks: parsed.unresolvedTasks || '',
            lastIdx: chat.history.length
          });
        }
      }
    } catch (err) {
      console.warn('Auto-summarization notice:', err.message);
    }
  }
}

// 6. Unified Context Assembler (Provider-Independent)
export function buildUnifiedContext({
  chatId,
  personaConfig,
  baseInstruction,
  userMessage = '',
  history = [],
  maxRecentTurns = 12,
  userName = 'Raghul',
  userRole = 'Full-Stack Software Engineer'
}) {
  // A. Semantic Search over long-term memories
  const relevantMemories = searchSemanticMemories(userMessage, 4);

  // B. Active Conversation Summary
  const summaryRow = getConversationSummary(chatId);

  // C. Short-Term History (Sliding Window)
  const recentHistory = history.length > maxRecentTurns ? history.slice(-maxRecentTurns) : history;

  // D. Build Unified System Directive
  let unifiedSystemPrompt = baseInstruction || personaConfig?.systemPrompt || 'You are Nexus AI, an advanced conversational companion.';

  // Add Temporal Context (only if not already present)
  if (!unifiedSystemPrompt.includes('[Context: Current local date & time')) {
    unifiedSystemPrompt += `\n\n[Context: Current local date & time is ${new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata', dateStyle: 'full', timeStyle: 'short' })}]`;
  }

  // Add User Profile & Long-Term Memory (avoid duplicate profile headers)
  if (!unifiedSystemPrompt.includes('USER IDENTITY CONTEXT') && !unifiedSystemPrompt.includes('USER PROFILE')) {
    unifiedSystemPrompt += `\n\n### 👤 USER PROFILE & PERSISTENT MEMORY:
- Name: ${userName}
- Role: ${userRole}`;
  }

  if (relevantMemories.length > 0 && !unifiedSystemPrompt.includes('Recalled Long-Term Facts:')) {
    unifiedSystemPrompt += `\n\n### 🧠 RECALLED PERSISTENT MEMORIES:\n` + relevantMemories.map(m => `  * [${m.category.toUpperCase()}] ${m.content}`).join('\n');
  }

  // Add Active Conversation Summary if available
  if (summaryRow && summaryRow.summary) {
    unifiedSystemPrompt += `\n\n### 📝 PREVIOUS CONVERSATION CONTEXT SUMMARY:
${summaryRow.summary}`;
    if (summaryRow.key_decisions) {
      unifiedSystemPrompt += `\nKey Decisions: ${summaryRow.key_decisions}`;
    }
    if (summaryRow.unresolved_tasks) {
      unifiedSystemPrompt += `\nUnresolved Tasks: ${summaryRow.unresolved_tasks}`;
    }
  }

  // Ensure Language Invariant is always reinforced
  if (!unifiedSystemPrompt.includes('MANDATORY LANGUAGE INVARIANT')) {
    unifiedSystemPrompt += `\n\n### 🌐 MANDATORY LANGUAGE INVARIANT:
- Respond ONLY in **English** or **Tanglish** (Tamil written phonetically using the English/Latin alphabet).
- STRICT PROHIBITION: DO NOT output any Tamil script characters (U+0B80–U+0BFF).
- When the user communicates in Tamil or Tanglish, reply in conversational Tanglish using English letters.
- When the user communicates in English, reply in English.`;
  }

  return {
    systemInstruction: unifiedSystemPrompt,
    recentHistory,
    relevantMemories,
    activeSummary: summaryRow
  };
}

