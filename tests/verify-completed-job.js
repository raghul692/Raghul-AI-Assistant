import { researchRepository } from '../research/db/repository.js';
import { generateAndValidateReportPdf } from '../research/publishing/pdfEngine.js';
import fs from 'fs';

async function run() {
  const jobId = 'job_1794238231495_4yhkbs';
  console.log(`================================================================`);
  console.log(`🔍 AUDITING REAL EXECUTED JOB IN SQLITE: ${jobId}`);
  console.log(`================================================================\n`);

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

  // 1. Job Record
  const job = researchRepository.getJob(jobId);
  assert(job && job.id === jobId, `Job record exists: ${jobId}`);
  assert(job.status === 'COMPLETED', `Job status is COMPLETED (${job.status})`);
  assert(job.user_query.includes('Multi-Agent System architectures in 2026'), 'User query verified');

  // 2. Sources Record
  const sources = researchRepository.getSources(jobId);
  assert(Array.isArray(sources) && sources.length >= 20, `Discovered & saved ${sources.length} sources`);
  console.log(`   - Sample sources:`);
  for (const s of sources.slice(0, 3)) {
    console.log(`     * [${(s.credibility_score || 0).toFixed(2)}] ${s.title?.slice(0, 50)} (${s.url})`);
  }

  // 3. Evidence Items Record
  const evidence = researchRepository.getEvidenceByJobId(jobId);
  assert(Array.isArray(evidence) && evidence.length >= 20, `Extracted & saved ${evidence.length} evidence passages`);
  console.log(`   - Sample evidence snippet: "${evidence[0]?.snippet?.slice(0, 90)}..."`);

  // 4. Claims Record
  const claims = researchRepository.getClaims(jobId);
  assert(Array.isArray(claims) && claims.length >= 20, `Extracted & saved ${claims.length} atomic claims`);
  const verified = claims.filter(c => c.verification_status === 'SUPPORTED');
  console.log(`   - Total Claims: ${claims.length}`);
  console.log(`   - Verified (SUPPORTED): ${verified.length}`);
  console.log(`   - Sample claim: "${(claims[0]?.statement || claims[0]?.claim_text)?.slice(0, 90)}..."`);
  assert(verified.length > 0, `At least 1 claim verified (actually verified: ${verified.length})`);

  // 5. Sections
  const sections = researchRepository.getSectionsByJobId(jobId);
  assert(Array.isArray(sections) && sections.length > 0, `Report synthesized with ${sections.length} chapters/sections`);

  // 6. Generate and Validate PDF
  const combinedMarkdown = sections.map(s => `## ${s.title}\n\n${s.content_markdown}`).join('\n\n');
  const pdfRes = await generateAndValidateReportPdf(jobId, combinedMarkdown, {
    title: 'Multi-Agent System Architectures in 2026: LangGraph, CrewAI, AutoGen',
    sourcesCount: sources.length,
    citationsCount: sources.length
  });

  assert(pdfRes && pdfRes.success === true, 'A4 publication PDF generated successfully');
  assert(fs.existsSync(pdfRes.pdfPath), `PDF file exists on disk: ${pdfRes.pdfPath}`);
  assert(pdfRes.validation.fileSizeBytes > 50000, `Valid file size: ${(pdfRes.validation.fileSizeBytes / 1024).toFixed(1)} KB`);
  assert(pdfRes.validation.numPages >= 1, `PDF pages: ${pdfRes.validation.numPages}`);
  assert(pdfRes.validation.characterCount > 200, `PDF text layer verified (${pdfRes.validation.characterCount} extractable characters)`);

  console.log(`\n================================================================`);
  console.log(`🏁 REAL COMPLETED JOB AUDIT: ${passed} PASSED | ${failed} FAILED`);
  console.log(`📄 Generated Report Deliverable: ${pdfRes.pdfPath}`);
  console.log(`================================================================\n`);

  if (failed > 0) process.exit(1);
}

run();
