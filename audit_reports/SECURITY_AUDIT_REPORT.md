# RAGHUL AI — SECURITY & PRODUCTION HARDENING REPORT
**Audit Standard**: OWASP Top 10 (2025/2026), Server-Side Secret Isolation & Defense-in-Depth  
**Target Systems**: Frontend Bundle, Express API Gateway, Database Permissions, Storage  
**Audit Timestamp**: 2026-11-16T14:15:00Z  

---

## 1. SECRET EXPOSURE & API KEY HARDENING AUDIT

A recursive static and dynamic inspection was conducted across all client-side bundles and public assets:

| Sensitive Credential | Configuration Variable | Exposed to Browser? | Verification Record | Status |
| :--- | :--- | :--- | :--- | :--- |
| **Google Gemini Key** | `GEMINI_API_KEY` | **NO** | Server-side only; chat streamed via backend `/api/chat` | **SECURE** |
| **Portfolio Gemini Key**| `GEMINI_PORTFOLIO_API_KEY` | **NO** | Consumed strictly in `server.js` & `aiProviderManager.js` | **SECURE** |
| **Groq Cloud API Key** | `GROQ_API_KEY` | **NO** | Managed inside `providers/groqAdapter.js` on backend | **SECURE** |
| **OpenRouter API Key** | `OPENROUTER_API_KEY` | **NO** | Managed inside `providers/openrouterAdapter.js` | **SECURE** |
| **NVIDIA NIM API Key** | `NVIDIA_API_KEY` | **NO** | Managed inside `providers/nvidiaAdapter.js` | **SECURE** |
| **Cloudflare Token** | `CLOUDFLARE_API_TOKEN` | **NO** | Managed inside `providers/cloudflareAdapter.js` | **SECURE** |
| **GitHub Access Token** | `GITHUB_PERSONAL_ACCESS_TOKEN` | **NO** | Consumed only by `githubMcpGateway.js` on backend | **SECURE** |
| **Supabase Service Key**| `SUPABASE_SERVICE_ROLE_KEY` | **NO** | Exclusively used in `storageService.js` server-side | **SECURE** |
| **PostgreSQL DB URL** | `DATABASE_URL` | **NO** | Bound to Node.js backend pooler; never rendered in HTML | **SECURE** |
| **Admin API Key** | `ADMIN_API_KEY` | **NO** | Validated via HTTP headers for privileged routes | **SECURE** |

---

## 2. ATTACK SURFACE AUDIT & MITIGATION

### A. Server-Side Request Forgery (SSRF) Protection
- **Target Module**: `research/security/guardrails.js:validateSafeUrl`
- **Audit Test**: Verified in `tests/test-stage7-security.js` (0.3s).
- **Enforcement Rules**:
  - Blocks loopback addresses (`127.0.0.1`, `localhost`, `::1`).
  - Blocks cloud metadata endpoints (`169.254.169.254`, `metadata.google.internal`).
  - Blocks RFC1918 private subnets (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`).
  - Enforces explicit protocol whitelist (`http:`, `https:` only).

### B. Path Traversal Protection
- **Storage Service (`services/storageService.js`)**:
  - Normalized all download and upload paths with `path.normalize()`.
  - Blocks requests containing `../` or attempts to escape bucket root directory.
  - Verified in `tests/test-production-storage.js`: attempt to download `../../../../server.js` was caught and rejected safely.
- **Workspace File API (`routes/workspaceRoutes.js`)**:
  - Validates all file targets against `PROJECT_ROOT`.
  - Rejects traversal attempts with `HTTP 403 Forbidden`.
  - Rejects direct access to `.env` or sensitive configuration files.

### C. Prompt Injection & Sanitization
- **Target Module**: `security.js`
- **Mitigation Controls**:
  - `detectPromptInjection()` scans for delimiter hijacking, role-reversal exploits, and system prompt override attempts.
  - `redactSensitiveData()` automatically masks credit cards, private keys, and passwords before saving dialogue turns to database.
  - `sanitizeUserInput()` escapes HTML tags and prevents Cross-Site Scripting (XSS) in DOM rendering.

### D. CORS & Security HTTP Headers
- **Helmet**: Injects security headers across all API responses.
- **CORS**: Hardened with strict regex matching:
  - Permits `https://raghul-ai-assistant.vercel.app` (production frontend)
  - Permits `https://raghulraja-portfolio.vercel.app` & `https://raghulraja.is-a.dev`
  - Permits local developer loops (`localhost:3000`, `127.0.0.1:3000`, `localhost:5173`)
  - Blocks untrusted third-party origins with `Blocked by CORS policy: Origin not allowed`.
