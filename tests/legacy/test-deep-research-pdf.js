import fs from 'fs';

async function runLiveTests() {
  console.log('🧪 Starting Live Deep Research & Document Studio End-to-End Tests...\n');
  const BASE_URL = 'http://localhost:3000';
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

  // TEST 1: GET /api/documents
  console.log('1. Testing GET /api/documents endpoint...');
  const listRes = await fetch(`${BASE_URL}/api/documents`);
  assert(listRes.status === 200, 'GET /api/documents returns HTTP 200');
  const listJson = await listRes.json();
  assert(Array.isArray(listJson.documents), 'Response contains documents array');
  console.log(`     Found ${listJson.documents.length} existing documents in registry.`);

  // TEST 2: POST /api/documents/generate (IEEE Academic PDF)
  console.log('\n2. Testing POST /api/documents/generate (IEEE PDF)...');
  const genPdfRes = await fetch(`${BASE_URL}/api/documents/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      format: 'pdf',
      style: 'ieee',
      title: 'Neural Consensus Protocols in Edge Clusters',
      author: 'Nexus Lead Fellow',
      abstract: 'Formal proof of Byzantine fault tolerance in decentralized agent swarms.',
      sections: [
        {
          title: 'Introduction',
          content: 'Decentralized AI nodes require bounded consensus protocols to eliminate state divergence.'
        }
      ],
      tables: [
        {
          caption: 'Consensus Latency Across Node Counts',
          headers: ['Nodes', 'P50 (ms)', 'Packet Loss'],
          rows: [['4', '12ms', '0.0%'], ['16', '38ms', '0.01%']]
        }
      ]
    })
  });

  assert(genPdfRes.status === 200, 'POST /api/documents/generate returns HTTP 200');
  const pdfJson = await genPdfRes.json();
  assert(pdfJson.success && pdfJson.document && pdfJson.document.fileId, 'Document generated with valid fileId');
  const pdfFileId = pdfJson.document.fileId;
  console.log(`     Generated PDF ID: ${pdfFileId} (${pdfJson.document.filename})`);

  // TEST 3: GET /api/documents/download/:fileId (Download Header Verification)
  console.log('\n3. Testing GET /api/documents/download/:fileId...');
  const downloadRes = await fetch(`${BASE_URL}/api/documents/download/${pdfFileId}`);
  assert(downloadRes.status === 200, 'Download endpoint returns HTTP 200');
  const dispHeader = downloadRes.headers.get('content-disposition');
  assert(dispHeader && dispHeader.includes('attachment'), `Content-Disposition is attachment (${dispHeader})`);
  const pdfBytes = await downloadRes.arrayBuffer();
  assert(pdfBytes.byteLength > 5000, `Downloaded PDF has substantial size (${pdfBytes.byteLength} bytes)`);

  // TEST 4: GET /api/documents/view/:fileId (Inline Preview Verification)
  console.log('\n4. Testing GET /api/documents/view/:fileId...');
  const viewRes = await fetch(`${BASE_URL}/api/documents/view/${pdfFileId}`);
  assert(viewRes.status === 200, 'View endpoint returns HTTP 200');
  const viewContentType = viewRes.headers.get('content-type');
  assert(viewContentType && viewContentType.includes('application/pdf'), `Content-Type is application/pdf (${viewContentType})`);
  const viewDispHeader = viewRes.headers.get('content-disposition');
  assert(viewDispHeader && viewDispHeader.includes('inline'), `Content-Disposition is inline (${viewDispHeader})`);

  // TEST 5: POST /api/documents/generate (Microsoft Word .docx)
  console.log('\n5. Testing POST /api/documents/generate (.docx Word)...');
  const genDocxRes = await fetch(`${BASE_URL}/api/documents/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      format: 'docx',
      title: 'Cloud Security Audit Specification',
      subtitle: 'Zero Trust Verification Framework',
      author: 'Nexus Security Fellow',
      abstract: 'Production audit criteria for cloud deployments.',
      sections: [
        {
          title: 'Scope of Evaluation',
          content: 'Auditing authentication boundaries and token lifetimes.',
          bullets: ['JWT rotation', 'mTLS service mesh', 'Least privilege RBAC']
        }
      ]
    })
  });

  assert(genDocxRes.status === 200, 'DOCX generation returns HTTP 200');
  const docxJson = await genDocxRes.json();
  assert(docxJson.document.format === 'docx', 'Generated document format is docx');
  const docxDownloadRes = await fetch(`${BASE_URL}/api/documents/download/${docxJson.document.fileId}`);
  assert(docxDownloadRes.status === 200, 'DOCX download endpoint works');

  // TEST 6: POST /api/documents/generate (PowerPoint .pptx)
  console.log('\n6. Testing POST /api/documents/generate (.pptx PowerPoint)...');
  const genPptxRes = await fetch(`${BASE_URL}/api/documents/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      format: 'pptx',
      title: 'Autonomous Multi-Agent Swarms',
      subtitle: 'Technical Briefing Deck',
      theme: 'dark',
      slides: [
        {
          category: 'Overview',
          title: 'Agent Coordination Topologies',
          cards: [
            { stat: '10x', title: 'Speedup', description: 'Parallelized problem decomposition' },
            { stat: '0%', title: 'Drift', description: 'Strict factual grounding graph' }
          ]
        }
      ]
    })
  });

  assert(genPptxRes.status === 200, 'PPTX generation returns HTTP 200');
  const pptxJson = await genPptxRes.json();
  assert(pptxJson.document.format === 'pptx', 'Generated document format is pptx');

  // TEST 7: POST /api/documents/edit (Dual-Engine Upload & Edit)
  console.log('\n7. Testing POST /api/documents/edit (Uploaded PDF Edit)...');
  const base64Pdf = Buffer.from(pdfBytes).toString('base64');
  const editRes = await fetch(`${BASE_URL}/api/documents/edit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      pdfBase64: base64Pdf,
      originalFilename: 'user_uploaded_paper.pdf',
      instructions: 'Add 1.5pt crisp border and page numbers',
      addBorder: true,
      addPageNumbers: true
    })
  });

  assert(editRes.status === 200, 'Edit endpoint returns HTTP 200');
  const editJson = await editRes.json();
  assert(editJson.success && editJson.document.downloadUrl, 'Edited PDF generated with download URL');

  // TEST 8: /api/chat/stream with /doc command
  console.log('\n8. Testing /api/chat/stream with /doc pptx command...');
  const chatRes = await fetch(`${BASE_URL}/api/chat/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: '/doc pptx Autonomous Distributed Systems',
      sessionId: 'test-session-doc'
    })
  });

  assert(chatRes.status === 200, 'Chat stream returns HTTP 200');
  const reader = chatRes.body.getReader();
  const decoder = new TextDecoder();
  let receivedText = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    receivedText += decoder.decode(value, { stream: true });
  }

  assert(receivedText.includes('document-action-card'), 'Chat stream output contains interactive Document Action Card');
  assert(receivedText.includes('Download PPTX'), 'Action Card contains Download PPTX link');
  assert(receivedText.includes('/api/documents/download/'), 'Action Card contains valid API download route');

  // TEST 9: /api/chat/stream with Uploaded PDF Editing
  console.log('\n9. Testing /api/chat/stream with uploaded PDF attachment...');
  const uploadChatRes = await fetch(`${BASE_URL}/api/chat/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: 'Please add a border and page numbers to this PDF document.',
      sessionId: 'test-session-upload',
      attachments: [
        {
          name: 'report_sample.pdf',
          mimeType: 'application/pdf',
          data: base64Pdf
        }
      ]
    })
  });

  assert(uploadChatRes.status === 200, 'Upload chat stream returns HTTP 200');
  const uploadReader = uploadChatRes.body.getReader();
  let uploadReceivedText = '';

  while (true) {
    const { done, value } = await uploadReader.read();
    if (done) break;
    uploadReceivedText += decoder.decode(value, { stream: true });
  }

  assert(uploadReceivedText.includes('document-action-card'), 'Upload edit stream outputs Document Action Card');
  assert(uploadReceivedText.includes('Download Edited PDF'), 'Upload edit stream contains Download Edited PDF button');
  assert(uploadReceivedText.includes('Open Preview'), 'Upload edit stream contains Open Preview button');

  console.log(`\n🎉 ALL ${passed}/${total} LIVE END-TO-END TESTS PASSED (100%)!\n`);
}

runLiveTests().catch(err => {
  console.error('\n❌ Live Test Failure:', err);
  process.exit(1);
});

