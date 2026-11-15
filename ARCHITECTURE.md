# 🏛️ Raghul AI — Production System Architecture

## 1. Executive Architecture Summary

Raghul AI Assistant is engineered as a decoupled, horizontally scalable, multi-tier cloud-native platform adhering to modern zero-trust and anti-fragile principles. The architecture strictly separates client presentation, synchronous API handling, asynchronous background computation, persistent relational and vector data storage, and persistent binary object storage.

```
                                    +-----------------------+
                                    |     User Browser      |
                                    +-----------+-----------+
                                                |
                                      HTTPS API Requests / SSE
                                                |
                                                v
+-----------------------+           +-----------------------+           +-----------------------+
|    Vercel Frontend    | --------> |   Render Web Service  | <-------> |  Render Worker Pool   |
| (Static SPA + Assets) |           |   (raghul-ai-api)     |           |  (raghul-ai-worker)   |
+-----------------------+           +-----------+-----------+           +-----------+-----------+
                                                |                                   |
                         +----------------------+-----------------------------------+
                         |                                                          |
                         v                                                          v
        +-----------------------------------+                      +-----------------------------------+
        |       Supabase PostgreSQL         |                      |         Supabase Storage          |
        |  - Relational Database (17.6)     |                      |  - raghul-ai-documents            |
        |  - pgvector (0.8.2 Vector Search) |                      |  - raghul-ai-reports              |
        |  - Distributed Queue (SKIP LOCKED)|                      |  - raghul-ai-images               |
        |  - Cross-Process Event Bus        |                      |  - Secure Signed URL Expirations  |
        +-----------------------------------+                      +-----------------------------------+
```

---

## 2. Component Topology & Separation of Concerns

### A. Frontend Layer (Platform: Vercel)
- **Role:** High-velocity user interface delivery, real-time token streaming client, interactive audio visualizer, and SPA asset serving.
- **Hosting:** Vercel Global Edge Network.
- **Entrypoint:** `public/` directory configured via `vercel.json`.
- **API Routing:** Automated path rewrite from `/api/:path*` directly to the Render Web Service URL via HTTPS.
- **State Invariance:** Zero local disk dependencies; all client state is either transient in browser session memory or persisted remotely via REST and SSE.

### B. Synchronous Backend API (Platform: Render Web Service)
- **Service Name:** `raghul-ai-api`
- **Runtime:** Node.js 20+ (ES Modules)
- **Entrypoint:** `server.js`
- **Core Responsibilities:**
  1. REST API endpoint routing (`/api/chat`, `/api/jobs`, `/api/voice`, `/api/portfolio`, `/api/research`).
  2. Inbound security middleware: Origin check, Bearer token / API Key validation, Request ID stamping (`X-Request-ID`).
  3. Real-Time Token Streaming: Low-latency SSE streams for conversational dialogue with sub-300ms TTFT.
  4. Non-Blocking Job Submission: Enqueuing long-running operations (`deep_research`, `multi_agent_swarm`, `document_generation`) into PostgreSQL without blocking HTTP workers.
  5. Cross-Process Event Relay: Consuming job events emitted by workers and relaying them to client SSE streams via `services/eventBus.js`.
  6. Health and Readiness Probing: `/health` (liveness) and `/ready` (database + queue connectivity).

### C. Asynchronous Background Worker (Platform: Render Background Worker)
- **Service Name:** `raghul-ai-worker`
- **Runtime:** Node.js 20+ (Headless daemon)
- **Entrypoint:** `worker.js`
- **Core Responsibilities:**
  1. Queue Polling: Atomic distributed task acquisition using `SELECT ... FOR UPDATE SKIP LOCKED` via `queue/jobQueue.js`.
  2. Multi-Agent Swarm Execution: Orchestrating multi-turn research, web crawling, evidence synthesis, and report compiling without HTTP timeouts.
  3. Progress Notification: Publishing intermediate stage events and token progress into `job_events` table and PostgreSQL notification channels.
  4. Blob Synthesis & Storage: Uploading generated PDFs, DOCX, and analytical bundles directly to Supabase Storage via `services/storageService.js`.
  5. Resilience: Idempotency deduplication, exponential backoff retries, and automatic Dead-Letter Queue (DLQ) quarantine after max retries.
  6. Lifecycle Management: Graceful shutdown handling (`SIGTERM` / `SIGINT`) allowing in-flight tasks to finish within a 25-second deadline.

