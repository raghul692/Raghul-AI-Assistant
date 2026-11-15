/**
 * RAGHUL AI — ChatGPT-Level Conversational Memory & Context Suite
 * Exhaustive Verification of:
 * 1. Conversation Memory (Multi-turn recall & sliding window handling)
 * 2. Context Awareness & Follow-up Anaphora/Pronoun Resolution
 * 3. Long-Term Persistent Memory (Store & recall user facts across sessions)
 * 4. Chat History Recall (Cross-session dialogue recall without hallucination)
 * 5. Conversational Summarization & Working Context Compression
 * 6. Language Policy Compliance (Strict Latin alphabet, Zero Tamil Unicode)
 */

import assert from 'assert';
import { db } from '../db.js';
import {
  initMemoryTables,
  saveUserMemory,
  getUserMemory,
  listUserMemories,
  deleteUserMemory,
  searchSemanticMemories,
  extractAndSaveFacts,
  resolveFollowUpContext,
  searchInSessionHistory,
  isPastChatRecallIntent,
  searchPastConversations,
  saveConversationSummary,
  getConversationSummary,
  checkAndSummarizeConversation,
  buildUnifiedContext
} from '../memory/persistentMemoryEngine.js';
import { createOrUpdateChat, getChat, deleteChat } from '../storage.js';

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(`    ${err.message}`);
    failed++;
  }
}

async function testAsync(name, fn) {
  try {
    await fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(`    ${err.message}`);
    failed++;
  }
}

