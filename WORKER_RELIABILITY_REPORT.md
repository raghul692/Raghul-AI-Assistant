# ⚙️ RAGHUL AI — WORKER & DISTRIBUTED QUEUE RELIABILITY REPORT
**Audit Executed**: 2026-11-15  
**Engine**: Render Background Worker (`worker.js`) + Supabase PostgreSQL Queue (`queue/jobQueue.js`)  
**Scope**: Atomic Leases, Idempotency, Leases & Heartbeats, DLQ, Graceful Shutdown, In-Flight Job Release  

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

### 6. Job Cancellation & In-Flight Release APIs
- `jobQueue.cancel(jobId, reason)`: Allows canceling pending or running jobs cleanly, marking them `status = 'cancelled'` and broadcasting an audit event.
- `jobQueue.releaseJob(jobId, reason)`: Enables a shutting-down worker to release an in-flight job back to `status = 'pending'` without waiting for stall timeouts.
- `jobQueue.listRecentJobs(limit)`: Provides real-time operational visibility into recent queue items.

---

## 3. Worker Lifecycle & Shutdown Resilience

### Fail-Fast Production Startup
In production (`NODE_ENV === 'production'`), `worker.js` executes strict pre-flight checks:
1. Validates that `DATABASE_URL` is set.
2. Checks PostgreSQL health via `dbAdapter.healthCheck()`.
3. If PostgreSQL is unreachable, it logs a fatal error and terminates immediately with exit code 1. It will **never** silently fall back to an ephemeral SQLite database.

### In-Flight Job Tracking & Graceful Draining
1. Worker tracks all active job IDs in an `inFlightJobIds` set.
2. On receiving `SIGTERM` or `SIGINT`:
   - Sets `isRunning = false` (stops dequeuing new jobs).
   - Enters a graceful drain loop with a 15-second timeout.
   - If jobs complete within the window, the worker exits cleanly.
   - If jobs remain active when the timeout expires, the worker calls `jobQueue.releaseJob()` on each active job, unlocking them in PostgreSQL so that peer workers can pick them up immediately.
   - Closes the PostgreSQL connection pool and exits with code 0.

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
| Exponential Backoff & DLQ | Max attempts transitions to DLQ | `test-production-queue-worker.js` Test 6 | **VERIFIED** |
| Burst Concurrency | 20 parallel requests generate 1 job | `test-production-queue-worker.js` Test 7 | **VERIFIED** |
| Heartbeat Tracking | Heartbeat extends lease lock | `test-production-queue-worker.js` Test 8 | **VERIFIED** |
| Stalled Job Recovery | Expired leases automatically reclaimed | `test-production-queue-worker.js` Test 9 | **VERIFIED** |
| In-Flight Job Release | Graceful shutdown releases job to pending | `test-production-queue-worker.js` Test 10 | **VERIFIED** |
| Job Cancellation | Cancel transitions status to cancelled | `test-production-queue-worker.js` Test 11 | **VERIFIED** |
