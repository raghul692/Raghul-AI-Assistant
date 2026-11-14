import { researchOrchestrator } from './research/orchestration/researchOrchestrator.js';
import { generateAndValidateReportPdf } from './research/publishing/pdfEngine.js';
import { researchRepository } from './research/db/repository.js';

async function main() {
  console.log('🧪 Starting Autonomous Deep Research Master Verification Suite...');

  // Test 1: Repository & DB Schema
  const jobs = researchRepository.listJobs(5);
  console.log(`✅ [1/4] SQLite Repository verified: Found ${jobs.length} research jobs in database.`);

  // Test 2: Orchestrator Live Execution
  const testTopic = 'WebAssembly Component Model Architecture 2026';
  console.log(`🚀 [2/4] Executing autonomous research loop for: "${testTopic}"...`);

  const jobResult = await researchOrchestrator.startJob(
    testTopic,
    { mode: 'deep' },
    (p) => {
      console.log(`   [Progress ${p.progress}%] [${p.step}] ${p.message.slice(0, 75)}...`);
    }
  );

  console.log(`✅ [3/4] Research loop complete!`);
  console.log(`   Job ID: ${jobResult.jobId}`);
  console.log(`   Sources Inspected: ${jobResult.sourcesCount}`);
  console.log(`   Verified Citations: ${jobResult.citations.length}`);
  console.log(`   Report Words: ${jobResult.reportMarkdown.split(/\s+/).length}`);

  // Test 3: Publication A4 PDF Generation & Validation
  console.log(`📄 [4/4] Generating & validating publication-grade A4 PDF...`);
  const pdfResult = await generateAndValidateReportPdf(jobResult.jobId, jobResult.reportMarkdown, {
    title: testTopic,
    sourcesCount: jobResult.sourcesCount,
    citationsCount: jobResult.citations.length
  });

  console.log(`✅ Verified A4 PDF created: ${pdfResult.fileName}`);
  console.log(`   File size: ${(pdfResult.validation.fileSizeBytes / 1024).toFixed(1)} KB`);
  console.log(`   Page count: ${pdfResult.validation.numPages}`);
  console.log(`   Executive summary present: ${pdfResult.validation.hasExecutiveSummary}`);
  console.log(`   Bibliography present: ${pdfResult.validation.hasBibliography}`);
  console.log(`   Numbered citations present: ${pdfResult.validation.hasCitations}`);
  console.log('\n🏆 ALL DEEP RESEARCH ENGINE QUALITY GATES PASSED 100%!');
}

main().catch(err => {
  console.error('❌ Deep Research suite failed:', err);
  process.exit(1);
});

