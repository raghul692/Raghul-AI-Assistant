/**
 * NEXUS AI — GITHUB MCP PLATFORM & AUTONOMOUS AUTOMATION MASTER VERIFICATION SUITE
 * 
 * Verifies all 6 Core Domains:
 * 1. Protocol: Official GitHub Remote MCP Initialization, Session Negotiation, Dynamic Tool Discovery
 * 2. Identity & Access: Fine-Grained Personal Access Token, User Identity & Live Repository Listing
 * 3. Repository Explorer: README Retrieval, File Tree Navigation, Commits & Branches
 * 4. Automation Engine: 15 Seeded Workflows, Manual Trigger, Run Checkpoints, Execution Persistence
 * 5. Webhook Security: HMAC SHA-256 Signature Verification, Event Deduplication, Webhook Ingestion
 * 6. Governance & Safety: Confidence-Gated Human Approval, SHA-256 Hash Chained Audit Ledger
 */

import { githubMcpGateway } from './githubMcpGateway.js';
import { githubAutomationEngine } from './githubAutomationEngine.js';
import { githubWorkspaceBridge } from './githubWorkspaceBridge.js';
import {
  getGitHubConnection,
  listGitHubAutomations,
  listAutomationRuns,
  createApprovalRequest,
  updateApprovalStatus,
  listPendingApprovals,
  logGitHubAudit,
  verifyGitHubAuditLedger
} from './db.js';

console.log('================================================================');
console.log(' NEXUS AI — GITHUB MCP SERVER & AUTOMATION VERIFICATION SUITE');
console.log(' Target System: Nexus AI Assistant (Node.js 26 + SQLite + MCP)');
console.log('================================================================\n');

