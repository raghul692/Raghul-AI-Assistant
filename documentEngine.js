import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, BorderStyle, WidthType, AlignmentType, Header, Footer, PageNumber } from 'docx';
import PptxGenJS from 'pptxgenjs';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { PDFParse } = require('pdf-parse');

const execFileAsync = promisify(execFile);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const DOCS_DIR = path.join(__dirname, 'data', 'generated', 'documents');
fs.mkdirSync(DOCS_DIR, { recursive: true });

// Locate system Chromium / Chrome / Edge executable for headless A4 print
const CANDIDATE_CHROME_PATHS = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  process.env.CHROME_BIN || ''
];

let cachedBrowserExecutable = null;
export function getBrowserExecutable() {
  if (cachedBrowserExecutable && fs.existsSync(cachedBrowserExecutable)) {
    return cachedBrowserExecutable;
  }
  for (const p of CANDIDATE_CHROME_PATHS) {
    if (p && fs.existsSync(p)) {
      cachedBrowserExecutable = p;
      return p;
    }
  }
  return null;
}

/**
 * Generate a unique file ID
 */
export function generateDocId(prefix = 'doc') {
  const timestamp = Date.now();
  const rand = Math.random().toString(36).substring(2, 8);
  return `${prefix}_${timestamp}_${rand}`;
}

/**
 * Metadata Registry for Generated Documents
 */
const metadataIndexFile = path.join(__dirname, 'data', 'generated', 'documents_index.json');
function loadMetadataIndex() {
  try {
    if (fs.existsSync(metadataIndexFile)) {
      return JSON.parse(fs.readFileSync(metadataIndexFile, 'utf-8'));
    }
  } catch (e) {
    console.warn('[DocEngine] Index load notice:', e.message);
  }
  return {};
}

function saveDocMetadata(meta) {
  try {
    const idx = loadMetadataIndex();
    idx[meta.fileId] = {
      ...meta,
      createdAt: meta.createdAt || new Date().toISOString()
    };
    fs.writeFileSync(metadataIndexFile, JSON.stringify(idx, null, 2));
  } catch (e) {
    console.warn('[DocEngine] Index save notice:', e.message);
  }
}

export function getDocumentMetadata(fileId) {
  const idx = loadMetadataIndex();
  return idx[fileId] || null;
}

export function listDocuments(limit = 50) {
  const idx = loadMetadataIndex();
  return Object.values(idx).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, limit);
}

/**
 * Render any HTML string to a pixel-perfect A4 PDF using Headless Chrome/Edge
 */
export async function renderHtmlToPdf(htmlContent, outputPdfPath, options = {}) {
  const browserPath = getBrowserExecutable();
  if (!browserPath) {
    throw new Error('No compatible headless browser (Google Chrome or Microsoft Edge) found on the system.');
  }

  const tempHtmlPath = path.join(DOCS_DIR, `temp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}.html`);
  fs.writeFileSync(tempHtmlPath, htmlContent, 'utf-8');

  try {
    const fileUrl = `file:///${tempHtmlPath.replace(/\\/g, '/')}`;
    const args = [
      '--headless=new',
      '--run-all-compositor-stages-before-draw',
      '--disable-gpu',
      '--no-sandbox',
      '--no-pdf-header-footer',
      `--print-to-pdf=${outputPdfPath}`,
      fileUrl
    ];

    await execFileAsync(browserPath, args, { timeout: 30000 });

    if (!fs.existsSync(outputPdfPath)) {
      throw new Error('Headless browser exited without generating PDF file.');
    }

    const stats = fs.statSync(outputPdfPath);
    return {
      success: true,
      sizeBytes: stats.size
    };
  } finally {
    try {
      if (fs.existsSync(tempHtmlPath)) fs.unlinkSync(tempHtmlPath);
    } catch (e) {}
  }
}

/**
 * ============================================================================
 * 1. IEEE 2-COLUMN ACADEMIC STANDARD PDF GENERATOR
 * ============================================================================
 * Formats according to IEEE Transactions guidelines:
 * - 2-Column balanced layout
 * - Times New Roman / Latin Modern academic typography
 * - Roman numeral section numbering (I. INTRODUCTION, II. METHODOLOGY)
 * - Numbered mathematical formulas, figures, and data tables
 * - IEEE reference bibliography format [1], [2]
 */
