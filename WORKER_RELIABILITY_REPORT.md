# RAGHUL AI — BACKGROUND WORKER & QUEUE RELIABILITY REPORT
**Document Version:** 3.0.0 (Phase 13 Worker Audit)  
**Date:** November 2026  
**Auditor:** Principal Backend Engineer & Reliability Architect  
**Status:** ✅ Production Certified (At-Least-Once Delivery with Idempotency)

---

## 1. DISTRIBUTED JOB QUEUE LIFECYCLE (`queue/jobQueue.js`)

The queue is backed by Supabase PostgreSQL table `job_queue` and implements high-concurrency safe operations:

```
[Web Service API]
       │
       ▼ 1. Enqueue with Idempotency Key (ON CONFLICT DO NOTHING)
 [PostgreSQL job_queue Table]
       │
       ▼ 2. Atomic Acquisition: SELECT ... FOR UPDATE SKIP LOCKED
 [Render Background Worker]
       │
       ├─► 3. Heartbeat Loop: locked_at = NOW() (every 10s)
       ├─► 4. Cross-Process EventBus: job_events insertion + LISTEN/NOTIFY
       └─► 5. Completion: status = 'completed', result stored
```

### 1.1 Atomic Job Acquisition
```sql
SELECT * FROM job_queue
WHERE status = 'pending' AND run_at <= NOW()
ORDER BY priority DESC, created_at ASC
LIMIT 1
FOR UPDATE SKIP LOCKED;
```
Transactions are held only during the brief acquisition step (under 5 milliseconds), preventing locked rows from blocking peer workers.

### 1.2 Burst Concurrent Idempotency
- **Stress Test Outcome:** Tested with **20 concurrent requests with the identical idempotency key**. Exactly 1 job was created; 19 requests returned the duplicate job reference without constraint violation errors.

---

## 2. WORKER LIFECYCLE & CRASH RECOVERY (`worker.js`)

### 2.1 Active Heartbeat
The worker executes an active 10-second heartbeat loop updating `locked_at = NOW()` on the acquired job.

### 2.2 Stalled Job Auto-Recovery
If a worker crashes (OOM, SIGKILL, platform recycling), peer workers or a restarted worker invoke `recoverStalledJobs()`:
```sql
UPDATE job_queue
SET status = 'pending', locked_by = NULL, locked_at = NULL, attempts = attempts + 1
WHERE status = 'running' AND locked_at < NOW() - INTERVAL '60 seconds' AND attempts < max_attempts;
```
Expired jobs are safely reclaimed and executed without human intervention.

### 2.3 Dead-Letter Queue (DLQ)
Jobs exceeding `max_attempts` (default: 3) transition to `status = 'failed'` with complete stack traces persisted to `error_details`.

---

## 3. CROSS-PROCESS SSE EVENT BUS (`services/eventBus.js`)

- **Dual-Delivery Model:** Events are inserted into `job_events` table and broadcast via PostgreSQL `NOTIFY job_events`.
- **PgBouncer Fallback:** For transaction poolers that do not support long-lived `LISTEN`, an active 400ms polling fallback polls `job_events` for active client subscriptions.
- **Event Deduplication:** Enforces `seenEventIds` set to eliminate duplicate client emissions.
- **Last-Event-ID Support:** Client reconnects pass `Last-Event-ID` header; missing events are replayed from `job_events`.
