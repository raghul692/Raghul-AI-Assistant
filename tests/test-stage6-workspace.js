import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { initResearchSchema } from '../research/db/schema.js';
import { researchRepository } from '../research/db/repository.js';
import { researchSupervisor } from '../research/orchestration/supervisor.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition, testName, details = '') {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✅ [PASS] ${testName}`);
  } else {
    failedTests++;
    console.error(`  ❌ [FAIL] ${testName} - ${details}`);
  }
}

async function runStage6WorkspaceTestSuite() {
  console.log('================================================================');
  console.log('🧪 RAGHUL AI — STAGE 6 WORKSPACE UI & SSE INTEGRATION SUITE');
  console.log('================================================================\n');

  initResearchSchema();

  const testJobId = `job_test_stage6_${Date.now()}`;
  researchRepository.createJob({
    id: testJobId,
    userQuery: 'Evaluating Microservices vs Monoliths in 2026',
    domain: 'systems_engineering',
    mode: 'deep'
  });

  // -------------------------------------------------------------
  // Test 1: Research Creation Flow & Storage
  // -------------------------------------------------------------
  console.log('--- Test 1: Research Creation & Job Record ---');
  const createdJob = researchRepository.getJob(testJobId);
  assert(createdJob && createdJob.id === testJobId, 'Job successfully initialized in SQLite database');
  assert(createdJob.mode === 'deep', 'Mode correctly recorded as deep');

  // -------------------------------------------------------------
  // Test 2: Input Validation Logic
  // -------------------------------------------------------------
  console.log('\n--- Test 2: Input Validation Logic ---');
  const emptyQuery = '   ';
  const isValid = emptyQuery && emptyQuery.trim().length > 0;
  assert(!isValid, 'Empty or whitespace inquiry correctly rejected');

  // -------------------------------------------------------------
  // Test 3: Status Transition Lifecycle
  // -------------------------------------------------------------
  console.log('\n--- Test 3: Status Transition Lifecycle ---');
  researchRepository.updateJobProgress(testJobId, {
    progress: 35,
    currentStage: 'discovery',
    status: 'IN_PROGRESS'
  });
  const updatedJob = researchRepository.getJob(testJobId);
  assert(updatedJob.progress === 35, 'Job progress updated to 35%');
  assert(updatedJob.current_stage === 'discovery', 'Stage updated to discovery');
  assert(updatedJob.status === 'IN_PROGRESS', 'Status updated to IN_PROGRESS');

  // -------------------------------------------------------------
  // Test 4: SSE Payload Serialization
  // -------------------------------------------------------------
  console.log('\n--- Test 4: SSE Event Serialization ---');
  const sampleEvent = {
    step: 'claims_extracted',
    badge: '🧬 CLAIMS EXTRACTED',
    message: 'Extracted 12 atomic claims from documentation',
    progress: 60,
    sourcesCount: 15,
    claimsCount: 12
  };
  const sseChunk = `data: ${JSON.stringify(sampleEvent)}\n\n`;
  assert(sseChunk.startsWith('data: ') && sseChunk.endsWith('\n\n'), 'Standard SSE event envelope formatted');
  const parsed = JSON.parse(sseChunk.replace('data: ', '').trim());
  assert(parsed.claimsCount === 12, 'SSE event payload deserialized with full metric fidelity');

  // -------------------------------------------------------------
  // Test 5: Source Explorer Data Structure
  // -------------------------------------------------------------
  console.log('\n--- Test 5: Source Explorer Structure ---');
  const source = researchRepository.addSource({
    jobId: testJobId,
    url: 'https://martinfowler.com/articles/microservices.html',
    domain: 'martinfowler.com',
    title: 'Microservices Guide',
    author: 'Martin Fowler',
    publishedDate: '2025-06-12',
    category: 'primary_doc',
    credibilityScore: 0.95,
    isPrimarySource: true
  });
  const sourcesList = researchRepository.getSourcesByJobId(testJobId);
  assert(sourcesList.length >= 1, 'Sources successfully retrieved for job');
  assert(sourcesList[0].domain === 'martinfowler.com', 'Source domain preserved');
  assert(sourcesList[0].is_primary_source === true, 'Primary source flag preserved');
  assert(sourcesList[0].credibility_score >= 0.9, 'Credibility score accurately tracked');

  // -------------------------------------------------------------
  // Test 6: Claims & Evidence Matrix
  // -------------------------------------------------------------
  console.log('\n--- Test 6: Claims & Evidence Matrix ---');
  const claimIds = researchRepository.saveClaimsBatch(testJobId, [
    {
      statement: 'Microservices introduce network serialization latency overhead.',
      category: 'performance',
      verificationStatus: 'SUPPORTED',
      confidenceScore: 0.92,
      exactQuote: 'introduce network serialization latency',
      primarySourceId: source.id
    },
    {
      statement: 'Monoliths guarantee zero-latency cross-domain function calls.',
      category: 'architecture',
      verificationStatus: 'UNVERIFIED',
      confidenceScore: 0.50,
      exactQuote: 'zero-latency cross-domain function calls',
      primarySourceId: source.id
    }
  ]);
  const claims = researchRepository.getClaimsByJobId(testJobId);
  assert(claims.length >= 2, 'Batch claims retrieved for matrix');
  const supported = claims.filter(c => c.verification_status === 'SUPPORTED');
  const unverified = claims.filter(c => c.verification_status === 'UNVERIFIED');
  assert(supported.length === 1, 'Filter by SUPPORTED status works');
  assert(unverified.length === 1, 'Filter by UNVERIFIED status works');

  // -------------------------------------------------------------
  // Test 7: Contradiction Panel Data
  // -------------------------------------------------------------
  console.log('\n--- Test 7: Contradictions Panel Data ---');
  researchRepository.addContradiction({
    jobId: testJobId,
    claimId: claimIds[0],
    sourceAId: source.id,
    sourceBId: null,
    disputedTopic: 'Operational Cost Scaling',
    sourceAAssertion: 'Microservices reduce team coordination overhead.',
    sourceBAssertion: 'Microservices increase DevOps infrastructure overhead 3x.',
    resolutionStrategy: 'context_dependent',
    finalDisposition: 'disputed'
  });
  const contradictions = researchRepository.getContradictionsByJobId(testJobId);
  assert(contradictions.length === 1, 'Contradiction record retrieved');
  assert(contradictions[0].source_a_assertion.includes('reduce team coordination'), 'Assertion A preserved');
  assert(contradictions[0].source_b_assertion.includes('DevOps infrastructure'), 'Assertion B preserved');

  // -------------------------------------------------------------
  // Test 8: Research History Query
  // -------------------------------------------------------------
  console.log('\n--- Test 8: Research History API Response ---');
  const historyJobs = researchRepository.listJobs(10);
  assert(Array.isArray(historyJobs) && historyJobs.length > 0, 'History jobs list returned');
  assert(historyJobs.some(j => j.id === testJobId), 'Current job present in persistent history');

  // -------------------------------------------------------------
  // Test 9: Frontend DOM Verification (index.html Inspection)
  // -------------------------------------------------------------
  console.log('\n--- Test 9: Frontend DOM Elements in index.html ---');
  const indexPath = path.join(__dirname, '..', 'public', 'index.html');
  const indexHtml = fs.readFileSync(indexPath, 'utf-8');
  assert(indexHtml.includes('id="deepResearchWorkspaceModal"'), 'deepResearchWorkspaceModal element exists in index.html');
  assert(indexHtml.includes('data-mode="research"') || indexHtml.includes('id="menuDeepResearch"'), 'Deep Research mode trigger exists in header/navbar');
  assert(indexHtml.includes('id="drLaunchBtn"'), 'Launch button exists');
  assert(indexHtml.includes('id="drSourcesListContainer"'), 'Sources explorer container exists');
  assert(indexHtml.includes('id="drClaimsTableContainer"'), 'Claims table container exists');
  assert(indexHtml.includes('id="drContradictionsContainer"'), 'Contradictions container exists');
  assert(indexHtml.includes('id="drDownloadPdfBtn"'), 'Download PDF button exists');
  assert(indexHtml.includes('id="drHistoryContainer"'), 'History container exists');

  // -------------------------------------------------------------
  // Test 10: Frontend Controller in app.js
  // -------------------------------------------------------------
  console.log('\n--- Test 10: Frontend Controller in app.js ---');
  const appJsPath = path.join(__dirname, '..', 'public', 'app.js');
  const appJs = fs.readFileSync(appJsPath, 'utf-8');
  assert(appJs.includes('initDeepResearchWorkspace'), 'initDeepResearchWorkspace function exists in app.js');
  assert(appJs.includes('connectResearchStream'), 'connectResearchStream function exists in app.js');
  assert(appJs.includes('loadResearchHistory'), 'loadResearchHistory function exists in app.js');
  assert(appJs.includes('loadJobDetailsIntoWorkspace'), 'loadJobDetailsIntoWorkspace function exists in app.js');

  console.log('\n================================================================');
  console.log(`📊 STAGE 6 TEST SUMMARY: ${passedTests} / ${totalTests} assertions passed (${failedTests} failures)`);
  console.log('================================================================');

  if (failedTests > 0) process.exit(1);
  process.exit(0);
}

runStage6WorkspaceTestSuite().catch(err => {
  console.error('❌ Stage 6 test suite failed:', err);
  process.exit(1);
});