async function runMemorySuite() {
  console.log('================================================================');
  console.log('🧠 RAGHUL AI — CONVERSATIONAL MEMORY & CONTEXT TEST SUITE');
  console.log('================================================================\n');

// -----------------------------------------------------------------------------
// SECTION 1: LONG-TERM PERSISTENT MEMORY & AUTONOMOUS FACT EXTRACTION
// -----------------------------------------------------------------------------
console.log('1. Long-Term Persistent Memory & Fact Distillation');

test('Fact Extraction captures user tech stack and stores in SQLite', () => {
  const userMsg = "I usually build with Go, Gin, and PostgreSQL for my cloud APIs.";
  const extracted = extractAndSaveFacts(userMsg);
  assert(Array.isArray(extracted), 'Extracted facts should be an array');
  assert(extracted.length > 0, 'Should extract at least one fact');
  
  const saved = extracted.find(f => f.content.includes('Go, Gin, and PostgreSQL'));
  assert(saved, 'Extracted fact should preserve stack details');
  assert.strictEqual(saved.category, 'preference');
});

test('Fact Extraction captures preferred database and communication style', () => {
  const msg1 = "My favorite db is Redis for caching and session state.";
  const ext1 = extractAndSaveFacts(msg1);
  assert(ext1.length > 0, 'Should extract db preference');
  assert(ext1.some(f => f.content.includes('Redis')), 'Should store Redis as preferred database');

  const msg2 = "Please keep your answers concise and avoid fluff.";
  const ext2 = extractAndSaveFacts(msg2);
  assert(ext2.length > 0, 'Should extract brevity preference');
  assert(ext2.some(f => f.content.includes('concise')), 'Should store conciseness instruction');
});

test('Semantic Search retrieves stored preferences for relevant queries', () => {
  const hits = searchSemanticMemories('What tech stack and database should we use for the new service?', 4);
  assert(Array.isArray(hits), 'Hits should be an array');
  assert(hits.length > 0, 'Semantic memory search should return hits');
  const hasTechMemory = hits.some(h => /Go|Gin|PostgreSQL|Redis/i.test(h.content));
  assert(hasTechMemory, 'Recalled memory should include user tech stack');
});

test('Memory Deduplication prevents redundant duplicate entries', () => {
  const mem1 = saveUserMemory({
    category: 'preference',
    content: 'User prefers dark mode across all IDEs and dashboards.',
    importance: 0.8
  });
  const mem2 = saveUserMemory({
    category: 'preference',
    content: 'User prefers dark mode across all IDEs and dashboards.',
    importance: 0.9
  });
  assert.strictEqual(mem1.id, mem2.id, 'Duplicate memory should update existing entry rather than duplicating');
});

// -----------------------------------------------------------------------------
// SECTION 2: CONTEXT AWARENESS & ANAPHORA / PRONOUN RESOLUTION
// -----------------------------------------------------------------------------
console.log('\n2. Context Awareness & Reference Resolution');

test('Follow-up resolver expands short pronoun queries with conversation context', () => {
  const history = [
    { role: 'user', text: 'Tell me about Redis in-memory data store.' },
    { role: 'assistant', text: 'Redis is an in-memory key-value data store used as a database, cache, and message broker with sub-millisecond latency.' }
  ];

  const followUp = "Why is it so fast?";
  const resolved = resolveFollowUpContext(followUp, history);
  assert(resolved.includes('Redis'), `Resolved query should contain subject from previous turns: "${resolved}"`);
  assert(resolved.startsWith('Why is it so fast?'), 'Original query should be preserved');
});

test('Follow-up resolver handles comparison questions between multiple entities', () => {
  const history = [
    { role: 'user', text: 'Compare Kafka and RabbitMQ architectures.' },
    { role: 'assistant', text: 'Kafka is a distributed append-only commit log optimized for high-throughput stream processing, while RabbitMQ is a traditional message broker supporting complex routing via AMQP exchanges.' }
  ];

  const followUp = "Which one has higher throughput?";
  const resolved = resolveFollowUpContext(followUp, history);
  assert(/Kafka|RabbitMQ/i.test(resolved), `Resolved query should identify Kafka or RabbitMQ: "${resolved}"`);
});

// -----------------------------------------------------------------------------
// SECTION 3: IN-SESSION DEEP RECALL (Turns older than Sliding Window)
// -----------------------------------------------------------------------------
console.log('\n3. In-Session Deep Recall for Older Turns');

test('searchInSessionHistory accurately recalls turns pruned by sliding window', () => {
  const history = [];
  // Build a conversation of 16 turns
  history.push({ role: 'user', text: 'Let us initialize our database connection on port 5439 with user admin_raghul.' });
  history.push({ role: 'assistant', text: 'Configured connection pool for PostgreSQL on port 5439 with user admin_raghul.' });
  
  for (let i = 1; i <= 14; i++) {
    history.push({ role: 'user', text: `Step ${i}: Now we implement feature module #${i}.` });
    history.push({ role: 'assistant', text: `Module #${i} verified and passing unit tests.` });
  }

  assert.strictEqual(history.length, 30, 'Conversation should have 30 turns');
  
  // Recent turns sliding window of 12 turns excludes the first 18 turns
  const recalled = searchInSessionHistory('What was the database port and user we configured?', history, 12);
  assert(Array.isArray(recalled), 'Recalled items should be an array');
  assert(recalled.length > 0, 'Should recall early database configuration turn');
  assert(recalled.some(r => r.text.includes('5439') && r.text.includes('admin_raghul')), 'Recalled turn should contain port 5439 and user admin_raghul');
});

// -----------------------------------------------------------------------------
// SECTION 4: CROSS-SESSION CHAT HISTORY RECALL
// -----------------------------------------------------------------------------
console.log('\n4. Cross-Session Chat History Recall (Past Conversations)');

test('isPastChatRecallIntent accurately identifies cross-session inquiry intent', () => {
  assert.strictEqual(isPastChatRecallIntent('What did we discuss in our last chat?'), true);
  assert.strictEqual(isPastChatRecallIntent('Did we talk about Redis in our previous conversation?'), true);
  assert.strictEqual(isPastChatRecallIntent('Recall what you said about Docker in the earlier session.'), true);
  assert.strictEqual(isPastChatRecallIntent('Search my previous chats for the deployment command.'), true);
  
  // Normal questions should not trigger past chat recall
  assert.strictEqual(isPastChatRecallIntent('Explain how async/await works in JavaScript.'), false);
  assert.strictEqual(isPastChatRecallIntent('Write a quick Python script to parse JSON.'), false);
});

test('searchPastConversations retrieves actual past dialogue turns from SQLite', () => {
  const sessionPastId = `test_chat_past_${Date.now()}`;
  createOrUpdateChat({
    id: sessionPastId,
    title: 'Docker Deployment Architecture',
    persona: 'assistant',
    history: [
      { role: 'user', text: 'How do I deploy Redis container with docker-compose?' },
      { role: 'model', text: 'Use image redis:7-alpine with ports 6379:6379 and appendonly yes for persistence.' }
    ]
  });

  const currentChatId = `test_chat_current_${Date.now()}`;
  const pastRecalls = searchPastConversations('What did we discuss about Redis and docker-compose?', currentChatId, 3);
  
  assert(Array.isArray(pastRecalls), 'Past recalls should be an array');
  assert(pastRecalls.length > 0, 'Should find past dialogue turns');
  const hit = pastRecalls.find(r => r.chatId === sessionPastId);
  assert(hit, 'Should retrieve dialogue from the past Docker session');
  assert(hit.chatTitle.includes('Docker Deployment'), 'Should identify session title');

  // Clean up test chat
  deleteChat(sessionPastId);
});

// -----------------------------------------------------------------------------
// SECTION 5: ROBUST CONVERSATION SUMMARIZATION & COMPRESSION
// -----------------------------------------------------------------------------
console.log('\n5. Conversational Summarization & Working Context Compression');

  await testAsync('checkAndSummarizeConversation generates and persists structured summary', async () => {
    const testChatId = `test_summary_chat_${Date.now()}`;
    const testChat = createOrUpdateChat({
      id: testChatId,
      title: 'Kubernetes Cluster Planning',
      persona: 'assistant',
      history: [
        { role: 'user', text: 'How to setup an EKS cluster with Terraform?' },
        { role: 'model', text: 'We recommend using the terraform-aws-modules/eks module with managed node groups.' },
        { role: 'user', text: 'Which CNI plugin should we select?' },
        { role: 'model', text: 'Decided on AWS VPC CNI for native ENI allocation and Calico for NetworkPolicies.' },
        { role: 'user', text: 'What is our plan for ingress controller?' },
        { role: 'model', text: 'We configured AWS Load Balancer Controller with ALB.' },
        { role: 'user', text: 'What about TLS certificates?' },
        { role: 'model', text: 'Configured cert-manager with Let\'s Encrypt ACME issuer.' },
        { role: 'user', text: 'Now let us write the helm chart values.' },
        { role: 'model', text: 'Created initial helm chart template for microservices.' }
      ]
    });

    await checkAndSummarizeConversation(testChat, null); // Test extractive fallback when no LLM
    
    const summaryRow = getConversationSummary(testChatId);
    assert(summaryRow, 'Summary record should exist in database');
    assert(summaryRow.summary && summaryRow.summary.length > 10, 'Summary text should be populated');
    assert.strictEqual(summaryRow.last_summarized_msg_idx, testChat.history.length, 'last_summarized_msg_idx should match history length');
    
    // Clean up
    deleteChat(testChatId);
  });

// -----------------------------------------------------------------------------
// SECTION 6: UNIFIED CONTEXT ASSEMBLER (ChatGPT-Standard Full Pipeline)
// -----------------------------------------------------------------------------
console.log('\n6. Unified Context Assembler (End-to-End Context Synthesis)');

test('buildUnifiedContext seamlessly coordinates working memory, long-term facts, and sliding window', () => {
  const chatId = `unified_test_chat_${Date.now()}`;
  createOrUpdateChat({
    id: chatId,
    title: 'Microservices Architecture',
    persona: 'assistant',
    history: []
  });
  
  // Seed summary
  saveConversationSummary(chatId, {
    summary: 'Discussed migrating monolithic Node backend to event-driven Go microservices.',
    keyDecisions: 'Selected NATS JetStream for message queue; PostgreSQL for persistence.',
    unresolvedTasks: 'Need to write Docker Compose orchestration file.',
    lastIdx: 6
  });

  const history = [
    { role: 'user', text: 'Can we also configure Prometheus metrics?' },
    { role: 'assistant', text: 'Yes, we will expose /metrics endpoint using client_golang on port 9090.' }
  ];

  const userQuery = "What message queue and database did we choose earlier?";
  const unified = buildUnifiedContext({
    chatId,
    personaConfig: { systemPrompt: 'You are an elite software architect.' },
    baseInstruction: 'Core Assistant Rules',
    userMessage: userQuery,
    history,
    maxRecentTurns: 10,
    userName: 'Raghul',
    userRole: 'Staff Platform Engineer'
  });

  assert(unified.systemInstruction, 'Unified system instruction should exist');
  assert(unified.systemInstruction.includes('ACTIVE CONVERSATION WORKING MEMORY SUMMARY:'), 'Should include working memory summary');
  assert(unified.systemInstruction.includes('NATS JetStream'), 'Context should contain previous decision NATS JetStream');
  assert(unified.systemInstruction.includes('PostgreSQL'), 'Context should contain previous decision PostgreSQL');
  assert(unified.systemInstruction.includes('CONVERSATIONAL CONTINUITY & CONTEXT GROUNDING:'), 'Should enforce continuity directives');
  assert.strictEqual(unified.recentHistory.length, 2, 'Should provide active recent history');

  // Clean up
  deleteChat(chatId);
  db.prepare('DELETE FROM conversation_summaries WHERE chat_id = ?').run(chatId);
});

// -----------------------------------------------------------------------------
// SECTION 7: STRICT LANGUAGE POLICY VERIFICATION (ZERO TAMIL SCRIPT)
// -----------------------------------------------------------------------------
console.log('\n7. Strict Language Policy Enforcement');

test('System instructions and prompt outputs contain ZERO Tamil script characters', () => {
  const unified = buildUnifiedContext({
    chatId: 'policy_check_chat',
    personaConfig: { systemPrompt: 'You are a bilingual companion.' },
    baseInstruction: 'Base instructions',
    userMessage: 'Vanakkam bro, enna visayam?',
    history: [],
    userName: 'Raghul'
  });

  const hasTamilScript = /[\u0B80-\u0BFF]/.test(unified.systemInstruction);
  assert.strictEqual(hasTamilScript, false, 'System instruction MUST contain ZERO Tamil Unicode characters (U+0B80-U+0BFF)');
});

  // -----------------------------------------------------------------------------
  // SUMMARY
  // -----------------------------------------------------------------------------
  console.log('\n================================================================');
  console.log(`📊 MEMORY & CONTEXT SUITE SUMMARY: ${passed} Passed, ${failed} Failed`);
  console.log('================================================================');

  if (failed > 0) {
    process.exit(1);
  } else {
    console.log('🎉 All Conversational Memory & Context tests passed with 100% success rate!\n');
    process.exit(0);
  }
}

runMemorySuite().catch(err => {
  console.error('Fatal test suite error:', err);
  process.exit(1);
});
