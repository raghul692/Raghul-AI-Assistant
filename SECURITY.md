# 🛡️ Raghul AI — Production Security & Governance Architecture

## 1. Zero-Trust Security Posture

Raghul AI operates under strict enterprise security principles:
1. **Zero Client Trust:** The frontend is treated as an untrusted public client. Sensitive database credentials, AI service role keys, and internal queue URLs are strictly isolated on the backend.
2. **Explicit CORS Allowlisting:** Cross-Origin Resource Sharing headers explicitly validate incoming origins against configured production hosts (e.g., `https://your-app.vercel.app`), completely rejecting unauthorized origins.
3. **Defense-in-Depth Authentication:** High-privilege routes require API key authorization or loopback developer origin validation.
4. **End-to-End Auditability:** All administrative changes, governance actions, and settings alterations are recorded in tamper-evident audit logs.

---

## 2. Authentication & Authorization Boundaries (`middleware/auth.js`)

The platform implements layered authentication middleware:

### A. Request ID Stamping (`requestIdMiddleware`)
Every incoming HTTP request is assigned a unique UUID (`X-Request-ID`). This ID is included in response headers and propagated across all database queries and worker jobs to enable end-to-end distributed tracing.

### B. High-Privilege Route Guard (`requireLocalDeveloperOrigin` / `requireSensitiveOperationAuth`)
Critical operational endpoints (such as `/api/code/run`, `/api/terminal/*`, `/api/git/*`, `/api/workspace/*`) are guarded against unauthorized execution:
1. **Production Token Authentication:** In production (`NODE_ENV === 'production'`), requests MUST supply a valid `ADMIN_API_KEY` or `DEVELOPER_API_KEY` via `Authorization: Bearer <token>` or `x-api-key`.
2. **CORS & Origin Hardening:** CORS is explicitly decoupled from authentication. Browser `Origin` headers and loopback IP headers are NEVER trusted as proof of developer identity in production. Unauthenticated requests from any origin are rejected with `HTTP 401 Unauthorized`.
3. **Local Development Fallback:** In local offline development (`NODE_ENV !== 'production'`), loopback access (`127.0.0.1`, `::1`) is permitted for local IDE operations.

```javascript
import { requireLocalDeveloperOrigin } from './middleware/auth.js';

// Protect sensitive endpoints
app.use('/api/code', requireLocalDeveloperOrigin, codeRouter);
app.use('/api/terminal', requireLocalDeveloperOrigin, terminalRouter);
app.use('/api/git', requireLocalDeveloperOrigin, gitRouter);
app.use('/api/workspace', requireLocalDeveloperOrigin, workspaceRouter);
```

---

## 3. Server-Side Request Forgery (SSRF) Defense

The Deep Research Engine crawls web pages dynamically to extract evidence. To prevent SSRF attacks against internal network resources:
1. **IP Range Blacklisting:** Any URL resolving to private or link-local IP spaces (`127.0.0.0/8`, `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, `169.254.0.0/16`) is rejected prior to outbound connection.
2. **Protocol Restrictions:** Only `http:` and `https:` protocols are permitted. `file:`, `ftp:`, and `gopher:` are strictly prohibited.
3. **Cloud Metadata Protection:** Outbound calls to `http://169.254.169.254` (AWS/GCP/Render metadata services) are intercepted and dropped immediately.

---

## 4. SQL Injection Protection

All PostgreSQL interactions via `database/postgresPool.js` and `database/adapter.js` mandate parameterized queries:
- **Parameterized Placeholders:** PostgreSQL queries strictly use `$1, $2, ...` syntax.
- **Auto-Mapping:** The database adapter automatically parses and converts SQLite-style `?` positional parameters into PostgreSQL `$1, $2, ...` indexed parameters when operating against Supabase.
- **Zero Raw String Interpolation:** SQL queries NEVER concatenate unescaped user input into query strings.

---

## 5. Secret & Key Management Matrix

| Secret Name | Exposed to Client? | Stored In | Purpose |
| :--- | :--- | :--- | :--- |
| `DATABASE_URL` | **NO** | Render Environment | Connection string for Supabase PostgreSQL pool |
| `SUPABASE_SERVICE_ROLE_KEY` | **NO** | Render Environment | Admin key for Supabase Storage & RLS bypass |
| `ADMIN_API_KEY` | **NO** | Render Environment | High-privilege terminal/code execution guard |
| `GEMINI_API_KEY` | **NO** | Render Environment | Gemini 1.5 Pro / Flash AI text generation |
| `GROQ_API_KEY` | **NO** | Render Environment | Ultra-low latency Mixtral / Llama 3 inference |
| `OPENAI_API_KEY` | **NO** | Render Environment | Embeddings and fallback reasoning |
| `TAVILY_API_KEY` | **NO** | Render Environment | Deep research web search & fact validation |
| `BACKEND_URL` | **YES** | Vercel Environment | Base URL of Render Web Service for client API calls |

---

## 6. HTTP Security Headers

The Render Web Service applies hardened HTTP security headers:
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: SAMEORIGIN`
- `X-XSS-Protection: 1; mode=block`
- `Strict-Transport-Security: max-age=31536000; includeSubDomains` (enforced via HTTPS)
- `Access-Control-Allow-Credentials: true` with strict origin matching.
