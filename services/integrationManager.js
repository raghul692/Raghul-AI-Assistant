/**
 * NEXUS AI — CENTRAL INTEGRATION MANAGER
 * 
 * Production Integration Service for:
 * 1. GitHub API (PAT: fine-grained / classic)
 * 2. Vercel API (Token, Project ID, Team ID)
 * 3. Render API (API Key, Service ID)
 * 4. Supabase / PostgreSQL (REST & Direct connection)
 * 
 * Implements:
 * - Credential Discovery & Validation
 * - Live Connection Probing with Network Diagnostics
 * - Error Code Categorization (DNS, Timeout, Auth 401/403, Rate Limits)
 * - True Status Reporting: CONNECTED | OFFLINE | UNAVAILABLE | NOT CONFIGURED | RATE_LIMITED | ERROR
 * - Zero Fake Statuses: Never claims connected if probe fails.
 */

import 'dotenv/config';

class IntegrationManager {
  constructor() {
    this.refreshIntervalMs = 60000; // 1 minute background probe
    this.statusCache = {
      github: {
        provider: 'GitHub',
        id: 'github',
        status: 'UNAVAILABLE',
        configured: false,
        latencyMs: null,
        lastChecked: null,
        error: null,
        details: null,
        permissions: ['repo:read', 'repo:write', 'workflow', 'deployments']
      },
      vercel: {
        provider: 'Vercel',
        id: 'vercel',
        status: 'UNAVAILABLE',
        configured: false,
        latencyMs: null,
        lastChecked: null,
        error: null,
        details: null,
        permissions: ['deployments:read', 'deployments:create', 'projects:read']
      },
      render: {
        provider: 'Render',
        id: 'render',
        status: 'UNAVAILABLE',
        configured: false,
        latencyMs: null,
        lastChecked: null,
        error: null,
        details: null,
        permissions: ['services:read', 'deploys:read', 'deploys:create']
      },
      supabase: {
        provider: 'Supabase / PostgreSQL',
        id: 'supabase',
        status: 'UNAVAILABLE',
        configured: false,
        latencyMs: null,
        lastChecked: null,
        error: null,
        details: null,
        permissions: ['db:read', 'db:write', 'pgvector']
      }
    };
  }

  getCredentials() {
    return {
      github: {
        token: process.env.GITHUB_TOKEN || process.env.GITHUB_PERSONAL_ACCESS_TOKEN || '',
        owner: process.env.GITHUB_OWNER || 'raghul692',
        repo: process.env.GITHUB_REPOSITORY || 'raghulraja_portfolio'
      },
      vercel: {
        token: process.env.VERCEL_TOKEN || '',
        projectId: process.env.VERCEL_PROJECT_ID || 'prj_Ud3G5XTiPfP8dARMMpeF4DpmNSkn',
        teamId: process.env.VERCEL_TEAM_ID || 'team_BeEtoz4v6nuZDXZEOflqeQgJ'
      },
      render: {
        apiKey: process.env.RENDER_API_KEY || '',
        serviceId: process.env.RENDER_SERVICE_ID || process.env.SERVICE_ID || 'srv-da9foaon74is73fvojn0'
      },
      supabase: {
        url: process.env.SUPABASE_URL || 'https://brmafvpjvdgieelcgivi.supabase.co',
        anonKey: process.env.SUPABASE_ANON_KEY || '',
        serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
        dbUrl: process.env.DATABASE_URL || ''
      }
    };
  }

