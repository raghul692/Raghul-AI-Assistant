# 🤖 Raghul AI — Background Worker Architecture & Operations Runbook

## 1. Background Worker Overview

In compliance with 12-factor cloud principles, the Raghul AI system delegates heavy background computations, multi-agent AI research, code analysis, and document compilation to an independent Render Background Worker (`worker.js`).

The web service never executes long-running synchronous loops inside HTTP request handlers. It enqueues a job record, returns an immediate HTTP response with a job ID, and lets the background worker asynchronously consume and process the task.

---

## 2. Distributed Queue Architecture (`queue/jobQueue.js`)

The queue is backed by Supabase PostgreSQL in the `job_queue` table.

### Atomic Dequeue with `FOR UPDATE SKIP LOCKED`
To avoid race conditions when multiple worker instances run concurrently, tasks are dequeued using PostgreSQL's row-level locking feature:
```sql
WITH next_job AS (
  SELECT id
  FROM job_queue
  WHERE status = 'pending'
    AND (scheduled_at IS NULL OR scheduled_at <= NOW())
  ORDER BY priority DESC, created_at ASC
  LIMIT 1
  FOR UPDATE SKIP LOCKED
)
UPDATE job_queue q
SET status = 'processing',
    started_at = NOW(),
    worker_id = $1,
    attempts = attempts + 1,
    updated_at = NOW()
FROM next_job
WHERE q.id = next_job.id
RETURNING q.*;
```
This guarantees:
1. **Zero Race Conditions:** Exactly one worker acquires a given job.
2. **Strict Priority:** Highest priority jobs (e.g., priority `10` vs default `0`) execute first.
3. **FIFO Ordering:** Ties in priority are resolved by earliest submission timestamp.
4. **Zero Polling Deadlocks:** Workers do not wait on locked rows; they immediately skip to the next available unlocked job.

---

## 3. Supported Workload Types

| Job Type | Handler Method | Typical Duration | Output Artifact |
| :--- | :--- | :--- | :--- |
| `deep_research` | Autonomous multi-agent hypothesis generation, web crawling, and evidence validation | 30s - 180s | Formatted research report with live citations in Supabase Storage |
| `multi_agent_swarm` | 10-agent collaborative workflow & code topology synthesis | 20s - 90s | Synthesized architectural analysis bundle |
| `document_generation`| Compiling multi-page PDF/DOCX whitepapers | 5s - 25s | A4 PDF uploaded to `raghul-ai-reports` bucket |
| `code_repair` | Monaco AST parsing, linting, and automatic repair | 5s - 30s | Validated and patched source files |

---

## 4. Retries, Backoff & Dead-Letter Queue (DLQ)

Jobs are configured with automatic retry protection:
- **Default Max Retries:** 3 attempts.
- **Exponential Backoff Formula:**
  $$\text{delay} = \text{retryDelayMs} \times 2^{\text{attempts} - 1}$$
- If a transient network glitch or rate limit occurs (e.g., AI provider 429), the worker increments the `attempts` counter and schedules the next attempt in the future (`scheduled_at = NOW() + delay`).
- **Dead-Letter Quarantine:** If attempts exceed `max_attempts`, the job status transitions to `'failed'`, `dead_letter = TRUE`, and the error stack is preserved in the `error` column for operator triage.

---

## 5. Worker Operational Controls & Tuning

### Environment Variables for Worker
- `WORKER_CONCURRENCY`: Number of concurrent jobs processed by a single worker node (default: `2`).
- `WORKER_POLL_INTERVAL_MS`: Polling interval when the queue is idle (default: `2000` ms).
- `JOB_TIMEOUT_MS`: Time before an in-flight job is marked timed out (default: `300000` ms / 5 minutes).

### Graceful Shutdown Lifecycle
When Render deploys a new commit or restarts a container, it sends `SIGTERM` followed by `SIGINT`.
The worker handles these signals gracefully:
1. Sets `isShuttingDown = true` to stop dequeuing new jobs.
2. Waits up to 25 seconds for in-flight jobs to complete cleanly.
3. Closes database pool connections.
4. Exits with code `0`.

---

## 6. Manual Worker Testing & Verification

To run and verify the worker locally or in staging:
```bash
# Run unit & lifecycle test suite
node tests/test-production-queue-worker.js

# Launch worker in standalone daemon mode
npm run worker
```
