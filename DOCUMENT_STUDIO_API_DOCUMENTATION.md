# 📑 Nexus Document Studio & Deep Research API Documentation

Welcome to the **Nexus Document Studio & Deep Research API**. This API provides enterprise-grade endpoints to autonomously research topics and generate or edit professional documents in **PDF (IEEE 2-Column Academic & Modern Executive)**, **Microsoft Word (.docx)**, **PowerPoint (.pptx)**, and **Structured Data (.csv, .md)** formats.

---

## 🌐 Base URL
```text
http://localhost:3000/api/documents
```

---

## 📑 Endpoints Overview

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/documents` | List all generated documents in the registry |
| `GET` | `/api/documents/:fileId` | Retrieve metadata for a specific document |
| `GET` | `/api/documents/download/:fileId` | Download document with binary attachment headers |
| `GET` | `/api/documents/view/:fileId` | Open inline fullscreen preview in browser |
| `POST` | `/api/documents/generate` | Generate PDF, DOCX, PPTX, or CSV on demand |
| `POST` | `/api/documents/edit` | Dual-Engine precision editing of uploaded PDFs |

---

## 1. List Documents
Retrieve recently generated and edited documents with file sizes, timestamps, and download links.

- **URL:** `GET /api/documents`
- **Query Parameters:**
  - `limit` *(optional, number)*: Number of items to return (default: 50).
- **Response `200 OK`:**
```json
{
  "documents": [
    {
      "fileId": "ieee_1793947225602_b2c9nk",
      "filename": "neural_consensus_protocols_in_edge_clust.pdf",
      "format": "pdf",
      "style": "ieee-academic",
      "title": "Neural Consensus Protocols in Edge Clusters",
      "sizeBytes": 97122,
      "downloadUrl": "/api/documents/download/ieee_1793947225602_b2c9nk",
      "viewUrl": "/api/documents/view/ieee_1793947225602_b2c9nk",
      "createdAt": "2026-11-06T06:40:27.123Z"
    }
  ]
}
```

---

## 2. Generate Document
Generate a new binary document in PDF, DOCX, PPTX, or CSV.

- **URL:** `POST /api/documents/generate`
- **Headers:** `Content-Type: application/json`

### A. Generating IEEE 2-Column Academic PDF
```json
{
  "format": "pdf",
  "style": "ieee",
  "title": "Decentralized Cognitive Graphs in Autonomous Swarms",
  "author": "Nexus Research Fellow",
  "abstract": "This paper presents a formal evaluation of decentralized memory structures.",
  "sections": [
    {
      "title": "Introduction",
      "content": "Autonomous agents require bounded, persistent memory topologies."
    }
  ],
  "tables": [
    {
      "caption": "Memory Overhead Across Topologies",
      "headers": ["Architecture", "P50 Latency (ms)", "RAM (MB)"],
      "rows": [["Monolith", "140", "450"], ["Nexus Swarm", "18", "68"]]
    }
  ],
  "citations": [
    { "title": "Model Context Protocol Specification", "year": "2024", "url": "https://modelcontextprotocol.io" }
  ]
}
```

### B. Generating PowerPoint (.pptx) Presentation Deck
```json
{
  "format": "pptx",
  "title": "Enterprise AI Strategy 2026",
  "subtitle": "Autonomous Multi-Agent Infrastructure",
  "theme": "dark",
  "slides": [
    {
      "category": "Market Shift",
      "title": "The Rise of Model Context Protocol",
      "cards": [
        { "stat": "10x", "title": "Productivity", "description": "Automated workflow execution" },
        { "stat": "68%", "title": "Cost Savings", "description": "Deterministic tool calling" }
      ],
      "speakerNotes": "Emphasize efficiency gains over legacy prompt engineering."
    }
  ]
}
```

- **Response `200 OK`:**
```json
{
  "success": true,
  "document": {
    "fileId": "pptx_1793947230111_a9f2",
    "filename": "enterprise_ai_strategy_2026.pptx",
    "format": "pptx",
    "theme": "dark",
    "sizeBytes": 38450,
    "downloadUrl": "/api/documents/download/pptx_1793947230111_a9f2"
  }
}
```

---

## 3. Edit Uploaded PDF
Apply precision modifications to an uploaded PDF.

- **URL:** `POST /api/documents/edit`
- **Headers:** `Content-Type: application/json`
- **Request Body:**
```json
{
  "pdfBase64": "<base64_encoded_pdf_string>",
  "originalFilename": "quarterly_report.pdf",
  "instructions": "Add page numbers and a 1.5pt border",
  "addBorder": true,
  "addPageNumbers": true,
  "fontName": "Helvetica",
  "restructureAlignment": false
}
```
- **Response `200 OK`:**
```json
{
  "success": true,
  "document": {
    "fileId": "edited_1793947235222_x81b",
    "filename": "edited_quarterly_report.pdf",
    "format": "pdf",
    "sizeBytes": 98400,
    "downloadUrl": "/api/documents/download/edited_1793947235222_x81b",
    "viewUrl": "/api/documents/view/edited_1793947235222_x81b"
  }
}
```

---

## 4. Download and View Endpoints

### Download Binary File
- **URL:** `GET /api/documents/download/:fileId`
- **Headers Returned:**
  - `Content-Disposition: attachment; filename="<filename>"`
  - `Content-Type: application/pdf` (or `application/vnd.openxmlformats-officedocument.wordprocessingml.document`)

### Fullscreen Preview
- **URL:** `GET /api/documents/view/:fileId`
- **Headers Returned:**
  - `Content-Disposition: inline; filename="<filename>"`
  - `Content-Type: application/pdf`

