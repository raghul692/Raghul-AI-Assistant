import { mcpEngine } from './mcpClient.js';
import fs from 'fs';
import path from 'path';

console.log('🧪 STARTING COMPREHENSIVE 5-TIER MCP MASTER SUITE...\n');

async function runMcpTests() {
  let passed = 0;
  let total = 0;

  function assert(condition, name) {
    total++;
    if (condition) {
      console.log(`  ✅ PASS: ${name}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${name}`);
      throw new Error(`Assertion failed: ${name}`);
    }
  }

  // =========================================================================
  // TIER 1: COGNITION & DELIBERATE REASONING MCP
  // =========================================================================
  console.log('--- Tier 1: Cognition & Deliberate Reasoning MCP ---');

  // 1. Sequential Thinking
  const t1 = await mcpEngine.callTool('sequential_thinking', {
    thought: 'Hypothesis A: System bottleneck is caused by unindexed DB query',
    thoughtNumber: 1,
    totalThoughts: 3,
    nextThoughtNeeded: true
  });
  assert(t1.status === 'deliberating' && t1.thoughtNumber === 1, 'Sequential Thinking Step 1 initiated');

  const t2 = await mcpEngine.callTool('sequential_thinking', {
    thought: 'Hypothesis B: Profiling reveals Redis connection pool starvation, not DB index',
    thoughtNumber: 2,
    totalThoughts: 3,
    nextThoughtNeeded: true,
    isRevision: true,
    revisesThought: 1
  });
  assert(t2.isRevision === true && t2.revisesThought === 1, 'Sequential Thinking Step 2 revision verified');

  const t3 = await mcpEngine.callTool('sequential_thinking', {
    thought: 'Consensus: Increase Redis pool maxConnections to 50 and add retry backoff',
    thoughtNumber: 3,
    totalThoughts: 3,
    nextThoughtNeeded: false
  });
  assert(t3.status === 'consensus_reached', 'Sequential Thinking final consensus reached');

  // 2. Knowledge Graph Memory
  const entRes = await mcpEngine.callTool('memory_create_entities', {
    entities: [
      { name: 'Redis Microservice', entityType: 'Service', observations: ['Cluster port 6379', 'Used for rate limiting'] },
      { name: 'Express API Server', entityType: 'Backend', observations: ['Runs on port 3000', 'Handles JWT auth'] }
    ]
  });
  assert(entRes.createdCount >= 2, 'Knowledge Graph entities created');

  const relRes = await mcpEngine.callTool('memory_create_relations', {
    relations: [
      { from: 'Express API Server', to: 'Redis Microservice', relationType: 'CONNECTS_TO' }
    ]
  });
  assert(relRes.relations && relRes.relations.length >= 1, 'Knowledge Graph relation edge established');

  const searchRes = await mcpEngine.callTool('memory_search_nodes', { query: 'Redis' });
  assert(searchRes.matchedCount >= 1 && searchRes.relations.length >= 1, 'Knowledge Graph node & relation search verified');

  // =========================================================================
  // TIER 2: CODE & PRODUCTION FILESYSTEM MCP
  // =========================================================================
  console.log('\n--- Tier 2: Code & Production Filesystem MCP ---');

  const testFile = 'scratch/mcp_test_file.txt';
  const writeRes = await mcpEngine.callTool('fs_write_file', {
    filePath: testFile,
    content: 'const x = 10;\n// TARGET_TO_PATCH\nconst y = 20;'
  });
  assert(writeRes.success && writeRes.lines === 3, 'Filesystem Write operation verified');

  const readRes = await mcpEngine.callTool('fs_read_file', { filePath: testFile });
  assert(readRes.content.includes('TARGET_TO_PATCH'), 'Filesystem Read operation verified');

  const patchRes = await mcpEngine.callTool('fs_patch_file', {
    filePath: testFile,
    target: '// TARGET_TO_PATCH',
    replacement: 'const patchedVal = 100;'
  });
  assert(patchRes.success, 'Filesystem Surgical Patch operation verified');

  const verifyPatch = await mcpEngine.callTool('fs_read_file', { filePath: testFile });
  assert(verifyPatch.content.includes('const patchedVal = 100;'), 'Patched content verification passed');

  const searchFilesRes = await mcpEngine.callTool('fs_search_files', { pattern: 'patchedVal', dirPath: 'scratch' });
  assert(searchFilesRes.count >= 1, 'Filesystem content search verified');

  // Terminal Commander
  const termRes = await mcpEngine.callTool('terminal_execute_command', { command: 'node -v' });
  assert(termRes.exitCode === 0 && termRes.stdout.startsWith('v'), 'Terminal Commander node execution verified');

  const toolProbe = await mcpEngine.callTool('terminal_check_tool', { toolName: 'node' });
  assert(toolProbe.installed === true && Boolean(toolProbe.path), 'Terminal tool probe verified');

  // =========================================================================
  // TIER 3: LIVE RESEARCH & SCRAPER MCP
  // =========================================================================
  console.log('\n--- Tier 3: Live Research & Clean Markdown Scraper MCP ---');

  const searchMcp = await mcpEngine.callTool('web_live_search', { query: 'nodejs express framework', maxResults: 3 });
  assert(searchMcp.count >= 1 && searchMcp.results[0].link, 'Web Live Search MCP verified');

  // =========================================================================
  // TIER 4: DATA & SQLITE DATABASE MCP
  // =========================================================================
  console.log('\n--- Tier 4: Data & SQLite Database MCP ---');

  const tables = await mcpEngine.callTool('sqlite_list_tables');
  assert(tables.tableCount >= 1 && Array.isArray(tables.tables), 'SQLite List Tables verified');

  const firstTable = tables.tables[0].name;
  const desc = await mcpEngine.callTool('sqlite_describe_table', { tableName: firstTable });
  assert(desc.columnCount >= 1 && desc.columns[0].name, `SQLite Describe Table (${firstTable}) verified`);

  const queryRes = await mcpEngine.callTool('sqlite_run_query', {
    query: `SELECT * FROM "${firstTable}" LIMIT 5`
  });
  assert(queryRes.returnedRows >= 0 && typeof queryRes.executionTimeMs === 'number', 'SQLite Safe Read Query verified');

  // =========================================================================
  // TIER 5: PRODUCTIVITY CONNECTORS MCP (Notion, Linear, Slack, Zapier)
  // =========================================================================
  console.log('\n--- Tier 5: Productivity Connectors MCP ---');

  const linearRes = await mcpEngine.callTool('linear_create_issue', {
    title: 'Refactor JWT Refresh Token Middleware with Redis',
    description: 'Ensure token revocation list is checked in O(1)',
    priority: 'high'
  });
  assert(linearRes.success && linearRes.ticketId.startsWith('ENG-'), 'Linear Ticket MCP verified');

  const notionRes = await mcpEngine.callTool('notion_format_page', {
    title: 'Nexus AI Architecture Overview',
    content: 'Nexus AI is powered by a 5-tier MCP production server architecture.'
  });
  assert(notionRes.success && notionRes.formattedMarkdown.includes('# Nexus AI'), 'Notion Markdown Formatter MCP verified');

  const slackRes = await mcpEngine.callTool('slack_send_notification', {
    message: '🚀 Build Deployment Succeeded on Production!',
    channel: '#dev-alerts'
  });
  assert(slackRes.success && slackRes.channel === '#dev-alerts', 'Slack Notification MCP verified');

  // Cleanup scratch test file
  try {
    fs.unlinkSync(path.join(process.cwd(), testFile));
  } catch {}

  console.log(`\n================================================================`);
  console.log(`🏁 5-TIER MCP MASTER SUITE COMPLETE: ${passed} / ${total} TESTS PASSED (100%)`);
  console.log(`================================================================`);
}

runMcpTests().catch(err => {
  console.error('❌ MCP Master Suite failed:', err);
  process.exit(1);
});
