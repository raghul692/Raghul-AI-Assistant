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
    .replace(/[^\w\s]/g, ' ')
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

// 5. High-Precision User Fact & Preference Extractor
export function extractAndSaveFacts(userMessage = '') {
  if (!userMessage || typeof userMessage !== 'string' || userMessage.trim().length < 4) return [];
  const text = userMessage.trim();
  const extracted = [];

  // 1. Name patterns
  const nameMatch = text.match(/(?:my name is|i am|call me|en peyar)\s+([A-Za-z\s]{2,30})/i);
  if (nameMatch && !/(?:trying|going|building|working|looking|coding)/i.test(nameMatch[1])) {
    const name = nameMatch[1].trim().replace(/[.,!?;]+$/, '');
    if (name.length >= 2 && name.length <= 30) {
      const saved = saveUserMemory({
        category: 'preference',
        content: `User's name is ${name}.`,
        importance: 0.95
      });
      if (saved) extracted.push(saved);
    }
  }

  // 2. Role & Profession patterns
  const roleMatch = text.match(/(?:i work as(?: a| an)?|i am a(?:n)?|my role is(?: a| an)?|working as(?: a| an)?)\s+([A-Za-z0-9\s\-]{3,40})/i);
  if (roleMatch && !/(?:user|beginner|fan|person|human|trying|wondering)/i.test(roleMatch[1])) {
    const role = roleMatch[1].trim().replace(/[.,!?;]+$/, '');
    if (role.length >= 3 && role.length <= 40) {
      const saved = saveUserMemory({
        category: 'preference',
        content: `User's professional role: ${role}.`,
        importance: 0.9
      });
      if (saved) extracted.push(saved);
    }
  }

  // 3. Tech Stack & Language patterns
  const techMatch = text.match(/(?:my (?:tech )?stack is|i (?:usually )?(?:use|build with|develop with|code in)|we use)\s+([A-Za-z0-9,.\s\+\#]{3,60})/i);
  if (techMatch) {
    const stack = techMatch[1].trim().replace(/[.,!?;]+$/, '');
    if (stack.length >= 3 && !/(?:it|this|that|something|nothing)/i.test(stack)) {
      const saved = saveUserMemory({
        category: 'preference',
        content: `User tech stack & tools: ${stack}.`,
        importance: 0.88
      });
      if (saved) extracted.push(saved);
    }
  }

  // 4. Database patterns
  const dbMatch = text.match(/(?:my (?:favorite )?(?:database|db) is|favorite db is|db is|database is)\s+([A-Za-z0-9\s]{3,30})/i);
  if (dbMatch) {
    const dbName = dbMatch[1].trim().replace(/[.,!?;]+$/, '');
    const saved = saveUserMemory({
      category: 'preference',
      content: `User preferred database: ${dbName}.`,
      importance: 0.85
    });
    if (saved) extracted.push(saved);
  }

  // 5. Active Project patterns
  const projectMatch = text.match(/(?:i am building|working on a project called|my project is|building an?)\s+([A-Za-z0-9\s\-_]{3,50})/i);
  if (projectMatch && !/(?:code|website|app|system|logic)/i.test(projectMatch[1].trim())) {
    const project = projectMatch[1].trim().replace(/[.,!?;]+$/, '');
    const saved = saveUserMemory({
      category: 'project',
      content: `Current user project: ${project}.`,
      importance: 0.86
    });
    if (saved) extracted.push(saved);
  }

  // 6. Conciseness / Communication preference
  if (/(?:keep (?:it|answers|your\s+answers|explanations|responses) (?:short|concise|brief)|be brief|no fluff|less talking|avoid fluff)/i.test(text)) {
    const saved = saveUserMemory({
      category: 'instruction',
      content: 'User prefers concise, high-signal explanations with minimal fluff.',
      importance: 0.92
    });
    if (saved) extracted.push(saved);
  }

  // 7. Language tone preference
  if (/(?:talk (?:to me )?in tanglish|reply in tanglish|tanglish la pesu|conversational tanglish)/i.test(text)) {
    const saved = saveUserMemory({
      category: 'instruction',
      content: 'User prefers responses in conversational Tanglish using Latin script.',
      importance: 0.94
    });
    if (saved) extracted.push(saved);
  } else if (/(?:reply in english only|english la mattum|only english please)/i.test(text)) {
    const saved = saveUserMemory({
      category: 'instruction',
      content: 'User prefers responses in direct, professional English only.',
      importance: 0.94
    });
    if (saved) extracted.push(saved);
  }

  return extracted;
}

// 6. Follow-Up Query Resolver (Anaphora & Reference Resolution)
export function resolveFollowUpContext(query = '', history = []) {
  if (!query || typeof query !== 'string') return '';
  const clean = query.trim();

  // If query is short or has pronouns ("it", "that", "this", "they", "the first one", "which one", "why")
  const isAnaphoric = clean.split(/\s+/).length <= 4 || 
    /\b(it|that|this|they|them|these|those|which|first|second|former|latter|why|how|explain|compare|difference)\b/i.test(clean);

  if (!isAnaphoric || !Array.isArray(history) || history.length === 0) {
    return clean;
  }

  // Extract key terms from the most recent assistant and user turns
  const recentTurns = history.slice(-2);
  const contextWords = [];
  for (const turn of recentTurns) {
    if (turn.text) {
      // Extract code tokens, PascalCase, CamelCase, or technical nouns
      const matches = turn.text.match(/\b([A-Z][a-zA-Z0-9]+|[a-z]+[A-Z][a-zA-Z0-9]*|[a-zA-Z0-9_\-\.]{4,})\b/g);
      if (matches) {
        contextWords.push(...matches.slice(0, 8));
      }
    }
  }

  const uniqueContext = [...new Set(contextWords)].slice(0, 6).join(' ');
  return uniqueContext ? `${clean} (${uniqueContext})` : clean;
}

// 7. In-Session Deep Recall (Search turns older than the sliding window)
export function searchInSessionHistory(query = '', history = [], maxRecentTurns = 12) {
  if (!query || !Array.isArray(history) || history.length <= maxRecentTurns) return [];
  const olderTurns = history.slice(0, -maxRecentTurns);
  if (olderTurns.length === 0) return [];

  const tokensQuery = tokenize(query);
  if (tokensQuery.length === 0) return [];

  const scoredTurns = [];
  for (let i = 0; i < olderTurns.length; i++) {
    const turn = olderTurns[i];
    const sim = calculateSimilarity(query, turn.text || '');
    if (sim > 0.12) {
      scoredTurns.push({
        index: i + 1,
        role: turn.role,
        text: turn.text || '',
        score: sim
      });
    }
  }

  scoredTurns.sort((a, b) => b.score - a.score);
  return scoredTurns.slice(0, 3);
}

// 8. Cross-Session Chat History Recall
export function isPastChatRecallIntent(query = '') {
  if (!query || typeof query !== 'string') return false;
  return /(?:previous|past|other|earlier|last|yesterday|before)\s*(?:chat|conversation|discussion|session|message|topic)|(?:did we (?:talk|discuss|mention|say)|what did (?:we|i|you) (?:discuss|talk|say)|recall (?:our|the|my) (?:previous|past|earlier|last)|search (?:my )?(?:past|previous|old) (?:chats|conversations))/i.test(query);
}

export function searchPastConversations(query = '', currentChatId = null, limit = 4) {
  if (!query || typeof query !== 'string') return [];
  try {
    const clean = query
      .replace(/(?:what did we discuss|what did we talk about|did we talk about|recall our|in our|previous|past|chats?|conversations?|sessions?)/gi, '')
      .trim();
    const searchQuery = clean.length > 2 ? clean : query;

    // FTS5 and SQLite query across all chats
    const tokens = tokenize(searchQuery);
    if (tokens.length === 0) return [];

    const ftsPattern = tokens.map(t => `"${t.replace(/["*]/g, '')}"*`).join(' OR ');
    const stmt = db.prepare(`
      SELECT 
        m.chat_id,
        c.title as chat_title,
        m.role,
        m.text,
        m.timestamp,
        snippet(messages_fts, 2, '<b>', '</b>', '...', 20) as snippet
      FROM messages_fts f
      JOIN messages m ON f.message_id = m.id
      JOIN chats c ON m.chat_id = c.id
      WHERE messages_fts MATCH ? AND m.chat_id != ?
      ORDER BY bm25(messages_fts)
      LIMIT ?
    `);

    const rows = stmt.all(ftsPattern, currentChatId || '', limit);
    return rows.map(r => ({
      chatId: r.chat_id,
      chatTitle: r.chat_title,
      role: r.role,
      timestamp: r.timestamp,
      snippet: r.snippet || (r.text ? r.text.slice(0, 160) : '')
    }));
  } catch (err) {
    console.warn('Past conversation search notice:', err.message);
    return [];
  }
}

// 9. Conversation Summarization & Context Compression
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
 * Heuristic Extractive Summarizer fallback (Guarantees robust summary even without LLM)
 */
function createExtractiveSummary(messages = []) {
  const topics = [];
  const decisions = [];
  const pending = [];

  for (const m of messages) {
    const text = m.text || '';
    if (m.role === 'user') {
      const qMatch = text.match(/(?:how (?:to|can)|what is|explain|why|compare|implement|create|deploy|write)\s+([^?.!\n]{5,50})/i);
      if (qMatch) {
        topics.push(qMatch[0].trim());
      } else if (text.length > 5 && text.length < 80) {
        topics.push(text.trim());
      }
    } else {
      if (/(?:decided|configured|recommended|chosen|selected|architecture|implemented)\b/i.test(text)) {
        const sentence = text.split(/[.\n]/).find(s => /(?:recommend|use|configure|setup|install)\b/i.test(s));
        if (sentence && sentence.trim().length > 10) {
          decisions.push(sentence.trim().slice(0, 100));
        }
      }
      if (/(?:next step|todo|remaining|need to|pending|later)\b/i.test(text)) {
        const sentence = text.split(/[.\n]/).find(s => /(?:next|todo|pending)\b/i.test(s));
        if (sentence && sentence.trim().length > 10) {
          pending.push(sentence.trim().slice(0, 100));
        }
      }
    }
  }

  const uniqueTopics = [...new Set(topics)].slice(0, 4);
  const overview = uniqueTopics.length > 0 
    ? `Discussion covering: ${uniqueTopics.join('; ')}.`
    : 'Ongoing technical conversation with active solutions and explanations.';

  return {
    summary: overview,
    keyDecisions: decisions.slice(0, 3).join('; ') || 'Followed modular, test-driven implementation patterns.',
    unresolvedTasks: pending.slice(0, 2).join('; ') || 'None pending'
  };
}

/**
 * Checks if conversation should be summarized and compresses history
 */
export async function checkAndSummarizeConversation(chat, orchestrator) {
  if (!chat || !chat.history || chat.history.length < 8) return;
  const existing = getConversationSummary(chat.id);
  const lastIdx = existing ? existing.last_summarized_msg_idx : 0;
  
  // Summarize if 6 new turns have occurred since last summary
  if (chat.history.length - lastIdx >= 6) {
    const messagesToSummarize = chat.history.slice(lastIdx);
    const textBlock = messagesToSummarize.map(m => `${m.role.toUpperCase()}: ${m.text || ''}`).join('\n');

    let summaryData = null;

    if (orchestrator && typeof orchestrator.generateText === 'function') {
      try {
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

        const result = await orchestrator.generateText({
          prompt,
          taskCategory: 'summarization',
          maxTokens: 500
        });

        if (result && result.text) {
          const jsonMatch = result.text.match(/\{[\s\S]*?\}/);
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            summaryData = {
              summary: parsed.summary || 'Ongoing technical conversation',
              keyDecisions: parsed.keyDecisions || '',
              unresolvedTasks: parsed.unresolvedTasks || ''
            };
          }
        }
      } catch (err) {
        console.warn('LLM summarization notice, falling back to extractive summary:', err.message);
      }
    }

    // Extractive fallback if LLM was unavailable or timed out
    if (!summaryData) {
      summaryData = createExtractiveSummary(messagesToSummarize);
    }

    saveConversationSummary(chat.id, {
      ...summaryData,
      lastIdx: chat.history.length
    });
  }
}

// 10. Unified Context Assembler (Provider-Independent)
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
  // A. Auto-extract user facts & preferences from current turn
  if (userMessage) {
    extractAndSaveFacts(userMessage);
  }

  // B. Follow-Up Resolution & Semantic Search over persistent memories
  const resolvedQuery = resolveFollowUpContext(userMessage, history);
  const relevantMemories = searchSemanticMemories(resolvedQuery || userMessage, 5);

  // C. Active Conversation Summary
  const summaryRow = getConversationSummary(chatId);

  // D. Short-Term History (Sliding Window)
  const recentHistory = history.length > maxRecentTurns ? history.slice(-maxRecentTurns) : history;

  // E. In-Session Deep Recall (For turns older than sliding window)
  const inSessionRecalls = history.length > maxRecentTurns
    ? searchInSessionHistory(resolvedQuery || userMessage, history, maxRecentTurns)
    : [];

  // F. Cross-Session Past Chat Recall (If user asks about past conversations)
  const pastChatRecalls = isPastChatRecallIntent(userMessage)
    ? searchPastConversations(userMessage, chatId, 3)
    : [];

  // G. Build Unified System Directive
  let unifiedSystemPrompt = baseInstruction || personaConfig?.systemPrompt || 'You are Nexus AI, an advanced conversational companion.';

  // Add Temporal Context (only if not already present)
  if (!unifiedSystemPrompt.includes('[Context: Current local date & time')) {
    unifiedSystemPrompt += `\n\n[Context: Current local date & time is ${new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata', dateStyle: 'full', timeStyle: 'short' })}]`;
  }

  // Add User Profile & Long-Term Memory
  if (!unifiedSystemPrompt.includes('USER IDENTITY CONTEXT') && !unifiedSystemPrompt.includes('USER PROFILE')) {
    unifiedSystemPrompt += `\n\n### USER PROFILE & PERSISTENT MEMORY:
- Name: ${userName}
- Role: ${userRole}`;
  }

  if (relevantMemories.length > 0 && !unifiedSystemPrompt.includes('RECALLED PERSISTENT MEMORIES')) {
    unifiedSystemPrompt += `\n\n### RECALLED PERSISTENT MEMORIES (User Facts & Preferences across sessions):\n` + 
      relevantMemories.map(m => `  * [${m.category.toUpperCase()}] ${m.content}`).join('\n') +
      `\nMandate: Naturally adhere to these remembered user preferences and facts without asking the user to repeat them.`;
  }

  // Add Active Conversation Summary if available
  if (summaryRow && summaryRow.summary) {
    unifiedSystemPrompt += `\n\n### ACTIVE CONVERSATION WORKING MEMORY SUMMARY:
- Summary of Prior Discussion: ${summaryRow.summary}`;
    if (summaryRow.key_decisions) {
      unifiedSystemPrompt += `\n- Confirmed Decisions & Stack: ${summaryRow.key_decisions}`;
    }
    if (summaryRow.unresolved_tasks) {
      unifiedSystemPrompt += `\n- Unresolved / Next Tasks: ${summaryRow.unresolved_tasks}`;
    }
    unifiedSystemPrompt += `\nMandate: Ground all answers on this prior discussion summary. If the user refers to an earlier decision or code approach, maintain full continuity.`;
  }

  // Add In-Session Deep Recall if older turns matched
  if (inSessionRecalls.length > 0) {
    unifiedSystemPrompt += `\n\n### RECALLED IN-SESSION CONVERSATION EXCERPTS (Earlier turns in this chat):\n` +
      inSessionRecalls.map(r => `  * [Turn #${r.index} ${r.role}]: ${r.text.slice(0, 300)}`).join('\n') +
      `\nMandate: Reference these earlier discussion details to answer follow-ups accurately without asking the user to repeat past explanations.`;
  }

  // Add Cross-Session Past Chat Recall if user asked about previous chats
  if (pastChatRecalls.length > 0) {
    unifiedSystemPrompt += `\n\n### RECALLED PAST CHAT SESSIONS (Real conversation history from your database):\n` +
      pastChatRecalls.map(p => `  * [Session: "${p.chatTitle}" | Role: ${p.role}]: ${p.snippet}`).join('\n') +
      `\nMandate: The user is explicitly asking about their past conversations. Answer using these verified records. Accurately report what was discussed; do NOT invent or hallucinate past chats.`;
  }

  // Conversational Continuity & Reference Resolution Directives
  unifiedSystemPrompt += `\n\n### CONVERSATIONAL CONTINUITY & CONTEXT GROUNDING:
- Maintain unbroken conversational context. Resolve pronouns ("it", "that", "this", "they", "which one") using the immediate previous messages.
- Never ask the user to repeat information already stated in the conversation history, working memory, or persistent memories.
- Provide direct, logically connected answers that build upon previous explanations.`;

  // Ensure Language Invariant is always reinforced
  if (!unifiedSystemPrompt.includes('MANDATORY LANGUAGE INVARIANT')) {
    unifiedSystemPrompt += `\n\n### MANDATORY LANGUAGE INVARIANT:
- Respond ONLY in **English** or **Tanglish** (Tamil written phonetically using the English/Latin alphabet).
- STRICT PROHIBITION: DO NOT output any Tamil script characters (U+0B80-U+0BFF).
- When the user communicates in Tamil or Tanglish, reply in conversational Tanglish using English letters.
- When the user communicates in English, reply in English.`;
  }

  return {
    systemInstruction: unifiedSystemPrompt,
    recentHistory,
    relevantMemories,
    activeSummary: summaryRow,
    inSessionRecalls,
    pastChatRecalls
  };
}