export async function generateIEEEPdf({
  title = 'Autonomous Agentic Systems in Distributed Computing',
  authors = [{ name: 'RAGHUL AI Research Fellow', affiliation: 'Advanced AI Architecture Labs' }],
  abstract = '',
  keywords = ['Artificial Intelligence', 'Autonomous Agents', 'Model Context Protocol', 'Distributed Reasoning'],
  sections = [],
  citations = [],
  tables = [],
  figures = []
}) {
  const fileId = generateDocId('ieee');
  const filename = `${title.toLowerCase().replace(/[^a-z0-9]+/g, '_').slice(0, 40)}.pdf`;
  const outputPath = path.join(DOCS_DIR, `${fileId}_${filename}`);

  const authorHtml = authors.map(a => `
    <div class="author-block">
      <div class="author-name">${a.name}</div>
      <div class="author-affiliation">${a.affiliation}</div>
    </div>
  `).join('');

  const romanNumerals = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];

  const sectionsHtml = sections.map((sec, idx) => {
    const roman = romanNumerals[idx] || (idx + 1);
    const subSecHtml = (sec.subsections || []).map((sub, sIdx) => `
      <div class="ieee-subsection">
        <h3 class="ieee-h3"><em>${String.fromCharCode(65 + sIdx)}. ${sub.title}</em></h3>
        <div class="ieee-text">${sub.content}</div>
      </div>
    `).join('');

    return `
      <section class="ieee-section">
        <h2 class="ieee-h2">${roman}. ${sec.title.toUpperCase()}</h2>
        <div class="ieee-text">${sec.content || ''}</div>
        ${subSecHtml}
      </section>
    `;
  }).join('');

  const citationsHtml = citations.length > 0 ? `
    <section class="ieee-section ieee-references">
      <h2 class="ieee-h2">${romanNumerals[sections.length] || 'REF'}. REFERENCES</h2>
      <ol class="ieee-ref-list">
        ${citations.map((c, i) => `
          <li><span class="ref-num">[${i + 1}]</span> ${c.authors || 'RAGHUL AI Corpus'}, "${c.title || c.snippet || 'Research Data'}", <em>${c.journal || 'RAGHUL AI Archive'}</em>, ${c.year || '2026'}. ${c.url ? `<span class="ref-url">&lt;${c.url}&gt;</span>` : ''}</li>
        `).join('')}
      </ol>
    </section>
  ` : '';

  const tablesHtml = tables.map((t, idx) => `
    <div class="ieee-table-wrap">
      <div class="ieee-table-caption">TABLE ${romanNumerals[idx] || idx + 1}<br><span>${(t.caption || 'Empirical Comparison').toUpperCase()}</span></div>
      <table class="ieee-table">
        <thead>
          <tr>${(t.headers || []).map(h => `<th>${h}</th>`).join('')}</tr>
        </thead>
        <tbody>
          ${(t.rows || []).map(row => `<tr>${row.map(cell => `<td>${cell}</td>`).join('')}</tr>`).join('')}
        </tbody>
      </table>
    </div>
  `).join('');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>${title}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 18mm 14mm 20mm 14mm;
    }
    * { box-sizing: border-box; }
    body {
      font-family: "Times New Roman", Times, "Nimbus Roman No9 L", serif;
      font-size: 10pt;
      line-height: 1.25;
      color: #000000;
      background: #ffffff;
      margin: 0;
      padding: 0;
    }
    .header-banner {
      font-size: 8pt;
      color: #444444;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      border-bottom: 0.5pt solid #888888;
      padding-bottom: 4px;
      margin-bottom: 16px;
      display: flex;
      justify-content: space-between;
    }
    .title-banner {
      text-align: center;
      margin-bottom: 18px;
    }
    .paper-title {
      font-size: 20pt;
      font-weight: bold;
      line-height: 1.15;
      margin: 0 0 10px 0;
      letter-spacing: -0.3px;
    }
    .authors-container {
      display: flex;
      justify-content: center;
      gap: 32px;
      margin-bottom: 16px;
      flex-wrap: wrap;
    }
    .author-block {
      text-align: center;
    }
    .author-name {
      font-size: 11pt;
      font-weight: bold;
    }
    .author-affiliation {
      font-size: 9pt;
      font-style: italic;
      color: #333333;
    }
    .abstract-box {
      font-size: 9.5pt;
      text-align: justify;
      margin: 0 auto 18px auto;
      padding: 0 16px;
    }
    .abstract-title {
      font-weight: bold;
      font-style: italic;
    }
    .keywords-line {
      font-size: 9pt;
      margin-top: 6px;
    }
    .keywords-label {
      font-weight: bold;
      font-style: italic;
    }
    /* 2-Column Academic Layout */
    .ieee-columns {
      column-count: 2;
      column-gap: 20px;
      text-align: justify;
    }
    .ieee-section {
      margin-bottom: 14px;
      break-inside: avoid-column;
    }
    .ieee-h2 {
      font-size: 10pt;
      font-weight: bold;
      text-align: center;
      margin: 12px 0 6px 0;
      letter-spacing: 0.5px;
    }
    .ieee-h3 {
      font-size: 9.5pt;
      font-weight: normal;
      margin: 8px 0 4px 0;
    }
    .ieee-text {
      font-size: 10pt;
      line-height: 1.25;
      text-indent: 14px;
      margin-bottom: 8px;
    }
    .ieee-text:first-of-type {
      text-indent: 0;
    }
    .ieee-table-wrap {
      margin: 14px 0;
      text-align: center;
      break-inside: avoid-column;
    }
    .ieee-table-caption {
      font-size: 8.5pt;
      font-weight: bold;
      margin-bottom: 4px;
      letter-spacing: 0.5px;
    }
    .ieee-table-caption span {
      font-weight: normal;
    }
    .ieee-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 8.5pt;
      margin: 0 auto;
    }
    .ieee-table th {
      border-top: 1pt solid #000;
      border-bottom: 0.5pt solid #000;
      padding: 4px;
      font-weight: bold;
      text-align: center;
    }
    .ieee-table td {
      border-bottom: 0.5pt solid #ddd;
      padding: 4px;
      text-align: center;
    }
    .ieee-table tbody tr:last-child td {
      border-bottom: 1pt solid #000;
    }
    .ieee-references ol {
      padding-left: 18px;
      margin: 6px 0;
    }
    .ieee-ref-list li {
      font-size: 8.5pt;
      line-height: 1.25;
      margin-bottom: 5px;
      list-style-type: none;
      text-indent: -18px;
      padding-left: 18px;
    }
    .ref-num { font-weight: bold; }
    .ref-url { color: #0000ee; word-break: break-all; }
  </style>
</head>
<body>
  <div class="header-banner">
    <span>IEEE TRANSACTIONS ON ARTIFICIAL INTELLIGENCE & RESEARCH, VOL. 28, NO. 2, 2026</span>
    <span>RAGHUL AI RESEARCH LABS</span>
  </div>

  <div class="title-banner">
    <h1 class="paper-title">${title}</h1>
    <div class="authors-container">
      ${authorHtml}
    </div>
  </div>

  ${abstract ? `
  <div class="abstract-box">
    <span class="abstract-title">Abstract</span>—${abstract}
    ${keywords.length > 0 ? `
    <div class="keywords-line">
      <span class="keywords-label">Index Terms</span>—${keywords.join(', ')}.
    </div>` : ''}
  </div>` : ''}

  <div class="ieee-columns">
    ${sectionsHtml}
    ${tablesHtml}
    ${citationsHtml}
  </div>
</body>
</html>`;

  await renderHtmlToPdf(html, outputPath);

  const stats = fs.statSync(outputPath);
  const metadata = {
    fileId,
    filename,
    format: 'pdf',
    style: 'ieee-academic',
    title,
    sizeBytes: stats.size,
    path: outputPath,
    downloadUrl: `/api/documents/download/${fileId}`,
    viewUrl: `/api/documents/view/${fileId}`
  };
  saveDocMetadata(metadata);

  return metadata;
}

/**
 * ============================================================================
 * 2. MODERN EXECUTIVE CORPORATE STANDARD PDF GENERATOR
 * ============================================================================
 * Premium enterprise formatting:
 * - Full-width A4 single column layout
 * - Modern typography (Inter / Helvetica / Arial)
 * - Executive summary with accent borders
 * - 4-Card KPI metric highlights grid
 * - Corporate styling with headers, footers, and confidentiality badges
 */
export async function generateExecutivePdf({
  title = 'Enterprise AI Strategy & Architecture Dossier',
  author = 'RAGHUL AI Principal Research Fellow',
  organization = 'RAGHUL AI Technologies International',
  date = new Date().toLocaleDateString('en-US', { dateStyle: 'long' }),
  executiveSummary = '',
  kpis = [],
  sections = [],
  citations = []
}) {
  const fileId = generateDocId('exec');
  const filename = `${title.toLowerCase().replace(/[^a-z0-9]+/g, '_').slice(0, 40)}.pdf`;
  const outputPath = path.join(DOCS_DIR, `${fileId}_${filename}`);

  const kpisHtml = kpis.length > 0 ? `
    <div class="kpi-grid">
      ${kpis.map(k => `
        <div class="kpi-card">
          <div class="kpi-value">${k.value}</div>
          <div class="kpi-label">${k.label}</div>
          ${k.sub ? `<div class="kpi-sub">${k.sub}</div>` : ''}
        </div>
      `).join('')}
    </div>
  ` : '';

  const sectionsHtml = sections.map((sec, idx) => `
    <div class="exec-section">
      <div class="exec-sec-header">
        <span class="exec-sec-num">0${idx + 1}</span>
        <h2 class="exec-sec-title">${sec.title}</h2>
      </div>
      <div class="exec-sec-body">${sec.content || ''}</div>
      ${(sec.bullets || []).length > 0 ? `
        <ul class="exec-bullets">
          ${sec.bullets.map(b => `<li>${b}</li>`).join('')}
        </ul>
      ` : ''}
    </div>
  `).join('');

  const citationsHtml = citations.length > 0 ? `
    <div class="exec-sources">
      <h3 class="exec-sources-title">Verified Intelligence Sources & Citations</h3>
      <div class="sources-grid">
        ${citations.map((c, i) => `
          <div class="source-item">
            <span class="source-index">[${i + 1}]</span>
            <div class="source-details">
              <strong>${c.title || 'Market Source'}</strong>
              <div class="source-url">${c.url || ''}</div>
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  ` : '';

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>${title}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 18mm 16mm 20mm 16mm;
    }
    * { box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      font-size: 10.5pt;
      line-height: 1.6;
      color: #1e293b;
      background: #ffffff;
      margin: 0;
      padding: 0;
    }
    .exec-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 2px solid #0f172a;
      padding-bottom: 14px;
      margin-bottom: 24px;
    }
    .org-badge {
      font-size: 8.5pt;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 1.5px;
      color: #4f46e5;
    }
    .confidential-tag {
      font-size: 7.5pt;
      font-weight: 700;
      text-transform: uppercase;
      background: #f1f5f9;
      color: #475569;
      padding: 4px 10px;
      border-radius: 4px;
      letter-spacing: 1px;
    }
    .title-area {
      margin-bottom: 24px;
    }
    .doc-main-title {
      font-size: 24pt;
      font-weight: 800;
      color: #0f172a;
      line-height: 1.2;
      margin: 0 0 10px 0;
      letter-spacing: -0.5px;
    }
    .doc-meta-strip {
      font-size: 9pt;
      color: #64748b;
      display: flex;
      gap: 16px;
    }
    .exec-summary-card {
      background: #f8fafc;
      border-left: 4px solid #4f46e5;
      border-radius: 0 8px 8px 0;
      padding: 16px 20px;
      margin-bottom: 28px;
    }
    .exec-summary-label {
      font-size: 8.5pt;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: #4f46e5;
      margin-bottom: 6px;
    }
    .exec-summary-text {
      font-size: 11pt;
      color: #334155;
      font-weight: 500;
      margin: 0;
    }
    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 14px;
      margin-bottom: 30px;
      page-break-inside: avoid;
    }
    .kpi-card {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 14px;
      text-align: center;
      box-shadow: 0 1px 3px rgba(0,0,0,0.04);
    }
    .kpi-value {
      font-size: 20pt;
      font-weight: 800;
      color: #4f46e5;
      line-height: 1.1;
      margin-bottom: 4px;
    }
    .kpi-label {
      font-size: 8.5pt;
      font-weight: 600;
      color: #1e293b;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .kpi-sub {
      font-size: 7.5pt;
      color: #64748b;
      margin-top: 4px;
    }
    .exec-section {
      margin-bottom: 24px;
      page-break-inside: avoid;
    }
    .exec-sec-header {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 10px;
      border-bottom: 1px solid #e2e8f0;
      padding-bottom: 6px;
    }
    .exec-sec-num {
      font-size: 12pt;
      font-weight: 800;
      color: #4f46e5;
    }
    .exec-sec-title {
      font-size: 14pt;
      font-weight: 700;
      color: #0f172a;
      margin: 0;
    }
    .exec-sec-body {
      font-size: 10.5pt;
      color: #334155;
      margin-bottom: 8px;
    }
    .exec-bullets {
      padding-left: 20px;
      margin: 6px 0;
      color: #334155;
    }
    .exec-bullets li {
      margin-bottom: 6px;
    }
    .exec-sources {
      margin-top: 30px;
      padding-top: 16px;
      border-top: 1px solid #e2e8f0;
      page-break-inside: avoid;
    }
    .exec-sources-title {
      font-size: 10.5pt;
      font-weight: 700;
      color: #0f172a;
      margin-bottom: 10px;
    }
    .sources-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
    }
    .source-item {
      display: flex;
      gap: 8px;
      font-size: 8.5pt;
      background: #f8fafc;
      padding: 8px;
      border-radius: 4px;
    }
    .source-index {
      font-weight: bold;
      color: #4f46e5;
    }
    .source-details {
      word-break: break-all;
    }
    .source-url {
      color: #64748b;
      font-size: 7.5pt;
    }
  </style>
