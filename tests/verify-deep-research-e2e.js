import dotenv from 'dotenv';
dotenv.config();

import { researchOrchestrator } from '../research/orchestration/researchOrchestrator.js';
import { researchRepository } from '../research/db/repository.js';
import { generateAndValidateReportPdf } from '../research/publishing/pdfEngine.js';
import fs from 'fs';

async function run() {
  console.log('================================================================');
  console.log('🔬 VERIFY DEEP RESEARCH END-TO-END STAGE INTEGRATION (SECTION 5)');
  console.log('================================================================\n');

  const exactUserQuery = 'Production-grade Multi-Agent System architectures in 2026: Compare LangGraph, CrewAI, and AutoGen on execution latency, token costs, fault tolerance, and human-in-the-loop workflows. Include real enterprise case studies and GitHub benchmark repositories.';

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`✅ [PASS] ${message}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${message}`);
      failed++;
    }
  }

  const sseEvents = [];
  const onProgress = (p) => {
    sseEvents.push(p);
    console.log(`   [Stage Progress ${p.progress || 0}%] ${p.step}: ${p.message || ''}`);
  };

  console.log(`Executing Deep Research Job on exact user prompt:\n"${exactUserQuery}"\n`);
  const startTime = Date.now();

  try {
    const jobResult = await researchOrchestrator.startJob(
      exactUserQuery,
      { mode: 'quick' },
      onProgress
    );

    const duration = Date.now() - startTime;
    console.log(`\nExecution finished in ${(duration / 1000).toFixed(1)}s with status: ${jobResult.status}`);

    // 1. Job Creation & Persistence Check
    console.log('\n--- 1. Relational Persistence & Quality Gating ---');
    const dbJob = researchRepository.getJob(jobResult.jobId);
    assert(dbJob && dbJob.id === jobResult.jobId, `Job persisted in SQLite research_jobs table: ${jobResult.jobId}`);
    assert(dbJob.user_query === exactUserQuery, 'Persisted query matches original prompt verbatim');
    assert(['COMPLETED', 'PARTIAL', 'NEEDS_REVIEW'].includes(dbJob.status), `Valid final job status: ${dbJob.status}`);

    // 2. Plan & Queries Persistence Check
    const plan = researchRepository.getPlan(jobResult.jobId);
    assert(plan && Array.isArray(plan.subtopics) && plan.subtopics.length > 0, `Plan persisted with ${plan?.subtopics?.length || 0} subtopics`);

    const queries = researchRepository.getQueries(jobResult.jobId);
    assert(Array.isArray(queries) && queries.length > 0, `Generated & persisted ${queries.length} search queries`);

    // 3. Discovered Sources & Authority Check
    const sources = researchRepository.getSources(jobResult.jobId);
    assert(Array.isArray(sources) && sources.length >= 3, `Discovered & persisted ${sources.length} sources (min threshold satisfied)`);
    assert(sources.every(s => typeof s.authority_score === 'number'), 'All sources carry calculated authority scores');

    // 4. Evidence Passages Check
    const evidence = researchRepository.getEvidenceByJobId(jobResult.jobId);
    assert(Array.isArray(evidence) && evidence.length >= 2, `Extracted & persisted ${evidence.length} evidence passages`);

    // 5. Atomic Claims & Verification Check
    const claims = researchRepository.getClaims(jobResult.jobId);
    assert(Array.isArray(claims) && claims.length >= 1, `Extracted & persisted ${claims.length} atomic claims`);

    const verifiedClaims = claims.filter(c => c.verification_status === 'SUPPORTED');
    console.log(`   - Total Claims: ${claims.length}`);
    console.log(`   - Verified Claims: ${verifiedClaims.length}`);
    assert(claims.every(c => ['SUPPORTED', 'CONTRADICTED', 'UNVERIFIED', 'NEEDS_REVIEW'].includes(c.verification_status)), 'All claims adhere to canonical verification status enum');

    // 6. Report Markdown Synthesis Check
    console.log('\n--- 2. Publication Dossier & Deliverable Output ---');
    assert(Boolean(jobResult.reportMarkdown && jobResult.reportMarkdown.length > 500), `Synthesized publication report (${jobResult.reportMarkdown?.length || 0} chars)`);
    assert(jobResult.reportMarkdown.includes('Multi-Agent') || jobResult.reportMarkdown.includes('LangGraph') || jobResult.reportMarkdown.includes('CrewAI'), 'Report addresses core topic entities');

    // 7. A4 Publication PDF Generation & Text Layer Inspection
    console.log('\n--- 3. Verified A4 PDF Generation & Validation ---');
    const pdfRes = await generateAndValidateReportPdf(jobResult.jobId, jobResult.reportMarkdown, {
      title: 'Multi-Agent System Architectures in 2026',
      sourcesCount: sources.length,
      citationsCount: jobResult.citations?.length || sources.length
    });

    assert(pdfRes && pdfRes.success === true, 'PDF generation and structural validation succeeded');
    assert(fs.existsSync(pdfRes.filePath), `Physical PDF exists on disk: ${pdfRes.filePath}`);
    assert(pdfRes.validation.fileSizeBytes > 10000, `Valid PDF size: ${(pdfRes.validation.fileSizeBytes / 1024).toFixed(1)} KB`);
    assert(pdfRes.validation.numPages >= 1, `PDF pages: ${pdfRes.validation.numPages}`);
    assert(pdfRes.validation.hasTextLayer === true, 'PDF contains extractable text layer');

    // 8. Stage Lifecycle Progress SSE Verification
    console.log('\n--- 4. SSE Stage Progress Events ---');
    const stepNames = sseEvents.map(e => e.step);
    assert(stepNames.includes('planning'), 'SSE contained planning step');
    assert(stepNames.includes('discovery') || stepNames.includes('sources_discovered'), 'SSE contained discovery step');
    assert(stepNames.includes('extraction') || stepNames.includes('claims_extracted'), 'SSE contained extraction step');
    assert(stepNames.includes('synthesis'), 'SSE contained synthesis step');

  } catch (err) {
    console.error('Deep Research execution error:', err);
    assert(false, `Deep Research crashed with: ${err.message}`);
  }

  console.log('\n================================================================');
  console.log(`🏁 DEEP RESEARCH E2E SUITE RESULT: ${passed} PASSED | ${failed} FAILED`);
  console.log('================================================================\n');

  if (failed > 0) process.exit(1);
}

run();
