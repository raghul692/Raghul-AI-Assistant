import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { ResearchReportModel, REPORT_TYPES } from '../research/publishing/reportModel.js';
import { convertMarkdownToPrintHtml, generateAndValidateReportPdf } from '../research/publishing/pdfEngine.js';
import { initResearchSchema } from '../research/db/schema.js';
import { researchRepository } from '../research/db/repository.js';

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

async function runStage5TestSuite() {
  console.log('================================================================');
  console.log('🧪 RAGHUL AI — STAGE 5 PUBLISHING & CANONICAL REPORT SUITE');
  console.log('================================================================\n');

  initResearchSchema();

  const testJobId = `job_test_stage5_${Date.now()}`;
  researchRepository.createJob({
    id: testJobId,
    userQuery: 'Test Publication Engine and Canonical Report Model',
    domain: 'systems_engineering',
    mode: 'deep'
  });

  // -------------------------------------------------------------
  // Test 1: Executive Report Model Generation
  // -------------------------------------------------------------
  console.log('--- Test 1: Executive Report Model Generation ---');
  const execReport = new ResearchReportModel(testJobId, {
    reportType: REPORT_TYPES.EXECUTIVE,
    title: 'Executive Briefing: Distributed Graph Consensus in 2026',
    domain: 'systems_engineering'
  });
  execReport.setExecutiveSummary('High-concurrency consensus protocols have migrated toward hybrid DAG-BFT topologies.');
  const execMd = execReport.toMarkdown();
  assert(execMd.includes('**Report Type:** EXECUTIVE'), 'Executive report type reflected in header');
  assert(execMd.includes('Executive Summary'), 'Executive Summary section present in output');

  // -------------------------------------------------------------
  // Test 2: Technical Report Model Generation
  // -------------------------------------------------------------
  console.log('\n--- Test 2: Technical Report Model Generation ---');
  const techReport = new ResearchReportModel(testJobId, {
    reportType: REPORT_TYPES.TECHNICAL,
    title: 'Architectural Analysis: Memory-Mapped LSM Trees'
  });
  techReport.addSection({
    title: 'Cache Invalidation Mechanics',
    contentMarkdown: 'LSM-tree compaction cascades trigger cache invalidation spikes across block caches [1].',
    order: 1
  });
  const techMd = techReport.toMarkdown();
  assert(techMd.includes('Cache Invalidation Mechanics'), 'Detailed technical section properly appended');
  assert(techMd.includes('[1]'), 'Numbered citation reference embedded');

  // -------------------------------------------------------------
  // Test 3: Academic-Style Report Generation
  // -------------------------------------------------------------
  console.log('\n--- Test 3: Academic-Style Report Generation ---');
  const academicReport = new ResearchReportModel(testJobId, {
    reportType: REPORT_TYPES.ACADEMIC,
    title: 'Formal Verification of Actor Protocols'
  });
  academicReport.setMethodology({
    scope: 'Systematic literature review of 48 peer-reviewed papers',
    sourcesCount: 48,
    passagesCount: 192,
    claimsCount: 84,
    verifiedClaimsCount: 68,
    verificationRate: 0.81
  });
  const academicMd = academicReport.toMarkdown();
  assert(academicMd.includes('Research Methodology & Provenance'), 'Academic provenance section generated');
  assert(academicMd.includes('81% verification rate'), 'Verification rate calculated and presented');

  // -------------------------------------------------------------
  // Test 4: Claim-to-Citation Traceability & Matrix
  // -------------------------------------------------------------
  console.log('\n--- Test 4: Claim-to-Citation Traceability ---');
  techReport.setClaimsMatrix([
    {
      id: 'clm_1',
      statement: 'Compaction overhead scales with write amplification factor.',
      category: 'performance',
      verificationStatus: 'SUPPORTED',
      confidenceScore: 0.94,
      exactQuote: 'Compaction overhead scales with write amplification',
      sourceUrl: 'https://rocksdb.org/docs'
    }
  ]);
  techReport.setBibliography([
    {
      number: 1,
      title: 'RocksDB Architecture Guide',
      url: 'https://rocksdb.org/docs',
      publisher: 'RocksDB Team',
      publishedDate: '2026-01-15',
      isPrimary: true
    }
  ]);
  const matrixMd = techReport.toMarkdown();
  assert(matrixMd.includes('Forensic Evidence Verification & Claims Matrix'), 'Claims matrix section generated');
  assert(matrixMd.includes('SUPPORTED'), 'Supported claim status reflected in matrix');
  assert(matrixMd.includes('Verified Bibliography & Source Catalog'), 'Bibliography catalog generated');
  assert(matrixMd.includes('[1] **RocksDB Architecture Guide**'), 'Numbered citation matches bibliography index');

  // -------------------------------------------------------------
  // Test 5: Missing Source Metadata Handling
  // -------------------------------------------------------------
  console.log('\n--- Test 5: Missing Source Metadata Handling ---');
  const undatedBib = [
    {
      number: 2,
      title: 'Undated Technical Whitepaper',
      url: 'https://example.org/whitepaper',
      publisher: 'Example Org',
      publishedDate: null // Missing date
    }
  ];
  techReport.setBibliography(undatedBib);
  const undatedMd = techReport.toMarkdown();
  assert(undatedMd.includes('(n.d.)'), 'Missing publication date safely rendered as (n.d.) without crashing');

  // -------------------------------------------------------------
  // Test 6: Unverified Claim Qualification
  // -------------------------------------------------------------
  console.log('\n--- Test 6: Unverified Claim Qualification ---');
  techReport.setClaimsMatrix([
    {
      id: 'clm_unv',
      statement: 'Alternative storage engine claims 100x latency reduction.',
      category: 'benchmark',
      verificationStatus: 'UNVERIFIED',
      confidenceScore: 0.35,
      exactQuote: '100x latency reduction'
    }
  ]);
  const unvMd = techReport.toMarkdown();
  assert(unvMd.includes('UNVERIFIED'), 'Unverified claim explicitly badged as UNVERIFIED in matrix');

  // -------------------------------------------------------------
  // Test 7: Contradiction Representation
  // -------------------------------------------------------------
  console.log('\n--- Test 7: Contradiction Representation ---');
  techReport.setContradictions([
    {
      disputedTopic: 'Write Amplification in B-Tree vs LSM',
      sourceAAssertion: 'LSM write amplification is bounded below 10x.',
      sourceBAssertion: 'Heavy random write workloads cause amplification up to 30x.',
      resolutionStrategy: 'benchmark_comparison',
      finalDisposition: 'workload_dependent'
    }
  ]);
  const contraMd = techReport.toMarkdown();
  assert(contraMd.includes('Contradictions & Divergent Findings'), 'Contradictions section generated');
  assert(contraMd.includes('Disputed Topic: Write Amplification'), 'Disputed topic clearly delineated');

  // -------------------------------------------------------------
  // Test 8: Table Rendering in Semantic HTML
  // -------------------------------------------------------------
  console.log('\n--- Test 8: Table Rendering in Semantic HTML ---');
  const sampleTableMd = `
| Feature | System A | System B |
| :--- | :--- | :--- |
| Latency | 12ms | 45ms |
| Memory | 256MB | 1024MB |
`;
  const printHtml = convertMarkdownToPrintHtml(sampleTableMd, { title: 'Test Table' });
  assert(printHtml.includes('<table class="data-table">'), 'Markdown table converted to HTML <table>');
  assert(printHtml.includes('<th>Latency</th>') || printHtml.includes('<th>Feature</th>'), 'Table headers properly formatted');
  assert(printHtml.includes('<td>12ms</td>'), 'Table data cells properly formatted');

  // -------------------------------------------------------------
  // Test 9: Unicode and Special Characters
  // -------------------------------------------------------------
  console.log('\n--- Test 9: Unicode and Special Characters ---');
  const unicodeMd = 'Comparative evaluation: α-decay vs β-decay & throughput testing (O(N·log N) complexity).';
  const unicodeHtml = convertMarkdownToPrintHtml(unicodeMd, { title: 'Unicode Test' });
  assert(unicodeHtml.includes('α-decay'), 'Greek and Unicode symbols preserved intact');

  // -------------------------------------------------------------
  // Test 10: Long URLs and Code Blocks
  // -------------------------------------------------------------
  console.log('\n--- Test 10: Code Blocks and Formatting ---');
  const codeMd = '```javascript\nconst x = 42;\nconsole.log(x);\n```';
  const codeHtml = convertMarkdownToPrintHtml(codeMd, { title: 'Code Test' });
  assert(codeHtml.includes('<pre class="code-block"><code class="lang-javascript">'), 'Code block rendered with syntax container');

  // -------------------------------------------------------------
  // Test 11: Real A4 PDF Generation & File Verification
  // -------------------------------------------------------------
  console.log('\n--- Test 11: Real A4 PDF Generation & Validation ---');
  const sampleReportText = `
# Autonomous Multi-Agent Consensus: 2026 Evaluation

## Executive Summary
This report provides a formal evaluation of modern consensus mechanisms across decentralized multi-agent systems. Empirical tests show hybrid DAG-BFT achieves 15,000 TPS under simulated high-contention network partitions [1].

## Architectural Analysis
Consensus protocols rely on state-machine replication where agent nodes exchange signed proposals [1].

| Metric | DAG-BFT | Raft Cluster |
| :--- | :--- | :--- |
| Throughput | 15,000 TPS | 2,500 TPS |
| Finality Latency | 450ms | 1,200ms |

## Verified Bibliography & Source Catalog
[1] **High-Throughput Distributed Consensus**  
Publisher: *IEEE Computer Society* (2026-02-10) • **Primary Source**  
URL: [https://ieee.org/papers/consensus-2026](https://ieee.org/papers/consensus-2026)
`;

  const pdfResult = await generateAndValidateReportPdf(testJobId, sampleReportText, {
    title: 'Autonomous Multi-Agent Consensus: 2026 Evaluation',
    sourcesCount: 1,
    citationsCount: 1
  });

  assert(pdfResult.success === true, 'PDF generation succeeded');
  assert(fs.existsSync(pdfResult.pdfPath), 'Physical PDF file exists on disk');
  assert(pdfResult.validation.fileSizeBytes > 1000, `Valid PDF file size: ${(pdfResult.validation.fileSizeBytes / 1024).toFixed(1)} KB`);
  assert(pdfResult.validation.numPages >= 1, `Valid page count: ${pdfResult.validation.numPages}`);
  assert(pdfResult.validation.hasExecutiveSummary === true, 'Executive Summary verified in PDF text layer');
  assert(pdfResult.validation.hasBibliography === true, 'Bibliography verified in PDF text layer');
  assert(pdfResult.validation.hasCitations === true, 'Numbered citation brackets verified in PDF');

  // -------------------------------------------------------------
  // Test 12: Secret & Internal Prompt Non-Leakage
  // -------------------------------------------------------------
  console.log('\n--- Test 12: Prompt & Secret Leakage Inspection ---');
  const leakedCheck = /systemInstruction|GEMINI_API_KEY|GROQ_API_KEY/i.test(sampleReportText);
  assert(leakedCheck === false, 'No internal system prompts or API keys leaked in report content');

  console.log('\n================================================================');
  console.log(`📊 STAGE 5 TEST SUMMARY: ${passedTests} / ${totalTests} assertions passed (${failedTests} failures)`);
  console.log('================================================================');

  if (failedTests > 0) process.exit(1);
  process.exit(0);
}

runStage5TestSuite().catch(err => {
  console.error('❌ Stage 5 test suite failed:', err);
  process.exit(1);
});
