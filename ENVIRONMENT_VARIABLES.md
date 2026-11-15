# ⚙️ Raghul AI — Environment Variables Master Reference

This document provides a comprehensive specification of all environment variables used across the Vercel Frontend, Render Web Service, Render Background Worker, and Supabase Database layers.

---

## 1. Environment Matrix by Deployment Target

| Variable Name | Required? | Target Tier | Description | Production Default / Example |
| :--- | :--- | :--- | :--- | :--- |
| `NODE_ENV` | Yes | Web / Worker | Runtime environment mode | `production` |
| `PORT` | Yes | Web | Port for Express HTTP listener | `10000` (Render default) |
| `DATABASE_URL` | Yes | Web / Worker | PostgreSQL connection string | `postgresql://postgres:[PWD]@[HOST]:5432/postgres?sslmode=require` |
| `SUPABASE_URL` | Yes | Web / Worker | Base URL for Supabase API | `https://[PROJECT_ID].supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Web / Worker | Admin service key for Supabase Storage | `eyJhbGciOi...` |
| `CORS_ORIGIN` | Yes | Web | Comma-separated list of allowed origins | `https://your-app.vercel.app,https://raghulraja.is-a.dev` |
| `ADMIN_API_KEY` | Yes | Web | Secure secret key for admin/terminal routes | `[Cryptographically generated UUID]` |
| `DEVELOPER_API_KEY` | Optional | Web | Secondary secret key for developer API access | `[Random secret token]` |
| `WORKER_CONCURRENCY` | Optional | Worker | Max concurrent jobs per worker instance | `2` |
| `WORKER_POLL_INTERVAL_MS`| Optional | Worker | Idle polling interval in milliseconds | `2000` |
| `JOB_TIMEOUT_MS` | Optional | Worker | Maximum duration before job times out | `300000` (5 minutes) |
| `BACKEND_URL` | Yes | Vercel | Base URL of Render Web Service | `https://raghul-ai-api.onrender.com` |
| `GEMINI_API_KEY` | Recommended | Web / Worker | Google Gemini 1.5 Pro/Flash AI API key | `AIzaSy...` |
| `GROQ_API_KEY` | Recommended | Web / Worker | Groq Cloud ultra-fast inference API key | `gsk_...` |
| `OPENAI_API_KEY` | Optional | Web / Worker | OpenAI API key for embeddings and GPT-4o | `sk-...` |
| `TAVILY_API_KEY` | Optional | Web / Worker | Tavily Search API key for research extraction| `tvly-...` |
| `EXA_API_KEY` | Optional | Web / Worker | Exa Neural Search API key for web citations | `...` |

---

## 2. Configuration Profiles

### Profile A: Render Web Service (`raghul-ai-api`)
```env
NODE_ENV=production
PORT=10000
DATABASE_URL=postgresql://postgres:[PASSWORD]@[HOST]:5432/postgres?sslmode=require
SUPABASE_URL=https://[PROJECT_ID].supabase.co
SUPABASE_SERVICE_ROLE_KEY=[YOUR_SERVICE_ROLE_KEY]
CORS_ORIGIN=https://your-app.vercel.app,https://raghulraja.is-a.dev
ADMIN_API_KEY=[YOUR_SECURE_ADMIN_KEY]

# AI Providers
GEMINI_API_KEY=[YOUR_GEMINI_KEY]
GROQ_API_KEY=[YOUR_GROQ_KEY]
```

### Profile B: Render Background Worker (`raghul-ai-worker`)
```env
NODE_ENV=production
DATABASE_URL=postgresql://postgres:[PASSWORD]@[HOST]:5432/postgres?sslmode=require
SUPABASE_URL=https://[PROJECT_ID].supabase.co
SUPABASE_SERVICE_ROLE_KEY=[YOUR_SERVICE_ROLE_KEY]
WORKER_CONCURRENCY=2
WORKER_POLL_INTERVAL_MS=2000
JOB_TIMEOUT_MS=300000

# AI Providers for Research & Synthesis
GEMINI_API_KEY=[YOUR_GEMINI_KEY]
GROQ_API_KEY=[YOUR_GROQ_KEY]
TAVILY_API_KEY=[YOUR_TAVILY_KEY]
```

### Profile C: Vercel Frontend
```env
BACKEND_URL=https://raghul-ai-api.onrender.com
```

### Profile D: Local Development (Offline Mode)
For local development without cloud credentials, omit `DATABASE_URL` and `SUPABASE_URL`. The application will automatically initialize the local SQLite engine (`data/nexus.db`) and local filesystem storage.
```env
PORT=3000
NODE_ENV=development
ADMIN_API_KEY=local-dev-key
```
