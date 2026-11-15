# 🚀 Raghul AI — Step-by-Step Production Deployment Guide

This guide provides exhaustive, production-grade instructions for deploying the 4-tier Raghul AI architecture across Vercel, Render, and Supabase.

---

## 1. Prerequisites & Account Setup

Ensure you have administrative access to the following platforms:
1. **GitHub:** Repository containing this codebase (`raghul692/ai-chatbot` or fork).
2. **Supabase:** Cloud project running PostgreSQL 17 with `pgvector`.
3. **Render:** Account with Web Service and Background Worker capabilities.
4. **Vercel:** Account connected to your GitHub repository.

---

## 2. Supabase Infrastructure Provisioning

### A. Database Provisioning & Schema Migration
1. Log in to [Supabase Console](https://supabase.com/dashboard) and create a new project (e.g., `raghul-ai-production`).
2. Retrieve the Transaction Connection Pooler URL and Direct Connection URL from **Project Settings -> Database -> Connection String**:
   - `DATABASE_URL`: `postgres://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres?pgbouncer=true` (or direct on port 5432).
3. Clone the repository locally and apply all versioned migrations:
   ```bash
   export DATABASE_URL="postgresql://postgres:[PASSWORD]@[HOST]:5432/postgres?sslmode=require"
   node scripts/run-migrations.js
   ```
   *Expected output:* Confirms all 12 migration files successfully executed.

### B. Data Ingestion (SQLite to Supabase)
If you have existing records in `data/nexus.db`:
```bash
node scripts/migrate-sqlite-to-supabase.js
```
*Expected output:* `8,519+ records migrated across 55 user tables.`

### C. Supabase Storage Buckets Setup
1. Go to **Storage -> Create Bucket** in the Supabase Dashboard, or verify that the automated provisioning script runs:
   ```bash
   node -e "import('./services/storageService.js').then(m => m.default.initBuckets())"
   ```
2. Verify the 3 required buckets exist:
   - `raghul-ai-documents` (Public: false, RLS enforced)
   - `raghul-ai-reports` (Public: true)
   - `raghul-ai-images` (Public: true)
3. Under **Storage -> Policies**, ensure read policies are active for public buckets or service_role access.

---

## 3. Render Web Service Deployment (`raghul-ai-api`)

1. Log in to [Render Dashboard](https://dashboard.render.com).
2. Click **New +** -> **Web Service** and connect your GitHub repository.
3. Configure settings:
   - **Name:** `raghul-ai-api`
   - **Environment:** `Node`
   - **Region:** Match your Supabase region (e.g., Oregon / US-West or Singapore).
   - **Branch:** `main`
   - **Build Command:** `npm install --omit=dev`
   - **Start Command:** `npm start` (executes `node server.js`)
   - **Plan:** Starter or Standard (0.5+ CPU, 512MB+ RAM)
4. Configure **Health Check Path:**
   - Set to `/health`
5. Configure Environment Variables (refer to `ENVIRONMENT_VARIABLES.md` for full list):
   - `NODE_ENV`: `production`
   - `PORT`: `10000` (Render default)
   - `DATABASE_URL`: `postgresql://postgres:[PASSWORD]@[HOST]:5432/postgres?sslmode=require`
   - `SUPABASE_URL`: `https://[PROJECT_ID].supabase.co`
   - `SUPABASE_SERVICE_ROLE_KEY`: `[YOUR_SERVICE_ROLE_KEY]`
   - `CORS_ORIGIN`: `https://your-app.vercel.app,https://raghulraja.is-a.dev`
   - `ADMIN_API_KEY`: `[GENERATE_A_SECURE_RANDOM_UUID]`
   - `GEMINI_API_KEY`, `GROQ_API_KEY`, `OPENAI_API_KEY` (AI provider keys)
6. Click **Deploy Web Service**.
7. Note down the public URL: `https://raghul-ai-api.onrender.com`.

---

## 4. Render Background Worker Deployment (`raghul-ai-worker`)

1. In Render Dashboard, click **New +** -> **Background Worker**.
2. Connect the same GitHub repository.
3. Configure settings:
   - **Name:** `raghul-ai-worker`
   - **Environment:** `Node`
   - **Region:** Same region as Web Service.
   - **Branch:** `main`
   - **Build Command:** `npm install --omit=dev`
   - **Start Command:** `npm run worker` (executes `node worker.js`)
   - **Plan:** Starter or Standard (0.5+ CPU, 512MB+ RAM)
4. Configure Environment Variables:
   - `NODE_ENV`: `production`
   - `DATABASE_URL`: (Identical Supabase URL as Web Service)
   - `SUPABASE_URL`: (Identical Supabase URL)
   - `SUPABASE_SERVICE_ROLE_KEY`: (Identical Key)
   - `WORKER_CONCURRENCY`: `2`
   - `WORKER_POLL_INTERVAL_MS`: `2000`
   - `GEMINI_API_KEY`, `GROQ_API_KEY`, `OPENAI_API_KEY`
5. Click **Deploy Background Worker**.
6. Check the Worker logs. You should observe:
   ```
   ================================================================
   🤖 RAGHUL AI — BACKGROUND WORKER INITIALIZING [worker-xxx]
   Target Queue: Supabase PostgreSQL (Distributed)
   Cloud Storage: Supabase Storage Active
   Max Concurrency: 2
   ================================================================
   Polling queue every 2000ms...
   ```

---

## 5. Vercel Frontend Deployment

1. Log in to [Vercel Dashboard](https://vercel.com) and click **Add New -> Project**.
2. Import the GitHub repository.
3. In **Project Settings**:
   - **Framework Preset:** Other
   - **Root Directory:** `./`
   - **Output Directory:** `public`
4. Add Environment Variables:
   - `BACKEND_URL`: `https://raghul-ai-api.onrender.com`
5. Verify `vercel.json` in repository:
   - Contains rewrite from `/api/:path*` to `https://raghul-ai-api.onrender.com/api/:path*`.
6. Click **Deploy**.
7. Once deployed, copy your production domain (e.g., `https://raghul-ai.vercel.app`).
8. Return to Render Web Service settings and ensure `CORS_ORIGIN` includes your Vercel domain!

---

## 6. End-to-End Post-Deployment Verification

Execute the following verification curl requests against your live deployment:

1. **Verify Liveness:**
   ```bash
   curl -I https://raghul-ai-api.onrender.com/health
   # Expected: HTTP/1.1 200 OK
   ```

2. **Verify Readiness (Supabase & Queue Connectivity):**
   ```bash
   curl https://raghul-ai-api.onrender.com/ready
   # Expected: {"status":"ready","database":{"driver":"postgresql","status":"healthy"}}
   ```

3. **Verify Vercel Rewrites:**
   ```bash
   curl -I https://your-app.vercel.app/health
   # Expected: HTTP/2 200 OK
   ```

4. **Verify CORS Protection:**
   ```bash
   curl -I -H "Origin: https://malicious-site.com" https://raghul-ai-api.onrender.com/api/jobs
   # Expected: Access-Control-Allow-Origin will NOT match malicious origin
   ```
