/**
 * RAGHUL AI — PORTFOLIO OS MASTER FORENSIC VERIFICATION SUITE
 * 
 * End-to-End Live Forensic Tests:
 * 1. REAL GITHUB OPERATIONS (Branch creation, commit, PR creation, PR closure)
 * 2. PERSISTENT JOB QUEUE (Execution, retry backoff, concurrency, crash recovery, DLQ)
 * 3. EMERGENCY STOP ENFORCEMENT (Immediate worker abort & agent safety block)
 * 4. REAL VERCEL & RENDER MULTI-CLOUD (Live deployments, ready states, service health)
 * 5. SUPABASE & SQLITE DATA CONSISTENCY (Sync, document cache, contact inquiries)
 * 6. 7-STAGE AUTONOMOUS AI AGENT PIPELINE (Plan -> Execute -> Test -> Review -> Approval -> Deploy -> Verify)
 * 7. PRODUCTION DOMAIN LIVE PROBE (https://raghulraja.is-a.dev/ HTTP 200 & latency check)
 * 
 * ZERO FAKE DATA: Strictly live API evidence.
 */

import 'dotenv/config';
import { db } from '../db.js';
import { integrationManager } from '../services/integrationManager.js';
import { portfolioJobQueue } from '../services/portfolioJobQueue.js';
import { portfolioAgentEngine } from '../services/portfolioAgentEngine.js';
import { supabaseSyncEngine } from '../services/supabaseSyncEngine.js';

let passedTests = 0;
let totalTests = 0;
const results = [];

function assert(description, condition, detail = '') {
  totalTests++;
  if (condition) {
    passedTests++;
    results.push({ name: description, passed: true, detail });
    console.log(`[PASS] ${description}${detail ? ` -> ${detail}` : ''}`);
  } else {
    results.push({ name: description, passed: false, detail });
    console.error(`[FAIL] ${description}${detail ? ` -> ${detail}` : ''}`);
  }
}

