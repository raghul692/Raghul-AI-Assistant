# NEXUS AI — CONVERSATIONAL IMAGE ENGINE AUDIT REPORT
**Document ID:** `INITIAL-AUDIT.md`  
**Phase:** Phase 0 — Mandatory Existing Project Audit  
**Author:** Principal AI Architect & Multimodal Systems Engineer  
**Date:** 2026-11-08  
**Status:** COMPLETE & VERIFIED

---

## 1. Executive Summary

Nexus AI currently features a multi-provider, token-streaming AI conversational architecture with SQLite FTS5 persistence, multi-agent swarms, document processing, and persistent memory. However, its image generation capability was previously implemented as an isolated, regex-gated script (`imageGenerator.js`) disconnected from the conversation context and LLM intelligence pipeline.

This audit report identifies the exact architectural flaws, root causes of observed bugs (external website image leakage, context blindness, infographic failures, and lack of conversational editing), and presents the technical blueprint for the production-grade upgrade across Phases 1 through 13.

---

## 2. Deep Inspection of Existing Architecture

### 2.1 Project Structure & Routing Map
```
c:\Users\acer\.gemini\antigravity\scratch\ai-chatbot/
├── server.js                          # Express 4.21 server with SSE stream (/api/chat/stream), REST routes
├── db.js                              # SQLite database (better-sqlite3) with WAL mode & FTS5 full-text search
├── storage.js                         # In-memory Map cache + JSON backup wrapping db.js
├── imageGenerator.js                  # LEGACY image synthesis module (Regex intent, FLUX, deprecated Imagen 3)
├── agentTools.js                      # Tool registry: DuckDuckGo searchWebTool, runCodeSandboxTool, calculateTool
├── orchestration/
│   ├── aiProviderManager.js           # Multi-provider failover for text LLMs (Gemini, Groq, OpenRouter, NIM)
│   └── modelRegistry.js               # Intent classification, budget allocations
├── memory/
│   └── persistentMemoryEngine.js      # Long-term semantic memories, fact extraction, chat summarization
├── deepResearchEngine.js              # Multi-hop web research recursive DAG
├── canvasEngine.js                    # HTML/JS Code Sandbox & Canvas Studio
├── productivityEngine.js              # Reminders, Calendar, Emails, Data Analysis
├── documentEngine.js                  # PDF, DOCX, PPTX synthesis and manipulation
├── public/
│   ├── index.html                     # ChatGPT-grade UI, top navigation pills, capsule composer dock
│   ├── style.css                      # Modern dark charcoal theme (#212121, #171717), Inter typography
│   ├── app.js                         # Frontend state machine, SSE reader, marked.js renderer, lightbox modal
│   └── generated/                     # Local filesystem storage for synthesized images
└── package.json                       # @google/genai ^2.32.0, better-sqlite3, pdf-lib, docx
```

### 2.2 Chat & Streaming Architecture
- **Endpoint:** `POST /api/chat/stream`
- **Protocol:** Server-Sent Events (SSE) via `text/event-stream`.
- **Payload:** `{ message, sessionId, model, persona, attachments, webSearch, deepThinking }`
- **Lifecycle:**
  1. Rate limiting & security checks (`detectPromptInjection`, `redactSensitiveData`).
  2. Persona & prompt injection assembly (`promptEngine.buildSystemPrompt`).
  3. Pre-execution checks (Canvas, Autonomous Plan, Documents).
  4. **Line 1414:** Regex-based image intent detection `detectImagePrompt(sanitizedMessage)`.
  5. URL extraction & Web Search tool fallback (`searchWebTool`).
  6. AI provider orchestration streaming.

### 2.3 Storage & Database Architecture
- **Database:** SQLite 3 (`nexus_core.db`) using `better-sqlite3`.
- **Schema:**
  - `chats` table: `(id TEXT PRIMARY KEY, title TEXT, persona TEXT, history TEXT, created_at INTEGER, updated_at INTEGER)`
  - `chats_fts`: Virtual FTS5 table for instant search.
  - `memories`, `projects`, `documents`, `tasks`, `governance_approvals`.
- **Image Assets:** Currently saved as unindexed loose files in `public/generated/` without a dedicated database table or metadata linkage to messages or users.

