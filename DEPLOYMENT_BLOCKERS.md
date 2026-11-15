# 🛑 RAGHUL AI — DEPLOYMENT BLOCKERS & PRODUCTION PREREQUISITES
**Audit Date**: 2026-11-15  
**Review Level**: Principal DevOps & Cloud Infrastructure Gate  
**Deployment Target**: Vercel (Frontend) + Render Web (`raghul-ai-api`) + Render Worker (`raghul-ai-worker`) + Supabase (PostgreSQL 17.6 + Storage)  

---

## 1. Resolved Blockers (Fixed in Phase 13)

| Blocker ID | Severity | Root Cause | Resolution Applied | Verification |
| :--- | :--- | :--- | :--- | :--- |
| **BLK-01** | **CRITICAL** | Silent SQLite fallback in production (`database/adapter.js` & `queue/jobQueue.js`) | Enforced strict rejection in production: queries fail loudly and `/ready` returns 503 if PostgreSQL is unavailable. | `test-production-health-ready.js` |
| **BLK-02** | **CRITICAL** | Privileged routes (`/api/terminal`, `/api/workspace`, `/api/git`, `/api/code`) allowed unauthenticated loopback/origin access | Implemented mandatory server-side Bearer token auth (`ADMIN_API_KEY`) in `middleware/auth.js`. | `test-production-health-ready.js` (Test 5) |
| **BLK-03** | **HIGH** | Windows IPv6 DNS timeout bug in connection pool (`dns.setDefaultResultOrder('verbatim')`) | Replaced with `ipv4first` across `database/postgresPool.js`, reducing probe latency by >10x. | `test-production-db-adapter.js` |
| **BLK-04** | **HIGH** | 5 historical SQLite records rejected by PostgreSQL schema mismatch on NOT NULL constraints | Created Migration 013 relaxing obsolete legacy NOT NULLs and migrated all 5 records (100% parity). | `scripts/check-5-records.js` |
| **BLK-05** | **MEDIUM** | Vercel rewrite configuration lacked `/health` and `/ready` routing | Updated `vercel.json` rewrites to proxy `/health` and `/ready` to `raghul-ai-api.onrender.com`. | Configuration inspection |
| **BLK-06** | **MEDIUM** | SSRF filter lacked IPv6 Link-Local and ULA filtering | Added RFC 4193 and RFC 4291 IPv6 checks in `research/security/guardrails.js`. | `test-stage7-security.js` |

---

## 2. Active External Prerequisites & Cloud Environment Setup

These items require manual configuration in the cloud dashboards before DNS cutover to live production traffic:

### A. Render Environment Variables Configuration
The following environment variables MUST be populated in the Render dashboard for both `raghul-ai-api` and `raghul-ai-worker`:

1. `DATABASE_URL`: Must point to the Supabase PostgreSQL connection string (Transaction Pooler on port 6543 or Session Pooler on port 5432).
2. `SUPABASE_URL`: Must point to `https://brmafvpjvdgieelcgivi.supabase.co`.
3. `SUPABASE_SERVICE_ROLE_KEY`: Required for bucket operations (`raghul-ai-documents`, `raghul-ai-reports`, `raghul-ai-images`).
4. `ADMIN_API_KEY`: Secret string (min 32 characters) required for privileged endpoint authorization.
5. `GEMINI_API_KEY`: Primary AI reasoning and chat key.
6. `GROQ_API_KEY`, `OPENROUTER_API_KEY`, `NVIDIA_API_KEY`: Fallback provider keys.
7. `GITHUB_PERSONAL_ACCESS_TOKEN`: Required for GitHub autonomous agent operations.

### B. Render Service Plan Considerations
- **Free Tier Hazard**: Render free tier Web Services spin down after 15 minutes of inactivity, causing 50+ second cold-start delays. Render Background Workers are not supported on the free plan (require Starter plan or higher).
- **Recommendation**: Deploy `raghul-ai-api` on Render Starter ($7/mo) and `raghul-ai-worker` on Render Starter ($7/mo) in the Singapore region (`singapore`) for low latency.

### C. Vercel Configuration
- Vercel project root must serve `public/` directory (configured via `vercel.json`).
- Ensure custom domain `raghulraja-portfolio.vercel.app` or `raghulraja.is-a.dev` is configured with valid SSL/TLS certificates.

### D. Supabase Storage Buckets
- Verify that buckets `raghul-ai-documents`, `raghul-ai-reports`, and `raghul-ai-images` have public read access enabled for generated artifacts, while restricting write access to the service role.

---

## 3. Operational Risk Assessment

| Risk Area | Severity | Likelihood | Mitigation Strategy |
| :--- | :--- | :--- | :--- |
| **PostgreSQL Pooler Exhaustion** | High | Low | Pool max set to 10 connections per service; short transactions enforced. |
| **Multi-Agent WAN Latency** | Medium | Medium | Deep Research and Swarms execute asynchronously in Worker; Web Service responds immediately with job ID. |
| **Worker Container Restart** | Medium | Low | Queue uses processing leases (`locked_at`); orphaned jobs recovered automatically on restart. |
| **Network Partition / Outage** | High | Low | Exponential backoff retry policies (up to 3 attempts) before routing to Dead-Letter Queue (DLQ). |

---

## 4. Final Blocker Status

**Zero Unresolved Code Blockers.**  
All repository code, schema definitions, queue mechanisms, and test suites are verified. Cloud environment variable provisioning remains the sole prerequisite prior to production activation.