</head>
<body>
  <div class="exec-header">
    <div class="org-badge">${organization}</div>
    <div class="confidential-tag">Executive Intelligence • Internal & Partner Briefing</div>
  </div>

  <div class="title-area">
    <h1 class="doc-main-title">${title}</h1>
    <div class="doc-meta-strip">
      <span>Author: <strong>${author}</strong></span>
      <span>•</span>
      <span>Date: ${date}</span>
      <span>•</span>
      <span>Standard: Tier-1 Executive Research</span>
    </div>
  </div>

  ${executiveSummary ? `
  <div class="exec-summary-card">
    <div class="exec-summary-label">Executive Summary & Strategic Verdict</div>
    <p class="exec-summary-text">${executiveSummary}</p>
  </div>` : ''}

  ${kpisHtml}
  ${sectionsHtml}
  ${citationsHtml}
</body>
</html>`;

  await renderHtmlToPdf(html, outputPath);

  const stats = fs.statSync(outputPath);
  const metadata = {
    fileId,
    filename,
    format: 'pdf',
    style: 'executive-corporate',
    title,
    sizeBytes: stats.size,
    path: outputPath,
    downloadUrl: `/api/documents/download/${fileId}`,
    viewUrl: `/api/documents/view/${fileId}`
  };
  saveDocMetadata(metadata);

  return metadata;
}

/**
 * ============================================================================
 * 3. MICROSOFT WORD (.DOCX) GENERATOR
 * ============================================================================
 * Pure Node.js native docx constructor using docx package:
 * - Proper Word Document styling
 * - Heading 1 & Heading 2 with borders
 * - Zebra-striped tables
 * - Footers with dynamic page numbering (Page X of Y)
 */
export async function generateDocxDocument({
  title = 'Technical Specification Document',
  subtitle = 'Enterprise Systems Architecture & Research',
  author = 'RAGHUL AI Principal Architect',
  abstract = '',
  sections = [],
  tables = []
}) {
  const fileId = generateDocId('docx');
  const filename = `${title.toLowerCase().replace(/[^a-z0-9]+/g, '_').slice(0, 40)}.docx`;
  const outputPath = path.join(DOCS_DIR, `${fileId}_${filename}`);

  const docChildren = [];

  // Title
  docChildren.push(
    new Paragraph({
      text: title,
      heading: HeadingLevel.TITLE,
      spacing: { after: 120 }
    })
  );

  // Subtitle & Author
  docChildren.push(
    new Paragraph({
      children: [
        new TextRun({ text: subtitle, italics: true, color: '64748b', size: 24 }),
        new TextRun({ text: `\nPrepared by ${author} • ${new Date().toLocaleDateString('en-US')}`, size: 20, color: '94a3b8' })
      ],
      spacing: { after: 280 }
    })
  );

  // Abstract / Executive Summary Callout
  if (abstract) {
    docChildren.push(
      new Paragraph({
        children: [
          new TextRun({ text: 'EXECUTIVE SUMMARY\n', bold: true, color: '4f46e5', size: 20 }),
          new TextRun({ text: abstract, italics: true, color: '334155', size: 22 })
        ],
        border: {
          left: { style: BorderStyle.SINGLE, size: 24, color: '4f46e5', space: 10 }
        },
        spacing: { after: 300 }
      })
    );
  }

  // Sections
  sections.forEach((sec, idx) => {
    docChildren.push(
      new Paragraph({
        text: `${idx + 1}. ${sec.title}`,
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 240, after: 120 }
      })
    );

    if (sec.content) {
      docChildren.push(
        new Paragraph({
          text: sec.content,
          spacing: { after: 120 }
        })
      );
    }

    if (Array.isArray(sec.bullets)) {
      sec.bullets.forEach(b => {
        docChildren.push(
          new Paragraph({
            text: `• ${b}`,
            spacing: { after: 60 }
          })
        );
      });
    }
  });

  // Tables
  tables.forEach(t => {
    const tableRows = [];
    if (t.headers && t.headers.length > 0) {
      tableRows.push(
        new TableRow({
          tableHeader: true,
          children: t.headers.map(h => new TableCell({
            children: [new Paragraph({ children: [new TextRun({ text: h, bold: true, color: 'ffffff' })] })],
            shading: { fill: '0f172a' }
          }))
        })
      );
    }

    (t.rows || []).forEach((r, rIdx) => {
      tableRows.push(
        new TableRow({
          children: r.map(c => new TableCell({
            children: [new Paragraph({ text: String(c) })],
            shading: rIdx % 2 === 1 ? { fill: 'f8fafc' } : undefined
          }))
        })
      );
    });

    if (tableRows.length > 0) {
      docChildren.push(
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: tableRows
        })
      );
      docChildren.push(new Paragraph({ text: '', spacing: { after: 180 } }));
    }
  });

  const doc = new Document({
    sections: [{
      properties: {
        page: {
          margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } // 1 inch
        }
      },
      footers: {
        default: new Footer({
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [
                new TextRun('RAGHUL AI Intelligence Report • Page '),
                new TextRun({ children: [PageNumber.CURRENT] }),
                new TextRun(' of '),
                new TextRun({ children: [PageNumber.TOTAL_PAGES] })
              ]
            })
          ]
        })
      },
      children: docChildren
    }]
  });

  const buffer = await Packer.toBuffer(doc);
  fs.writeFileSync(outputPath, buffer);

  const stats = fs.statSync(outputPath);
  const metadata = {
    fileId,
    filename,
    format: 'docx',
    title,
    sizeBytes: stats.size,
    path: outputPath,
    downloadUrl: `/api/documents/download/${fileId}`
  };
  saveDocMetadata(metadata);

  return metadata;
}

/**
 * ============================================================================
 * 4. POWERPOINT (.PPTX) PRESENTATION DECK GENERATOR
 * ============================================================================
 * Official Anthropic & Enterprise 16:9 Presentation Standard:
 * - Dual Themes: Dark Tech (`dark`) and Clean Corporate (`light`)
 * - Multi-column visual cards, stat callouts, and speaker notes
 */
export async function generatePptxDeck({
  title = 'Architectural Briefing Deck',
  subtitle = 'Deep Systems & Research Overview',
  author = 'RAGHUL AI Principal Architect',
  theme = 'dark', // 'dark' | 'light'
  slides = []
}) {
  const fileId = generateDocId('pptx');
  const filename = `${title.toLowerCase().replace(/[^a-z0-9]+/g, '_').slice(0, 40)}.pptx`;
  const outputPath = path.join(DOCS_DIR, `${fileId}_${filename}`);

  const pres = new PptxGenJS();
  pres.layout = 'LAYOUT_16x9';

  // Palette definitions
  const isDark = theme === 'dark';
  const colors = {
    bg: isDark ? '090D16' : 'F8FAFC',
    cardBg: isDark ? '0F172A' : 'FFFFFF',
    textMain: isDark ? 'F8FAFC' : '0F172A',
    textSub: isDark ? '94A3B8' : '64748B',
    accent: '6366F1',
    accentCyan: '06B6D4',
    border: isDark ? '1E293B' : 'E2E8F0'
  };

  // 1. Cover Slide
  const cover = pres.addSlide();
  cover.background = { color: colors.bg };

  // Decorative top accent strip
  cover.addShape(pres.ShapeType.rect, {
    x: 0.8, y: 1.2, w: 2.0, h: 0.08,
    fill: { color: colors.accent }
  });

  cover.addText(title, {
    x: 0.8, y: 1.6, w: 11.5, h: 2.2,
    fontSize: 40, bold: true, color: colors.textMain,
    fontFace: 'Arial'
  });

  cover.addText(subtitle, {
    x: 0.8, y: 4.0, w: 11.5, h: 1.0,
    fontSize: 20, color: colors.textSub,
    fontFace: 'Arial'
  });

  cover.addText(`Presented by ${author} • RAGHUL AI Intelligence Labs`, {
    x: 0.8, y: 6.2, w: 10.0, h: 0.5,
    fontSize: 12, color: colors.accentCyan, bold: true
  });

  // 2. Content Slides
  slides.forEach((s, idx) => {
    const slide = pres.addSlide();
    slide.background = { color: colors.bg };

    // Slide category badge
    slide.addText(`SLIDE ${idx + 1} OF ${slides.length} • ${(s.category || 'ANALYSIS').toUpperCase()}`, {
      x: 0.8, y: 0.5, w: 8.0, h: 0.3,
      fontSize: 10, bold: true, color: colors.accent, letterSpacing: 1.5
    });

    // Slide Title
    slide.addText(s.title || 'Overview', {
      x: 0.8, y: 0.8, w: 11.5, h: 0.8,
      fontSize: 26, bold: true, color: colors.textMain, fontFace: 'Arial'
    });

    // Subtitle or Summary text
    if (s.summary) {
      slide.addText(s.summary, {
        x: 0.8, y: 1.6, w: 11.5, h: 0.6,
        fontSize: 14, color: colors.textSub
      });
    }

    // Visual Cards Layout (e.g. 2 or 3 concept/metric cards)
    if (Array.isArray(s.cards) && s.cards.length > 0) {
      const cardCount = Math.min(s.cards.length, 3);
      const cardWidth = (11.5 - (cardCount - 1) * 0.4) / cardCount;

      s.cards.slice(0, 3).forEach((card, cIdx) => {
        const cardX = 0.8 + cIdx * (cardWidth + 0.4);
        
        slide.addShape(pres.ShapeType.roundRect, {
          x: cardX, y: 2.4, w: cardWidth, h: 4.2,
          fill: { color: colors.cardBg },
          line: { color: colors.border, width: 1 }
        });

        if (card.stat) {
          slide.addText(card.stat, {
            x: cardX + 0.2, y: 2.6, w: cardWidth - 0.4, h: 0.8,
            fontSize: 28, bold: true, color: colors.accent
          });
        }

        slide.addText(card.title || '', {
          x: cardX + 0.2, y: card.stat ? 3.4 : 2.7, w: cardWidth - 0.4, h: 0.6,
          fontSize: 16, bold: true, color: colors.textMain
        });

        slide.addText(card.description || '', {
          x: cardX + 0.2, y: card.stat ? 4.1 : 3.4, w: cardWidth - 0.4, h: 2.2,
          fontSize: 12, color: colors.textSub, lineSpacing: 18
        });
      });
    } 
    // Bullet List Layout
    else if (Array.isArray(s.bullets) && s.bullets.length > 0) {
      const bulletItems = s.bullets.map(b => ({
        text: b,
        options: { fontSize: 16, color: colors.textMain, bullet: true, lineSpacing: 28 }
      }));

      slide.addText(bulletItems, {
        x: 0.8, y: 2.3, w: 11.5, h: 4.5
      });
    }

    // Speaker notes
    if (s.speakerNotes) {
      slide.addNotes(s.speakerNotes);
    }
  });

  await pres.writeFile({ fileName: outputPath });

  const stats = fs.statSync(outputPath);
  const metadata = {
    fileId,
    filename,
    format: 'pptx',
    theme,
    title,
    slideCount: slides.length + 1,
    sizeBytes: stats.size,
    path: outputPath,
    downloadUrl: `/api/documents/download/${fileId}`
  };
  saveDocMetadata(metadata);

  return metadata;
}

/**
 * ============================================================================
 * 5. DUAL-ENGINE DOCUMENT EDITOR (UPLOAD & EDIT)
 * ============================================================================
 * Handles user-uploaded PDFs according strictly to user instructions:
 * - Lossless Vector Overlay Engine (pdf-lib): Adds borders, page numbers, stamping
 * - Precision Text Re-render Engine: Extracts text, modifies requested sections, re-renders
 */
export async function editUploadedPdf({
  pdfBuffer,
  originalFilename = 'document.pdf',
  instructions = '',
  addBorder = false,
  addPageNumbers = false,
  fontName = 'Helvetica', // 'Helvetica' | 'Times' | 'Courier'
  textReplacements = [], // [{ find: '...', replace: '...' }]
  restructureAlignment = false
}) {
  const fileId = generateDocId('edited');
  const filename = `edited_${originalFilename}`;
  const outputPath = path.join(DOCS_DIR, `${fileId}_${filename}`);

  // Check if this requires full textual restructuring or simple vector overlay
  const needsStructuralReRender = textReplacements.length > 0 || restructureAlignment;

  if (!needsStructuralReRender) {
    // -------------------------------------------------------------
    // ENGINE A: Lossless Vector Overlay using pdf-lib
    // -------------------------------------------------------------
    const pdfDoc = await PDFDocument.load(pdfBuffer);
    const pages = pdfDoc.getPages();
    const pageCount = pages.length;

    let font;
    if (fontName.toLowerCase().includes('time')) {
      font = await pdfDoc.embedFont(StandardFonts.TimesRoman);
    } else if (fontName.toLowerCase().includes('courier')) {
      font = await pdfDoc.embedFont(StandardFonts.Courier);
    } else {
      font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    }

    pages.forEach((page, idx) => {
      const { width, height } = page.getSize();

      // Add 1.5pt crisp page border
      if (addBorder) {
        page.drawRectangle({
          x: 20,
          y: 20,
          width: width - 40,
          height: height - 40,
          borderWidth: 1.5,
          borderColor: rgb(0.15, 0.2, 0.3),
          color: undefined // transparent fill
        });
      }

      // Add Page Numbers centered at bottom
      if (addPageNumbers) {
        const text = `Page ${idx + 1} of ${pageCount}`;
        const textSize = 9;
        const textWidth = font.widthOfTextAtSize(text, textSize);
        page.drawText(text, {
          x: (width - textWidth) / 2,
          y: 28,
          size: textSize,
          font,
          color: rgb(0.3, 0.35, 0.4)
        });
      }
    });

    const modifiedBytes = await pdfDoc.save();
    fs.writeFileSync(outputPath, modifiedBytes);
  } else {
    // -------------------------------------------------------------
    // ENGINE B: Structural Extract & Precision Re-Render
    // -------------------------------------------------------------
    let extractedText = '';
    try {
      const parser = new PDFParse({ data: pdfBuffer });
      await parser.load();
      const parsed = await parser.getText();
      extractedText = parsed?.text || '';
    } catch (parseErr) {
      console.warn('[DocEngine] Structural PDF text parse fallback:', parseErr.message);
    }

    // Apply strict user text replacements
    for (const r of textReplacements) {
      if (r.find && r.replace !== undefined) {
        extractedText = extractedText.replaceAll(r.find, r.replace);
      }
    }

    // Wrap in cleanly styled HTML with requested font & alignment
    const fontFamily = fontName.toLowerCase().includes('time') ? '"Times New Roman", Times, serif'
      : (fontName.toLowerCase().includes('courier') ? 'Courier, monospace' : 'Arial, Helvetica, sans-serif');
    
    const textAlign = restructureAlignment ? 'justify' : 'left';

    const paragraphs = extractedText.split(/\n\s*\n/).map(p => p.trim()).filter(Boolean);
    const bodyHtml = paragraphs.map(p => `<p class="doc-p">${p.replace(/\n/g, '<br>')}</p>`).join('\n');

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    @page {
      size: A4 portrait;
      margin: 20mm;
      ${addPageNumbers ? '@bottom-center { content: "Page " counter(page) " of " counter(pages); font-size: 9pt; color: #64748b; }' : ''}
    }
    body {
      font-family: ${fontFamily};
      font-size: 11pt;
      line-height: 1.6;
      color: #0f172a;
      text-align: ${textAlign};
      padding: 0;
      margin: 0;
      ${addBorder ? 'border: 1.5pt solid #1e293b; padding: 24px; min-height: 90vh;' : ''}
    }
    .doc-p {
      margin-bottom: 14px;
    }
  </style>
</head>
<body>
  ${bodyHtml}
</body>
</html>`;

    await renderHtmlToPdf(html, outputPath);
  }

  const stats = fs.statSync(outputPath);
  const metadata = {
    fileId,
    filename,
    format: 'pdf',
    operation: 'edit_uploaded_pdf',
    instructions,
    sizeBytes: stats.size,
    path: outputPath,
    downloadUrl: `/api/documents/download/${fileId}`,
    viewUrl: `/api/documents/view/${fileId}`
  };
  saveDocMetadata(metadata);

  return metadata;
}

/**
 * ============================================================================
 * 6. STRUCTURED DATA FILE EXPORTER (.CSV / .TSV / .MD / .TXT)
 * ============================================================================
 */
export function exportDataFile({ filename = 'export.csv', content = '', format = 'csv' }) {
  const fileId = generateDocId('file');
  const safeFilename = filename.replace(/[^a-zA-Z0-9_.-]/g, '_');
  const outputPath = path.join(DOCS_DIR, `${fileId}_${safeFilename}`);

  fs.writeFileSync(outputPath, content, 'utf-8');

  const stats = fs.statSync(outputPath);
  const metadata = {
    fileId,
    filename: safeFilename,
    format,
    sizeBytes: stats.size,
    path: outputPath,
    downloadUrl: `/api/documents/download/${fileId}`
  };
  saveDocMetadata(metadata);

  return metadata;
}
