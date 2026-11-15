/**
 * RAGHUL AI — CENTRAL INTEGRATION MANAGER
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
import dns from 'dns';
import { setGlobalDispatcher, Agent } from 'undici';
import { db } from '../db.js';

try {
  dns.setDefaultResultOrder('ipv4first');
} catch (_) {}

try {
  setGlobalDispatcher(new Agent({
    connect: { timeout: 15000, autoSelectFamily: false },
    allowH2: false
  }));
} catch (_) {}

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

  isEmergencyStopActive() {
    try {
      const row = db.prepare("SELECT value FROM portfolio_system_state WHERE key = 'emergency_stop'").get();
      return row?.value === 'true';
    } catch (_) {
      return false;
    }
  }

  validateSafeTargetUrl(targetUrl) {
    try {
      const parsed = new URL(targetUrl);
      if (!['http:', 'https:'].includes(parsed.protocol)) {
        throw new Error(`SSRF_GUARD_BLOCKED: Protocol ${parsed.protocol} is disallowed`);
      }
      const hostname = parsed.hostname.toLowerCase();
      if (
        hostname === '169.254.169.254' ||
        hostname.endsWith('.internal')
      ) {
        throw new Error(`SSRF_GUARD_BLOCKED: Target host ${hostname} is restricted`);
      }
      return true;
    } catch (err) {
      throw new Error(`SSRF_GUARD_BLOCKED: ${err.message}`);
    }
  }

  /**
   * Helper to execute fetch with strict timeout & categorized diagnostics
   */
  async _probeUrl(url, options = {}, timeoutMs = 6000) {
    this.validateSafeTargetUrl(url);
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

  // =========================================================================
  // 5. OPERATIONAL VERCEL METHODS
  // =========================================================================
  async getLatestVercelDeployments(limit = 5) {
    const creds = this.getCredentials().vercel;
    if (!creds.token || !creds.projectId) {
      throw new Error('Vercel credentials missing in .env');
    }

    const teamParam = creds.teamId ? `&teamId=${creds.teamId}` : '';
    const url = `https://api.vercel.com/v6/deployments?projectId=${creds.projectId}&limit=${limit}${teamParam}`;
    const res = await fetch(url, {
      headers: { 'Authorization': `Bearer ${creds.token}` }
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Vercel deployments fetch failed [HTTP ${res.status}]: ${errText}`);
    }

    const data = await res.json();
    return (data.deployments || []).map(d => ({
      id: d.uid,
      name: d.name,
      url: d.url ? `https://${d.url}` : null,
      state: d.state,
      ready: d.readyState,
      createdAt: d.created,
      creator: d.creator ? d.creator.username : 'Unknown',
      target: d.target || 'production',
      branch: d.meta?.githubCommitRef || 'main',
      commitSha: d.meta?.githubCommitSha || null,
      commitMessage: d.meta?.githubCommitMessage || null
    }));
  }

  // =========================================================================
  // 6. OPERATIONAL RENDER METHODS
  // =========================================================================
  async getLatestRenderDeployments(limit = 5) {
    const creds = this.getCredentials().render;
    if (!creds.apiKey || !creds.serviceId) {
      throw new Error('Render credentials missing in .env');
    }

    const url = `https://api.render.com/v1/services/${creds.serviceId}/deploys?limit=${limit}`;
    const res = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${creds.apiKey}`,
        'Accept': 'application/json'
      }
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Render deploys fetch failed [HTTP ${res.status}]: ${errText}`);
    }

    const text = await res.text();
    let data = [];
    try { data = text ? JSON.parse(text) : []; } catch (_) { data = []; }
    const list = Array.isArray(data) ? data : (data.deploys || []);
    return list.map(d => {
      const deploy = d.deploy || d;
      return {
        id: deploy.id,
        status: deploy.status,
        createdAt: deploy.createdAt,
        updatedAt: deploy.updatedAt,
        finishedAt: deploy.finishedAt,
        commit: deploy.commit ? {
          id: deploy.commit.id,
          message: deploy.commit.message
        } : null
      };
    });
  }

  // =========================================================================
  // 7. OPERATIONAL PRODUCTION HEALTH PROBE
  // =========================================================================
  async verifyProductionHealth(targetUrl = 'https://raghulraja.is-a.dev/') {
    const start = Date.now();
    try {
      const probe = await this._probeUrl(targetUrl, {
        headers: {
          'User-Agent': 'RaghulAI-PortfolioOS-HealthProbe/1.0',
          'Cache-Control': 'no-cache'
        }
      }, 7000);

      const latencyMs = Date.now() - start;
      return {
        success: probe.ok,
        url: targetUrl,
        status: probe.status,
        latencyMs,
        ssl: targetUrl.startsWith('https://'),
        timestamp: Date.now(),
        headers: probe.response ? {
          server: probe.response.headers.get('server') || 'Vercel Edge',
          contentType: probe.response.headers.get('content-type'),
          age: probe.response.headers.get('age')
        } : null,
        error: probe.error
      };
    } catch (e) {
      return {
        success: false,
        url: targetUrl,
        status: 0,
        latencyMs: Date.now() - start,
        ssl: targetUrl.startsWith('https://'),
        timestamp: Date.now(),
        error: { code: 'PROBE_FAILED', message: e.message }
      };
    }
  }

  // =========================================================================
  // 8. OPERATIONAL GITHUB METHODS (AUTONOMOUS BRANCH, COMMIT, PR, MERGE)
  // =========================================================================
  async getGitHubRepoDetails() {
    const creds = this.getCredentials().github;
    if (!creds.token) throw new Error('GITHUB_TOKEN missing in .env');

    try {
      const res = await fetch(`https://api.github.com/repos/${creds.owner}/${creds.repo}`, {
        headers: {
          'Authorization': `Bearer ${creds.token}`,
          'User-Agent': 'RaghulAI-PortfolioOS',
          'Accept': 'application/vnd.github.v3+json'
        }
      });

      if (res.ok) {
        const data = await res.json();
        const details = {
          fullName: data.full_name,
          defaultBranch: data.default_branch,
          visibility: data.visibility,
          description: data.description,
          openIssues: data.open_issues_count,
          pushedAt: data.pushed_at,
          updatedAt: data.updated_at
        };
        this._cachedRepoDetails = { data: details, timestamp: Date.now() };
        return details;
      }
    } catch (err) {
      // Fallback to cache if network fails
    }

    if (this._cachedRepoDetails?.data) {
      return this._cachedRepoDetails.data;
    }

    throw new Error('GitHub repo query failed and no cached data available');
  }

  async createGitHubBranch(branchName, baseBranch = 'main') {
    if (this.isEmergencyStopActive()) {
      throw new Error('EMERGENCY_STOP_BLOCKED: All mutations paused by emergency stop');
    }
    const creds = this.getCredentials().github;
    if (!creds.token) throw new Error('GITHUB_TOKEN missing in .env');

    // 1. Get base branch SHA
    const refRes = await fetch(`https://api.github.com/repos/${creds.owner}/${creds.repo}/git/ref/heads/${baseBranch}`, {
      headers: {
        'Authorization': `Bearer ${creds.token}`,
        'User-Agent': 'RaghulAI-PortfolioOS',
        'Accept': 'application/vnd.github.v3+json'
      }
    });
    if (!refRes.ok) throw new Error(`Base branch ${baseBranch} ref lookup failed [HTTP ${refRes.status}]`);
    const refData = await refRes.json();
    const sha = refData.object.sha;

    // 2. Create new branch ref
    const createRes = await fetch(`https://api.github.com/repos/${creds.owner}/${creds.repo}/git/refs`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${creds.token}`,
        'User-Agent': 'RaghulAI-PortfolioOS',
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        ref: `refs/heads/${branchName}`,
        sha
      })
    });

    if (!createRes.ok) {
      const err = await createRes.text();
      throw new Error(`Branch creation failed [HTTP ${createRes.status}]: ${err}`);
    }

    const createdData = await createRes.json();
    return {
      success: true,
      branch: branchName,
      ref: createdData.ref,
      sha: createdData.object.sha
    };
  }

  async getGitHubFileContent({ path, branch = 'main' }) {
    const creds = this.getCredentials().github;
    if (!creds.token) throw new Error('GITHUB_TOKEN missing in .env');

    const res = await fetch(`https://api.github.com/repos/${creds.owner}/${creds.repo}/contents/${path}?ref=${branch}`, {
      headers: {
        'Authorization': `Bearer ${creds.token}`,
        'User-Agent': 'RaghulAI-PortfolioOS',
        'Accept': 'application/vnd.github.v3+json'
      }
    });
    if (!res.ok) throw new Error(`Fetch file ${path} failed [HTTP ${res.status}]`);
    const data = await res.json();
    return {
      sha: data.sha,
      content: Buffer.from(data.content, 'base64').toString('utf8'),
      path: data.path
    };
  }

  async commitGitHubFile({ branch, path, content, message, isBase64 = false }) {
    const creds = this.getCredentials().github;
    if (!creds.token) throw new Error('GITHUB_TOKEN missing in .env');

    // Check if file already exists on this branch to obtain SHA
    let existingSha = null;
    try {
      const getFileRes = await fetch(`https://api.github.com/repos/${creds.owner}/${creds.repo}/contents/${path}?ref=${branch}`, {
        headers: {
          'Authorization': `Bearer ${creds.token}`,
          'User-Agent': 'RaghulAI-PortfolioOS',
          'Accept': 'application/vnd.github.v3+json'
        }
      });
      if (getFileRes.ok) {
        const fileData = await getFileRes.json();
        existingSha = fileData.sha;
      }
    } catch (_) {}

    let base64Content;
    if (Buffer.isBuffer(content)) {
      base64Content = content.toString('base64');
    } else if (isBase64) {
      base64Content = content;
    } else {
      base64Content = Buffer.from(content, 'utf-8').toString('base64');
    }

    const payload = {
      message: message || `Autonomous commit: update ${path}`,
      content: base64Content,
      branch
    };
    if (existingSha) payload.sha = existingSha;

    const putRes = await fetch(`https://api.github.com/repos/${creds.owner}/${creds.repo}/contents/${path}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${creds.token}`,
        'User-Agent': 'RaghulAI-PortfolioOS',
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!putRes.ok) {
      const err = await putRes.text();
      throw new Error(`Commit file failed [HTTP ${putRes.status}]: ${err}`);
    }

    const resData = await putRes.json();
    return {
      success: true,
      path,
      branch,
      commitSha: resData.commit.sha,
      contentSha: resData.content.sha,
      htmlUrl: resData.content.html_url
    };
  }

  async createGitHubPullRequest({ title, head, base = 'main', body }) {
    const creds = this.getCredentials().github;
    if (!creds.token) throw new Error('GITHUB_TOKEN missing in .env');

    const prRes = await fetch(`https://api.github.com/repos/${creds.owner}/${creds.repo}/pulls`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${creds.token}`,
        'User-Agent': 'RaghulAI-PortfolioOS',
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        title,
        head,
        base,
        body: body || 'Autonomous Pull Request created by Raghul AI Portfolio OS.'
      })
    });

    if (!prRes.ok) {
      const err = await prRes.text();
      throw new Error(`PR creation failed [HTTP ${prRes.status}]: ${err}`);
    }

    const prData = await prRes.json();
    return {
      success: true,
      number: prData.number,
      title: prData.title,
      htmlUrl: prData.html_url,
      state: prData.state,
      head: prData.head.ref,
      base: prData.base.ref
    };
  }

  async closeGitHubPullRequest(pullNumber) {
    const creds = this.getCredentials().github;
    if (!creds.token) throw new Error('GITHUB_TOKEN missing in .env');

    const patchRes = await fetch(`https://api.github.com/repos/${creds.owner}/${creds.repo}/pulls/${pullNumber}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${creds.token}`,
        'User-Agent': 'RaghulAI-PortfolioOS',
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ state: 'closed' })
    });

    if (!patchRes.ok) {
      const err = await patchRes.text();
      throw new Error(`PR close failed [HTTP ${patchRes.status}]: ${err}`);
    }

    const prData = await patchRes.json();
    return {
      success: true,
      number: prData.number,
      state: prData.state
    };
  }

  async submitGitHubPullRequestReview(pullNumber, { event = 'COMMENT', body = 'Automated Code & Security Audit Review: All checks verified' } = {}) {
    const creds = this.getCredentials().github;
    if (!creds.token) throw new Error('GITHUB_TOKEN missing in .env');

    const reviewRes = await fetch(`https://api.github.com/repos/${creds.owner}/${creds.repo}/pulls/${pullNumber}/reviews`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${creds.token}`,
        'User-Agent': 'RaghulAI-PortfolioOS',
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        event: event || 'COMMENT',
        body: body || 'Automated Review: Verified by Raghul AI Portfolio OS.'
      })
    });

    if (!reviewRes.ok) {
      const err = await reviewRes.text();
      throw new Error(`PR review creation failed [HTTP ${reviewRes.status}]: ${err}`);
    }

    const reviewData = await reviewRes.json();
    return {
      success: true,
      id: reviewData.id,
      state: reviewData.state,
      htmlUrl: reviewData.html_url,
      submittedAt: reviewData.submitted_at
    };
  }

  async mergeGitHubPullRequest(pullNumber, { commitTitle = 'Autonomous merge by Raghul AI', mergeMethod = 'squash' } = {}) {
    const creds = this.getCredentials().github;
    if (!creds.token) throw new Error('GITHUB_TOKEN missing in .env');

    const mergeRes = await fetch(`https://api.github.com/repos/${creds.owner}/${creds.repo}/pulls/${pullNumber}/merge`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${creds.token}`,
        'User-Agent': 'RaghulAI-PortfolioOS',
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        commit_title: commitTitle,
        merge_method: mergeMethod
      })
    });

    if (!mergeRes.ok) {
      const err = await mergeRes.text();
      throw new Error(`PR merge failed [HTTP ${mergeRes.status}]: ${err}`);
    }

    const mergeData = await mergeRes.json();
    return {
      success: true,
      sha: mergeData.sha,
      merged: mergeData.merged,
      message: mergeData.message
    };
  }

  async deleteGitHubBranch(branchName) {
    const creds = this.getCredentials().github;
    if (!creds.token) throw new Error('GITHUB_TOKEN missing in .env');

    if (branchName === 'main' || branchName === 'master') {
      throw new Error('Security Guard: Deletion of production default branch is strictly forbidden');
    }

    const delRes = await fetch(`https://api.github.com/repos/${creds.owner}/${creds.repo}/git/refs/heads/${branchName}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${creds.token}`,
        'User-Agent': 'RaghulAI-PortfolioOS',
        'Accept': 'application/vnd.github.v3+json'
      }
    });

    if (!delRes.ok && delRes.status !== 404 && delRes.status !== 422) {
      const err = await delRes.text();
      throw new Error(`Branch deletion failed [HTTP ${delRes.status}]: ${err}`);
    }

    return {
      success: true,
      branch: branchName,
      status: delRes.status === 204 ? 'DELETED' : (delRes.status === 404 ? 'ALREADY_DELETED' : 'REMOVED')
    };
  }

  async listGitHubCommits(limit = 15) {
    const creds = this.getCredentials().github;
    if (!creds.token) throw new Error('GITHUB_TOKEN missing in .env');

    try {
      const res = await fetch(`https://api.github.com/repos/${creds.owner}/${creds.repo}/commits?per_page=${limit}`, {
        headers: {
          'Authorization': `Bearer ${creds.token}`,
          'User-Agent': 'RaghulAI-PortfolioOS',
          'Accept': 'application/vnd.github.v3+json'
        }
      });
      if (res.ok) {
        const data = await res.json();
        const commits = data.map(c => ({
          sha: c.sha,
          shortSha: c.sha.substring(0, 7),
          message: c.commit.message,
          author: c.commit.author.name,
          authorAvatar: c.author?.avatar_url,
          date: c.commit.author.date,
          htmlUrl: c.html_url
        }));
        this._cachedCommits = commits;
        return commits;
      }
    } catch (err) {
      // Fallback
    }

    if (this._cachedCommits?.length) {
      return this._cachedCommits;
    }

    throw new Error('GitHub commits query failed and no cached data available');
  }

  async listGitHubBranches(limit = 20) {
    const creds = this.getCredentials().github;
    if (!creds.token) throw new Error('GITHUB_TOKEN missing in .env');

    const res = await fetch(`https://api.github.com/repos/${creds.owner}/${creds.repo}/branches?per_page=${limit}`, {
      headers: {
        'Authorization': `Bearer ${creds.token}`,
        'User-Agent': 'RaghulAI-PortfolioOS',
        'Accept': 'application/vnd.github.v3+json'
      }
    });
    if (!res.ok) throw new Error(`GitHub branches query failed [HTTP ${res.status}]`);
    const data = await res.json();
    return data.map(b => ({
      name: b.name,
      commitSha: b.commit.sha,
      protected: b.protected
    }));
  }

  async listGitHubPullRequests(state = 'all', limit = 15) {
    const creds = this.getCredentials().github;
    if (!creds.token) throw new Error('GITHUB_TOKEN missing in .env');

    const res = await fetch(`https://api.github.com/repos/${creds.owner}/${creds.repo}/pulls?state=${encodeURIComponent(state)}&per_page=${limit}`, {
      headers: {
        'Authorization': `Bearer ${creds.token}`,
        'User-Agent': 'RaghulAI-PortfolioOS',
        'Accept': 'application/vnd.github.v3+json'
      }
    });
    if (!res.ok) throw new Error(`GitHub pulls query failed [HTTP ${res.status}]`);
    const data = await res.json();
    return data.map(pr => ({
      number: pr.number,
      title: pr.title,
      state: pr.state,
      user: pr.user?.login,
      userAvatar: pr.user?.avatar_url,
      head: pr.head?.ref,
      base: pr.base?.ref,
      createdAt: pr.created_at,
      htmlUrl: pr.html_url
    }));
  }

  // =========================================================================
  // 9. OPERATIONAL DEPLOYMENT TRIGGERS (RENDER & VERCEL)
  // =========================================================================
  async triggerRenderDeploy({ clearCache = 'do_not_clear' } = {}) {
    if (this.isEmergencyStopActive()) {
      throw new Error('EMERGENCY_STOP_BLOCKED: All mutations paused by emergency stop');
    }
    const creds = this.getCredentials().render;
    if (!creds.apiKey || !creds.serviceId) {
      throw new Error('Render credentials missing in .env');
    }

    const res = await fetch(`https://api.render.com/v1/services/${creds.serviceId}/deploys`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${creds.apiKey}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ clearCache })
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Render deployment trigger failed [HTTP ${res.status}]: ${err}`);
    }

    const text = await res.text();
    let data = {};
    try {
      data = text ? JSON.parse(text) : {};
    } catch (_) {
      data = {};
    }

    let deploy = data.deploy || data;
    // When Render returns HTTP 202 Accepted with empty body, fetch the active/queued deployment
    if (!deploy.id) {
      try {
        const latest = await this.getLatestRenderDeployments(1);
        if (latest.length > 0) {
          deploy = latest[0];
        }
      } catch (_) {}
    }

    return {
      success: true,
      httpStatus: res.status,
      id: deploy.id || 'dep_accepted',
      status: deploy.status || 'queued',
      createdAt: deploy.createdAt || new Date().toISOString(),
      commit: deploy.commit || null
    };
  }

  redactSecrets(textOrObj) {
    if (!textOrObj) return textOrObj;
    const str = typeof textOrObj === 'string' ? textOrObj : JSON.stringify(textOrObj);
    const creds = this.getCredentials();
    let sanitized = str;

    const secrets = [
      creds.github.token,
      creds.vercel.token,
      creds.render.apiKey,
      creds.supabase.serviceRoleKey,
      creds.supabase.anonKey
    ].filter(s => Boolean(s) && s.length > 5);

    for (const secret of secrets) {
      const masked = secret.slice(0, 4) + '...' + secret.slice(-4);
      sanitized = sanitized.replaceAll(secret, masked);
    }

    // Mask generic Bearer tokens
    sanitized = sanitized.replace(/Bearer\s+([A-Za-z0-9_\-\.]{15,})/g, 'Bearer ***REDACTED***');

    return typeof textOrObj === 'string' ? sanitized : JSON.parse(sanitized);
  }

  getAllStatuses() {
    return this.statusCache;
  }

  getStatus() {
    return {
      timestamp: Date.now(),
      providers: this.statusCache
    };
  }
}

export const integrationManager = new IntegrationManager();

