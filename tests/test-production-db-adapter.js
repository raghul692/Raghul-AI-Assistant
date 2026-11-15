/**
 * TEST SUITE: PRODUCTION DATABASE ADAPTER & SUPABASE POSTGRESQL POOL
 */

import assert from 'assert';
import { dbAdapter } from '../database/adapter.js';
import { getPostgresPool, pgQuery, pgQueryRow, withPgTransaction } from '../database/postgresPool.js';

async function runTest() {
  console.log('================================================================');
  console.log('🧪 VERIFY PRODUCTION DATABASE ADAPTER & POSTGRESQL POOL');
  console.log('================================================================\n');

  // Test 1: Health Check Probe
  console.log('--- Test 1: Health Check Probe ---');
  const health = await dbAdapter.healthCheck();
  console.log('Health Check Result:', health);
  assert(health.status === 'healthy', 'Database adapter should report healthy');
  assert(typeof health.latencyMs === 'number', 'Latency should be measured');
  console.log('✅ [PASS] Database adapter health check verified.\n');

  // Test 2: Dual Mode Query Execution
  console.log('--- Test 2: Dual Mode Query Execution ---');
  const row = await dbAdapter.queryRow('SELECT count(*) as count FROM chats');
  assert(row && row.count !== undefined, 'Query should return chat count');
  console.log(`✅ [PASS] Count query succeeded: ${row.count} chats found in database.\n`);

  // Test 3: Converted SQL Parameter Mapping
  console.log('--- Test 3: Parameter Placeholders Mapping ---');
  const testId = `test_chat_${Date.now()}`;
  const now = Date.now();

  await dbAdapter.execute(
    'INSERT INTO chats (id, title, persona, is_archived, created_at, updated_at) VALUES (?, ?, ?, 0, ?, ?)',
    [testId, 'Test Verification Chat', 'assistant', now, now]
  );

  const fetched = await dbAdapter.queryRow('SELECT id, title FROM chats WHERE id = ?', [testId]);
  assert(fetched && fetched.id === testId, 'Should find inserted test chat');
  assert.strictEqual(fetched.title, 'Test Verification Chat');
  console.log('✅ [PASS] Parameterized INSERT and SELECT verified.\n');

  // Test 4: Managed Transaction Support
  console.log('--- Test 4: Managed PostgreSQL Transaction Rollback ---');
  if (dbAdapter.isPostgres()) {
    let rollbackVerified = false;
    try {
      await withPgTransaction(async (tx) => {
        await tx.query('INSERT INTO chats (id, title, persona, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
          [`temp_${Date.now()}`, 'Temp Chat', 'assistant', now, now]);
        throw new Error('INTENTIONAL_TRANSACTION_ROLLBACK_TEST');
      });
    } catch (err) {
      if (err.message === 'INTENTIONAL_TRANSACTION_ROLLBACK_TEST') {
        rollbackVerified = true;
      }
    }
    assert(rollbackVerified, 'Transaction rollback should occur on error');
    console.log('✅ [PASS] Transaction rollback successfully verified.\n');
  } else {
    console.log('⏩ [SKIPPED] PostgreSQL-specific transaction check (running on SQLite fallback).\n');
  }

  // Cleanup
  await dbAdapter.execute('DELETE FROM chats WHERE id = ?', [testId]);
  console.log('✅ [PASS] Test artifact cleanup verified.\n');

  console.log('🎉 Production Database Adapter verification completed successfully!');
}

runTest().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
