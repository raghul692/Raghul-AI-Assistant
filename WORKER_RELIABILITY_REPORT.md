# ⚙️ RAGHUL AI — WORKER & DISTRIBUTED QUEUE RELIABILITY REPORT
**Audit Executed**: 2026-11-15  
**Engine**: Render Background Worker (`worker.js`) + Supabase PostgreSQL Queue (`queue/jobQueue.js`)  
**Scope**: Atomic Leases, Idempotency, Leases & Heartbeats, DLQ, Graceful Shutdown  

---

## 1. Queue Architecture & Delivery Semantics

The Raghul AI background processing pipeline utilizes PostgreSQL table `job_queue` with explicit delivery semantics:
- **Delivery Model**: **At-least-once processing with idempotent task handlers**.
- **Atomic Acquisition**: Implemented via `SELECT ... FOR UPDATE SKIP LOCKED` wrapped in an atomic `UPDATE` with `RETURNING *`. This guarantees that two concurrent workers can never acquire the same pending job record.
- **Short Transactions**: Worker processes acquire the job and commit the state transition (`status = 'running'`) immediately. Long-running multi-agent tasks (which can take 15 to 120 seconds) are executed outside of any open database transactions, preventing database connection exhaustion.

```sql
UPDATE job_queue
SET status = 'running',
    worker_id = $1,
    started_at = $2,
    locked_at = $2,
    attempts = attempts + 1
WHERE id = (
    SELECT id FROM job_queue
    WHERE status = 'pending'
      AND (next_retry_at IS NULL OR next_retry_at <= $2)
    ORDER BY priority ASC, created_at ASC
    FOR UPDATE SKIP LOCKED
    LIMIT 1
)
RETURNING *;
```

---

## 2. Distributed Queue Lifecycle Mechanisms

### 1. Unique Job Identifiers & Idempotency Keys
- Every job is assigned a globally unique ID (`job_<timestamp>_<hex>`).
- If an `idempotencyKey` is provided, a unique constraint on `job_queue (idempotency_key)` prevents duplicate job execution.
- Verified in `tests/test-production-queue-worker.js`: Test 7 executes 20 concurrent burst requests with the same idempotency key, resulting in exactly 1 job enqueued and 19 idempotent duplicates returned with zero collisions.

### 2. Processing Leases & Heartbeats
- When a worker begins processing a job, it sets `locked_at = Date.now()`.
- During execution, the worker runs a background interval timer every 10 seconds calling `jobQueue.heartbeat(jobId)`, updating `locked_at`.
- If a worker crashes or hangs, the heartbeat stops.

### 3. Stalled Job Recovery
- Every 60 seconds (or upon worker startup), the worker scans for running jobs where `locked_at < Date.now() - 60000`.
- Stalled jobs are automatically reclaimed, assigned `status = 'pending'`, and scheduled for retry.
- If a job has reached `max_attempts`, it is moved directly to the Dead-Letter Queue (`status = 'dlq'`).

### 4. Exponential Backoff & Retry Policies
- Failed jobs calculate an exponential delay: `delayMs = Math.min(1000 * Math.pow(2, attempts), 60000)`.
- The job status is set back to `'pending'` with `next_retry_at = Date.now() + delayMs`.
- Verified in `tests/test-production-queue-worker.js` (Test 6).

### 5. Dead-Letter Queue (DLQ)
- Jobs exceeding `max_attempts` (default: 3) transition to `status = 'dlq'`, preserving the terminal error message, attempt count, and execution timestamps for audit analysis.

---

## 3. Worker Lifecycle & Shutdown Resilience

### Worker Startup Lifecycle
1. Process boots via `npm run worker` (`node --dns-result-order=ipv4first worker.js`).
2. Validates database pool and cloud storage connectivity.
3. Executes crash recovery: checks for any running jobs previously locked by this worker ID or stalled.
4. Starts the polling loop (`POLL_INTERVAL_MS = 1500`, `MAX_CONCURRENT_JOBS = 3`).

### Graceful Termination (`SIGTERM` / `SIGINT`)
- Background workers in cloud platforms (Render, Kubernetes) receive a `SIGTERM` signal prior to platform container termination.
- Worker intercepts `SIGTERM` and `SIGINT`:
  1. Sets `isRunning = false` (stops dequeuing new jobs).
  2. Enters a draining loop with a 15-second grace period.
  3. Awaits completion of in-flight active jobs.
  4. Flushes and closes the PostgreSQL connection pool cleanly (`closePostgresPool()`).
  5. Exits cleanly with code 0.
- Verified in `tests/test-production-simulation-e2e.js`: Step 5 sends `SIGTERM` to the background worker; all jobs drain cleanly without dropped records.

---

## 4. Multi-Agent Task Handlers

The worker hosts four autonomous task handlers:
1. `deep_research`: Formulates investigation plans, scrapes safe URLs, compiles findings, generates A4 PDF reports, and uploads them to Supabase Storage.
2. `multi_agent_swarm`: Coordinates 10-agent deliberative panels with real-time SSE progress events.
3. `document_generation`: Generates IEEE-format PDFs, executive briefs, and Word DOCX documents, storing output artifacts in `raghul-ai-documents`.
4. `code_repair`: AST diagnostic analysis, automated code patching, and self-repair loops.

---

## 5. Verification Matrix

| Lifecycle Stage | Expected Behavior | Automated Test | Status |
| :--- | :--- | :--- | :--- |
| Enqueue & Priority | Strict priority (1-10) ordering | `test-production-queue-worker.js` Test 1 | **VERIFIED** |
| Idempotency Protection | Duplicate key returns existing job ID | `test-production-queue-worker.js` Test 2 & 7 | **VERIFIED** |
| Atomic Dequeue | `FOR UPDATE SKIP LOCKED` single acquisition | `test-production-queue-worker.js` Test 3 | **VERIFIED** |
| Real-Time Telemetry | Progress broadcast over EventBus & SSE | `test-production-queue-worker.js` Test 4 | **VERIFIED** |
| Result Storage | JSON result saved to PostgreSQL `job_queue` | `test-production-queue-worker.js` Test 5 | **VERIFIED** |
| Retry & Backoff | Exponential delay up to max attempts | `test-production-queue-worker.js` Test 6 | **VERIFIED** |
| DLQ Routing | Terminal failure moved to `'dlq'` | `test-production-queue-worker.js` Test 6 | **VERIFIED** |
| Stalled Recovery | Heartbeat expiration triggers reclamation | `test-production-queue-worker.js` Test 8 | **VERIFIED** |
| Crash Recovery | Orphaned jobs recovered on restart | `test-production-simulation-e2e.js` | **VERIFIED** |
| Graceful Shutdown | In-flight jobs drain before process exit | `test-production-simulation-e2e.js` Step 5 | **VERIFIED** |
