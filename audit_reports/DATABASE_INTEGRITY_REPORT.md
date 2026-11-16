# RAGHUL AI — SUPABASE POSTGRESQL & DATABASE INTEGRITY REPORT
**Target Database**: Supabase PostgreSQL 17.6 on aarch64 Linux  
**Connection Host**: `aws-0-ap-south-1.pooler.supabase.com:5432` (AWS Mumbai Pooler)  
**Database Name**: `postgres`  
**User**: `postgres.brmafvpjvdgieelcgivi`  
**Audit Standard**: Schema Verification, pgvector Embeddings, ACID Transactions & Pool Health  
**Audit Timestamp**: 2026-11-16T14:15:00Z  

---

## 1. POSTGRESQL POOL & HARDWARE HEALTH

Executing probe against `aws-0-ap-south-1.pooler.supabase.com`:
```json
{
  "driver": "postgresql",
  "status": "healthy",
  "latencyMs": 71,
  "timestamp": "2026-11-16T08:19:06.088Z",
  "version": "PostgreSQL 17.6 on aarch64-unknown-linux-gnu, compiled by gcc (GCC) 15.2.0, 64-bit"
}
```

### Connection Pool Configuration (`database/postgresPool.js`)
- `max`: 10 connections (tailored to Supabase free/starter pooler limits)
- `idleTimeoutMillis`: 30,000ms
- `connectionTimeoutMillis`: 15,000ms
- `keepAlive`: `true` (TCP keepalive enabled)
- `ssl`: `{ rejectUnauthorized: false }` (mandatory for Supabase SSL pooler connection)
- `dns.lookup`: Family 4 enforced to prevent Windows IPv6 connection reset drops

---

## 2. PRODUCTION SCHEMA & TABLE INVENTORY

The live Supabase database contains the full relational schema migrated through scripts 001 to 013:

| Table Name | Primary Key | Key Columns / Indexes | Purpose | Live Count |
| :--- | :--- | :--- | :--- | :--- |
| `chats` | `id` (TEXT) | `title`, `created_at`, `updated_at`, `pinned` | High-level conversation sessions | 134 |
| `messages` | `id` (TEXT) | `chat_id` (FK), `role`, `content`, `created_at` | Individual dialogue turns | 890+ |
| `user_memories` | `id` (TEXT) | `key`, `fact`, `category`, `confidence` | Extracted long-term user facts & tech stack preferences | Active |
| `job_queue` | `id` (TEXT) | `idempotency_key`, `job_type`, `priority`, `status` | Distributed background queue | Active |
| `job_events` | `id` (BIGSERIAL) | `job_id`, `event_type`, `payload`, `created_at` | Real-time event bus for SSE delivery | Active |
| `audit_ledger` | `id` (TEXT) | `actor`, `action`, `hash`, `prev_hash`, `timestamp` | Immutable SHA-256 tamper-evident governance ledger | Active |
| `projects` | `id` (TEXT) | `name`, `status`, `summary`, `created_at` | Portfolio OS projects & workspaces | Active |
| `document_chunks` | `id` (TEXT) | `document_id`, `chunk_text`, `embedding` (vector 768) | RAG vector embeddings & similarity search | Active |

---

## 3. ACID TRANSACTIONS & DATA CORRUPTION CHECKS

1. **Transactional Rollback Verification**:
   - `tests/test-production-db-adapter.js` executed `dbAdapter.transaction()`.
   - Inserted a temporary test chat record and intentionally threw an error inside the transaction closure.
   - Verified that the record was completely rolled back from PostgreSQL. 0 ghost records remained.
2. **Atomic Idempotency Locking**:
   - `job_queue` defines `idempotency_key TEXT UNIQUE`.
   - In `tests/test-production-queue-worker.js`, 20 concurrent insert requests with the same idempotency key were executed simultaneously.
   - Result: Exactly 1 primary job was committed; 19 duplicate submissions received the existing job ID with `isDuplicate: true`. 0 database collision errors (`23505`) escaped to the user.
3. **Stalled Job Heartbeat Recovery**:
   - Running jobs update `locked_at` every 10 seconds.
   - If a background worker crashes or is SIGKILLed, `jobQueue.recoverStalledJobs(30000)` detects jobs whose `locked_at` is older than 30s, increments attempts, and restores them to `pending` status for retry.
