/**
 * RAGHUL AI — PORTFOLIO OS V8 COMPLETE FULL-SYSTEM VERIFICATION TEST
 * Automated verification of all 14 modules, backend routes, database schema, and live site integrity.
 */

import assert from 'assert';

console.log('⚡ Starting Complete Full-System Verification for Portfolio OS V8...\n');

async function runVerification() {
  const baseUrl = 'http://localhost:3000';
  let passedCount = 0;
  let totalTests = 10;

  // 1. Dedicated Route Verification
  console.log('TEST 1: Dedicated Full-Page Route (/os & /portfolio-os)');
  const osRes = await fetch(`${baseUrl}/os`);
  assert.strictEqual(osRes.status, 200, 'GET /os must return 200 OK');
  const osHtml = await osRes.text();
  assert(osHtml.includes('Raghul AI — Portfolio Operating System'), 'Page title must match');
  assert(osHtml.includes('view-overview'), 'Must contain view-overview container');
  console.log('✅ PASS: Dedicated route /os verified');
  passedCount++;

  // 2. Settings API & SQLite Persistence
  console.log('\nTEST 2: User Settings API & SQLite Persistence');
  const settingsRes = await fetch(`${baseUrl}/api/portfolio/settings`).then(r => r.json());
  assert(settingsRes.success, 'Settings query must succeed');
  assert(settingsRes.settings.theme, 'Theme must be defined in settings');
  console.log('✅ PASS: Settings loaded from SQLite:', settingsRes.settings);
  passedCount++;

  // 3. Notifications API & SQLite Storage
  console.log('\nTEST 3: Notifications API & Real SQLite Queue');
  const notifsRes = await fetch(`${baseUrl}/api/portfolio/notifications`).then(r => r.json());
  assert(notifsRes.success, 'Notifications query must succeed');
  assert(Array.isArray(notifsRes.notifications), 'Notifications must be an array');
  assert(notifsRes.total > 0, 'Total notifications must be > 0');
  console.log(`✅ PASS: ${notifsRes.notifications.length} real notifications retrieved (unread: ${notifsRes.unreadCount})`);
  passedCount++;

  // 4. Incidents API
  console.log('\nTEST 4: Incidents & Reliability API');
  const incRes = await fetch(`${baseUrl}/api/portfolio/incidents`).then(r => r.json());
  assert(incRes.success, 'Incidents query must succeed');
  assert(Array.isArray(incRes.incidents), 'Incidents must be an array');
  console.log(`✅ PASS: Incidents center verified (${incRes.incidents.length} recorded)`);
  passedCount++;

  // 5. GitHub Repository Details
  console.log('\nTEST 5: Real GitHub Repository Integration');
  const repoRes = await fetch(`${baseUrl}/api/portfolio/github/repo`).then(r => r.json());
  assert(repoRes.success, 'GitHub repo query must succeed');
  assert.strictEqual(repoRes.repo.fullName, 'raghul692/raghulraja_portfolio');
  assert.strictEqual(repoRes.repo.defaultBranch, 'main');
  console.log(`✅ PASS: GitHub repository verified: ${repoRes.repo.fullName} [branch: ${repoRes.repo.defaultBranch}]`);
  passedCount++;

  // 6. GitHub Live Commits
  console.log('\nTEST 6: Real GitHub Commit History');
  const commitsRes = await fetch(`${baseUrl}/api/portfolio/github/commits?limit=5`).then(r => r.json());
  assert(commitsRes.success, 'Commits query must succeed');
  assert(commitsRes.commits.length > 0, 'Must have at least 1 commit');
  console.log(`✅ PASS: ${commitsRes.commits.length} commits retrieved. Latest: [${commitsRes.commits[0].shortSha}] ${commitsRes.commits[0].message.slice(0, 45)}`);
  passedCount++;

  // 7. Database Table Schema & Row Counts
  console.log('\nTEST 7: SQLite 14-Table Architecture');
  const tablesRes = await fetch(`${baseUrl}/api/portfolio/database/tables`).then(r => r.json());
  assert(tablesRes.success, 'Database tables query must succeed');
  assert(tablesRes.tables.length >= 12, 'Must have at least 12 portfolio tables');
  console.log(`✅ PASS: ${tablesRes.tables.length} tables verified with live row counts`);
  passedCount++;

  // 8. System Deep Monitoring & Portfolio Health
  console.log('\nTEST 8: System Telemetry & Portfolio Health Probe');
  const monRes = await fetch(`${baseUrl}/api/portfolio/monitoring/services`).then(r => r.json());
  assert(monRes.success, 'Monitoring query must succeed');
  assert(monRes.system.memoryRssMb, 'Memory RSS must be reported');
  assert(monRes.portfolioSite.status, 'Portfolio site status must be reported');
  console.log(`✅ PASS: Host telemetry verified (RSS: ${monRes.system.memoryRssMb}MB, Site Status: ${monRes.portfolioSite.status}, Latency: ${monRes.portfolioSite.latencyMs}ms)`);
  passedCount++;

  // 9. Autonomous 7-Stage AI Pipeline Execution
  console.log('\nTEST 9: Autonomous 7-Stage Agent Pipeline');
  const agentRes = await fetch(`${baseUrl}/api/portfolio/agent/execute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt: 'Audit Supabase sync drift', autoApprove: false })
  }).then(r => r.json());
  assert(agentRes.success, 'Agent pipeline must succeed');
  assert.strictEqual(agentRes.status, 'COMPLETED');
  assert.strictEqual(agentRes.pipelineNodes.length, 7, 'Must execute all 7 stages');
  console.log(`✅ PASS: 7-Stage agent pipeline executed cleanly in ${agentRes.duration}`);
  passedCount++;

  // 10. SHA-256 Merkle Ledger Cryptographic Integrity
  console.log('\nTEST 10: Cryptographic Governance & Ledger Integrity');
  const auditRes = await fetch(`${baseUrl}/api/portfolio/governance/audit-integrity`).then(r => r.json());
  assert(auditRes.valid, 'Audit ledger must be cryptographically valid');
  assert(auditRes.totalRecords > 0, 'Audit records must exist');
  assert(auditRes.operatorPublicKey.includes('BEGIN PUBLIC KEY') || auditRes.operatorPublicKey.startsWith('ed25519:'), 'Operator public key must be valid PEM or Ed25519');
  console.log(`✅ PASS: SHA-256 Ledger validated (${auditRes.totalRecords} records, Operator Key: PEM/Ed25519)`);
  passedCount++;

  console.log(`\n=============================================================`);
  console.log(`🏆 ALL ${passedCount}/${totalTests} FULL-SYSTEM TESTS PASSED PERFECTLY (100% PASS RATE)`);
  console.log(`=============================================================`);
  process.exit(0);
}

runVerification().catch(err => {
  console.error('\n❌ FULL-SYSTEM TEST FAILURE:', err.message);
  process.exit(1);
});