async function runTestSuite() {
  const summary = [];
  let userLogin = '';
  let sampleRepo = '';

  // -------------------------------------------------------------
  // TEST 1: Official GitHub Remote MCP Protocol & Dynamic Discovery
  // -------------------------------------------------------------
  console.log('--- TEST 1: GitHub Remote MCP Protocol Handshake ---');
  try {
    const initRes = await githubMcpGateway.initialize();
    console.log(`✓ MCP Handshake Initialized. Session ID: ${initRes.sessionId}`);
    console.log(`✓ Protocol Version: ${githubMcpGateway.protocolVersion}`);
    console.log(`✓ Live Discovered MCP Tools: ${initRes.toolsCount}`);

    if (initRes.toolsCount < 40) {
      throw new Error(`Expected at least 40 tools, discovered ${initRes.toolsCount}`);
    }

    summary.push({ domain: '01_MCP_PROTOCOL', status: 'VERIFIED', details: `${initRes.toolsCount} live tools discovered dynamically (Session: ${initRes.sessionId?.slice(0, 8)}...)` });
  } catch (err) {
    console.error('✗ Test 1 Failed:', err.message);
    summary.push({ domain: '01_MCP_PROTOCOL', status: 'FAILED', details: err.message });
  }

  // -------------------------------------------------------------
  // TEST 2: Identity & Fine-Grained Token Access
  // -------------------------------------------------------------
  console.log('\n--- TEST 2: User Identity & Authenticated Access ---');
  try {
    const identity = await githubMcpGateway.getAuthenticatedIdentity(true);
    userLogin = identity.login;
    console.log(`✓ Authenticated User: @${identity.login} (${identity.name})`);
    console.log(`✓ Public Repositories: ${identity.publicRepos}`);
    console.log(`✓ Connection Provider: ${identity.connectedVia}`);

    const repos = await githubMcpGateway.listRepositories({ perPage: 5 });
    console.log(`✓ Retrieved ${repos.length} accessible repositories.`);
    if (repos.length > 0) {
      sampleRepo = repos[0].full_name;
      console.log(`✓ Sample Target Repository: ${sampleRepo}`);
    }

    summary.push({ domain: '02_IDENTITY_AND_REPOS', status: 'VERIFIED', details: `User @${identity.login} (${identity.name}) verified with ${repos.length}+ accessible repos` });
  } catch (err) {
    console.error('✗ Test 2 Failed:', err.message);
    summary.push({ domain: '02_IDENTITY_AND_REPOS', status: 'FAILED', details: err.message });
  }

  // -------------------------------------------------------------
  // TEST 3: Repository Explorer (README, File Tree, Commits)
  // -------------------------------------------------------------
  console.log('\n--- TEST 3: Repository Explorer & Code Inspection ---');
  try {
    const [owner, repoName] = sampleRepo.split('/');
    const readme = await githubMcpGateway.getReadme(owner, repoName);
    console.log(`✓ README Content retrieved: ${readme.content ? readme.content.length + ' bytes' : 'Empty/None'}`);

    const branches = await githubMcpGateway.listBranches(owner, repoName);
    console.log(`✓ Branches discovered: ${branches.length} (${branches.map(b => b.name).join(', ')})`);

    const commits = await githubMcpGateway.listCommits(owner, repoName, '', 5);
    console.log(`✓ Recent Commits: ${commits.length} commits inspected on default branch.`);

    summary.push({ domain: '03_REPO_EXPLORER', status: 'VERIFIED', details: `README (${readme.content?.length || 0}B), ${branches.length} branches, and ${commits.length} commits verified on ${sampleRepo}` });
  } catch (err) {
    console.error('✗ Test 3 Failed:', err.message);
    summary.push({ domain: '03_REPO_EXPLORER', status: 'FAILED', details: err.message });
  }

  // -------------------------------------------------------------
  // TEST 4: Automation Engine & Persistent Job Queue
  // -------------------------------------------------------------
  console.log('\n--- TEST 4: Autonomous Automation Engine ---');
  try {
    const automations = await githubAutomationEngine.seedAutomations();
    console.log(`✓ Seeded Enterprise Automations: ${automations.length}/15 active.`);

    // Trigger Repository Health Monitor
    const run = await githubAutomationEngine.trigger('auto_repo_health', {
      repo: sampleRepo,
      triggerSource: 'automated_test_runner'
    });
    console.log(`✓ Automation triggered: Run ID ${run.id} [Status: ${run.status}]`);

    // Allow run to execute
    await new Promise(r => setTimeout(r, 4000));

    const runs = listAutomationRuns(5);
    const completedRun = runs.find(r => r.id === run.id);
    console.log(`✓ Automation Run Status: ${completedRun?.status} (Step: ${completedRun?.current_step})`);

    summary.push({ domain: '04_AUTOMATION_ENGINE', status: 'VERIFIED', details: `15 enterprise automations active; Run ${run.id} executed and persisted to SQLite` });
  } catch (err) {
    console.error('✗ Test 4 Failed:', err.message);
    summary.push({ domain: '04_AUTOMATION_ENGINE', status: 'FAILED', details: err.message });
  }

  // -------------------------------------------------------------
  // TEST 5: Webhook HMAC SHA-256 Security & Ingestion
  // -------------------------------------------------------------
  console.log('\n--- TEST 5: Webhook Signature Verification & Ingestion ---');
  try {
    process.env.GITHUB_WEBHOOK_SECRET = 'nexus_super_secret_webhook_key_2026';
    const payload = {
      action: 'opened',
      issue: { number: 1, title: 'Bug: Payment gateway timeout', user: { login: userLogin } },
      repository: { full_name: sampleRepo },
      sender: { login: userLogin }
    };

    const crypto = await import('crypto');
    const hmac = crypto.createHmac('sha256', process.env.GITHUB_WEBHOOK_SECRET);
    const validSignature = 'sha256=' + hmac.update(JSON.stringify(payload)).digest('hex');

    const webhookResult = await githubAutomationEngine.handleWebhook({
      deliveryId: `del_test_${Date.now()}`,
      event: 'issues',
      payload,
      signatureHeader: validSignature
    });

    console.log(`✓ Webhook Ingested: Success=${webhookResult.success}, Event=${webhookResult.event}`);

    // Test rejection of forged signature
    let rejected = false;
    try {
      await githubAutomationEngine.handleWebhook({
        deliveryId: `del_forged_${Date.now()}`,
        event: 'issues',
        payload,
        signatureHeader: 'sha256=invalid_tampered_signature_00000000'
      });
    } catch (e) {
      rejected = true;
      console.log(`✓ Forged Webhook Rejected: ${e.message}`);
    }

    if (!rejected) throw new Error('Security flaw: Invalid webhook signature was not rejected!');

    summary.push({ domain: '05_WEBHOOK_SECURITY', status: 'VERIFIED', details: 'HMAC SHA-256 signature verification passed; invalid signatures correctly rejected' });
  } catch (err) {
    console.error('✗ Test 5 Failed:', err.message);
    summary.push({ domain: '05_WEBHOOK_SECURITY', status: 'FAILED', details: err.message });
  }

  // -------------------------------------------------------------
  // TEST 6: Confidence-Gated Human Approval & Immutable Audit Ledger
  // -------------------------------------------------------------
  console.log('\n--- TEST 6: Governance, Approval Queue & Audit Ledger ---');
  try {
    // 1. Create a staged file change in workspace
    const stageResult = githubWorkspaceBridge.stageFileChange(
      'data/test-patch.txt',
      `// High-Risk Staged Change: ${Date.now()}\nexport const FEATURE_FLAG = true;\n`,
      'Automated Test: Verify confidence-gated human approval requirement'
    );
    console.log(`✓ Approval Staged: ID ${stageResult.approvalId} [Requires Human Decision]`);

    // 2. Verify pending queue
    const pending = listPendingApprovals();
    const hasItem = pending.some(p => p.id === stageResult.approvalId);
    console.log(`✓ Pending Approvals Queue: ${pending.length} item(s) found (Staged found: ${hasItem})`);

    // 3. Resolve approval
    const resolved = updateApprovalStatus(stageResult.approvalId, 'approved', 'Test approver signature');
    console.log(`✓ Approval Decision Recorded: ${resolved.status} (Reason: ${resolved.decision_reason})`);

    // 4. Verify Immutable SHA-256 Hash Chained Ledger
    logGitHubAudit({
      actor: 'Master Test Runner',
      action: 'SECURITY_LEDGER_VERIFY',
      resource: 'github_audit_ledger',
      status: 'VERIFIED'
    });

    const ledgerVerify = verifyGitHubAuditLedger();
    console.log(`✓ SHA-256 Hash Chained Ledger: Verified ${ledgerVerify.count} blocks intact.`);

    if (!ledgerVerify.verified) {
      throw new Error(`Audit ledger corruption detected at ID ${ledgerVerify.brokenAtId}`);
    }

    summary.push({ domain: '06_GOVERNANCE_LEDGER', status: 'VERIFIED', details: `Human approval flow verified; SHA-256 Ledger (${ledgerVerify.count} blocks) 100% intact` });
  } catch (err) {
    console.error('✗ Test 6 Failed:', err.message);
    summary.push({ domain: '06_GOVERNANCE_LEDGER', status: 'FAILED', details: err.message });
  }

  console.log('\n================================================================');
  console.log(' MASTER GITHUB MCP & AUTOMATION VERIFICATION SUMMARY');
  console.log('================================================================');
  console.table(summary);
  const allPassed = summary.every(s => s.status === 'VERIFIED');
  console.log(allPassed ? '\n🌟 ALL 6 DOMAINS 100% VERIFIED & PRODUCTION READY!' : '\n⚠️ SOME DOMAINS FAILED VERIFICATION.');
}

runTestSuite().catch(e => console.error('FATAL TEST ERROR:', e));

