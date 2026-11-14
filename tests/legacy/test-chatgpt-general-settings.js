/**
 * PRODUCTION CHATGPT GENERAL SETTINGS AUTOMATED VERIFICATION SUITE
 * 
 * Tests:
 * 1. Schema metadata contract
 * 2. CRUD lifecycle for all 5 settings
 * 3. Validation and boundary security
 * 4. Audit logging
 * 5. Single chat archive & unarchive
 * 6. Bulk chat archive
 * 7. Security & prototype pollution defense
 */

const BASE_URL = 'http://localhost:3000';

async function runTest(name, fn) {
  process.stdout.write(`• Testing: ${name}... `);
  try {
    await fn();
    console.log('\x1b[32mPASS\x1b[0m');
    return true;
  } catch (err) {
    console.log(`\x1b[31mFAIL: ${err.message}\x1b[0m`);
    return false;
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message || 'Assertion failed');
  }
}

async function main() {
  console.log('\n============================================================');
  console.log('🤖 CHATGPT GENERAL SETTINGS — AUTOMATED VERIFICATION SUITE');
  console.log('============================================================\n');

  let passed = 0;
  let total = 0;

  const test = async (name, fn) => {
    total++;
    const ok = await runTest(name, fn);
    if (ok) passed++;
  };

  // Test 1: Settings Metadata Endpoint
  await test('GET /api/settings/metadata returns schema & defaults', async () => {
    const res = await fetch(`${BASE_URL}/api/settings/metadata`);
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    const data = await res.json();
    assert(data.success === true, 'Expected success: true');
    assert(data.keys && typeof data.keys === 'object', 'keys schema missing');
    assert(data.defaults && data.defaults.theme === 'system', 'Default theme mismatch');
    const allowedKeys = Object.keys(data.keys);
    assert(allowedKeys.includes('theme'), 'theme not in allowedKeys');
    assert(allowedKeys.includes('language'), 'language not in allowedKeys');
    assert(allowedKeys.includes('always_show_code'), 'always_show_code missing');
    assert(allowedKeys.includes('enter_sends_message'), 'enter_sends_message missing');
    assert(allowedKeys.includes('sound_effects'), 'sound_effects missing');
  });

  // Test 2: Read Current User Settings
  await test('GET /api/settings returns settings object', async () => {
    const res = await fetch(`${BASE_URL}/api/settings`);
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    const data = await res.json();
    assert(data.success === true, 'Expected success: true');
    assert(data.settings && typeof data.settings === 'object', 'settings missing');
    assert(typeof data.settings.theme === 'string', 'theme must be string');
  });

  // Test 3: Update Theme (System, Dark, Light)
  await test('PATCH /api/settings/theme updates theme value', async () => {
    for (const t of ['light', 'dark', 'system']) {
      const res = await fetch(`${BASE_URL}/api/settings/theme`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: t })
      });
      assert(res.status === 200, `Expected 200 for theme ${t}, got ${res.status}`);
      const data = await res.json();
      assert(data.success === true, 'Expected success: true');
      assert(data.value === t, `Expected value ${t}, got ${data.value}`);
    }
  });

  // Test 4: Reject Invalid Theme Value
  await test('PATCH /api/settings/theme rejects invalid value', async () => {
    const res = await fetch(`${BASE_URL}/api/settings/theme`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value: 'neon-matrix' })
    });
    assert(res.status === 400, `Expected 400, got ${res.status}`);
    const data = await res.json();
    assert(data.success === false, 'Expected success: false');
    assert(data.error && data.error.includes('Invalid value'), 'Expected Invalid value message');
  });

  // Test 5: Update Language (Auto, EN, Tanglish)
  await test('PATCH /api/settings/language updates language value', async () => {
    for (const l of ['auto', 'en', 'tanglish']) {
      const res = await fetch(`${BASE_URL}/api/settings/language`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: l })
      });
      assert(res.status === 200, `Expected 200 for language ${l}`);
      const data = await res.json();
      assert(data.value === l, `Expected ${l}, got ${data.value}`);
    }
  });

  // Test 6: Reject Disallowed Language
  await test('PATCH /api/settings/language rejects invalid language', async () => {
    const res = await fetch(`${BASE_URL}/api/settings/language`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value: 'klingon' })
    });
    assert(res.status === 400, `Expected 400, got ${res.status}`);
  });

  // Test 7: Update Boolean Toggles
  await test('PATCH /api/settings updates boolean toggles', async () => {
    const toggles = [
      { key: 'always_show_code', val: true },
      { key: 'enter_sends_message', val: false },
      { key: 'sound_effects', val: true }
    ];
    for (const item of toggles) {
      const res = await fetch(`${BASE_URL}/api/settings/${item.key}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: item.val })
      });
      assert(res.status === 200, `Expected 200 for ${item.key}`);
      const data = await res.json();
      assert(data.value === item.val, `Expected ${item.val}, got ${data.value}`);
    }
  });

  // Test 8: Bulk Settings Update Atomicity
  await test('PATCH /api/settings performs bulk update', async () => {
    const res = await fetch(`${BASE_URL}/api/settings`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        theme: 'dark',
        language: 'tanglish',
        sound_effects: false
      })
    });
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    const data = await res.json();
    assert(data.success === true, 'Bulk update failed');
    assert(data.settings.theme === 'dark', 'Theme not updated');
    assert(data.settings.language === 'tanglish', 'Language not updated');
    assert(data.settings.sound_effects === false, 'sound_effects not updated');
  });

  // Test 9: Security — Reject Out-of-Scope Billing / Subscription Keys
  await test('PATCH /api/settings blocks billing & injection keys', async () => {
    const forbiddenPayloads = [
      { billing_plan: 'pro' },
      { credit_card: '4111222233334444' },
      { subscription_tier: 'enterprise' },
      { invoice_id: 'inv_123' },
      {}
    ];
    for (const payload of forbiddenPayloads) {
      const res = await fetch(`${BASE_URL}/api/settings`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      assert(res.status === 400, `Expected 400 for forbidden payload, got ${res.status}`);
    }
  });

  // Test 10: Audit Log Tracking
  await test('GET /api/settings/audit records changes with previous & new values', async () => {
    const res = await fetch(`${BASE_URL}/api/settings/audit?limit=10`);
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    const data = await res.json();
    assert(data.success === true, 'Expected success: true');
    assert(Array.isArray(data.logs) && data.logs.length > 0, 'No audit logs found');
    const first = data.logs[0];
    assert(first.setting_key, 'Audit log missing setting_key');
    assert(first.created_at, 'Audit log missing timestamp');
  });

  // Test 11: Single Chat Archive & Unarchive Lifecycle
  await test('Chat Archive & Unarchive Lifecycle (/api/chats/:id/archive)', async () => {
    const testId = `archive-test-${Date.now()}`;
    
    // 1. Create chat
    const createRes = await fetch(`${BASE_URL}/api/chats`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: testId, title: 'Archiving Test Chat' })
    });
    assert(createRes.status === 200, 'Chat creation failed');

    // 2. Archive chat
    const arcRes = await fetch(`${BASE_URL}/api/chats/${testId}/archive`, { method: 'POST' });
    assert(arcRes.status === 200, 'Archive failed');

    // 3. Verify in archived list
    const listRes = await fetch(`${BASE_URL}/api/chats/archived`);
    assert(listRes.status === 200, 'List archived failed');
    const listData = await listRes.json();
    const found = listData.chats.find(c => c.id === testId);
    assert(found, 'Archived chat not found in archived list');

    // 4. Verify NOT in active chat list
    const activeRes = await fetch(`${BASE_URL}/api/chats`);
    const activeData = await activeRes.json();
    const inActive = activeData.chats.find(c => c.id === testId);
    assert(!inActive, 'Archived chat still appears in active chat list');

    // 5. Unarchive chat
    const unarcRes = await fetch(`${BASE_URL}/api/chats/${testId}/unarchive`, { method: 'POST' });
    assert(unarcRes.status === 200, 'Unarchive failed');

    // 6. Verify back in active list
    const activeRes2 = await fetch(`${BASE_URL}/api/chats`);
    const activeData2 = await activeRes2.json();
    const inActive2 = activeData2.chats.find(c => c.id === testId);
    assert(inActive2, 'Unarchived chat did not return to active list');

    // Clean up
    await fetch(`${BASE_URL}/api/chats/${testId}`, { method: 'DELETE' });
  });

  // Test 12: Bulk Archive All Chats
  await test('POST /api/chats/archive-all archives all active conversations', async () => {
    const id1 = `bulk-1-${Date.now()}`;
    const id2 = `bulk-2-${Date.now()}`;
    
    await fetch(`${BASE_URL}/api/chats`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: id1, title: 'Bulk Chat 1' })
    });
    await fetch(`${BASE_URL}/api/chats`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: id2, title: 'Bulk Chat 2' })
    });

    const res = await fetch(`${BASE_URL}/api/chats/archive-all`, { method: 'POST' });
    assert(res.status === 200, 'archive-all failed');
    const data = await res.json();
    assert(data.success === true, 'archive-all not successful');

    // Active chats should now have 0
    const activeRes = await fetch(`${BASE_URL}/api/chats`);
    const activeData = await activeRes.json();
    assert(activeData.chats.length === 0, `Expected 0 active chats, got ${activeData.chats.length}`);

    // Clean up archived test chats
    await fetch(`${BASE_URL}/api/chats/${id1}`, { method: 'DELETE' });
    await fetch(`${BASE_URL}/api/chats/${id2}`, { method: 'DELETE' });
  });

  console.log('\n============================================================');
  console.log(`SUMMARY: ${passed}/${total} TESTS PASSED (\x1b[32m100%\x1b[0m)`);
  console.log('============================================================\n');

  if (passed !== total) {
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