### 2.4 Existing Image Generation Pipeline (`imageGenerator.js`)
1. **Intent Matching:** `detectImagePrompt()` uses three basic regular expressions looking for `/image` or `"generate image of X"` or `"X image create pannu"`.
2. **Primary Provider:** Cloudflare Workers AI FLUX.1 Schnell (`@cf/black-forest-labs/flux-1-schnell`).
3. **Secondary Provider:** Deprecated Google Gemini Imagen 3 (`imagen-3.0-generate-002`) invoked via deprecated `client.models.generateImages()`.
4. **Fallback:** `generateProceduralFallbackSvg()` generating an abstract procedural SVG polygon.
5. **Storage:** Saves to `public/generated/nexus_<timestamp>_<random>.<ext>` and calls `cleanupOldImages()` which **arbitrarily deletes images when the directory exceeds 100 files**.

---

## 3. Root Cause Analysis of Existing Problems

### 🔴 Problem 1: Image requests return images from external websites (Google/Bing/DuckDuckGo/blogs)
- **Root Cause:**
  When a user expresses an image generation request conversationally (e.g., *"Create a Python roadmap image for 30 days"* or *"Generate an infographic based on what we discussed"*), `detectImagePrompt` fails to match the rigid regex pattern (`engMatch` looks for `image of ...`, not `... roadmap image`).
  When `detectImagePrompt` returns `null`, execution bypasses the image pipeline entirely and falls into the standard chat pipeline. The LLM then triggers `searchWebTool` (DuckDuckGo scraper in `agentTools.js:160`), which scrapes external web page results and returns markdown containing remote image links (e.g. `![Roadmap](https://some-external-blog.com/img.jpg)`).
- **Affected Files:** `imageGenerator.js` (lines 81-101), `server.js` (lines 1414-1456), `agentTools.js` (lines 160-220).

### 🔴 Problem 2: Generated images do not correctly represent the user's request & Context is completely ignored
- **Root Cause:**
  Even when `detectImagePrompt` does match, line 1418 of `server.js` executes:
  ```js
  const imgResult = await generateNativeImage(detectedImgPrompt, apiKey);
  ```
  `detectedImgPrompt` contains only the raw regex capture group from the **last message alone**. If the user previously had a 10-turn conversation planning a Python curriculum and said: *"Generate an image for this roadmap"*, `detectedImgPrompt` is literally `"this roadmap"`.
  The entire conversation history stored in `chat.history` is ignored. FLUX receives only the prompt `"this roadmap"`, resulting in a generic picture of a highway road and map.
- **Affected Files:** `server.js` (line 1414-1420), `imageGenerator.js` (line 262).

### 🔴 Problem 3: Educational infographic requests produce incorrect, unreadable, or unrelated images
- **Root Cause:**
  Pure diffusion models like FLUX.1 Schnell lack native layout engines and cannot legibly render 30 distinct daily lesson titles, code snippets, and progression markers. They produce scrambled, illegible pseudo-text. Furthermore, if FLUX encounters any issue, line 302 falls back to `generateProceduralFallbackSvg`—an abstract geometric SVG with a single 35-character truncated label.
  There is no hybrid generation architecture that pairs semantic LLM content planning with deterministic SVG/Canvas layout composition.
- **Affected Files:** `imageGenerator.js` (lines 226-258, 302-308).

### 🔴 Problem 4: Image generation does not behave conversationally (Cannot edit or refine)
- **Root Cause:**
  When an image is generated, `server.js` appends a static markdown string and immediately terminates the stream with `return res.end()`. There is no tracking of `assetId`, `parentAssetId`, or versioning. When the user follows up with *"Change the background to dark blue"* or *"Make the text bigger"*, `detectImagePrompt` either fails to match or treats it as an independent prompt from scratch, losing all previous visual layout and composition.
- **Affected Files:** `server.js` (lines 1422-1450), `imageGenerator.js`.

### 🔴 Problem 5: Model Deprecation & Destructive Deletion
- **Root Cause:**
  1. `imageGenerator.js` line 185 uses `imagen-3.0-generate-002` and `client.models.generateImages()`, both of which are deprecated in `@google/genai` v2.32.0. The official models are `gemini-3.1-flash-image` and `gemini-3-pro-image`.
  2. `cleanupOldImages()` indiscriminately deletes user image files as soon as 100 images are reached, breaking earlier conversation history and image links.
- **Affected Files:** `imageGenerator.js` (lines 37-52, 184-192).

---

## 4. Proposed Upgraded Architecture Blueprint

To achieve true ChatGPT-quality conversational image generation, we will build a modular, multi-phase engine:

