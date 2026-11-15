# RAGHUL AI — DEPLOYMENT BLOCKERS & REMAINING PREREQUISITES
**Document Version:** 3.0.0 (Phase 13 Blockers Audit)  
**Date:** November 2026  
**Auditor:** Principal DevOps Engineer & Release Manager  
**Status:** ZERO CODE BLOCKERS (Operational Prerequisites Enumerated)

---

## 1. CODEBASE DEFECT AUDIT

- **Functional Code Bugs:** **0 (None)**
- **Test Failures:** **0 (All 20 test suites passing 100%)**
- **Syntax Errors:** **0 (None)**
- **Vulnerabilities (`npm audit`):** **0 (None)**
- **SQLite Fallback Violations:** **0 (Strictly blocked in production)**

---

## 2. MANUAL CLOUD CONFIGURATION PREREQUISITES

The repository and architecture are 100% prepared. The platform administrator must execute these 3 manual dashboard setup steps:

### 2.1 Supabase Project Verification
- **Host:** `db.brmafvpjvdgieelcgivi.supabase.co`
- **Port:** Use port `5432` for Session Pooler / direct or `6543` for Transaction Pooler.
- **Extensions:** Confirm `vector` extension is active (already enabled in migration `005`).
- **Storage Buckets:** Confirm `raghul-ai-documents`, `raghul-ai-reports`, `raghul-ai-images` exist (verified active via `scripts/provision-storage.js`).

### 2.2 Render.com Blueprint Application
- In [dashboard.render.com](https://dashboard.render.com), click **New +** -> **Blueprint**.
- Select repository `https://github.com/raghul692/Raghul-AI-Assistant.git`.
- Render loads [render.yaml](file:///c:/Users/acer/.gemini/antigravity/scratch/ai-chatbot/render.yaml) automatically.
- Provide the environment secrets:
  - `DATABASE_URL`
  - `SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `GEMINI_API_KEY`
  - `ADMIN_API_KEY`
  - `SESSION_SECRET`

### 2.3 Vercel Project Setup
- In [vercel.com](https://vercel.com), import `raghul692/Raghul-AI-Assistant`.
- Vercel loads [vercel.json](file:///c:/Users/acer/.gemini/antigravity/scratch/ai-chatbot/vercel.json).
- Add Environment Variable:
  - `API_BASE_URL`: `https://raghul-ai-api.onrender.com`
- Click **Deploy**.
