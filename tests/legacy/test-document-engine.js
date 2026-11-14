import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  generateIEEEPdf,
  generateExecutivePdf,
  generateDocxDocument,
  generatePptxDeck,
  editUploadedPdf,
  exportDataFile,
  getDocumentMetadata,
  listDocuments
} from './documentEngine.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runTests() {
  console.log('🧪 Starting Document Engine Integration Verification...\n');
  let passed = 0;
  let total = 0;

  function assert(condition, message) {
    total++;
    if (condition) {
      passed++;
      console.log(`  ✅ [PASS] ${message}`);
    } else {
      console.error(`  ❌ [FAIL] ${message}`);
      throw new Error(`Assertion failed: ${message}`);
    }
  }

  // TEST 1: IEEE 2-Column Academic Standard PDF
  console.log('1. Testing IEEE 2-Column Academic Standard PDF...');
  const ieeeRes = await generateIEEEPdf({
    title: 'Autonomous Swarm Intelligence in Edge Networks',
    authors: [
      { name: 'Raghul M.', affiliation: 'Lead AI Engineer, Nexus Labs' },
      { name: 'Dr. Sarah Lin', affiliation: 'Dept. of Computer Science, MIT' }
    ],
    abstract: 'This paper presents a formal evaluation of autonomous model context protocols across distributed edge topologies.',
    keywords: ['Edge Computing', 'Autonomous Agents', 'Model Context Protocol', 'Distributed Reasoning'],
    sections: [
      {
        title: 'Introduction',
        content: 'Distributed AI systems require bounded cognitive loops to minimize token footprint while maintaining factual consistency.'
      },
      {
        title: 'Architectural Mechanics',
        content: 'We instantiate a multi-tiered agent memory graph utilizing SQLite and vector graph edges for low-latency recall.'
      }
    ],
    tables: [
      {
        caption: 'Latency & Memory Benchmarks across Topologies',
        headers: ['Topology', 'P50 Latency (ms)', 'P99 Latency (ms)', 'Memory Footprint (MB)'],
        rows: [
          ['Centralized Monolith', '142', '318', '240'],
          ['Edge Swarm (Ours)', '18', '42', '36']
        ]
      }
    ],
    citations: [
      { authors: 'J. Vaswani et al.', title: 'Attention Is All You Need', journal: 'NeurIPS', year: '2017' },
      { authors: 'Anthropic Core Team', title: 'The Model Context Protocol Specification', journal: 'MCP Standards', year: '2024', url: 'https://modelcontextprotocol.io' }
    ]
  });

  assert(ieeeRes && ieeeRes.fileId && ieeeRes.format === 'pdf', 'IEEE PDF returns valid file metadata');
  assert(fs.existsSync(ieeeRes.path), 'IEEE PDF file exists on disk');
  const ieeeBuffer = fs.readFileSync(ieeeRes.path);
  assert(ieeeBuffer.slice(0, 4).toString() === '%PDF', 'IEEE PDF contains valid %PDF magic header');
  assert(ieeeBuffer.length > 5000, `IEEE PDF has substantial size (${ieeeBuffer.length} bytes)`);

  // TEST 2: Modern Executive Corporate Standard PDF
  console.log('\n2. Testing Modern Executive Corporate Standard PDF...');
  const execRes = await generateExecutivePdf({
    title: 'Q3 Enterprise AI Strategy & Cost Optimization Dossier',
    author: 'Principal AI Architect',
    organization: 'Nexus Global Systems',
    executiveSummary: 'By migrating from brute-force token prompting to targeted MCP tools, inference costs dropped by 68% while answer accuracy rose from 84% to 98.4%.',
    kpis: [
      { value: '68%', label: 'Cost Reduction', sub: 'vs legacy RAG' },
      { value: '98.4%', label: 'Fact Verification', sub: 'IEEE Standard' },
      { value: '18ms', label: 'Average P50', sub: 'Edge Inference' },
      { value: '100%', label: 'Local Execution', sub: 'Zero Leaks' }
    ],
    sections: [
      {
        title: 'Core Findings & ROI Drivers',
        content: 'The integration of the 5-tier MCP architecture enabled real-time reasoning and deterministic database verification.',
        bullets: [
          'Sequential Thinking prevented cognitive hallucination.',
          'SQLite Memory Graph retained multi-turn facts indefinitely.',
          'Local Chrome Headless engine produced publication-ready documents on-prem.'
        ]
      }
    ],
    citations: [
      { title: 'Nexus Enterprise Benchmark Study', url: 'https://nexus.local/research/enterprise-ai-benchmark' }
    ]
  });

  assert(execRes && execRes.fileId && execRes.format === 'pdf', 'Executive PDF returns valid file metadata');
  assert(fs.existsSync(execRes.path), 'Executive PDF exists on disk');
  const execBuffer = fs.readFileSync(execRes.path);
  assert(execBuffer.slice(0, 4).toString() === '%PDF', 'Executive PDF contains valid %PDF magic header');

  // TEST 3: Microsoft Word (.docx) Generator
  console.log('\n3. Testing Microsoft Word (.docx) Generator...');
  const docxRes = await generateDocxDocument({
    title: 'Enterprise Model Context Protocol Architecture',
    subtitle: 'Standard Operating Procedures & API Contracts',
    author: 'Nexus Lead Architect',
    abstract: 'This technical document formalizes the production deployment of local MCP servers.',
    sections: [
      {
        title: 'Introduction & Scope',
        content: 'All communication with desktop resources must pass through sandboxed JSON-RPC interfaces.',
        bullets: [
          'Zero execution of arbitrary unauthorized commands',
          'Human-in-the-loop review for high-risk mutations'
        ]
      }
    ],
    tables: [
      {
        headers: ['Server Name', 'Protocol', 'Security Tier'],
        rows: [
          ['Filesystem MCP', 'JSON-RPC Stdio', 'Tier-1 Scoped'],
          ['Knowledge Graph MCP', 'SQLite Memory', 'Tier-0 Safe']
        ]
      }
    ]
  });

  assert(docxRes && docxRes.fileId && docxRes.format === 'docx', 'Word DOCX returns valid metadata');
  assert(fs.existsSync(docxRes.path), 'Word DOCX file exists on disk');
  const docxBuffer = fs.readFileSync(docxRes.path);
  // Zip/DOCX magic bytes: PK (0x50, 0x4B)
  assert(docxBuffer[0] === 0x50 && docxBuffer[1] === 0x4B, 'Word DOCX contains valid PK zip header');
  assert(docxBuffer.length > 2000, `DOCX has substantial size (${docxBuffer.length} bytes)`);

  // TEST 4: PowerPoint (.pptx) Deck Generator (Dark & Light)
  console.log('\n4. Testing PowerPoint (.pptx) Deck Generator (Dual Theme)...');
  const pptxRes = await generatePptxDeck({
    title: 'Next-Gen Autonomous Agent Architecture',
    subtitle: 'From Static Prompts to Cognitive MCP Tooling',
    author: 'Nexus AI Fellow',
    theme: 'dark',
    slides: [
      {
        category: 'Market Shift',
        title: 'Why Standard Prompting Fails at Enterprise Scale',
        summary: 'Prompt bloating consumes token budget and introduces context drift.',
        cards: [
          { stat: '84%', title: 'Context Loss', description: 'Large context windows degrade reasoning depth exponentially.' },
          { stat: '3.8x', title: 'Latency Spike', description: 'Payload sizes exceeding 30k tokens incur severe latency.' },
          { stat: '99.9%', title: 'MCP Solution', description: 'Deterministic tool-calling fetches only relevant facts on-demand.' }
        ],
        speakerNotes: 'Emphasize the difference between stuffing context vs calling MCP tools on-demand.'
      },
      {
        category: 'Implementation',
        title: 'The 5-Tier Agentic Architecture',
        bullets: [
          'Tier 1: Sequential Thinking for recursive o1-style planning',
          'Tier 2: Knowledge Graph Memory for entity-relation durability',
          'Tier 3: Scoped Filesystem & Native Desktop Execution',
          'Tier 4: Enterprise Document Studio (PDF, DOCX, PPTX)',
          'Tier 5: External Productivity Connectors (Slack, Zapier, Linear)'
        ],
        speakerNotes: 'Walk through each layer from bottom to top.'
      }
    ]
  });

  assert(pptxRes && pptxRes.fileId && pptxRes.format === 'pptx', 'PPTX returns valid metadata');
  assert(fs.existsSync(pptxRes.path), 'PPTX file exists on disk');
  const pptxBuffer = fs.readFileSync(pptxRes.path);
  assert(pptxBuffer[0] === 0x50 && pptxBuffer[1] === 0x4B, 'PPTX contains valid PK zip header');

  // TEST 5: Dual-Engine PDF Editor (Engine A: Lossless Vector Overlay)
  console.log('\n5. Testing PDF Editor Engine A (Lossless Vector Overlay - Borders & Page Numbers)...');
  const editOverlayRes = await editUploadedPdf({
    pdfBuffer: ieeeBuffer,
    originalFilename: 'sample_research.pdf',
    instructions: 'Add crisp 1.5pt page border and page numbers at the bottom',
    addBorder: true,
    addPageNumbers: true
  });

  assert(editOverlayRes && editOverlayRes.format === 'pdf', 'PDF Editor returns valid edited file');
  assert(fs.existsSync(editOverlayRes.path), 'Edited PDF exists on disk');
  const editedBuffer = fs.readFileSync(editOverlayRes.path);
  assert(editedBuffer.slice(0, 4).toString() === '%PDF', 'Edited PDF has valid %PDF header');

  // TEST 6: Dual-Engine PDF Editor (Engine B: Structural Text Re-render)
  console.log('\n6. Testing PDF Editor Engine B (Structural Text Replacement & Font Change)...');
  const editReRenderRes = await editUploadedPdf({
    pdfBuffer: execBuffer,
    originalFilename: 'executive_memo.pdf',
    instructions: 'Change font to Arial, justify alignment, and replace 68% with 75%',
    textReplacements: [
      { find: '68%', replace: '75%' }
    ],
    fontName: 'Arial',
    restructureAlignment: true,
    addPageNumbers: true
  });

  assert(editReRenderRes && editReRenderRes.format === 'pdf', 'Structural PDF Editor returns valid edited file');
  assert(fs.existsSync(editReRenderRes.path), 'Structural Edited PDF exists on disk');

  // TEST 7: Data File Exporter
  console.log('\n7. Testing Data File Exporter (CSV & MD)...');
  const csvRes = exportDataFile({
    filename: 'agent_benchmarks.csv',
    content: 'Model,Tokens/sec,Accuracy,CostPerM\nNexus-Agent,185,98.4%,$0.15\nGPT-4o,110,88.2%,$2.50\n',
    format: 'csv'
  });
  assert(csvRes && fs.existsSync(csvRes.path), 'CSV file exported successfully');

  // TEST 8: Document Index & Registry Retrieval
  console.log('\n8. Testing Document Registry & Metadata Retrieval...');
  const meta = getDocumentMetadata(ieeeRes.fileId);
  assert(meta && meta.fileId === ieeeRes.fileId, 'Retrieved metadata matches generated file ID');
  const allDocs = listDocuments(10);
  assert(Array.isArray(allDocs) && allDocs.length >= 6, `Document registry lists all generated files (count: ${allDocs.length})`);

  console.log(`\n🎉 ALL ${passed}/${total} DOCUMENT ENGINE TESTS PASSED (100%)!\n`);
}

runTests().catch(err => {
  console.error('\n❌ Document Engine Test Failure:', err);
  process.exit(1);
});