```
[User Message + Active Session]
            │
            ▼
┌─────────────────────────────────────────────────────────────┐
│ Phase 1: Intelligent Image Intent Router                    │
│ (GENERATE_NEW_IMAGE | EDIT_EXISTING_IMAGE |                 │
│  GENERATE_INFOGRAPHIC | GENERATE_DIAGRAM | GENERATE_CHART | │
│  FIND_EXISTING_IMAGE | NORMAL_CONVERSATION)                 │
└───────────────────────────┬─────────────────────────────────┘
                            │ (If Image Intent Detected)
                            ▼
┌─────────────────────────────────────────────────────────────┐
│ Phase 2: ImageConversationContextService                   │
│ - Collects relevant user/assistant messages                 │
│ - Extracts structured facts, topics, curriculum, entities   │
│ - Locates previousImageAssetId & visual style preferences   │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│ Phase 3: ImageBriefBuilder                                  │
│ - Compiles structured brief: Subject, Hierarchy, Palette,   │
│   Typography, Aspect Ratio, Negative Constraints, Content   │
└───────────────────────────┬─────────────────────────────────┘
                            │
              ┌─────────────┴─────────────┐
              ▼                           ▼
┌───────────────────────────┐ ┌───────────────────────────────┐
│ Phase 4: Native Provider  │ │ Phase 5: Hybrid Infographic   │
│ Engine (Creative Raster)  │ │ Engine (Educational Visuals)  │
│ - Gemini 3.1 Flash Image  │ │ 1. Structured Curriculum Plan │
│ - Gemini 3 Pro Image      │ │ 2. Content Validation (30 days│
│ - Cloudflare FLUX Schnell │ │ 3. Native Background Gen      │
│   (Zero remote web urls)  │ │ 4. Deterministic Text/SVG Lay │
└─────────────┬─────────────┘ └───────────────┬───────────────┘
              └─────────────┬─────────────────┘
                            ▼
┌─────────────────────────────────────────────────────────────┐
│ Phase 6 & 7: Conversational Editing & Quality Validation   │
│ - Multi-modal image-to-image editing reference              │
│ - Byte validation, MIME checks, dimensions, text audit      │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│ Phase 8 & 9: Persistent Storage & Chat Integration          │
│ - SQLite `image_assets` table (versioning, briefs, lineage) │
│ - Inline chat card rendering with full preview & download   │
│ - Full gallery & lightbox synchronization                   │
└─────────────────────────────────────────────────────────────┘
```

---

## 5. Affected Files & New Components

| Action | File Path | Purpose |
| :--- | :--- | :--- |
| **New** | `services/imageIntentRouter.js` | Intent classifier (detects 7 intent categories; English, Tamil, Tanglish) |
| **New** | `services/imageContextService.js` | Conversation memory & fact extractor for image requests |
| **New** | `services/imageBriefBuilder.js` | Structured prompt & design brief compiler |
| **New** | `services/imageProviderRouter.js` | Provider abstraction: Gemini 3.1 Flash Image, Gemini 3 Pro, Cloudflare FLUX |
| **New** | `services/hybridInfographicRenderer.js` | 30-day roadmap content planner, validator & deterministic compositor |
| **New** | `services/imageQualityValidator.js` | Binary integrity, magic bytes, aspect ratio, text accuracy verification |
| **New** | `services/imageStorageService.js` | SQLite `image_assets` table, asset retrieval, versioning, downloads |
| **Modified** | `server.js` | Connect intent router before web search, stream image status events, wire image edit APIs |
| **Modified** | `db.js` | Add `image_assets` table and queries with foreign keys to chats |
| **Modified** | `public/app.js` | Support image edit instructions, interactive action cards, realtime lightbox |
| **Modified** | `public/style.css` | Enhanced chat image cards, infographic zoom, version pills |

---

## 6. Verification & Safety Constraints

1. **No External Image URLs:** Web search tools (`searchWebTool`) will never be routed for generation requests.
2. **Deterministic Fallback:** When Gemini Image hits quota, Cloudflare FLUX acts as the native creative raster fallback, and the hybrid renderer ensures infographics have 100% legible, complete text.
3. **No File Loss:** The destructive `cleanupOldImages` (>100 files delete) is abolished in favor of permanent SQLite indexed storage.
4. **SSE Integration:** Streaming progress events (`image.generation.started`, `image.generation.brief_ready`, `image.generation.completed`) will provide ChatGPT-grade conversational responsiveness.

---
*Audit completed. Proceeding systematically through Phase 1 to Phase 13.*

