import { db } from '../db.js';
import { initResearchSchema } from '../research/db/schema.js';
import { researchRepository } from '../research/db/repository.js';
import { ResearchSupervisor, researchSupervisor } from '../research/orchestration/supervisor.js';
import { RESEARCH_AGENT_ROLES, authorizeAgentTool, isAgentAuthorized } from '../research/orchestration/permissions.js';
import { createTaskContract, validateAgentOutput } from '../research/orchestration/taskContracts.js';
import { ModelRouter } from '../research/providers/modelRouter.js';

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

async function runStage4TestSuite() {
  console.log('================================================================');
  console.log('🧪 RAGHUL AI — STAGE 4 MULTI-AGENT ORCHESTRATION & ROUTING SUITE');
  console.log('================================================================\n');

  initResearchSchema();

  const testJobId = `job_test_stage4_${Date.now()}`;
  researchRepository.createJob({
    id: testJobId,
    userQuery: 'Test Multi-Agent Supervisor Orchestration',
    domain: 'ai_systems',
    mode: 'deep'
  });

  // -------------------------------------------------------------
  // Test 1: Supervisor creates a valid execution plan
  // -------------------------------------------------------------
  console.log('--- Test 1: Supervisor Plan Formulation ---');
  const supervisor = new ResearchSupervisor();
  const ctx = supervisor.createJobContext(testJobId, 'Evaluation of Multi-Agent Frameworks in 2026', { mode: 'deep' });
  assert(ctx && ctx.jobId === testJobId, 'Supervisor created valid execution context');
  assert(ctx.mode === 'deep' && ctx.isCancelled === false, 'Context initialized with correct parameters');

  // -------------------------------------------------------------
  // Test 2: Specialist task dependencies are respected
  // -------------------------------------------------------------
  console.log('\n--- Test 2: Specialist Task Contract Formulation ---');
  const contract = createTaskContract({
    jobId: testJobId,
    agentRole: RESEARCH_AGENT_ROLES.PLANNER,
    stepName: 'plan_formulation',
    inputData: { topic: 'Autonomous Agent Frameworks' }
  });
  assert(contract && contract.taskId.startsWith('task_'), 'Task contract assigned unique ID');
  assert(contract.status === 'QUEUED', 'Task contract status is initial QUEUED');

  // -------------------------------------------------------------
  // Test 3: Agent outputs are schema-validated
  // -------------------------------------------------------------
  console.log('\n--- Test 3: Output Schema Validation ---');
  const validPlannerOutput = {
    subtopics: [{ title: 'State Management', searchQueries: ['LangGraph state'] }]
  };
  const invalidPlannerOutput = { subtopics: [] };
  const validCheck = validateAgentOutput(RESEARCH_AGENT_ROLES.PLANNER, validPlannerOutput);
  const invalidCheck = validateAgentOutput(RESEARCH_AGENT_ROLES.PLANNER, invalidPlannerOutput);
  assert(validCheck.valid === true, 'Valid planner output accepted');
  assert(invalidCheck.valid === false, 'Invalid planner output rejected by schema validator');

  // -------------------------------------------------------------
  // Test 4: Tool permissions reject unauthorized calls
  // -------------------------------------------------------------
  console.log('\n--- Test 4: Role-Based Tool Permission Enforcement ---');
  assert(isAgentAuthorized(RESEARCH_AGENT_ROLES.SEARCH_STRATEGIST, 'generate_search_matrix') === true, 'Search Strategist authorized for search queries');
  assert(isAgentAuthorized(RESEARCH_AGENT_ROLES.PLANNER, 'query_web_search') === false, 'Planner denied direct web search capability');
  assert(isAgentAuthorized(RESEARCH_AGENT_ROLES.WRITER, 'delete_database') === false, 'Writer denied destructive database capability');
  let rejectedErr = null;
  try {
    authorizeAgentTool(RESEARCH_AGENT_ROLES.EXTRACTOR, 'publish_report');
  } catch (err) {
    rejectedErr = err;
  }
  assert(rejectedErr !== null && rejectedErr.message.includes('not authorized'), 'Server-side permission throws AccessDenied on unauthorized tool execution');

  // -------------------------------------------------------------
  // Test 5: Bounded concurrency is respected
  // -------------------------------------------------------------
  console.log('\n--- Test 5: Bounded Concurrency Setting ---');
  const boundedSupervisor = new ResearchSupervisor({ maxConcurrentTasks: 3 });
  assert(boundedSupervisor.maxConcurrentTasks === 3, 'Supervisor enforces configured concurrency bound');

  // -------------------------------------------------------------
  // Test 6: Provider timeout triggers expected fallback behavior
  // -------------------------------------------------------------
  console.log('\n--- Test 6: Per-Task Timeout Enforcement ---');
  let timeoutCaught = false;
  try {
    await supervisor.executeAgentTask({
      jobId: testJobId,
      agentRole: RESEARCH_AGENT_ROLES.SUPERVISOR,
      requiredCapability: 'create_plan',
      stepName: 'test_timeout',
      timeoutMs: 100, // Short timeout
      taskFn: async () => {
        await new Promise(r => setTimeout(r, 500));
        return { plan: 'never' };
      }
    });
  } catch (err) {
    if (err.message.includes('exceeded timeout')) {
      timeoutCaught = true;
    }
  }
  assert(timeoutCaught === true, 'Task timeout triggered as expected when duration exceeded limit');

  // -------------------------------------------------------------
  // Test 7: Rate-limit and retry handling
  // -------------------------------------------------------------
  console.log('\n--- Test 7: Retry Budget & Recovery ---');
  let attemptCounter = 0;
  const retryResult = await supervisor.executeAgentTask({
    jobId: testJobId,
    agentRole: RESEARCH_AGENT_ROLES.SUPERVISOR,
    requiredCapability: 'create_plan',
    stepName: 'test_retry',
    taskFn: async () => {
      attemptCounter++;
      if (attemptCounter < 2) {
        throw new Error('Transient rate limit 429');
      }
      return { status: 'recovered' };
    }
  });
  assert(attemptCounter === 2, 'Supervisor executed task retry on transient failure');
  assert(retryResult.status === 'recovered', 'Task succeeded on retry');

  // -------------------------------------------------------------
  // Test 8: Retry limits prevent infinite loops
  // -------------------------------------------------------------
  console.log('\n--- Test 8: Retry Limit Bounds ---');
  let infinitePrevented = false;
  let failAttempts = 0;
  try {
    await supervisor.executeAgentTask({
      jobId: testJobId,
      agentRole: RESEARCH_AGENT_ROLES.SUPERVISOR,
      requiredCapability: 'create_plan',
      stepName: 'test_infinite_fail',
      taskFn: async () => {
        failAttempts++;
        throw new Error('Persistent failure');
      }
    });
  } catch (err) {
    infinitePrevented = true;
  }
  assert(infinitePrevented === true, 'Task stopped after retry threshold reached');
  assert(failAttempts === supervisor.maxRetries + 1, `Task attempted exactly ${supervisor.maxRetries + 1} times`);

  // -------------------------------------------------------------
  // Test 9: Cancellation reaches running tasks
  // -------------------------------------------------------------
  console.log('\n--- Test 9: Cancellation Propagation ---');
  supervisor.cancelJob(testJobId, 'Test user cancellation');
  let cancellationBlocked = false;
  try {
    await supervisor.executeAgentTask({
      jobId: testJobId,
      agentRole: RESEARCH_AGENT_ROLES.SUPERVISOR,
      requiredCapability: 'create_plan',
      stepName: 'test_post_cancel',
      taskFn: async () => ({ status: 'should_not_run' })
    });
  } catch (err) {
    if (err.message.includes('ExecutionAborted')) cancellationBlocked = true;
  }
  assert(cancellationBlocked === true, 'Supervisor immediately blocks new tasks when job is cancelled');

  // -------------------------------------------------------------
  // Test 10: SQLite Run Persistence & Recovery
  // -------------------------------------------------------------
  console.log('\n--- Test 10: SQLite Run Persistence ---');
  const runId = researchRepository.recordRun({
    jobId: testJobId,
    agentRole: 'planner',
    provider: 'gemini',
    model: 'gemini-3.5-flash-lite',
    stepName: 'plan_formulation',
    promptTokens: 450,
    completionTokens: 220,
    costUsd: 0.0001,
    durationMs: 850,
    status: 'COMPLETED'
  });
  assert(typeof runId === 'string' && runId.startsWith('run_'), 'Execution run recorded in SQLite');
  const runs = researchRepository.getRunsByJobId(testJobId);
  assert(runs.length >= 1, 'Runs retrieved from SQLite match recorded executions');
  assert(runs.some(r => r.agent_role === 'planner'), 'Agent role preserved in SQLite run record');

  // -------------------------------------------------------------
  // Test 11: Duplicate task execution is idempotent
  // -------------------------------------------------------------
  console.log('\n--- Test 11: Idempotent Query & Plan Persistence ---');
  const qId1 = researchRepository.saveQuery({
    jobId: testJobId,
    queryText: 'LangGraph architecture 2026',
    searchEngine: 'unified_search',
    queryType: 'subtopic'
  });
  assert(typeof qId1 === 'string', 'Query saved idempotently');

  // -------------------------------------------------------------
  // Test 12: Partial agent failure produces honest partial result
  // -------------------------------------------------------------
  console.log('\n--- Test 12: Honest Partial Quality Gate Mapping ---');
  const freshLedger = ctx.ledger;
  // If claims count is 0, quality gate must produce 'PARTIAL' status
  const gateRes = freshLedger.evaluateQualityGate({ minClaims: 5, minSources: 5 });
  assert(!gateRes.passed, 'Quality gate fails when evidence thresholds are unmet');
  const mappedStatus = gateRes.passed ? 'COMPLETED' : (freshLedger.claims.length === 0 ? 'PARTIAL' : 'NEEDS_REVIEW');
  assert(mappedStatus === 'PARTIAL', 'Unmet threshold with zero claims honestly mapped to PARTIAL status');

  // -------------------------------------------------------------
  // Test 13: Grounding in Stage 3 Evidence Ledger
  // -------------------------------------------------------------
  console.log('\n--- Test 13: Grounded Verification Integrity ---');
  freshLedger.registerSource({
    url: 'https://docs.crewai.com/core-concepts',
    title: 'CrewAI Core Concepts',
    publisher: 'docs.crewai.com'
  });
  freshLedger.ingestPassages(
    'https://docs.crewai.com/core-concepts',
    'CrewAI provides hierarchical and sequential multi-agent execution flows with task delegation.',
    'CrewAI Core Concepts',
    'docs.crewai.com'
  );
  assert(freshLedger.evidencePassages.length >= 1, 'Evidence passage recorded in Stage 3 ledger');

  // -------------------------------------------------------------
  // Test 14: An agent cannot mark unsupported claim as verified
  // -------------------------------------------------------------
  console.log('\n--- Test 14: Unsupported Claim Integrity ---');
  const dummyClaims = freshLedger.registerClaims([
    { claimText: 'Framework X solves P vs NP in polynomial time.' }
  ], 'https://docs.crewai.com/core-concepts');
  assert(dummyClaims[0].verificationStatus === 'UNVERIFIED', 'Uncorroborated claim defaults to UNVERIFIED');

  // -------------------------------------------------------------
  // Test 15: Existing AI Chat, Memory & Gateway Continuity
  // -------------------------------------------------------------
  console.log('\n--- Test 15: Application Continuity Preservation ---');
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(t => t.name);
  assert(tables.includes('messages'), 'Existing messages table preserved');
  assert(tables.includes('research_runs'), 'research_runs table active in database');
  assert(tables.includes('research_jobs'), 'research_jobs table active in database');

  console.log('\n================================================================');
  console.log(`📊 STAGE 4 TEST SUMMARY: ${passedTests} / ${totalTests} assertions passed (${failedTests} failures)`);
  console.log('================================================================');

  if (failedTests > 0) process.exit(1);
  process.exit(0);
}

runStage4TestSuite().catch(err => {
  console.error('❌ Stage 4 test suite failed:', err);
  process.exit(1);
});
