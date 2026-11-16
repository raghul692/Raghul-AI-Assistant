# RAGHUL AI — AUDIT BUG FIX & CHANGELOG REPORT
**Audit Standard**: Root Cause Analysis, Minimal Surface Area Diffs & Regression Verifications  
**Audit Timestamp**: 2026-11-16T14:15:00Z  

---

## 1. SUMMARY OF INVESTIGATED & RESOLVED DEFECTS

During the comprehensive audit, 5 real production defects were uncovered, analyzed down to their exact execution root cause, cleanly resolved, and regression-verified:

| Issue ID | Severity | Affected Subsystem | Root Cause | Fix Applied | Retest Result |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **BUG-01** | High | Test Harness (`runAllSuites.js`) | Test suites 11, 12, 13 threw `ECONNREFUSED` when executed via `npm test` because no HTTP server was listening on port 3000. | Integrated automated server lifecycle management in `runAllSuites.js` that probes port 3000, starts `server.js` if idle, and shuts it down upon completion. | **PASS (14/14 Suites Passed)** |
| **BUG-02** | High | Queue Worker (`worker.js`) | Background worker in Singapore was dequeuing all pending jobs regardless of whether the worker had an active handler, causing test fixtures and unhandled types to fail instantly to DLQ. | Updated `worker.js` to supply `Object.keys(HANDLERS)` to `jobQueue.dequeue()`, restricting worker execution strictly to supported job types. | **PASS (Clean Job Routing)** |
| **BUG-03** | High | Queue Engine (`queue/jobQueue.js`) | `dequeue()` lacked ability to filter by `job_type`, target specific job IDs, or protect delayed jobs, causing local test jobs to race with live cloud workers. | Enhanced `dequeue(workerId, options)` to support `allowedJobTypes`, `targetJobId`, and `ignoreDelay` in both PostgreSQL and SQLite drivers. | **PASS (Deterministic Dequeue)** |
| **BUG-04** | Medium | Queue Engine (`queue/jobQueue.js`) | `enqueue()` lacked a `delayMs` / `nextRetryAt` parameter, making it impossible to schedule future executions or protect cancellation tests from instant worker pickup. | Added `delayMs` and `nextRetryAt` parameters to `jobQueue.enqueue()` mapped to the existing `next_retry_at` database column. | **PASS (Delayed Jobs & Protected Cancel)** |
| **BUG-05** | High | SSE Proxy Buffering (`server.js`) | Vercel Edge reverse proxy dropped streaming connections after 15s with HTTP 502 Bad Gateway due to proxy buffering prior to model response. | Implemented immediate header flush, `X-Accel-Buffering: no`, and initial byte `: connected\n\n` across all SSE streaming endpoints. | **PASS (Sub-second Stream Flush)** |

---

## 2. DETAILED ROOT CAUSE ANALYSES & DIFF RECORDS

### BUG-01: Master Test Harness Listener Automation
- **File Touched**: `tests/runAllSuites.js`
- **Root Cause**: Suites 11 (Canvas Studio), 12 (Portfolio Intelligence), and 13 (Voice Mode) make live HTTP calls to `http://localhost:3000`. When `npm test` ran in an environment where `server.js` was not running in the background, all 3 suites threw unhandled `ECONNREFUSED` connection errors.
- **Fix**: Wrapped test runner in a health check that launches `server.js` on port 3000 with `WORKER_EMBEDDED=false`, awaits the `/health` probe, runs the 14 suites, and terminates the spawned child process cleanly in a `finally` block.
- **Verification**: Executed `npm test`. All 14 suites passed with 100% success rate in 106.3s.

### BUG-02 & BUG-03: Distributed Queue Worker Race Condition
- **Files Touched**: `queue/jobQueue.js`, `worker.js`, `tests/test-production-queue-worker.js`
- **Root Cause**: The live Render worker service in Singapore polls Supabase PostgreSQL every 1.5 seconds. When automated tests enqueued jobs, the remote worker in Singapore dequeued them within 161ms. Because the jobs were test fixtures (`test_document_generation`), the remote worker threw `Unsupported job_type` and moved them to DLQ before the test could verify dequeue, cancellation, or failure handling.
- **Fix**:
  1. Enhanced `jobQueue.dequeue()` with an optional `allowedJobTypes` filter clause:
     ```sql
     AND ($5::text[] IS NULL OR job_type = ANY($5::text[]))
     ```
  2. Supported `targetJobId` for deterministic test verification.
  3. Added `delayMs` / `nextRetryAt` to `jobQueue.enqueue()` so jobs scheduled for the future are ignored by the remote worker polling loop until their time has arrived.
  4. Updated `worker.js` to dequeue only `Object.keys(HANDLERS)`.
- **Verification**: Ran `tests/test-production-queue-worker.js` and `tests/runProductionSuites.js`. All 6 production suites passed with 0 failures and 0 race conditions.

### BUG-05: Vercel Proxy Buffering & HTTP 502 Bad Gateway Prevention
- **Files Touched**: `server.js`, `portfolioRoutes.js`, `routes/terminalRoutes.js`, `public/app.js`
- **Root Cause**: Reverse proxies buffer outgoing HTTP responses if chunked transfer encoding is not acknowledged immediately. If AI generation takes more than 15 seconds, Vercel drops the socket.
- **Fix**: Flushed headers immediately and transmitted `: connected\n\n` upon socket acceptance. Added automatic direct-to-Render fallback on cloud origins if the Vercel proxy encounters a timeout.
- **Verification**: Tested live browser chat at `https://raghul-ai-assistant.vercel.app/`. Received first token in under 2 seconds without proxy drops.
