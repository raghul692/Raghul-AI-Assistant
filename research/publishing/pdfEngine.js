import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getBrowserExecutable, renderHtmlToPdf } from '../../documentEngine.js';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { PDFParse } = require('pdf-parse');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPORTS_DIR = path.join(__dirname, '..', '..', 'data', 'generated', 'research_reports');

fs.mkdirSync(REPORTS_DIR, { recursive: true });

/**
 * Convert Markdown text to semantic publication HTML with print CSS
 */
export function convertMarkdownToPrintHtml(markdownText, metadata = {}) {
  const title = metadata.title || 'Technical Research Report';
  const pubDate = metadata.date || new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  const author = metadata.author || 'Raghul AI Autonomous Deep Research Engine';
  const sourcesCount = metadata.sourcesCount || 0;
  const citationsCount = metadata.citationsCount || 0;

  // Simple, robust Markdown-to-HTML parser for publication formatting
  let bodyHtml = markdownText
    // Escape HTML
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    // Headings
    .replace(/^### (.*$)/gim, '<h3>$1</h3>')
    .replace(/^## (.*$)/gim, '<h2>$1</h2>')
    .replace(/^# (.*$)/gim, '<h1>$1</h1>')
    // Bold & Italics
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    // Citations [1], [2, 3] -> highlighted superscripts
    .replace(/\[(\d+(?:,\s*\d+)*)\]/g, '<cite class="citation-ref">[$1]</cite>')
    // Blockquotes & Alerts
    .replace(/^&gt; \[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\] (.*$)/gim, '<div class="alert-box alert-$1"><span class="alert-tag">$1:</span> $2</div>')
    .replace(/^&gt; (.*$)/gim, '<blockquote>$1</blockquote>')
    // Horizontal Rule
    .replace(/^---$/gim, '<hr class="section-divider">')
    // Lists
    .replace(/^\- (.*$)/gim, '<li>$1</li>')
    // Paragraphs
    .replace(/\n\s*\n/g, '</p><p>')
    .replace(/<\/li><p><li>/g, '</li><li>');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${title}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 20mm 15mm 20mm 15mm;
      @bottom-right {
        content: counter(page) " / " counter(pages);
        font-size: 8pt;
        color: #666;
      }
    }
    
    *, *:before, *:after {
      box-sizing: border-box;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      font-size: 10.5pt;
      line-height: 1.6;
      color: #1a1a1a;
      background: #ffffff;
      margin: 0;
      padding: 0;
    }

    /* Cover Page */
    .cover-page {
      page-break-after: always;
      display: flex;
      flex-direction: column;
      justify-content: center;
      min-height: 230mm;
      padding: 40mm 10mm 20mm 10mm;
      border-bottom: 2px solid #0f172a;
    }

    .cover-badge {
      display: inline-block;
      padding: 4px 12px;
      font-size: 8pt;
      font-weight: 700;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      background: #0f172a;
      color: #ffffff;
      border-radius: 4px;
      margin-bottom: 15mm;
      width: fit-content;
    }

    .cover-title {
      font-size: 26pt;
      font-weight: 800;
      line-height: 1.2;
      color: #0f172a;
      margin: 0 0 10mm 0;
    }

    .cover-subtitle {
      font-size: 13pt;
      color: #475569;
      margin: 0 0 25mm 0;
      font-weight: 400;
    }

    .cover-meta {
      border-top: 1px solid #e2e8f0;
      padding-top: 8mm;
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 5mm;
      font-size: 9.5pt;
      color: #64748b;
    }

    .cover-meta strong {
      color: #0f172a;
    }

    /* Content Typography */
    h1 {
      font-size: 18pt;
      font-weight: 700;
      color: #0f172a;
      margin-top: 10mm;
      margin-bottom: 4mm;
      page-break-before: always;
      border-bottom: 1.5px solid #e2e8f0;
      padding-bottom: 2mm;
    }

    h2 {
      font-size: 14pt;
      font-weight: 600;
      color: #1e293b;
      margin-top: 8mm;
      margin-bottom: 3mm;
      page-break-after: avoid;
    }

    h3 {
      font-size: 11.5pt;
      font-weight: 600;
      color: #334155;
      margin-top: 6mm;
      margin-bottom: 2mm;
      page-break-after: avoid;
    }

    p {
      margin: 0 0 3.5mm 0;
      text-align: justify;
      hyphens: auto;
    }

    /* Citations */
    .citation-ref {
      font-weight: 700;
      color: #2563eb;
      font-size: 8.5pt;
      vertical-align: super;
      text-decoration: none;
      padding: 0 1px;
    }

    /* Blockquotes */
    blockquote {
      margin: 4mm 0;
      padding: 3mm 5mm;
      border-left: 3.5px solid #3b82f6;
      background: #f8fafc;
      color: #334155;
      font-style: italic;
    }

    /* Alerts */
    .alert-box {
      margin: 4mm 0;
      padding: 3.5mm 5mm;
      border-radius: 4px;
      font-size: 9.5pt;
      border-left: 4px solid #3b82f6;
      background: #eff6ff;
    }
    .alert-tag {
      font-weight: 700;
      text-transform: uppercase;
      font-size: 8pt;
    }

    /* Tables */
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 5mm 0;
      font-size: 9pt;
      page-break-inside: avoid;
    }

    th, td {
      border: 1px solid #cbd5e1;
      padding: 2.5mm 3.5mm;
      text-align: left;
    }

    th {
      background: #f1f5f9;
      font-weight: 600;
      color: #0f172a;
    }

    tr:nth-child(even) td {
      background: #f8fafc;
    }

    /* Divider */
    .section-divider {
      border: none;
      border-top: 1px solid #e2e8f0;
      margin: 8mm 0;
    }

    /* Header & Footer */
    .page-header {
      position: fixed;
      top: -12mm;
      left: 0;
      right: 0;
      height: 8mm;
      border-bottom: 0.5px solid #cbd5e1;
      font-size: 7.5pt;
      color: #94a3b8;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .page-footer {
      position: fixed;
      bottom: -10mm;
      left: 0;
      right: 0;
      height: 8mm;
      border-top: 0.5px solid #cbd5e1;
      font-size: 7.5pt;
      color: #94a3b8;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
  </style>
</head>
<body>
  <!-- Cover Page -->
  <div class="cover-page">
    <div class="cover-badge">Tier-1 Autonomous Deep Research</div>
    <div class="cover-title">${title}</div>
    <div class="cover-subtitle">Comprehensive Evidence-First Investigation & Strategic Evaluation</div>
    <div class="cover-meta">
      <div><strong>Author:</strong> ${author}</div>
      <div><strong>Date:</strong> ${pubDate}</div>
      <div><strong>Sources Analyzed:</strong> ${sourcesCount}</div>
      <div><strong>Verified Citations:</strong> ${citationsCount}</div>
    </div>
  </div>

  <!-- Main Body Content -->
  <div class="report-content">
    <p>${bodyHtml}</p>
  </div>
</body>
</html>`;
}

/**
 * Generate and Validate an A4 PDF from Research Markdown
 */
export async function generateAndValidateReportPdf(jobId, markdownText, metadata = {}) {
  const fileName = `research_report_${jobId}.pdf`;
  const outputPdfPath = path.join(REPORTS_DIR, fileName);

  // 1. Render Semantic HTML
  const printHtml = convertMarkdownToPrintHtml(markdownText, metadata);

  // 2. Render to Pixel-Perfect A4 PDF via Headless Chrome / Edge
  await renderHtmlToPdf(printHtml, outputPdfPath, { format: 'A4', landscape: false });

  if (!fs.existsSync(outputPdfPath)) {
    throw new Error('PDF render failed: Output file was not created.');
  }

  // 3. Automated Validation via pdf-parse
  const fileBytes = fs.readFileSync(outputPdfPath);
  let parsedText = '';
  let numPages = 1;
  try {
    const parser = new PDFParse({ data: fileBytes });
    await parser.load();
    const parsed = await parser.getText();
    parsedText = parsed?.text || '';
    numPages = parser.pages?.length || 1;
  } catch (err) {
    console.warn('[PdfEngine] PDF text parse inspection fallback:', err.message);
  }

  const textLength = parsedText.length;

  // Run validation criteria
  const validation = {
    valid: true,
    numPages,
    fileSizeBytes: fileBytes.length,
    characterCount: textLength,
    hasExecutiveSummary: /executive summary/i.test(parsedText),
    hasBibliography: /sources|bibliography|references/i.test(parsedText),
    hasCitations: /\[\d+\]/.test(parsedText)
  };

  if (numPages < 1 || textLength < 200) {
    validation.valid = false;
    validation.reason = 'PDF contains insufficient page count or empty content.';
  }

  return {
    success: validation.valid,
    pdfPath: outputPdfPath,
    fileName,
    url: `/api/research/reports/${fileName}`,
    validation
  };
}
