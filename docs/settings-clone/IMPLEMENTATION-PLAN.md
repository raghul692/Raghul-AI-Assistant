# CHATGPT GENERAL SETTINGS CLONE — IMPLEMENTATION PLAN
**Plan Version:** 1.0.0  
**Target Completion:** Production-Grade End-to-End Implementation

---

### Phase 1 — Database Architecture & Migrations
1. Add `user_settings` table in `db.js`:
   - `id TEXT PRIMARY KEY`
   - `user_id TEXT NOT NULL`
   - `setting_key TEXT NOT NULL`
   - `setting_value TEXT NOT NULL` (JSON stringified)
   - `created_at INTEGER NOT NULL`
   - `updated_at INTEGER NOT NULL`
   - `UNIQUE(user_id, setting_key)`
2. Add `settings_audit_logs` table in `db.js`:
   - `id TEXT PRIMARY KEY`
   - `user_id TEXT NOT NULL`
   - `setting_key TEXT NOT NULL`
   - `previous_value TEXT`
   - `new_value TEXT`
   - `action TEXT NOT NULL`
   - `created_at INTEGER NOT NULL`
3. Add `is_archived INTEGER DEFAULT 0` and `archived_at INTEGER` to `chats` table in `db.js`.
4. Seed default settings for `user_id = 'raghul'`:
   - `theme`: `"system"`
   - `language`: `"auto"`
   - `always_show_code`: `false`
   - `enter_sends_message`: `true`
   - `sound_effects`: `false`

---

### Phase 2 — Modular Backend Settings Architecture
Create dedicated, decoupled backend modules:
- `services/settingsRepository.js`: SQLite CRUD operations for `user_settings` and `settings_audit_logs`.
- `services/settingsValidator.js`: Strict validation of allowed setting keys, types, and values.
- `services/settingsAuditService.js`: Records changes and destructive actions.
- `services/settingsService.js`: Business logic layer orchestrating repository, validation, and audit.
- `controllers/settingsController.js`: Express request/response handlers.
- `middleware/settingsMiddleware.js`: Request schema validation and rate limiting.
- `routes/settingsRoutes.js`: Exposes REST endpoints mounted on `/api/settings`.

---

### Phase 3 — API Endpoints Implementation
- `GET /api/settings`: Returns all settings for current authenticated user.
- `GET /api/settings/:key`: Returns single setting value.
- `PATCH /api/settings/:key`: Updates single setting with validation.
- `PATCH /api/settings`: Updates multiple settings in a single transaction.
- `POST /api/settings/reset`: Resets settings to system defaults with audit log.
- `GET /api/settings/metadata`: Returns allowed keys, schema, and allowed values.
- Plus chat archive endpoints:
  - `GET /api/chats/archived`: Lists all archived chats.
  - `POST /api/chats/:id/archive`: Archives a specific chat.
  - `POST /api/chats/:id/unarchive`: Restores a specific chat.
  - `POST /api/chats/archive-all`: Archives all active chats.

---

### Phase 4 — Frontend General Settings UI & Component Engineering
1. **General Tab Integration:**
   - Position **General** (`#tabGeneral`) as the primary, active-by-default tab in Settings.
   - Exact ChatGPT row layout with clean dividers, descriptive labels, and controls.
2. **Interactive Controls:**
   - **Theme Selector:** `<select id="generalThemeSelect">` (`System`, `Dark`, `Light`).
   - **Language Selector:** `<select id="generalLanguageSelect">` (`Auto-detect`, `English`, `Tanglish`).
   - **Show Code Switch:** Toggle switch for code visibility.
   - **Enter to Send Switch:** Toggle switch controlling composer enter key behavior.
   - **Sound Effects Switch:** Toggle switch controlling UI feedback sounds.
   - **Archived Chats Action:** Button `Manage` opening `#archivedChatsModal`.
   - **Archive All Chats Action:** Button `Archive all` triggering confirmation modal.
   - **Delete All Chats Action:** Button `Delete all` (destructive red) triggering confirmation modal.
3. **Archived Chats Modal:**
   - Dedicated modal listing all archived chats with date, message count, 1-click **Unarchive**, and **Delete**.
4. **Immediate Lifecycle & Persistence:**
   - On page load, `loadUserSettings()` calls `GET /api/settings` and applies all preferences.
   - On any control change, immediate optimistic update + `PATCH /api/settings` call + visual save indicator.

---

### Phase 5 — REA Intelligence & Automated Testing
- Document REA analysis and limitations in `docs/settings-clone/REA-VERIFICATION.md`.
- Build comprehensive Playwright test script `test-settings-e2e.js` validating:
  1. Navigation & initial load
  2. Theme switching (System, Dark, Light)
  3. Language switching
  4. Toggle switch updates & database persistence
  5. Chat archiving & unarchiving via Manage modal
  6. Archive all chats confirmation flow
  7. Delete all chats confirmation flow
  8. Browser page reload persistence test
  9. Cross-user isolation security verification
- Run tests and capture visual verification artifacts.

---

### Phase 6 — Final Implementation Report
- Generate `docs/settings-clone/FINAL-IMPLEMENTATION-REPORT.md` documenting verified execution and evidence.

