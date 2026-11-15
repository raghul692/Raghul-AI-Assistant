# ✅ Raghul AI — Production Readiness Checklist & Pre-Flight Verification

Use this checklist prior to rolling out deployments or promoting changes to production.

---

## 1. Pre-Flight Infrastructure Gates

- [x] **PostgreSQL 17 Running:** Supabase instance provisioned and accessible over SSL.
- [x] **pgvector Extension Active:** Verified `CREATE EXTENSION IF NOT EXISTS vector;` (version 0.8.2).
- [x] **Database Migrations Applied:** All 12 DDL scripts in `migrations/` applied without error.
- [x] **Data Ingestion Complete:** Verified record parity between SQLite and Supabase PostgreSQL (8,519 records).
- [x] **Supabase Storage Buckets Active:**
  - [x] `raghul-ai-documents` (Private, RLS active)
  - [x] `raghul-ai-reports` (Public)
  - [x] `raghul-ai-images` (Public)
- [x] **Render Web Service Configured:**
  - [x] Health probe set to `/health`.
  - [x] Readiness probe accessible at `/ready`.
  - [x] Start command set to `node server.js` (or `npm start`).
  - [x] Inbound CORS restricted to verified domains (`CORS_ORIGIN`).
  - [x] High-privilege routes protected via `ADMIN_API_KEY` in `middleware/auth.js`.
- [x] **Render Background Worker Configured:**
  - [x] Dedicated worker entrypoint set to `node worker.js` (or `npm run worker`).
  - [x] Queue consumer configured with `FOR UPDATE SKIP LOCKED`.
  - [x] Graceful `SIGTERM` / `SIGINT` shutdown verified with 25-second drain window.
- [x] **Vercel Frontend Configured:**
  - [x] Output directory set to `public`.
  - [x] `vercel.json` rewrites active from `/api/:path*` to Render Web Service URL.
  - [x] Static asset caching headers configured.

---

## 2. Automated Quality & Regression Gates

- [x] **Baseline Master Test Suite:**
  - Command: `npm test` (`tests/runAllSuites.js`)
  - Result: 14 out of 14 test suites passed 100% (227.2s).
- [x] **Production Multi-Process Simulation:**
  - Command: `node tests/test-production-simulation-e2e.js`
  - Result: Verified Web Service (port 3097) + Background Worker running in independent processes, enqueuing, processing, streaming SSE, and shutting down cleanly.
- [x] **Database Adapter Verification:**
  - Command: `node tests/test-production-db-adapter.js`
  - Result: Liveness probe, count queries, parameterized `$1` auto-mapping, transaction rollback verified.
- [x] **Distributed Queue Verification:**
  - Command: `node tests/test-production-queue-worker.js`
  - Result: Priority order, atomic dequeue, idempotency collision prevention, exponential backoff, DLQ quarantine verified.
- [x] **Cloud Storage Verification:**
  - Command: `node tests/test-production-storage.js`
  - Result: Buffer upload, byte-for-byte download verification, signed URL generation, clean deletion verified.
- [x] **Cross-Process SSE Verification:**
  - Command: `node tests/test-production-sse-realtime.js`
  - Result: Cross-process event publishing via `job_events`, SSE stream handshake, live broadcast, disconnect cleanup verified.
- [x] **Strict Language Policy Gate:**
  - Command: `node scripts/verify-language-policy.js`
  - Result: 0 Tamil Unicode characters found across all production files (`[\u0B80-\u0BFF]` check).

---

## 3. Operational Monitoring & Observability Runbook

- [ ] **Liveness Verification:** Probe `https://raghul-ai-api.onrender.com/health` returns `200 OK` with JSON `{ "status": "healthy" }`.
- [ ] **Readiness Verification:** Probe `https://raghul-ai-api.onrender.com/ready` returns `200 OK` with `{ "database": { "status": "healthy" } }`.
- [ ] **Worker Health Monitoring:** Check Render logs for periodic worker heartbeats and successful job completion metrics.
- [ ] **DLQ Triage:** Inspect `SELECT * FROM job_queue WHERE dead_letter = TRUE;` periodically to identify permanently failing tasks.
- [ ] **Storage Quota:** Monitor Supabase Storage dashboard to ensure usage remains within plan limits.
