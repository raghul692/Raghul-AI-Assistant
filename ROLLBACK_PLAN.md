# 🔄 Raghul AI — Production Disaster Recovery & Rollback Plan

This runbook defines deterministic, rapid-rollback procedures to recover the platform from deployment failures, database disruptions, or service outages.

---

## 1. Quick Emergency Rollback Matrix

| Failure Scenario | Target Action | Est. Recovery Time |
| :--- | :--- | :--- |
| **Faulty Code Deployment on Render Web** | Rollback to previous deployment commit in Render Dashboard | < 2 minutes |
| **Faulty Worker Code Deployment** | Rollback worker to previous deployment commit in Render Dashboard | < 2 minutes |
| **Supabase PostgreSQL Outage** | Unset `DATABASE_URL` to engage embedded SQLite dual-adapter | < 3 minutes |
| **Corrupted Database Migration** | Restore Supabase Point-in-Time backup or execute rollback SQL | < 5 minutes |
| **Vercel Frontend Build Failure** | Rollback to previous production deployment in Vercel UI | < 1 minute |
| **Queue Saturation / Worker Crash** | Restart worker process; in-flight tasks re-queue via timeout recovery | < 2 minutes |

---

## 2. Step-by-Step Rollback Procedures

### Scenario A: Supabase PostgreSQL Disruption (Engaging SQLite Fallback)
If Supabase experiences a region outage or network connectivity fails between Render and Supabase:
1. Navigate to **Render Dashboard -> `raghul-ai-api` -> Environment**.
2. Temporarily delete or rename the `DATABASE_URL` variable (e.g., `DISABLED_DATABASE_URL`).
3. Click **Save Changes**. Render will automatically trigger a zero-downtime rolling restart.
4. On startup, `database/adapter.js` detects that `DATABASE_URL` is undefined:
   ```
   [Database Adapter] Routing to local SQLite engine (data/nexus.db).
   ```
5. The API immediately resumes handling traffic using the local SQLite persistence layer.
6. Once Supabase recovers, restore `DATABASE_URL` in the environment settings to resume cloud PostgreSQL operation.

### Scenario B: Reverting a Render Code Deployment
If a newly deployed commit introduces unexpected runtime errors:
1. Open [Render Dashboard](https://dashboard.render.com).
2. Click on the affected service (`raghul-ai-api` or `raghul-ai-worker`).
3. Select **Deploys** from the left navigation.
4. Locate the last known healthy deployment.
5. Click the three dots `...` next to that deployment and select **Rollback to this deploy**.
6. Render will rebuild and activate the previous Docker image within 60-120 seconds.

### Scenario C: Reverting a Vercel Frontend Deployment
If the frontend UI suffers from broken routing, asset 404s, or styling regressions:
1. Open [Vercel Dashboard](https://vercel.com).
2. Navigate to your project -> **Deployments**.
3. Locate the previous successful deployment.
4. Click the three dots `...` on the right and select **Instant Rollback**.
5. Vercel edge nodes will immediately switch traffic to the prior build within seconds.

### Scenario D: Database Schema & Data Rollback (Supabase)
If an errant migration corrupted schema tables or data integrity:
1. **Option 1: Point-in-Time Restore (Recommended)**
   - Open Supabase Console -> **Project Settings -> Database -> Backups**.
   - Select the automated snapshot immediately preceding the incident.
   - Click **Restore to this point**.
2. **Option 2: Re-executing Clean Migration & Ingestion**
   - If tables need complete re-creation:
     ```bash
     export DATABASE_URL="postgresql://postgres:[PASSWORD]@[HOST]:5432/postgres?sslmode=require"
     node scripts/run-migrations.js
     node scripts/migrate-sqlite-to-supabase.js
     ```
   - This safely restores the 8,519 baseline records from `data/nexus.db`.

### Scenario E: Unclogging a Saturated Worker Queue
If a runaway job or poison pill hangs worker processes:
1. Query stuck jobs in Supabase SQL editor:
   ```sql
   UPDATE job_queue
   SET status = 'failed', error = 'Manually terminated by operator during incident recovery', updated_at = NOW()
   WHERE status = 'processing' AND started_at < NOW() - INTERVAL '10 minutes';
   ```
2. Restart the worker in Render Dashboard by clicking **Manual Deploy -> Restart Service**.
3. The worker pool will cleanly pick up remaining pending jobs.
