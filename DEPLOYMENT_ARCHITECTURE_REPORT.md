# RAGHUL AI — Deployment Platform & Infrastructure Architecture Assessment

**Document ID:** RAGHUL-INFRA-EVAL-2026-V1  
**Date:** November 15, 2026  
**Auditor / Infrastructure Architect:** Principal Cloud & DevOps Architect  
**Status:** COMPLETE (Recommended Deployment Topology Defined)

---

## 1. Executive Summary

This report evaluates hosting platforms and deployment architectures for the **RAGHUL AI** platform. Based on the technical requirements of the codebase—specifically the embedded SQLite (`better-sqlite3`) database, persistent file workspaces (`scratch/`), long-lived Server-Sent Events (SSE) connections (exceeding 300 seconds during Deep Research execution), and real-time WebSocket PTY terminal sessions—this evaluation delivers evidence-based infrastructure recommendations.

---

## 2. Technical Stack Constraints & Architecture Profile

| Architectural Dimension | Application Requirement | Infrastructure Implication |
|---|---|---|
| **Runtime Environment** | Node.js 20+ (ESM `"type": "module"`) | Requires modern V8 runtime with native ESM and top-level await. |
| **Database Persistence** | SQLite 3 via `better-sqlite3` in WAL mode (`data/nexus.db`) | **Requires persistent, non-ephemeral local disk storage.** Ephemeral filesystems will cause catastrophic data loss on restart. |
| **Real-Time Streaming** | Server-Sent Events (SSE) for AI token streaming and agent logs | Requires infrastructure supporting long-lived HTTP connections without aggressive gateway timeouts (minimum 300s). |
| **Terminal / IDE Studio** | WebSocket / PTY emulation for live terminal interactions | Requires HTTP upgrade support for WebSockets. |
| **Filesystem Workspace** | `scratch/` directory for code editing, git clones, and artifacts | Requires read/write access to localized directory tree. |
| **Native C++ Bindings** | `better-sqlite3` compiled C++ addon | Build environment must provide build-essential / Python tooling or prebuilt glibc binaries. |

---

## 3. Deployment Platform Compatibility Matrix

### 3.1 Serverless Platforms (Vercel, AWS Lambda, Cloudflare Workers, Netlify)

- **Verdict:** ❌ **INCOMPATIBLE / UNSUITABLE for full backend.**
- **Forensic Failure Analysis:**
  1. *Storage Volatility:* Serverless functions operate on stateless, read-only or ephemeral microVMs. Any write to `data/nexus.db` is obliterated when the instance scales to zero or cycles.
  2. *Connection Timeouts:* Vercel enforces a 10s (Hobby) or 60s (Pro) execution ceiling. Deep Research jobs and Autonomous Agent swarms routinely execute multi-phase tasks lasting 60–180 seconds, resulting in immediate HTTP 504 Gateway Timeouts.
  3. *Native Addon Compilation:* Bundling `better-sqlite3` in AWS Lambda or Cloudflare Workers requires complex cross-compilation layers and frequently fails during edge initialization.
  4. *WebSockets:* Serverless architectures do not natively maintain persistent WebSocket state for the Canvas IDE interactive terminal.

---

### 3.2 Containerized PaaS Platforms (Railway, Render, Fly.io)

- **Verdict:** 🟢 **HIGHLY RECOMMENDED (Fastest Production Path).**
- **Architecture Specification:**
  - Build via standard Dockerfile (`node:20-slim`).
  - Attach a **Persistent Storage Volume** mounted to `/app/data`.
  - Configure port `3000` with public HTTPS routing.
  - Set request timeout to 300+ seconds.
  - Zero maintenance of operating system security patches.
  - Automated continuous deployment via GitHub webhook integration.

---

### 3.3 Virtual Private Server (VPS) / Cloud Compute (DigitalOcean, Hetzner, AWS EC2)

- **Verdict:** 🟢 **EXCELLENT / HIGHEST CONTROL & PERFORMANCE.**
- **Architecture Specification:**
  - **OS:** Ubuntu 22.04 LTS or 24.04 LTS.
  - **Process Management:** PM2 in cluster or fork mode (`pm2 start server.js --name "raghul-ai"`).
  - **Reverse Proxy:** Nginx with HTTP/2 and WebSocket upgrade directives.
  - **SSL/TLS:** Free automated Let's Encrypt certificates managed via `certbot`.
  - **Storage:** Dedicated NVMe/SSD block storage ensuring optimal SQLite IOPS.
  - **Backups:** Automated nightly cron backing up `data/nexus.db` via SQLite `.backup` command to S3 or remote storage.

---

## 4. Recommended Production Nginx Configuration (VPS Deployment)

```nginx
server {
    listen 80;
    server_name raghulraja.is-a.dev;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name raghulraja.is-a.dev;

    ssl_certificate /etc/letsencrypt/live/raghulraja.is-a.dev/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/raghulraja.is-a.dev/privkey.pem;

    # Performance & Compression
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml image/svg+xml;

    # Client upload limits (for document attachments)
    client_max_body_size 50M;

    # Reverse Proxy to Node.js Backend
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;

        # WebSocket Upgrade Support
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";

        # Forwarded Headers
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Long-Lived Connection Timeouts for SSE & Deep Research
        proxy_read_timeout 600s;
        proxy_send_timeout 600s;
        proxy_buffering off;
        proxy_cache off;
    }
}
```

---

## 5. Hardware Sizing & Capacity Requirements

| Resource | Minimum Specification | Recommended Production Specification |
|---|---|---|
| **CPU** | 1 vCPU (x86_64 or ARM64) | 2 vCPUs |
| **RAM** | 1 GB | 2 GB to 4 GB |
| **Disk Storage** | 10 GB SSD | 25 GB NVMe SSD |
| **Network** | 1 Gbps port | 1 Gbps unmetered |
| **Operating System** | Linux (Ubuntu/Debian) or Docker | Ubuntu 24.04 LTS / Debian 12 |

---

**Sign-off:** Principal Cloud & DevOps Architect  
**Outcome:** Deployment Architecture Assessment COMPLETE.