  /**
   * Helper to execute fetch with strict timeout & categorized diagnostics
   */
  async _probeUrl(url, options = {}, timeoutMs = 6000) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    const start = Date.now();

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal
      });
      clearTimeout(timeout);
      const latencyMs = Date.now() - start;
      return { ok: response.ok, status: response.status, latencyMs, response, error: null };
    } catch (err) {
      clearTimeout(timeout);
      const latencyMs = Date.now() - start;
      let diagCode = 'NETWORK_ERROR';
      let message = err.message || 'Unknown network error';

      if (err.name === 'AbortError') {
        diagCode = 'TIMEOUT';
        message = `Probe timed out after ${timeoutMs}ms`;
      } else if (err.code === 'ENOTFOUND' || (err.cause && err.cause.code === 'ENOTFOUND') || message.includes('Could not resolve host')) {
        diagCode = 'DNS_UNREACHABLE';
        message = 'Host DNS resolution failed. Check local internet connectivity or DNS.';
      } else if (err.code === 'ECONNRESET' || (err.cause && err.cause.code === 'ECONNRESET') || message.includes('Connection was reset')) {
        diagCode = 'CONNECTION_RESET';
        message = 'Connection reset by peer or network gateway.';
      } else if (err.code === 'UND_ERR_CONNECT_TIMEOUT' || (err.cause && err.cause.code === 'UND_ERR_CONNECT_TIMEOUT')) {
        diagCode = 'CONNECT_TIMEOUT';
        message = 'TCP connection timeout to external host.';
      }

      return {
        ok: false,
        status: 0,
        latencyMs,
        response: null,
        error: { code: diagCode, message, original: message }
      };
    }
  }

  // =========================================================================
  // 1. GITHUB PROBE
  // =========================================================================
  async testGitHub() {
    const creds = this.getCredentials().github;
    if (!creds.token) {
      this.statusCache.github = {
        ...this.statusCache.github,
        status: 'NOT CONFIGURED',
        configured: false,
        lastChecked: Date.now(),
        error: { code: 'MISSING_CREDENTIALS', message: 'GITHUB_TOKEN is missing in .env' }
      };
      return this.statusCache.github;
    }

    const probe = await this._probeUrl('https://api.github.com/user', {
      headers: {
        'Authorization': `Bearer ${creds.token}`,
        'User-Agent': 'RaghulAI-PortfolioOS',
        'Accept': 'application/vnd.github.v3+json'
      }
    });

    if (probe.ok) {
      let userData = null;
      try { userData = await probe.response.json(); } catch (_) {}
      this.statusCache.github = {
        ...this.statusCache.github,
        status: 'CONNECTED',
        configured: true,
        latencyMs: probe.latencyMs,
        lastChecked: Date.now(),
        error: null,
        details: {
          login: userData ? userData.login : creds.owner,
          owner: creds.owner,
          repository: creds.repo,
          publicRepos: userData ? userData.public_repos : null,
          rateLimitRemaining: probe.response.headers.get('x-ratelimit-remaining')
        }
      };
    } else {
      let status = 'ERROR';
      if (probe.status === 401) status = 'INVALID_CREDENTIALS';
      else if (probe.status === 403) status = 'RATE_LIMITED';
      else if (probe.status === 0) status = 'OFFLINE';

      this.statusCache.github = {
        ...this.statusCache.github,
        status,
        configured: true,
        latencyMs: probe.latencyMs,
        lastChecked: Date.now(),
        error: probe.error || { code: `HTTP_${probe.status}`, message: `GitHub API returned HTTP ${probe.status}` },
        details: { owner: creds.owner, repository: creds.repo }
      };
    }
    return this.statusCache.github;
  }

  // =========================================================================
  // 2. VERCEL PROBE
  // =========================================================================
  async testVercel() {
    const creds = this.getCredentials().vercel;
    if (!creds.token) {
      this.statusCache.vercel = {
        ...this.statusCache.vercel,
        status: 'NOT CONFIGURED',
        configured: false,
        lastChecked: Date.now(),
        error: { code: 'MISSING_CREDENTIALS', message: 'VERCEL_TOKEN is missing in .env' }
      };
      return this.statusCache.vercel;
    }

    const url = `https://api.vercel.com/v9/projects/${creds.projectId}${creds.teamId ? `?teamId=${creds.teamId}` : ''}`;
    const probe = await this._probeUrl(url, {
      headers: { 'Authorization': `Bearer ${creds.token}` }
    });

    if (probe.ok) {
      let projectData = null;
      try { projectData = await probe.response.json(); } catch (_) {}
      this.statusCache.vercel = {
        ...this.statusCache.vercel,
        status: 'CONNECTED',
        configured: true,
        latencyMs: probe.latencyMs,
        lastChecked: Date.now(),
        error: null,
        details: {
          projectId: creds.projectId,
          projectName: projectData ? projectData.name : 'raghulraja-portfolio',
          framework: projectData ? projectData.framework : 'vite',
          updatedAt: projectData ? projectData.updatedAt : null
        }
      };
    } else {
      let status = 'ERROR';
      if (probe.status === 401 || probe.status === 403) status = 'INVALID_CREDENTIALS';
      else if (probe.status === 0) status = 'OFFLINE';

      this.statusCache.vercel = {
        ...this.statusCache.vercel,
        status,
        configured: true,
        latencyMs: probe.latencyMs,
        lastChecked: Date.now(),
        error: probe.error || { code: `HTTP_${probe.status}`, message: `Vercel API returned HTTP ${probe.status}` },
        details: { projectId: creds.projectId, teamId: creds.teamId }
      };
    }
    return this.statusCache.vercel;
  }

  // =========================================================================
  // 3. RENDER PROBE
  // =========================================================================
  async testRender() {
    const creds = this.getCredentials().render;
    if (!creds.apiKey) {
      this.statusCache.render = {
        ...this.statusCache.render,
        status: 'NOT CONFIGURED',
        configured: false,
        lastChecked: Date.now(),
        error: { code: 'MISSING_CREDENTIALS', message: 'RENDER_API_KEY is missing in .env' }
      };
      return this.statusCache.render;
    }

    const url = `https://api.render.com/v1/services/${creds.serviceId}`;
    const probe = await this._probeUrl(url, {
      headers: {
        'Authorization': `Bearer ${creds.apiKey}`,
        'Accept': 'application/json'
      }
    });

    if (probe.ok) {
      let serviceData = null;
      try { serviceData = await probe.response.json(); } catch (_) {}
      const s = serviceData && (serviceData.service || serviceData);
      this.statusCache.render = {
        ...this.statusCache.render,
        status: 'CONNECTED',
        configured: true,
        latencyMs: probe.latencyMs,
        lastChecked: Date.now(),
        error: null,
        details: {
          serviceId: creds.serviceId,
          name: s ? s.name : 'FastAPI Backend',
          suspended: s ? s.suspended : 'not_suspended',
          repo: s ? s.repo : 'raghul692/raghulraja_portfolio'
        }
      };
    } else {
      let status = 'ERROR';
      if (probe.status === 401 || probe.status === 403) status = 'INVALID_CREDENTIALS';
      else if (probe.status === 0) status = 'OFFLINE';

      this.statusCache.render = {
        ...this.statusCache.render,
        status,
        configured: true,
        latencyMs: probe.latencyMs,
        lastChecked: Date.now(),
        error: probe.error || { code: `HTTP_${probe.status}`, message: `Render API returned HTTP ${probe.status}` },
        details: { serviceId: creds.serviceId }
      };
    }
    return this.statusCache.render;
  }

  // =========================================================================
  // 4. SUPABASE / POSTGRESQL PROBE
  // =========================================================================
  async testSupabase() {
    const creds = this.getCredentials().supabase;
    if (!creds.url || (!creds.serviceRoleKey && !creds.anonKey)) {
      this.statusCache.supabase = {
        ...this.statusCache.supabase,
        status: 'NOT CONFIGURED',
        configured: false,
        lastChecked: Date.now(),
        error: { code: 'MISSING_CREDENTIALS', message: 'SUPABASE_URL or keys missing in .env' }
      };
      return this.statusCache.supabase;
    }

    const key = creds.serviceRoleKey || creds.anonKey;
    const probe = await this._probeUrl(`${creds.url}/rest/v1/`, {
      headers: {
        'apikey': key,
        'Authorization': `Bearer ${key}`
      }
    });

    if (probe.ok) {
      let schemaData = null;
      try { schemaData = await probe.response.json(); } catch (_) {}
      const tables = schemaData && schemaData.definitions ? Object.keys(schemaData.definitions) : [];
      this.statusCache.supabase = {
        ...this.statusCache.supabase,
        status: 'CONNECTED',
        configured: true,
        latencyMs: probe.latencyMs,
        lastChecked: Date.now(),
        error: null,
        details: {
          endpoint: creds.url,
          tablesFound: tables.length,
          tablesList: tables.slice(0, 8),
          pgvector: tables.some(t => t.includes('vector') || t.includes('embedding'))
        }
      };
    } else {
      let status = 'ERROR';
      if (probe.status === 401 || probe.status === 403) status = 'INVALID_CREDENTIALS';
      else if (probe.status === 0) status = 'OFFLINE';

      this.statusCache.supabase = {
        ...this.statusCache.supabase,
        status,
        configured: true,
        latencyMs: probe.latencyMs,
        lastChecked: Date.now(),
        error: probe.error || { code: `HTTP_${probe.status}`, message: `Supabase REST returned HTTP ${probe.status}` },
        details: { endpoint: creds.url }
      };
    }
    return this.statusCache.supabase;
  }

  /**
   * Probe all integrations concurrently and return unified report
   */
  async probeAll() {
    const results = await Promise.allSettled([
      this.testGitHub(),
      this.testVercel(),
      this.testRender(),
      this.testSupabase()
    ]);

    return {
      timestamp: Date.now(),
      providers: this.statusCache,
      summary: {
        total: 4,
        connected: Object.values(this.statusCache).filter(p => p.status === 'CONNECTED').length,
        offline: Object.values(this.statusCache).filter(p => p.status === 'OFFLINE').length,
        notConfigured: Object.values(this.statusCache).filter(p => p.status === 'NOT CONFIGURED').length,
        error: Object.values(this.statusCache).filter(p => ['ERROR', 'INVALID_CREDENTIALS', 'RATE_LIMITED'].includes(p.status)).length
      }
    };
  }

  getStatus() {
    return {
      timestamp: Date.now(),
      providers: this.statusCache
    };
  }
}

export const integrationManager = new IntegrationManager();
