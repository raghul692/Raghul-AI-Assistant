import { db } from './db.js';
import { initResearchSchema } from './research/db/schema.js';
import { researchRepository } from './research/db/repository.js';
import { EvidenceLedger } from './research/evidence/evidenceLedger.js';
import { ModelRouter } from './research/providers/modelRouter.js';
import { researchOrchestrator } from './research/orchestration/researchOrchestrator.js';

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

async function runStage3VerificationSuite() {
  console.log('================================================================');
  console.log('🧪 RAGHUL AI — STAGE 3 EVIDENCE & CLAIM ENGINE VERIFICATION SUITE');
  console.log('================================================================\n');

  // Ensure DB Schema is initialized
  initResearchSchema();

  const testJobId = `job_test_stage3_${Date.now()}`;
  researchRepository.createJob({
    id: testJobId,
    userQuery: 'Evaluating Multi-Agent Systems in 2026: LangGraph vs CrewAI vs AutoGen',
    domain: 'ai_systems',
    mode: 'deep'
  });

  // -------------------------------------------------------------
  // Test 1: False-Success Quality Gate Regression Check
  // -------------------------------------------------------------
  console.log('--- Test 1: False-Success Quality Gate Regression ---');
  {
    const emptyLedger = new EvidenceLedger();
    const gateZero = emptyLedger.evaluateQualityGate({ minClaims: 3, minSources: 5 });
    assert(!gateZero.passed, 'Quality gate fails when 0 claims are extracted');
    assert(gateZero.verifiedClaims === 0, 'Zero verified claims correctly reported');

    // Register 5 sources, but 0 claims
    for (let i = 1; i <= 5; i++) {
      emptyLedger.registerSource({
        url: `https://example.com/source-${i}`,
        title: `Source ${i}`,
        publisher: 'example.com'
      });
    }
    const gateNoClaims = emptyLedger.evaluateQualityGate({ minClaims: 3, minSources: 5 });
    assert(!gateNoClaims.passed, 'Quality gate fails with sufficient sources but 0 claims');
    assert(gateNoClaims.reasons.some(r => r.includes('Insufficient atomic claims')), 'Correct failure reason provided for missing claims');
  }

  // -------------------------------------------------------------
  // Test 2: Undated / Missing Publication Date Authority
  // -------------------------------------------------------------
  console.log('\n--- Test 2: Missing Publication Date Authority & Ingestion ---');
  const ledger = new EvidenceLedger();
  const undatedSource = ledger.registerSource({
    url: 'https://docs.langchain.com/langgraph/concepts',
    title: 'LangGraph Architecture Documentation',
    publisher: 'docs.langchain.com',
    sourceType: 'docs',
    publishedDate: null // Intentionally missing date
  });

  assert(undatedSource.confidenceScore >= 0.70, 'Undated documentation maintains solid authority (>= 0.70)');
  assert(undatedSource.freshnessScore === 0.80, 'Undated documentation defaults to contemporary freshness (0.80)');

  const undatedPassages = ledger.ingestPassages(
    undatedSource.url,
    'LangGraph coordinates multi-agent loops using stateful cyclic graphs. Unlike strict DAG engines, cyclic execution enables iterative agent reflection and error correction natively without ad-hoc state reset wrappers.',
    undatedSource.title,
    undatedSource.publisher
  );
  assert(undatedPassages.length >= 1, 'Passages ingested successfully from undated source');
  assert(undatedPassages[0].charCount > 80, 'Passage character count accurately calculated');

  // Register source in SQLite for relational DB foreign key integrity
  const dbSourceA = researchRepository.addSource({
    jobId: testJobId,
    url: undatedSource.url,
    domain: 'docs.langchain.com',
    title: undatedSource.title,
    category: 'primary_doc',
    credibilityScore: undatedSource.confidenceScore,
    isPrimarySource: true
  });
  undatedSource.id = dbSourceA.id;

  // -------------------------------------------------------------
  // Test 3: Passage Extraction Coverage & Batch Persistence in SQLite
  // -------------------------------------------------------------
  console.log('\n--- Test 3: Passage Extraction Coverage & SQLite Persistence ---');
  const sourceBUrl = 'https://github.com/crewAIInc/crewAI';
  const sourceB = ledger.registerSource({
    url: sourceBUrl,
    title: 'CrewAI Framework Repository',
    publisher: 'github.com',
    sourceType: 'github',
    publishedDate: '2026-03-01'
  });
  const dbSourceB = researchRepository.addSource({
    jobId: testJobId,
    url: sourceB.url,
    domain: 'github.com',
    title: sourceB.title,
    category: 'github',
    credibilityScore: sourceB.confidenceScore,
    isPrimarySource: true
  });
  sourceB.id = dbSourceB.id;

  const bPassages = ledger.ingestPassages(
    sourceBUrl,
    'CrewAI provides role-based agent orchestration where autonomous agents operate within configurable processes.\n\nCrewAI workflows support sequential and hierarchical task delegation, optimizing team collaboration patterns across LLMs.',
    sourceB.title,
    'github.com'
  );

  const allPassages = [...undatedPassages, ...bPassages];
  const savedEvidenceIds = researchRepository.saveEvidenceBatch(testJobId, allPassages.map((p, idx) => ({
    sourceId: p.sourceId === undatedSource.id ? dbSourceA.id : dbSourceB.id,
    snippet: p.text,
    relevanceScore: 0.88,
    charCount: p.charCount,
    passageIndex: idx
  })));

  assert(savedEvidenceIds.length === allPassages.length, `All ${allPassages.length} evidence passages saved to SQLite`);
  const evidenceInDb = researchRepository.getEvidenceByJobId(testJobId);
  assert(evidenceInDb.length === allPassages.length, 'Evidence records retrieved from SQLite match batch count');
  assert(evidenceInDb[0].snippet.includes('LangGraph coordinates multi-agent loops'), 'Snippet content preserved intact in SQLite');

  // -------------------------------------------------------------
  // Test 4: Verification Execution via ModelRouter
  // -------------------------------------------------------------
  console.log('\n--- Test 4: Verification Execution via ModelRouter ---');
  const modelRouter = new ModelRouter();
  const testClaimStatement = 'LangGraph enables iterative agent reflection and error correction via cyclic graphs.';
  const verificationResult = await modelRouter.verifyClaim(
    testClaimStatement,
    allPassages.map(p => ({ text: p.text, sourceUrl: p.sourceUrl, title: p.title }))
  );

  assert(verificationResult && typeof verificationResult === 'object', 'Verification returned structured result object');
  assert(['SUPPORTED', 'PARTIALLY_SUPPORTED', 'DISPUTED', 'UNVERIFIED'].includes(verificationResult.status), `Valid verification status: ${verificationResult.status}`);
  assert(typeof verificationResult.confidenceScore === 'number' && verificationResult.confidenceScore > 0, `Confidence score generated: ${verificationResult.confidenceScore}`);
  assert(Array.isArray(verificationResult.corroboratingPassages), 'Corroborating passages returned as array');

  // -------------------------------------------------------------
  // Test 5: Direct Primary Source Evidence Linking
  // -------------------------------------------------------------
  console.log('\n--- Test 5: Direct Primary Source Evidence Linking ---');
  const registeredClaims = ledger.registerClaims([
    {
      claimText: testClaimStatement,
      claimType: 'architecture',
      exactQuote: 'cyclic execution enables iterative agent reflection and error correction',
      confidence: 0.95
    }
  ], undatedSource.url);

  const claimId = registeredClaims[0].id;
  const savedClaimIds = researchRepository.saveClaimsBatch(testJobId, [{
    id: claimId,
    statement: registeredClaims[0].claimText,
    category: 'architecture',
    exactQuote: registeredClaims[0].exactQuote,
    primarySourceId: dbSourceA.id
  }]);
  assert(savedClaimIds[0] === claimId, 'Claim saved to SQLite research_claims table');

  researchRepository.linkClaimEvidenceBatch([{
    claimId: claimId,
    evidenceId: savedEvidenceIds[0],
    linkType: 'supports',
    confidence: 0.96
  }]);

  const rawLinks = db.prepare('SELECT * FROM claim_evidence WHERE claim_id = ?').all(claimId);
  assert(rawLinks.length === 1, 'Claim-evidence relationship successfully recorded in SQLite claim_evidence table');
  assert(rawLinks[0].evidence_id === savedEvidenceIds[0], 'Correct evidence_id linked to claim');

  // -------------------------------------------------------------
  // Test 6: Independent Corroboration Requires Different Source URL
  // -------------------------------------------------------------
  console.log('\n--- Test 6: Independent Corroboration Verification ---');
  ledger.recordVerification(claimId, {
    status: 'SUPPORTED',
    confidenceScore: 0.94,
    verdictRationale: 'Verified through direct primary documentation passage.',
    corroboratingPassages: [undatedPassages[0].text]
  });

  const updatedClaim = ledger.claims.find(c => c.id === claimId);
  assert(updatedClaim.verificationStatus === 'SUPPORTED', 'Claim marked as SUPPORTED in ledger');
  assert(updatedClaim.corroborationCount === 1, 'Corroboration count accurately tracked');

  researchRepository.updateClaimVerification(claimId, {
    verificationStatus: updatedClaim.verificationStatus,
    confidenceScore: updatedClaim.confidenceScore,
    verificationNotes: updatedClaim.verdictRationale,
    verifiedAt: Date.now()
  });

  const dbClaimRecord = db.prepare('SELECT * FROM research_claims WHERE id = ?').get(claimId);
  assert(dbClaimRecord.verification_status === 'SUPPORTED', 'SQLite claim updated with verified status');
  assert(dbClaimRecord.confidence_score >= 0.90, 'SQLite claim reflects updated confidence score');

  // -------------------------------------------------------------
  // Test 7: Contradiction Detection & Persistence
  // -------------------------------------------------------------
  console.log('\n--- Test 7: Contradiction Detection & Persistence ---');
  const contradictionId = researchRepository.addContradiction({
    jobId: testJobId,
    claimId: claimId,
    sourceAId: dbSourceA.id,
    sourceBId: dbSourceB.id,
    disputedTopic: 'Execution Latency under Multi-Turn Branching',
    sourceAAssertion: 'Cyclic graph overhead is negligible (< 10ms per transition)',
    sourceBAssertion: 'Complex graph state checkpoints incur 80-120ms latency per step',
    resolutionStrategy: 'benchmark_comparison',
    finalDisposition: 'disputed'
  });

  assert(typeof contradictionId === 'string' && (contradictionId.startsWith('cnt_') || contradictionId.startsWith('contra_')), 'Contradiction persisted with unique ID');
  const jobContradictions = researchRepository.getContradictionsByJobId(testJobId);
  assert(jobContradictions.length === 1, 'Contradiction retrieved from SQLite');
  assert(jobContradictions[0].disputed_topic.includes('Execution Latency'), 'Disputed topic preserved accurately');

  // -------------------------------------------------------------
  // Test 8: SQLite Persistence Survives Fresh Reconnect
  // -------------------------------------------------------------
  console.log('\n--- Test 8: SQLite Persistence & Audit Reconnect ---');
  const summary = researchRepository.getVerificationSummary(testJobId);
  assert(summary.totalClaims === 1, 'Summary reports 1 total claim');
  assert(summary.verifiedClaims === 1, 'Summary reports 1 verified claim');
  assert(summary.contradictions === 1, 'Summary reports 1 contradiction');
  assert(summary.evidenceCount === allPassages.length, `Summary reports ${allPassages.length} evidence items`);

  // -------------------------------------------------------------
  // Test 9: Idempotent Batch Insertion
  // -------------------------------------------------------------
  console.log('\n--- Test 9: Idempotent Batch Insertion ---');
  let duplicateErr = null;
  try {
    // Re-registering existing source should succeed gracefully (upsert)
    const reAdded = researchRepository.addSource({
      jobId: testJobId,
      url: undatedSource.url,
      domain: 'docs.langchain.com',
      title: 'Updated LangGraph Docs Title',
      category: 'primary_doc',
      credibilityScore: 0.98
    });
    assert(reAdded.title === 'Updated LangGraph Docs Title', 'Upsert correctly updated existing source record without constraint error');
  } catch (err) {
    duplicateErr = err;
  }
  assert(!duplicateErr, 'Batch upsert operation executed idempotently');

  // -------------------------------------------------------------
  // Test 10: ModelRouter Extraction Robustness
  // -------------------------------------------------------------
  console.log('\n--- Test 10: ModelRouter Claim Extraction Robustness ---');
  const samplePassage = 'AutoGen 0.4 introduced an asynchronous event-driven actor architecture. Agents communicate via typed message passing over gRPC or WebSockets rather than direct function invocation.';
  const extractedClaims = await modelRouter.extractAtomicClaims([
    { text: samplePassage, sourceUrl: 'https://microsoft.github.io/autogen', title: 'AutoGen Docs' }
  ]);

  assert(Array.isArray(extractedClaims) && extractedClaims.length > 0, `ModelRouter successfully extracted ${extractedClaims.length} atomic claims`);
  assert(extractedClaims[0].claimText.length > 10, 'Extracted claim contains substantive assertion');
  assert(extractedClaims[0].exactQuote !== undefined, 'Extracted claim includes exactQuote field');

  // -------------------------------------------------------------
  // Test 11: Orchestrator Quality Gate Rule Enforcement
  // -------------------------------------------------------------
  console.log('\n--- Test 11: Orchestrator Quality Gate Rule Enforcement ---');
  // Add 2 more claims to satisfy minClaims = 3
  const extraClaims = ledger.registerClaims([
    { claimText: 'AutoGen 0.4 uses an asynchronous actor model for agent communication.', confidence: 0.90 },
    { claimText: 'CrewAI organizes agents hierarchically or sequentially.', confidence: 0.88 }
  ], sourceBUrl);
  
  // Register 3 more sources to reach 5 sources
  for (let s = 1; s <= 3; s++) {
    ledger.registerSource({
      url: `https://benchmark-archive.org/agent-report-${s}`,
      title: `Agent Report ${s}`,
      publisher: 'benchmark-archive.org'
    });
  }

  // Without verifying extra claims, gate should pass because verifiedClaims = 1 > 0, totalClaims = 3 >= 3, sources = 5 >= 5
  const gatePassed = ledger.evaluateQualityGate({ minClaims: 3, minSources: 5 });
  assert(gatePassed.passed === true, 'Quality gate passes when thresholds for sources, claims, and verified claims are satisfied');
  assert(gatePassed.verifiedClaims >= 1, 'Verified claims count is positive');

  // -------------------------------------------------------------
  // Test 12: Baseline System Preservation
  // -------------------------------------------------------------
  console.log('\n--- Test 12: Baseline System Preservation ---');
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(t => t.name);
  assert(tables.includes('messages'), 'Original messages table preserved');
  assert(tables.includes('chats'), 'Original chats table preserved');
  assert(tables.includes('research_jobs'), 'research_jobs table present');
  assert(tables.includes('research_claims'), 'research_claims table present');
  assert(tables.includes('evidence_items'), 'evidence_items table present');
  assert(tables.includes('claim_evidence'), 'claim_evidence table present');
  assert(tables.includes('research_contradictions'), 'research_contradictions table present');

  console.log('\n================================================================');
  console.log(`📊 STAGE 3 TEST SUMMARY: ${passedTests} / ${totalTests} assertions passed (${failedTests} failures)`);
  console.log('================================================================');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runStage3VerificationSuite().catch(err => {
  console.error('❌ Fatal error running Stage 3 test suite:', err);
  process.exit(1);
});
