# RAGHUL AI — LOCAL VS PRODUCTION PARITY AUDIT REPORT
**Target Domain**: Production Parity Investigation  
**Local Environment**: Windows 11 x64, Node.js v26.10.0, SQLite Fallback Driver  
**Production Environment**: Linux aarch64 (Render Starter Container), Node.js v20.x, Supabase PostgreSQL 17  
**Audit Timestamp**: 2026-11-16T14:15:00Z  

---

## 1. PARITY MATRIX & INFRASTRUCTURE COMPARISON

| Parameter | Local Environment | Production Environment (Render/Vercel) | Discrepancy Classification | Verified Mitigation |
| :--- | :--- | :--- | :--- | :--- |
| **Node.js Runtime** | Node.js v26.10.0 (Windows) | Node.js v20.x LTS (Linux Container) | **Harmless** | Clean syntax compatibility; no OS-specific native addons required. |
| **DNS Resolution** | Dual Stack (IPv4 / IPv6) | Container IPv4 / IPv6 Native | **Configuration Risk** | Explicitly enforced `dns.setDefaultResultOrder('ipv4first')` across runtime. |
| **Primary Database** | SQLite (Better-SQLite3) fallback | Supabase PostgreSQL 17 (AWS Mumbai pooler) | **Expected / Sound** | Dual-mode adapter (`dbAdapter`) dynamically detects and transparently routes queries. |
| **Connection Pooling** | Single SQLite process lock | PostgreSQL connection pool (`max: 10`, 30s timeout) | **Operational Difference** | Managed pool handles reconnections, SSL, and session limits with transient retries. |
| **Object Storage** | Local filesystem (`data/`, `scratch/`) | Supabase Storage (`raghul-ai-documents`, `reports`) | **Operational Difference** | `storageService` detects cloud credentials; uploads to Supabase buckets in production. |
| **Background Queue** | Synchronous SQLite polling | Distributed PostgreSQL `FOR UPDATE SKIP LOCKED` | **Operational Difference** | High-concurrency atomic locking ensures workers never execute duplicate jobs. |
| **Web Server Port** | `3000` (configurable via `process.env.PORT`) | `PORT` injected by Render host environment | **Configuration Parity** | `server.js` listens on `process.env.PORT || 3000`. |
| **CORS Policy** | Allowed `localhost:3000`, `127.0.0.1` | Hardened regex `/\.vercel\.app$/`, `/\.onrender\.com$/` | **Hardened Production** | Prevents cross-origin token theft while permitting verified deployment origins. |
| **Reverse Proxy Buffering**| Direct client connection (no buffering) | Vercel Edge CDN Reverse Proxy | **High Operational Risk** | Added `X-Accel-Buffering: no`, immediate header flush, and `: connected\n\n` chunk. |
| **Worker Concurrency**| Single process (concurrency 1) | Independent Worker Service (concurrency 2-3) | **Operational Difference** | `WORKER_CONCURRENCY=2` handles parallel background deep research and document publishing. |

---

## 2. FORENSIC CLASSIFICATION OF DISCREPANCIES

### A. Harmless Discrepancies
1. **OS File Path Separators**:
   - Local: Windows backslashes `\`
   - Production: POSIX forward slashes `/`
   - *Mitigation*: All filesystem utilities use `path.join()`, `path.resolve()`, or URL representations.

2. **Node.js Engine Release**:
   - Local runs Node.js 26 experimental features, while Render container runs stable Node.js 20 LTS.
   - *Mitigation*: Codebase is strictly standardized to standard ES2022 ESM syntax (`import`/`export`), preventing syntax incompatibility.

### B. Configuration Discrepancies (Verified and Resolved)
1. **IPv6 Lookup Hang on Windows**:
   - *Observation*: Windows machines attempting to resolve Supabase pooler hostnames over IPv6 encounter connection reset or 15s connection timeouts.
   - *Mitigation*: Added `dns.setDefaultResultOrder('ipv4first')` in `server.js`, `worker.js`, and all test entrypoints.

2. **Vercel Reverse-Proxy SSE Buffering Timeout (HTTP 502)**:
   - *Observation*: Vercel serverless reverse proxy buffers HTTP responses until 15-20 seconds elapse. If the backend does not flush headers and emit bytes immediately, Vercel drops the connection with `HTTP 502 Bad Gateway`.
   - *Mitigation*: Added immediate header flush, `X-Accel-Buffering: no`, and initial byte `: connected\n\n` in `server.js`, `portfolioRoutes.js`, and `routes/terminalRoutes.js`.

### C. Functional Parity Verification
- **Dual-Mode Adapter Verification**: Tested `tests/test-production-db-adapter.js` against live Supabase PostgreSQL. Returned 100% PASS with 71ms query latency.
- **Storage Adapter Verification**: Tested `tests/test-production-storage.js` against Supabase Storage. Uploaded test artifact, retrieved byte-for-byte matching buffer, and cleaned up file.
- **Queue Parity**: Verified distributed row locking in `tests/test-production-queue-worker.js`. 20 concurrent burst requests produced 1 primary job and 19 duplicate detections without deadlocks.
