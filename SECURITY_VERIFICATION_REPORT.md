# 🛡️ RAGHUL AI — SECURITY VERIFICATION REPORT
**Audit Date**: 2026-11-15  
**Compliance Standard**: OWASP Top 10 (2026) / ASVS 5.0 Level 2 / Cloud Production Hardening  
**Scope**: Authentication, Authorization, Sensitive APIs, SSRF, CORS, Secrets Hygiene, Storage Isolation  

---

## 1. Authentication & Sensitive Endpoint Protection

### Threat Model
Privileged endpoints allow arbitrary terminal commands (`/api/terminal/*`), workspace file creation and editing (`/api/workspace/*`), git commit and stage commands (`/api/git/*`), AST code repair (`/api/code/*`), human governance approval resolution (`/api/governance/approvals/:id`), GitHub integration control (`/api/github/*`), and portfolio administration (`/api/portfolio/*`). If exposed without rigorous authentication, an attacker could achieve Remote Code Execution (RCE) or complete system compromise.

### Implemented Hardening & Controls
1. **Mandatory Bearer Token Gate**:
   In `middleware/auth.js`, all privileged routes require an `ADMIN_API_KEY` or `DEVELOPER_API_KEY`.
2. **Constant-Time Comparison (`crypto.timingSafeEqual`)**:
   Standard string comparisons (`a === b`) are vulnerable to timing side-channel attacks, leaking key characters through latency differences. We implemented constant-time comparison on SHA-256 digests:
   ```javascript
   function safeCompareKeys(provided, expected) {
     if (!provided || !expected) return false;
     const hashA = crypto.createHash('sha256').update(String(provided)).digest();
     const hashB = crypto.createHash('sha256').update(String(expected)).digest();
     return crypto.timingSafeEqual(hashA, hashB);
   }
   ```
3. **Query Parameter Token Support for Browser SSE**:
   Browser `EventSource` cannot send custom headers. To prevent unauthenticated access while allowing browser SSE connections, `middleware/auth.js` checks `req.query.token` and `req.query.apiKey`, validating them against `ADMIN_API_KEY`.
4. **Origin & Loopback Disallowance in Production**:
   In production (`NODE_ENV === 'production'`), requests from loopback IPs (`127.0.0.1`, `::1`) or requests carrying CORS origin headers are strictly denied unless accompanied by a valid Bearer token.
5. **Universal Sensitive Route Protection**:
   `requireSensitiveOperationAuth` is attached across:
   - `routes/terminalRoutes.js`
   - `routes/codeRoutes.js`
   - `routes/workspaceRoutes.js`
   - `routes/gitRoutes.js`
   - `routes/governanceRoutes.js` (`POST /approvals/:id`)
   - `githubRoutes.js` (`POST /connect`, `/pull-requests/review`, `/automations/trigger`, `/approvals/decision`, `/swarm/execute`)
   - `portfolioRoutes.js` (`POST /emergency-stop`, `/control/action`, `/agent/execute`, `/agent/approve`, `/deployments/trigger`, `/sync/supabase`, `/database/rollback-test`, `/database/backup`, `/settings`)

---

## 2. Server-Side Request Forgery (SSRF) Guardrails

### Deep Research Web Scraper Protection
The Deep Research engine crawls the internet for citations and primary sources. To prevent intranet scanning and cloud instance credential extraction, `research/security/guardrails.js` implements strict multi-layer checks:

1. **Protocol Whitelist**: Only `http:` and `https:` permitted. `file:`, `gopher:`, `ftp:`, `ldap:` blocked.
2. **Cloud Metadata Hostnames Blocked**:
   - `169.254.169.254` (AWS, GCP, Azure, OpenStack instance metadata service).
   - `metadata.google.internal` (Google Cloud metadata).
   - `instance-data` (AWS legacy metadata).
   - `metadata.packet.net` (Equinix Metal metadata).
3. **Private IPv4 Subnet Check**:
   - `127.0.0.0/8` (Loopback)
   - `10.0.0.0/8` (Private Class A)
   - `172.16.0.0/12` (Private Class B)
   - `192.168.0.0/16` (Private Class C)
   - `169.254.0.0/16` (Link-Local / APIPA)
   - `0.0.0.0/8` (Current network)
4. **IPv6 Private & Link-Local Filtering**:
   - `::1` and `::` (Loopback & unspecified)
   - `fe80::/10` (Link-Local)
   - `fc00::/7` and `fd00::/7` (Unique Local Addresses - RFC 4193)
5. **Anti-DNS Rebinding Validation**:
   `validateSafeUrlAsync()` performs asynchronous DNS resolution via `dns.promises.lookup()` to inspect the target's actual IP before sending requests.
6. **Anti-SSRF Manual Redirect Loop**:
   Both `research/extractors/webExtractor.js` and `server.js` (`fetchWebPage`) use `redirect: 'manual'`, looping a maximum of 4 hops. Each redirect target is validated against `validateSafeUrl()` before following, preventing redirect bypass to internal networks.

---

## 3. Storage Security & Path Traversal Guardrails

In `services/storageService.js`:
1. **Directory Traversal Defense**:
   All paths passed to upload, download, signed URL, and delete are checked via `assertSafeStoragePath()`:
   - Disallows `..`, leading slashes, null bytes, backslashes, and control characters.
2. **Bucket Whitelisting**:
   Restricted strictly to `raghul-ai-documents`, `raghul-ai-reports`, and `raghul-ai-images`. Access to unapproved buckets is rejected.
3. **Payload Size Limit**:
   Uploads are capped at 50MB (`MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024`).
4. **Fail-Closed in Production**:
   In production (`NODE_ENV === 'production'`), storage failures throw immediate exceptions; silent local filesystem fallbacks are disabled.

---

## 4. CORS Policy & Preflight Security

- Configured explicitly in `server.js`:
  ```javascript
  const allowedOrigins = process.env.ALLOWED_ORIGINS 
    ? process.env.ALLOWED_ORIGINS.split(',').map(s => s.trim())
    : [
        'http://localhost:3000',
        'http://127.0.0.1:3000',
        'http://localhost:5173',
        'https://raghulraja.is-a.dev',
        'https://raghulraja-portfolio.vercel.app'
      ];
  ```
- No wildcard `*` with credentials.
- Disallowed origins are rejected with an explicit CORS policy block.

---

## 5. Secrets & Credential Protection

- **Zero Secrets in Frontend Assets**: `public/app.js`, `public/os.html`, `public/studioIde.js`, and `public/portfolioOsEngine.js` contain zero backend API keys, service role keys, or database credentials.
- **Server-Side Token Storage**:
  - `DATABASE_URL`: Stored in Render Web & Worker env vars.
  - `SUPABASE_SERVICE_ROLE_KEY`: Stored in Render Web & Worker env vars. Never transmitted to frontend.
  - `ADMIN_API_KEY`: Stored in Render env vars for server-to-server operations.
  - `GEMINI_API_KEY`, `GROQ_API_KEY`, `OPENROUTER_API_KEY`, `NVIDIA_API_KEY`: Server-side only.
- **Log Sanitizer**: `research/security/guardrails.js` redacts API key patterns, GitHub PATs, and credit cards from logs and error messages.

---

## 6. Security Release Gate Verdict

**ALL SECURITY GATES PASSED.**  
The application adheres strictly to OWASP Top 10 guidelines with defense-in-depth across authentication, SSRF protection, storage boundaries, and secrets management.