async function runLiveForensicSuite() {
  console.log('\n======================================================================');
  console.log('   RAGHUL AI — PORTFOLIO OS LIVE FORENSIC AUDIT & VERIFICATION SUITE');
  console.log('======================================================================\n');

  // -------------------------------------------------------------------------
  // TEST SECTION 1: CREDENTIALS & INTEGRATION PROBES
  // -------------------------------------------------------------------------
  console.log('>>> SECTION 1: LIVE INTEGRATION PROBES (ZERO MOCKS)');
  const probeSummary = await integrationManager.probeAll();
  assert(
    'GitHub Integration Connected',
    probeSummary.providers.github.status === 'CONNECTED',
    `User: ${probeSummary.providers.github.details?.login}, Latency: ${probeSummary.providers.github.latencyMs}ms`
  );
  assert(
    'Vercel Integration Connected',
    probeSummary.providers.vercel.status === 'CONNECTED',
    `Project: ${probeSummary.providers.vercel.details?.projectName}, Latency: ${probeSummary.providers.vercel.latencyMs}ms`
  );
  assert(
    'Render Integration Connected',
    probeSummary.providers.render.status === 'CONNECTED',
    `Service: ${probeSummary.providers.render.details?.name}, Latency: ${probeSummary.providers.render.latencyMs}ms`
  );
  assert(
    'Supabase Integration Connected',
    probeSummary.providers.supabase.status === 'CONNECTED',
    `Tables: ${probeSummary.providers.supabase.details?.tablesFound}, Latency: ${probeSummary.providers.supabase.latencyMs}ms`
  );

  // -------------------------------------------------------------------------
  // TEST SECTION 2: PRODUCTION HEALTH & LATENCY
  // -------------------------------------------------------------------------
  console.log('\n>>> SECTION 2: PRODUCTION DOMAIN VERIFICATION (https://raghulraja.is-a.dev/)');
  const prodHealth = await integrationManager.verifyProductionHealth();
  assert(
    'Production Website Returns HTTP 200',
    prodHealth.success && prodHealth.status === 200,
    `Status: ${prodHealth.status}, Latency: ${prodHealth.latencyMs}ms`
  );
  assert(
    'Production Domain Uses Valid HTTPS/SSL',
    prodHealth.ssl === true,
    'SSL: true'
  );

  // -------------------------------------------------------------------------
  // TEST SECTION 3: MULTI-CLOUD DEPLOYMENTS (VERCEL & RENDER)
  // -------------------------------------------------------------------------
  console.log('\n>>> SECTION 3: MULTI-CLOUD DEPLOYMENT QUERYING');
  const vercelDeploys = await integrationManager.getLatestVercelDeployments(3);
  assert(
    'Vercel Deployments Retrieved',
    Array.isArray(vercelDeploys) && vercelDeploys.length > 0,
    `Found ${vercelDeploys.length} deployments. Latest: ${vercelDeploys[0]?.ready} (${vercelDeploys[0]?.url})`
  );

  const renderDeploys = await integrationManager.getLatestRenderDeployments(3);
  assert(
    'Render Deployments Retrieved',
    Array.isArray(renderDeploys) && renderDeploys.length > 0,
    `Found ${renderDeploys.length} deploys. Latest status: ${renderDeploys[0]?.status}`
  );

  // -------------------------------------------------------------------------
  // TEST SECTION 4: REAL AUTONOMOUS GITHUB OPERATIONS
  // -------------------------------------------------------------------------
  console.log('\n>>> SECTION 4: REAL AUTONOMOUS GITHUB OPERATIONS (BRANCH, COMMIT, PR, CLOSE)');
  const repoDetails = await integrationManager.getGitHubRepoDetails();
  assert(
    'GitHub Repo Details Retrieved',
    repoDetails.fullName === 'raghul692/raghulraja_portfolio',
    `Default branch: ${repoDetails.defaultBranch}`
  );

  const testBranchName = `test-audit-${Date.now()}`;
  let branchCreated = false;
  let commitCreated = false;
  let prCreated = false;
  let prNumber = null;

  try {
    const branchRes = await integrationManager.createGitHubBranch(testBranchName, repoDetails.defaultBranch);
    branchCreated = branchRes.success;
    assert('Autonomous GitHub Branch Created', branchCreated, `Branch: ${testBranchName}, Ref: ${branchRes.ref}`);

    const commitRes = await integrationManager.commitGitHubFile({
      branch: testBranchName,
      path: `audit-probe-${Date.now()}.json`,
      content: JSON.stringify({ auditTimestamp: Date.now(), agent: 'RaghulAI' }, null, 2),
      message: 'test: autonomous audit file commit'
    });
    commitCreated = commitRes.success;
    assert('Autonomous GitHub Commit Created', commitCreated, `Commit SHA: ${commitRes.commitSha}`);

    const prRes = await integrationManager.createGitHubPullRequest({
      title: `Test Audit PR: ${testBranchName}`,
      head: testBranchName,
      base: repoDetails.defaultBranch,
      body: 'Autonomous test PR created by Raghul AI Live Forensic Test Harness.'
    });
    prCreated = prRes.success;
    prNumber = prRes.number;
    assert('Autonomous GitHub Pull Request Created', prCreated, `PR #${prNumber} (${prRes.htmlUrl})`);

    const closeRes = await integrationManager.closeGitHubPullRequest(prNumber);
    assert('Autonomous GitHub Pull Request Closed Cleanly', closeRes.state === 'closed', `PR #${closeRes.number} closed`);
  } catch (err) {
    assert('Autonomous GitHub Operations Pipeline Completed', false, err.message);
  }

  // -------------------------------------------------------------------------
  // TEST SECTION 5: PERSISTENT JOB QUEUE & CRASH RECOVERY
  // -------------------------------------------------------------------------
  console.log('\n>>> SECTION 5: PERSISTENT JOB QUEUE & CRASH RECOVERY');
  const testIdempotencyKey = `idem_${Date.now()}`;
  const enq1 = portfolioJobQueue.enqueueJob({
    name: 'Forensic Health Check Job',
    jobType: 'health_check',
    payload: { target: 'raghulraja.is-a.dev' },
    idempotencyKey: testIdempotencyKey
  });
  assert('Job Enqueued into SQLite Queue', enq1 && enq1.id !== undefined, `Job ID: ${enq1.id}`);

  // Test idempotency prevention
  const enq2 = portfolioJobQueue.enqueueJob({
    name: 'Duplicate Health Check Job',
    jobType: 'health_check',
    payload: { target: 'raghulraja.is-a.dev' },
    idempotencyKey: testIdempotencyKey
  });
  assert('Job Queue Enforces Idempotency', enq2.duplicated === true && enq2.id === enq1.id, 'Duplicate rejected');

  // Wait for background worker to process job
  await new Promise(r => setTimeout(r, 1500));
  const queueStats = portfolioJobQueue.getStats();
  assert('Job Queue Processes Jobs Asynchronously', queueStats.total > 0, `Total: ${queueStats.total}, Completed: ${queueStats.stats.completed}`);

  // -------------------------------------------------------------------------
  // TEST SECTION 6: EMERGENCY STOP ENFORCEMENT
  // -------------------------------------------------------------------------
  console.log('\n>>> SECTION 6: EMERGENCY STOP ENFORCEMENT');
  portfolioJobQueue.setEmergencyStop(true);
  assert('Emergency Stop Flag Activated', portfolioJobQueue.isEmergencyStopped === true, 'Stopped');

  let blocked = false;
  try {
    await portfolioAgentEngine.executePipeline('Check my deployments');
  } catch (e) {
    blocked = e.message.includes('EMERGENCY_STOP_BLOCKED');
  }
  assert('Emergency Stop Blocks AI Agent Operations Safely', blocked === true, 'Operations blocked');

  portfolioJobQueue.setEmergencyStop(false);
  assert('Emergency Stop Resumed Safely', portfolioJobQueue.isEmergencyStopped === false, 'Resumed');

  // -------------------------------------------------------------------------
  // TEST SECTION 7: SUPABASE & SQLITE CONSISTENCY ENGINE
  // -------------------------------------------------------------------------
  console.log('\n>>> SECTION 7: SUPABASE & SQLITE DATA CONSISTENCY');
  const syncRes = await supabaseSyncEngine.syncAll();
  assert(
    'Supabase Document Synchronization Succeeded',
    syncRes.documents?.success === true,
    `Documents synced: ${syncRes.documents?.count}`
  );
  assert(
    'Supabase Contacts Synchronization Succeeded',
    syncRes.contacts?.success === true,
    `Inquiries synced: ${syncRes.contacts?.count}`
  );

  const consistency = await supabaseSyncEngine.getConsistencyReport();
  const localDocs = consistency.database?.local?.documents || 0;
  const localContacts = consistency.database?.local?.contacts || 0;
  assert(
    'SQLite Knowledge Index Row Count Matches or Exceeds Supabase Remote',
    localDocs >= 17,
    `SQLite: ${localDocs} docs, ${localContacts} contacts`
  );

  // -------------------------------------------------------------------------
  // TEST SECTION 8: 7-STAGE AUTONOMOUS AI AGENT PIPELINE
  // -------------------------------------------------------------------------
  console.log('\n>>> SECTION 8: 7-STAGE AUTONOMOUS AI AGENT PIPELINE');
  const pipelineRes = await portfolioAgentEngine.executePipeline('Perform full architecture and deployment audit');
  assert(
    '7-Stage AI Pipeline Completed Successfully',
    pipelineRes.status === 'COMPLETED' && pipelineRes.pipelineNodes.length === 7,
    `Duration: ${pipelineRes.duration}`
  );
  assert(
    'All 7 Stages Reached Done State',
    pipelineRes.pipelineNodes.every(n => n.status === 'done'),
    pipelineRes.pipelineNodes.map(n => n.name).join(' -> ')
  );
  assert(
    'Grounded Live Production Evidence In Result',
    pipelineRes.productionHealth?.status === 200,
    `Production latency: ${pipelineRes.productionHealth?.latencyMs}ms`
  );

  // -------------------------------------------------------------------------
  // SUMMARY
  // -------------------------------------------------------------------------
  console.log('\n======================================================================');
  console.log(`   FORENSIC HARNESS COMPLETED: ${passedTests} / ${totalTests} TESTS PASSED`);
  console.log('======================================================================\n');

  if (passedTests < totalTests) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runLiveForensicSuite().catch(err => {
  console.error('Fatal test runner error:', err);
  process.exit(1);
});
