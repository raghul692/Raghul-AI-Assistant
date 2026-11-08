/**
 * ============================================================================
 * DOCUMENT STUDIO & GENERATOR MCP SERVER (Claude Skills & IEEE Standard)
 * ============================================================================
 * Exposes tools for generating and editing publication-grade documents:
 * - IEEE 2-Column Academic & Modern Executive PDF Generator (Headless Chrome)
 * - Native Microsoft Word (.docx) Specification Generator
 * - Native 16:9 Widescreen PowerPoint (.pptx) Slide Deck Generator
 * - Dual-Engine PDF Editor (Lossless Vector Overlay + Precision Re-Render)
 * - Structured Data Exporter (.csv, .tsv, .md, .txt)
 */

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

class DocumentGeneratorServer {
  getToolDeclarations() {
    return [
      {
        name: 'doc_generate_pdf',
        description: 'Document Studio MCP: Generate publication-grade A4 PDF reports (IEEE 2-Column Academic or Modern Executive Standard) with citations, tables, and instant download/view URLs.',
        parameters: {
          type: 'OBJECT',
          properties: {
            title: { type: 'STRING', description: 'Document title' },
            style: { type: 'STRING', description: 'Layout style: "ieee" (academic 2-column) or "executive" (corporate briefing)' },
            abstract: { type: 'STRING', description: 'Executive summary or abstract' },
            author: { type: 'STRING', description: 'Author name or affiliation' },
            sections: {
              type: 'ARRAY',
              description: 'Array of section objects with title, content, and optional bullets',
              items: { type: 'OBJECT' }
            },
            citations: {
              type: 'ARRAY',
              description: 'Array of citation/source objects with title and url',
              items: { type: 'OBJECT' }
            },
            tables: {
              type: 'ARRAY',
              description: 'Array of comparison/data tables with headers and rows',
              items: { type: 'OBJECT' }
            },
            kpis: {
              type: 'ARRAY',
              description: 'Executive KPI metric cards (for executive style): [{ value, label, sub }]',
              items: { type: 'OBJECT' }
            }
          },
          required: ['title']
        },
        execute: async (args = {}) => {
          const style = (args.style || 'ieee').toLowerCase();
          if (style === 'executive' || style === 'corporate') {
            return await generateExecutivePdf({
              title: args.title,
              author: args.author || 'Nexus Research Fellow',
              executiveSummary: args.abstract || args.executiveSummary || '',
              kpis: args.kpis || [],
              sections: args.sections || [],
              citations: args.citations || []
            });
          } else {
            return await generateIEEEPdf({
              title: args.title,
              authors: [{ name: args.author || 'Nexus Research Fellow', affiliation: 'Nexus Labs' }],
              abstract: args.abstract || '',
              sections: args.sections || [],
              tables: args.tables || [],
              citations: args.citations || []
            });
          }
        }
      },
      {
        name: 'doc_generate_word',
        description: 'Document Studio MCP: Generate native Microsoft Word (.docx) documents with formal headings, shaded tables, executive summary callout, and page numbering.',
        parameters: {
          type: 'OBJECT',
          properties: {
            title: { type: 'STRING', description: 'Document title' },
            subtitle: { type: 'STRING', description: 'Document subtitle or scope' },
            author: { type: 'STRING', description: 'Author or organization' },
            abstract: { type: 'STRING', description: 'Executive summary callout' },
            sections: { type: 'ARRAY', description: 'Sections with title, content, bullets', items: { type: 'OBJECT' } },
            tables: { type: 'ARRAY', description: 'Tables with headers and rows', items: { type: 'OBJECT' } }
          },
          required: ['title']
        },
        execute: async (args = {}) => {
          return await generateDocxDocument(args);
        }
      },
      {
        name: 'doc_generate_presentation',
        description: 'Document Studio MCP: Generate 16:9 widescreen PowerPoint (.pptx) slide decks with dual theme support (dark/light), multi-column visual cards, and speaker notes.',
        parameters: {
          type: 'OBJECT',
          properties: {
            title: { type: 'STRING', description: 'Presentation title' },
            subtitle: { type: 'STRING', description: 'Subtitle or tagline' },
            author: { type: 'STRING', description: 'Presenter name' },
            theme: { type: 'STRING', description: '"dark" (Navy/Indigo) or "light" (Crisp Minimal)' },
            slides: {
              type: 'ARRAY',
              description: 'Array of slide objects: { category, title, summary, cards: [{ stat, title, description }], bullets: [], speakerNotes: "" }',
              items: { type: 'OBJECT' }
            }
          },
          required: ['title', 'slides']
        },
        execute: async (args = {}) => {
          return await generatePptxDeck(args);
        }
      },
      {
        name: 'doc_edit_pdf',
        description: 'Document Studio MCP: Apply precision edits to an uploaded PDF (add borders, page numbers, change font, replace text, or adjust alignment).',
        parameters: {
          type: 'OBJECT',
          properties: {
            pdfBase64: { type: 'STRING', description: 'Base64 encoded PDF buffer' },
            originalFilename: { type: 'STRING', description: 'Original filename' },
            instructions: { type: 'STRING', description: 'User instructions for editing' },
            addBorder: { type: 'BOOLEAN', description: 'Whether to add 1.5pt page perimeter border' },
            addPageNumbers: { type: 'BOOLEAN', description: 'Whether to add centered page numbers at bottom' },
            fontName: { type: 'STRING', description: 'Font family: "Helvetica", "Times", "Courier"' },
            textReplacements: {
              type: 'ARRAY',
              description: 'Text replacements: [{ find, replace }]',
              items: { type: 'OBJECT' }
            },
            restructureAlignment: { type: 'BOOLEAN', description: 'Whether to justify paragraph text alignment' }
          },
          required: ['pdfBase64']
        },
        execute: async (args = {}) => {
          const pdfBuffer = Buffer.from(args.pdfBase64, 'base64');
          return await editUploadedPdf({
            pdfBuffer,
            originalFilename: args.originalFilename || 'document.pdf',
            instructions: args.instructions || '',
            addBorder: Boolean(args.addBorder),
            addPageNumbers: Boolean(args.addPageNumbers),
            fontName: args.fontName || 'Helvetica',
            textReplacements: args.textReplacements || [],
            restructureAlignment: Boolean(args.restructureAlignment)
          });
        }
      },
      {
        name: 'doc_export_data',
        description: 'Document Studio MCP: Export tabular data or structured text to .csv, .tsv, .md, or .txt.',
        parameters: {
          type: 'OBJECT',
          properties: {
            filename: { type: 'STRING', description: 'Target filename with extension (e.g. data.csv)' },
            content: { type: 'STRING', description: 'File content' },
            format: { type: 'STRING', description: 'File format: csv, tsv, md, txt' }
          },
          required: ['filename', 'content']
        },
        execute: async (args = {}) => {
          return exportDataFile(args);
        }
      },
      {
        name: 'doc_list_generated',
        description: 'Document Studio MCP: List recently generated documents with download URLs and metadata.',
        parameters: {
          type: 'OBJECT',
          properties: {
            limit: { type: 'INTEGER', description: 'Maximum items to return' }
          }
        },
        execute: async (args = {}) => {
          return listDocuments(args.limit || 20);
        }
      }
    ];
  }
}

export const documentGeneratorServer = new DocumentGeneratorServer();