### D. Relational Database & Vector Store (Platform: Supabase PostgreSQL)
- **Engine:** PostgreSQL 17.6 (aarch64)
- **Extensions:** `pgvector` (0.8.2), `uuid-ossp`, `pgcrypto`
- **Connection Management:** `database/postgresPool.js` using `pg.Pool` with SSL (`rejectUnauthorized: false`), IPv4-first resolution, transaction wrappers, and automatic keep-alive.
- **Dual-Database Layer:** `database/adapter.js` dynamically routes queries to Supabase PostgreSQL when `DATABASE_URL` is set, with graceful fallback to local SQLite (`data/nexus.db`) for offline development and local unit tests.

### E. Distributed Queue & Event Bus
- **Queue Implementation:** Native PostgreSQL-backed queue (`job_queue`) leveraging table row locking with `SKIP LOCKED`. Completely eliminates external Redis dependencies for leaner architecture while guaranteeing strict idempotency and zero duplicate worker executions.
- **Event Bus Implementation:** `services/eventBus.js` combines PostgreSQL `job_events` persistence with cross-process listener pub/sub, ensuring clients receive every progress update even if connecting after job launch.

### F. Object Storage (Platform: Supabase Storage)
- **Buckets:**
  - `raghul-ai-documents`: User uploads, raw source files, extracted context.
  - `raghul-ai-reports`: Generated PDF reports, analytical whitepapers, DOCX files.
  - `raghul-ai-images`: Voice visualizer exports, generated charts, and screenshots.
- **Security:** RLS access controls with time-limited signed URLs (default: 3600 seconds) for private document downloads.

---

## 3. End-to-End Execution Workflows

### Standard Conversational Request
```
User -> Browser -> Vercel (/api/chat) -> Render Web (server.js)
  -> Auth & Rate Limit Check
  -> Memory Buffer Search (PostgreSQL)
  -> LLM Provider Streaming (Gemini / Groq / OpenAI)
  -> Render Web Pipes SSE Stream directly to Browser
```

### Heavy Autonomous Workflow (e.g., Deep Research / Swarm)
```
1. User clicks "Start Deep Research" on UI.
2. Browser issues POST /api/jobs { type: "deep_research", payload: {...} } to Render Web.
3. Render Web creates job record in `job_queue` (status: 'pending') and returns { jobId, streamUrl }.
4. Browser opens SSE connection to GET /api/jobs/:id/stream.
5. Render Worker (worker.js) atomically locks job using `FOR UPDATE SKIP LOCKED` (status: 'processing').
6. Worker executes multi-agent DAG:
   - Worker writes progress events to `job_events` and notifies EventBus.
   - EventBus broadcasts events to Render Web, which streams SSE to Browser.
7. Worker generates final PDF report, uploads to Supabase Storage bucket `raghul-ai-reports`.
8. Worker marks job status 'completed' with public/signed file URL.
9. Browser receives final 'complete' SSE event and renders download button.
```

---

## 4. Fault Tolerance & High Availability Matrix

| Threat / Incident | Mitigation Strategy | Architectural Mechanism |
| :--- | :--- | :--- |
| **Render Web Restart** | Active background jobs continue unaffected on Render Worker. | Decoupled queue architecture (`job_queue` in Supabase). |
| **Worker Process Crash** | Stuck jobs detected via heartbeat expiration and re-queued. | Auto-recovery retry loop with exponential backoff. |
| **Database Network Blip** | Pool retries connection 2 times with backoff; transient error recovery. | `database/postgresPool.js` retry query wrapper. |
| **Client Disconnection** | Job continues to completion in background; client retrieves results later via `/api/jobs/:id`. | Decoupled persistence in Supabase `job_events`. |
| **Storage Upload Outage** | Storage service records local fallback or re-attempts upload. | `services/storageService.js` error handling. |
