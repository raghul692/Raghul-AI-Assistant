import express from 'express';
import fs from 'fs';
import {
  generateIEEEPdf,
  generateExecutivePdf,
  generateDocxDocument,
  generatePptxDeck,
  editUploadedPdf,
  exportDataFile,
  getDocumentMetadata,
  listDocuments
} from '../documentEngine.js';

const router = express.Router();

// 1. List Documents
router.get('/', (req, res) => {
  const limit = parseInt(req.query.limit || '50', 10);
  res.json({ documents: listDocuments(limit) });
});

// 2. Get Document Metadata
router.get('/:fileId', (req, res) => {
  const meta = getDocumentMetadata(req.params.fileId);
  if (!meta) return res.status(404).json({ error: 'Document not found' });
  res.json({ document: meta });
});

// 3. Download Document
router.get('/download/:fileId', (req, res) => {
  const meta = getDocumentMetadata(req.params.fileId);
  if (!meta || !fs.existsSync(meta.path)) {
    return res.status(404).json({ error: 'Document file not found or expired' });
  }
  res.download(meta.path, meta.filename);
});

// 4. View Document Inline
router.get('/view/:fileId', (req, res) => {
  const meta = getDocumentMetadata(req.params.fileId);
  if (!meta || !fs.existsSync(meta.path)) {
    return res.status(404).send('Document not found');
  }
  const contentType = meta.format === 'pdf' ? 'application/pdf'
    : (meta.format === 'docx' ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    : (meta.format === 'pptx' ? 'application/vnd.openxmlformats-officedocument.presentationml.presentation' : 'text/plain'));
  res.setHeader('Content-Type', contentType);
  res.setHeader('Content-Disposition', `inline; filename="${meta.filename}"`);
  fs.createReadStream(meta.path).pipe(res);
});

// 5. Generate Multi-Format Document
router.post('/generate', async (req, res) => {
  try {
    const { format = 'pdf', style = 'ieee', title, subtitle, author, abstract, sections = [], tables = [], kpis = [], slides = [], content = '' } = req.body;
    if (!title && !content) return res.status(400).json({ error: 'title or content required' });

    let result;
    if (format === 'pdf') {
      if (style === 'executive') {
        result = await generateExecutivePdf({ title, author, executiveSummary: abstract, kpis, sections });
      } else {
        result = await generateIEEEPdf({ title, authors: [{ name: author || 'Nexus Fellow', affiliation: 'Nexus Labs' }], abstract, sections, tables });
      }
    } else if (format === 'docx') {
      result = await generateDocxDocument({ title, subtitle, author, abstract, sections, tables });
    } else if (format === 'pptx') {
      result = await generatePptxDeck({ title, subtitle, author, theme: req.body.theme || 'dark', slides });
    } else {
      result = exportDataFile({ filename: `${title || 'export'}.${format}`, content, format });
    }
    res.json({ success: true, document: result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 6. Edit Existing Document
router.post('/edit', async (req, res) => {
  try {
    const { pdfBase64, originalFilename, instructions, addBorder, addPageNumbers, fontName, textReplacements, restructureAlignment } = req.body;
    if (!pdfBase64) return res.status(400).json({ error: 'pdfBase64 required' });

    const pdfBuffer = Buffer.from(pdfBase64, 'base64');
    const result = await editUploadedPdf({
      pdfBuffer,
      originalFilename: originalFilename || 'document.pdf',
      instructions: instructions || '',
      addBorder: Boolean(addBorder),
      addPageNumbers: Boolean(addPageNumbers),
      fontName: fontName || 'Helvetica',
      textReplacements: textReplacements || [],
      restructureAlignment: Boolean(restructureAlignment)
    });
    res.json({ success: true, document: result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
