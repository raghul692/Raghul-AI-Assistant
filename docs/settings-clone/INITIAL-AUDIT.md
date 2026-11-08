# NEXUS AI — INITIAL PROJECT & ARCHITECTURAL AUDIT
## Production-Grade ChatGPT General Settings Clone
**Document Version:** 1.0.0  
**Audit Date:** 2026-11-08  
**Scope:** Frontend, Backend, Database, Security, & Settings Subsystem

---

### 1. Executive Summary & Existing Architecture Overview

Nexus AI is an ultra-fast, production-grade multimodal AI assistant application running on Node.js with native Server-Sent Events (SSE) token streaming, multi-provider AI model orchestration (Gemini, Groq, OpenRouter, NVIDIA, Cloudflare), persistent memory, RAG document processing, canvas workspace, and autonomous agent tools.

The user has commissioned a **production-grade functional clone of the ChatGPT General Settings experience** (`https://chatgpt.com/settings/general-settings`), strictly excluding Billing/Payment features while implementing a fully integrated, database-backed, audit-logged settings system.

---

### 2. Runtime, Framework, Dependencies & Versions

- **Runtime:** Node.js v26.10.0 (ECMAScript Modules `type: module`)
- **Backend Framework:** Express.js v4.21.2
- **Database Engine:** `better-sqlite3` v11.8.1 with Write-Ahead Logging (`PRAGMA journal_mode = WAL`) and synchronous normal
- **Primary AI SDK:** `@google/genai` v0.1.1
- **Compression & Middleware:** `compression` v1.7.5, `cors` v2.8.5, `dotenv` v16.4.7
- **Frontend Architecture:** Vanilla modern ES6+ with component-style event orchestration, CSS custom properties (design tokens), CSS Grid/Flexbox, and native DOM APIs.
- **Testing & Browser Harness:** Playwright (MCP-integrated) and Node.js native test suites.

---

### 3. Existing Routes, Navigation & Layout Audit

#### Navigation Architecture:
- Left-hand collapsible sidebar (`public/index.html`) featuring:
  - Brand header: "Raghul AI"
  - Top action pills: `New chat`, `Images`
  - History list with active chat selection, rename, and deletion
  - Sidebar footer with user profile bar (`#sidebarUserProfileBtn`) and settings gear button (`#openSettingsBtn`, shortcut `Ctrl+,`)
- Central chat viewport with model switcher pill, top navigation icons, and message history
- Fixed bottom composer with tool menu popover, voice mode, and think toggle.

#### Current Settings Modal State:
- Currently, clicking `#openSettingsBtn` opens `#settingsModal` with a two-column layout:
  - Sidebar tabs: `Account & Profile`, `AI Providers & Failover`, `Persistent Memory Hub`, `Projects & Knowledge`, `Personalization`, `Appearance`, `AI Capabilities`, `GitHub MCP`, `Portfolio Hub`, `Autonomous Tasks`, `Audit Trail`, `Data Controls`, `Keyboard Shortcuts`, `API & Health`.
- **CRITICAL DISCOVERY:**
  - There is currently **NO top-level "General" settings tab** matching ChatGPT's primary settings tab (`settings/general-settings`).
  - Essential General settings like **Theme**, **Language**, **Code Display**, **Archived Chats**, and **Delete All Chats** are either fragmented across different sub-tabs (`Appearance`, `Data Controls`) or completely missing (e.g. language preferences, archived chat management).
  - All existing settings changes were saved only into `localStorage` in the browser or via ad-hoc endpoints, with no centralized SQLite database persistence for user settings, no audit logging table, and no unified `GET/PATCH /api/settings` REST lifecycle.

---

### 4. Database Schema & Persistence Audit

Database file: `data/nexus.db` (SQLite 3 WAL mode) initialized via `db.js`:
- `chats` (`id`, `title`, `persona`, `created_at`, `updated_at`)
- `messages` (`id`, `chat_id`, `role`, `text`, `timestamp`, `metadata`)
- `messages_fts` (FTS5 virtual table for full-text search)
- `projects` & `project_files` (workspace system)
- `rag_documents`, `rag_chunks`, `rag_embeddings` (vector search)
- `github_connections`, `github_automations`, `github_automation_runs`, `github_webhooks`
- `image_assets` (generated visual assets)

#### Gaps Identified for Settings:
1. `user_settings` table does not exist. User preferences (theme, language, enter-to-send, show code, speech voice, sound effects) are not normalized or persisted server-side.
2. `settings_audit_logs` table does not exist. Destructive actions (chat wipes, archive actions, preference resets) have no immutable audit trail.
3. `chats` table lacks `is_archived` and `archived_at` columns, preventing users from managing or viewing archived chats.

---

### 5. Authentication & User Identity Context

- Active authenticated user: **Raghul** (`user_id = 'raghul'`).
- The user profile bar in sidebar shows initials `RR` and tier `Free` / `PRO`.
- Settings must enforce user-level isolation: queries must validate ownership against the active user session and prevent cross-user contamination or unrestricted mass-assignment.

---

### 6. Existing Design Tokens & UI Component Audit

Existing design tokens in `public/style.css`:
- Backgrounds: `--bg-primary` (`#212121` dark), `--bg-secondary` (`#171717`), `--bg-tertiary` (`#2f2f2f`), `--bg-input` (`#2f2f2f`)
- Borders: `--border-subtle` (`rgba(255, 255, 255, 0.08)`), `--border-medium` (`rgba(255, 255, 255, 0.15)`)
- Text: `--text-primary` (`#ececec`), `--text-secondary` (`#b4b4b4`), `--text-muted` (`#737373`)
- Brand / Accents: `--brand-emerald` (`#10a37f`), `--brand-blue` (`#3b82f6`), `--danger-red` (`#ef4444`)
- Spacing & Radii: `--radius-sm` (`6px`), `--radius-md` (`10px`), `--radius-lg` (`16px`), `--radius-pill` (`9999px`)
- Switch Toggles: `.switch` with `.slider.round` (standard iOS / ChatGPT toggle switch style)
- Buttons: `.btn`, `.btn-primary`, `.btn-secondary`, `.btn-ghost`, `.btn-danger-action`

---

### 7. Technical Debt & Safety Invariants

1. **Billing Exclusion Rule:** Billing, subscription plans, checkout, invoices, and payment methods must be strictly omitted as instructed.
2. **Preservation Invariant:** All existing working features (AI model orchestration, FLUX image generation, deep research, GitHub MCP, SQLite chats, etc.) must remain 100% operational with zero regression.
3. **No Mock Data / No Dead Buttons:** Every button, select dropdown, and toggle in the General Settings view must execute real API calls and apply immediate state changes.

