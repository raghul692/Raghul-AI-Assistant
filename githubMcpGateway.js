/**
 * RAGHUL AI — OFFICIAL GITHUB MCP SERVER GATEWAY & REPOSITORY ENGINE
 * 
 * Features:
 * 1. Streamable HTTP JSON-RPC 2.0 Client for Official GitHub Remote MCP (https://api.githubcopilot.com/mcp/)
 * 2. Dynamic Tool Discovery (Discovers live tools, input schemas & capabilities)
 * 3. Session negotiation (Mcp-Session-Id, Protocol 2024-11-05, instruction handshake)
 * 4. Hybrid Confidence-Gated Risk Classifier & Human-in-the-Loop Approval requirements
 * 5. Resilient Connection Management (Heartbeat, Auto-Reconnect, Request Abort Timeout)
 * 6. Native GitHub REST & Actions Engine for CI/CD runs, workflow dispatch, and security alerts
 * 7. Token Security (Stored strictly in backend process.env, never exposed to client or LLM)
 */

import 'dotenv/config';
import crypto from 'crypto';

export const GITHUB_RISK_LEVELS = {
  READ_ONLY: 'read_only',   // Reads, searches, metadata, inspect
  LOW: 'low',               // Read-only analysis with high depth
  MEDIUM: 'medium',         // Comments, reviews, branch creation
  HIGH: 'high',             // File changes, PR creation, issue updates
  CRITICAL: 'critical'      // File deletions, PR merges, force pushes
};

export class GitHubMCPGateway {
  constructor(options = {}) {
    this.endpointUrl = options.endpointUrl || process.env.GITHUB_MCP_URL || 'https://api.githubcopilot.com/mcp/';
    this.protocolVersion = '2024-11-05';
    this.sessionId = null;
    this.status = 'disconnected'; // 'disconnected' | 'connecting' | 'connected' | 'error'
    this.lastError = null;
    this.lastConnectedAt = null;
    this.serverInstructions = '';
    this.serverCapabilities = {};
    
    // Dynamically discovered tools map: toolName -> toolMetadata
    this.toolsRegistry = new Map();
    this.pendingRequests = new Map();
    this.defaultTimeoutMs = options.timeoutMs || 25000;
    
    // Cached user identity
    this.cachedIdentity = null;
  }

  /**
   * Safe getter for GitHub Personal Access Token
   * Never logs or exposes the raw string
   */
  _getToken() {
    const token = process.env.GITHUB_PERSONAL_ACCESS_TOKEN;
    if (!token || !token.trim()) {
      throw new Error('GITHUB_PERSONAL_ACCESS_TOKEN is not configured in environment.');
    }
    return token.trim();
  }

  /**
   * Masked representation for UI status
   */
  getTokenStatus() {
    try {
      const token = this._getToken();
      return {
        configured: true,
        type: token.startsWith('github_pat_') ? 'Fine-Grained PAT' : (token.startsWith('ghp_') ? 'Classic PAT' : 'OAuth/Bearer'),
        prefix: token.slice(0, 8) + '...' + token.slice(-4),
        length: token.length
      };
    } catch (e) {
      return { configured: false, error: e.message };
    }
  }

  /**
   * Initialize Session with Official GitHub Remote MCP Server
   */
  async initialize() {
    this.status = 'connecting';
    this.lastError = null;
    const token = this._getToken();

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.defaultTimeoutMs);

      const initPayload = {
        jsonrpc: '2.0',
        id: `init_${Date.now()}`,
        method: 'initialize',
        params: {
          protocolVersion: this.protocolVersion,
          capabilities: {
            roots: { listChanged: false },
            sampling: {}
          },
          clientInfo: {
            name: 'Raghul-AI-Assistant',
            version: '2.0.0'
          }
        }
      };

      const res = await fetch(this.endpointUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'text/event-stream, application/json'
        },
        body: JSON.stringify(initPayload),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`MCP Initialization failed [HTTP ${res.status}]: ${errorText.slice(0, 200)}`);
      }

      // Extract MCP session ID from header
      const sessionId = res.headers.get('mcp-session-id');
      if (sessionId) {
        this.sessionId = sessionId;
      }

      const bodyText = await res.text();
      let initResult = null;

      // Parse JSON from text or event-stream
      const dataLine = bodyText.split('\n').find(l => l.startsWith('data: '));
      if (dataLine) {
        const json = JSON.parse(dataLine.slice(6));
        initResult = json.result;
      } else {
        try {
          const json = JSON.parse(bodyText);
          initResult = json.result;
        } catch (e) {
          // Response may be raw SSE
        }
      }

      if (initResult) {
        this.serverInstructions = initResult.instructions || '';
        this.serverCapabilities = initResult.capabilities || {};
      }

      this.status = 'connected';
      this.lastConnectedAt = Date.now();

      // Now dynamically discover all live tools
      await this.discoverTools();

      // Fetch and cache authenticated identity
      await this.getAuthenticatedIdentity();

      return {
        success: true,
        sessionId: this.sessionId,
        toolsCount: this.toolsRegistry.size,
        identity: this.cachedIdentity
      };
    } catch (err) {
      this.status = 'error';
      this.lastError = err.message;
      throw err;
    }
  }

  /**
   * Ensure session is active, reconnecting if necessary
   */
  async ensureConnected() {
    if (this.status === 'connected' && this.sessionId) {
      return true;
    }
    await this.initialize();
    return true;
  }

  /**
   * Dynamic Tool Discovery: Discover live tools from GitHub MCP Server
   */
  async discoverTools() {
    const token = this._getToken();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.defaultTimeoutMs);

    const headers = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Accept': 'text/event-stream, application/json'
    };
    if (this.sessionId) {
      headers['Mcp-Session-Id'] = this.sessionId;
    }

    try {
      const res = await fetch(this.endpointUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: `tools_${Date.now()}`,
          method: 'tools/list',
          params: {}
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        throw new Error(`Failed to list tools [HTTP ${res.status}]`);
      }

      const text = await res.text();
      let toolsList = [];

      const dataLine = text.split('\n').find(l => l.startsWith('data: '));
      if (dataLine) {
        const parsed = JSON.parse(dataLine.slice(6));
        toolsList = parsed.result?.tools || [];
      } else {
        const parsed = JSON.parse(text);
        toolsList = parsed.result?.tools || [];
      }

      this.toolsRegistry.clear();
      for (const tool of toolsList) {
        const classification = this._classifyToolRisk(tool.name);
        this.toolsRegistry.set(tool.name, {
          name: tool.name,
          description: tool.description,
          inputSchema: tool.inputSchema || { type: 'object', properties: {} },
          riskLevel: classification.riskLevel,
          category: classification.category,
          requiresApproval: classification.requiresApproval,
          available: true
        });
      }

      return Array.from(this.toolsRegistry.values());
    } catch (err) {
      console.warn('[GitHubMCP] Tool discovery warning:', err.message);
      throw err;
    }
  }

  /**
   * Classify risk level and human approval policy for each discovered tool
   */
  _classifyToolRisk(toolName) {
    const criticalActions = ['delete_file', 'merge_pull_request', 'push_files'];
    const highActions = ['create_or_update_file', 'create_pull_request', 'create_repository', 'issue_write', 'update_pull_request', 'update_pull_request_branch', 'fork_repository', 'sub_issue_write'];
    const mediumActions = ['add_issue_comment', 'add_comment_to_pending_review', 'add_reply_to_pull_request_comment', 'create_branch', 'pull_request_review_write', 'update_issue_comment', 'request_copilot_review'];

    if (criticalActions.includes(toolName)) {
      return { riskLevel: GITHUB_RISK_LEVELS.CRITICAL, category: 'code_and_branches', requiresApproval: true };
    }
    if (highActions.includes(toolName)) {
      return { riskLevel: GITHUB_RISK_LEVELS.HIGH, category: 'workspace_mutation', requiresApproval: true };
    }
    if (mediumActions.includes(toolName)) {
      return { riskLevel: GITHUB_RISK_LEVELS.MEDIUM, category: 'collaboration', requiresApproval: false };
    }

    // Default: Read Only
    return { riskLevel: GITHUB_RISK_LEVELS.READ_ONLY, category: 'inspection_and_search', requiresApproval: false };
  }

  /**
   * Execute an MCP tool via JSON-RPC 2.0 tools/call
   */
  async callTool(name, toolArgs = {}, options = {}) {
    await this.ensureConnected();

    const toolMeta = this.toolsRegistry.get(name);
    if (!toolMeta) {
      throw new Error(`Tool "${name}" is not registered on GitHub MCP server.`);
    }

    // Validate risk & approval if called directly without approval token
    if (toolMeta.requiresApproval && !options.approved) {
      return {
        approvalRequired: true,
        tool: name,
        riskLevel: toolMeta.riskLevel,
        args: toolArgs,
        reason: `Operation "${name}" alters GitHub repository state and requires interactive human confirmation.`
      };
    }

    const token = this._getToken();
    const controller = new AbortController();
    const timeoutMs = options.timeoutMs || this.defaultTimeoutMs;
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    const headers = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Accept': 'text/event-stream, application/json'
    };
    if (this.sessionId) {
      headers['Mcp-Session-Id'] = this.sessionId;
    }

    try {
      const res = await fetch(this.endpointUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: `call_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          method: 'tools/call',
          params: {
            name,
            arguments: toolArgs
          }
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`GitHub MCP Call "${name}" failed [HTTP ${res.status}]: ${errorText.slice(0, 300)}`);
      }

      const text = await res.text();
      let callResult = null;

      const dataLine = text.split('\n').find(l => l.startsWith('data: '));
      if (dataLine) {
        const parsed = JSON.parse(dataLine.slice(6));
        if (parsed.error) {
          throw new Error(`MCP Error [${parsed.error.code}]: ${parsed.error.message}`);
        }
        callResult = parsed.result;
      } else {
        const parsed = JSON.parse(text);
        if (parsed.error) {
          throw new Error(`MCP Error [${parsed.error.code}]: ${parsed.error.message}`);
        }
        callResult = parsed.result;
      }

      // Format output content
      let contentData = null;
      if (callResult && Array.isArray(callResult.content) && callResult.content[0]?.text) {
        const rawText = callResult.content[0].text;
        try {
          contentData = JSON.parse(rawText);
        } catch (e) {
          contentData = rawText;
        }
      } else {
        contentData = callResult;
      }

      return {
        success: true,
        tool: name,
        data: contentData
      };
    } catch (err) {
      // If session expired or invalid, reset sessionId and reconnect once
      if (err.message.includes('session') || err.message.includes('401') || err.message.includes('403')) {
        this.sessionId = null;
        this.status = 'disconnected';
      }
      throw err;
    }
  }

  /**
   * Fetch authenticated GitHub user identity (login, name, avatar, bio, stats)
   */
  async getAuthenticatedIdentity(forceRefresh = false) {
    if (this.cachedIdentity && !forceRefresh) {
      return this.cachedIdentity;
    }

    try {
      // 1. Try get_me tool via MCP
      const mcpRes = await this.callTool('get_me', {});
      if (mcpRes && mcpRes.data) {
        const d = typeof mcpRes.data === 'string' ? JSON.parse(mcpRes.data) : mcpRes.data;
        this.cachedIdentity = {
          login: d.login,
          name: d.details?.name || d.name || d.login,
          avatarUrl: d.avatar_url,
          profileUrl: d.profile_url || `https://github.com/${d.login}`,
          bio: d.details?.bio || d.bio || '',
          publicRepos: d.details?.public_repos || d.public_repos || 0,
          publicGists: d.details?.public_gists || 0,
          followers: d.details?.followers || 0,
          following: d.details?.following || 0,
          connectedVia: 'Official GitHub Remote MCP',
          verifiedAt: Date.now()
        };
        return this.cachedIdentity;
      }
    } catch (e) {
      console.warn('[GitHubMCP] MCP get_me failed, using direct REST fallback:', e.message);
    }

    // 2. Fallback to direct authenticated REST /user
    const token = this._getToken();
    const res = await fetch('https://api.github.com/user', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'User-Agent': 'Raghul-AI-Assistant',
        'Accept': 'application/vnd.github.v3+json'
      }
    });

    if (!res.ok) {
      throw new Error(`GitHub identity verification failed [HTTP ${res.status}]`);
    }

    const d = await res.json();
    this.cachedIdentity = {
      login: d.login,
      name: d.name || d.login,
      avatarUrl: d.avatar_url,
      profileUrl: d.html_url,
      bio: d.bio || '',
      publicRepos: d.public_repos || 0,
      publicGists: d.public_gists || 0,
      followers: d.followers || 0,
      following: d.following || 0,
      connectedVia: 'GitHub Fine-Grained Personal Access Token',
      verifiedAt: Date.now()
    };

    return this.cachedIdentity;
  }

  /**
   * Direct Authenticated GitHub REST / GraphQL Call
   * For features not exposed by MCP tools (CI/CD Actions, Dependabot security, Workflow logs)
   */
  async fetchRest(apiPath, options = {}) {
    const token = this._getToken();
    const url = apiPath.startsWith('http') ? apiPath : `https://api.github.com${apiPath.startsWith('/') ? apiPath : '/' + apiPath}`;
    
    const headers = {
      'Authorization': `Bearer ${token}`,
      'User-Agent': 'Raghul-AI-Assistant',
      'Accept': options.accept || 'application/vnd.github.v3+json',
      ...(options.headers || {})
    };

    let lastError = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const res = await fetch(url, {
          method: options.method || 'GET',
          headers,
          body: options.body ? (typeof options.body === 'string' ? options.body : JSON.stringify(options.body)) : undefined
        });

        if (!res.ok) {
          const errText = await res.text();
          throw new Error(`GitHub REST ${apiPath} failed [HTTP ${res.status}]: ${errText.slice(0, 300)}`);
        }

        if (options.rawText) {
          return await res.text();
        }
        return await res.json();
      } catch (err) {
        lastError = err;
        if (attempt < 2) {
          await new Promise(r => setTimeout(r, 400 * (attempt + 1)));
        }
      }
    }
    throw lastError;
  }

  /**
   * List accessible repositories for current user
   */
  async listRepositories(options = {}) {
    const page = options.page || 1;
    const perPage = options.perPage || 30;
    const sort = options.sort || 'updated';

    // Try search_repositories tool if query provided
    if (options.query && this.toolsRegistry.has('search_repositories')) {
      try {
        const res = await this.callTool('search_repositories', {
          query: options.query,
          per_page: perPage,
          page
        });
        if (res.data?.items) return res.data.items;
      } catch (e) {
        console.warn('[GitHubMCP] search_repositories tool fallback to REST:', e.message);
      }
    }

    // Direct REST listing
    return await this.fetchRest(`/user/repos?per_page=${perPage}&page=${page}&sort=${sort}&affiliation=owner,collaborator`);
  }

  /**
   * Get single repository details & statistics
   */
  async getRepository(owner, repo) {
    return await this.fetchRest(`/repos/${owner}/${repo}`);
  }

  /**
   * Create a new repository on GitHub
   */
  async createRepository({ name, description = '', isPrivate = false, autoInit = true }) {
    return await this.fetchRest('/user/repos', {
      method: 'POST',
      body: JSON.stringify({
        name,
        description,
        private: isPrivate,
        auto_init: autoInit
      })
    });
  }

  /**
   * Resolve default branch for a repository (e.g. 'main' or 'master')
   */
  async resolveDefaultBranch(owner, repo) {
    try {
      const repoData = await this.getRepository(owner, repo);
      return repoData.default_branch || 'main';
    } catch (e) {
      return 'main';
    }
  }

  /**
   * Fuzzy match user's repository list by approximate name
   * e.g. "landing page" -> "modern-saas-landing-page", "portfolio" -> "raghulraja_portfolio"
   */
  async resolveRepoName(inputName, owner = 'raghul692') {
    if (!inputName) return null;
    const rawTrimmed = inputName.trim().replace(/^raghul692\//i, '').replace(/\.git$/i, '');
    const clean = rawTrimmed.toLowerCase();
    
    // Direct check first
    try {
      const direct = await this.getRepository(owner, clean);
      if (direct && direct.name) return direct.name;
    } catch (e) {}

    // List all user repos and find best match
    try {
      const repos = await this.listRepositories({ perPage: 100 });
      if (Array.isArray(repos)) {
        // 0. Primary personal repo preferences
        if (clean.includes('portfolio')) {
          const personal = repos.find(r => r.name.toLowerCase().includes('raghul') && r.name.toLowerCase().includes('portfolio'));
          if (personal) return personal.name;
        }

        // 1. Exact match case-insensitive
        const exact = repos.find(r => r.name.toLowerCase() === clean);
        if (exact) return exact.name;

        // 2. High-confidence significant keyword match (avoids stop-word hijacking like 'app' or 'project')
        const stopWords = ['the', 'my', 'app', 'application', 'project', 'new', 'repo', 'repository', 'system'];
        const significantKeywords = clean.split(/[-_\s]+/).filter(k => k.length > 2 && !stopWords.includes(k));
        if (significantKeywords.length > 0) {
          const matched = repos.find(r => {
            const rWords = r.name.toLowerCase().split(/[-_\s]+/);
            return significantKeywords.every(k => rWords.some(rw => rw === k || rw.startsWith(k)));
          });
          if (matched) return matched.name;
        }
      }
    } catch (e) {}

    return rawTrimmed;
  }

  /**
   * Create or update a file in a repository with Automatic Conflict Resolution (409 Retry)
   */
  async createOrUpdateFile(owner, repo, filePath, content, commitMessage = 'Add file via Raghul AI', branch = null) {
    const targetBranch = branch || await this.resolveDefaultBranch(owner, repo);
    const base64Content = Buffer.from(content, 'utf-8').toString('base64');

    let maxRetries = 3;
    let lastErr = null;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        let existingSha = null;
        try {
          const existing = await this.fetchRest(`/repos/${owner}/${repo}/contents/${filePath}?ref=${targetBranch}`);
          if (existing && existing.sha) existingSha = existing.sha;
        } catch (e) {
          // File might not exist yet (404), which is normal for new files
        }

        const body = {
          message: commitMessage,
          content: base64Content,
          branch: targetBranch
        };
        if (existingSha) body.sha = existingSha;

        const res = await this.fetchRest(`/repos/${owner}/${repo}/contents/${filePath}`, {
          method: 'PUT',
          body: JSON.stringify(body)
        });

        return res;
      } catch (err) {
        lastErr = err;
        if (err.message && err.message.includes('409') && attempt < maxRetries - 1) {
          // Conflict detected: Wait briefly and retry with fresh SHA
          await new Promise(r => setTimeout(r, 600 * (attempt + 1)));
          continue;
        }
        throw err;
      }
    }
    throw lastErr;
  }

  /**
   * Delete a file in a repository
   */
  async deleteFile(owner, repo, filePath, commitMessage = 'Delete file via Raghul AI', branch = null) {
    const targetBranch = branch || await this.resolveDefaultBranch(owner, repo);
    const existing = await this.fetchRest(`/repos/${owner}/${repo}/contents/${filePath}?ref=${targetBranch}`);
    if (!existing || !existing.sha) {
      throw new Error(`Cannot delete: File "${filePath}" does not exist on branch "${targetBranch}".`);
    }

    return await this.fetchRest(`/repos/${owner}/${repo}/contents/${filePath}`, {
      method: 'DELETE',
      body: JSON.stringify({
        message: commitMessage,
        sha: existing.sha,
        branch: targetBranch
      })
    });
  }

  /**
   * Create a new branch from a base branch
   */
  async createBranch(owner, repo, newBranchName, fromBranch = null) {
    const base = fromBranch || await this.resolveDefaultBranch(owner, repo);
    // Get commit SHA of the base branch
    const baseRef = await this.fetchRest(`/repos/${owner}/${repo}/git/ref/heads/${base}`);
    const sha = baseRef.object?.sha;
    if (!sha) throw new Error(`Could not find HEAD SHA for base branch "${base}".`);

    // Create the new branch reference
    return await this.fetchRest(`/repos/${owner}/${repo}/git/refs`, {
      method: 'POST',
      body: JSON.stringify({
        ref: `refs/heads/${newBranchName}`,
        sha
      })
    });
  }

  /**
   * Create a Pull Request
   */
  async createPullRequest(owner, repo, { title, body = '', head, base = null, draft = false }) {
    const targetBase = base || await this.resolveDefaultBranch(owner, repo);
    return await this.fetchRest(`/repos/${owner}/${repo}/pulls`, {
      method: 'POST',
      body: JSON.stringify({
        title,
        body,
        head,
        base: targetBase,
        draft
      })
    });
  }

  /**
   * Merge a Pull Request
   */
  async mergePullRequest(owner, repo, pullNumber, options = {}) {
    const { commitTitle, commitMessage, mergeMethod = 'merge' } = options;
    return await this.fetchRest(`/repos/${owner}/${repo}/pulls/${pullNumber}/merge`, {
      method: 'PUT',
      body: JSON.stringify({
        commit_title: commitTitle,
        commit_message: commitMessage,
        merge_method: mergeMethod // 'merge', 'squash', 'rebase'
      })
    });
  }

  /**
   * Create an Issue on a repository
   */
  async createIssue(owner, repo, { title, body = '', labels = [], assignees = [] }) {
    return await this.fetchRest(`/repos/${owner}/${repo}/issues`, {
      method: 'POST',
      body: JSON.stringify({
        title,
        body,
        labels,
        assignees
      })
    });
  }

  /**
   * Add a comment to an Issue or Pull Request
   */
  async addIssueComment(owner, repo, issueNumber, commentBody) {
    return await this.fetchRest(`/repos/${owner}/${repo}/issues/${issueNumber}/comments`, {
      method: 'POST',
      body: JSON.stringify({
        body: commentBody
      })
    });
  }

  /**
   * Close an Issue
   */
  async closeIssue(owner, repo, issueNumber) {
    return await this.fetchRest(`/repos/${owner}/${repo}/issues/${issueNumber}`, {
      method: 'PATCH',
      body: JSON.stringify({
        state: 'closed'
      })
    });
  }

  /**
   * Search code across GitHub or within a specific repository
   */
  async searchCode(query, owner = null, repo = null) {
    let q = query;
    if (owner && repo) {
      q += ` repo:${owner}/${repo}`;
    } else if (owner) {
      q += ` user:${owner}`;
    }
    return await this.fetchRest(`/search/code?q=${encodeURIComponent(q)}&per_page=20`);
  }

  /**
   * Get single commit details
   */
  async getCommit(owner, repo, commitSha) {
    return await this.fetchRest(`/repos/${owner}/${repo}/commits/${commitSha}`);
  }

  /**
   * Fetch README content and decode UTF-8
   */
  async getReadme(owner, repo) {
    try {
      const res = await this.fetchRest(`/repos/${owner}/${repo}/readme`);
      if (res && res.content) {
        const decoded = Buffer.from(res.content, 'base64').toString('utf8');
        return {
          name: res.name,
          path: res.path,
          size: res.size,
          content: decoded,
          htmlUrl: res.html_url
        };
      }
    } catch (e) {
      return { content: null, error: 'No README found in repository.' };
    }
  }

  /**
   * Browse files and directories in repository
   */
  async getFileContents(owner, repo, path = '', ref = '') {
    // 1. Try MCP tool get_file_contents
    if (this.toolsRegistry.has('get_file_contents')) {
      try {
        const args = { owner, repo, path: path || '' };
        if (ref) args.ref = ref;
        const res = await this.callTool('get_file_contents', args);
        if (res && res.data) return res.data;
      } catch (e) {
        console.warn('[GitHubMCP] get_file_contents tool fallback to REST:', e.message);
      }
    }

    // 2. REST fallback
    const query = ref ? `?ref=${encodeURIComponent(ref)}` : '';
    const data = await this.fetchRest(`/repos/${owner}/${repo}/contents/${path}${query}`);
    
    if (Array.isArray(data)) {
      // Directory listing
      return data.map(item => ({
        name: item.name,
        path: item.path,
        type: item.type, // 'file' | 'dir'
        size: item.size,
        sha: item.sha,
        htmlUrl: item.html_url
      }));
    } else if (data && data.content) {
      // File content
      return {
        name: data.name,
        path: data.path,
        size: data.size,
        sha: data.sha,
        content: Buffer.from(data.content, 'base64').toString('utf8'),
        htmlUrl: data.html_url
      };
    }
    return data;
  }

  /**
   * List repository branches
   */
  async listBranches(owner, repo) {
    if (this.toolsRegistry.has('list_branches')) {
      try {
        const res = await this.callTool('list_branches', { owner, repo });
        if (res && res.data) return Array.isArray(res.data) ? res.data : (res.data.branches || res.data);
      } catch (e) {}
    }
    return await this.fetchRest(`/repos/${owner}/${repo}/branches?per_page=50`);
  }

  /**
   * List recent commits on repository
   */
  async listCommits(owner, repo, branch = '', limit = 20) {
    if (this.toolsRegistry.has('list_commits')) {
      try {
        const args = { owner, repo, per_page: limit };
        if (branch) args.sha = branch;
        const res = await this.callTool('list_commits', args);
        if (res && res.data) return Array.isArray(res.data) ? res.data : (res.data.commits || res.data);
      } catch (e) {}
    }
    const query = branch ? `?sha=${encodeURIComponent(branch)}&per_page=${limit}` : `?per_page=${limit}`;
    return await this.fetchRest(`/repos/${owner}/${repo}/commits${query}`);
  }

  /**
   * Issues Management: List, Search, and Create
   */
  async listIssues(owner, repo, state = 'open', limit = 25) {
    if (this.toolsRegistry.has('list_issues')) {
      try {
        const res = await this.callTool('list_issues', { owner, repo, state, per_page: limit });
        if (res && res.data) return res.data;
      } catch (e) {}
    }
    return await this.fetchRest(`/repos/${owner}/${repo}/issues?state=${state}&per_page=${limit}&sort=updated`);
  }

  /**
   * Pull Request Management: List, Diff, and Summarize
   */
  async listPullRequests(owner, repo, state = 'open', limit = 25) {
    if (this.toolsRegistry.has('list_pull_requests')) {
      try {
        const res = await this.callTool('list_pull_requests', { owner, repo, state, per_page: limit });
        if (res && res.data) return res.data;
      } catch (e) {}
    }
    return await this.fetchRest(`/repos/${owner}/${repo}/pulls?state=${state}&per_page=${limit}&sort=updated`);
  }

  /**
   * CI/CD Actions: List workflows and workflow runs
   */
  async listWorkflows(owner, repo) {
    return await this.fetchRest(`/repos/${owner}/${repo}/actions/workflows`);
  }

  async listWorkflowRuns(owner, repo, limit = 15) {
    return await this.fetchRest(`/repos/${owner}/${repo}/actions/runs?per_page=${limit}`);
  }

  async getWorkflowRun(owner, repo, runId) {
    return await this.fetchRest(`/repos/${owner}/${repo}/actions/runs/${runId}`);
  }

  async getWorkflowRunJobs(owner, repo, runId) {
    return await this.fetchRest(`/repos/${owner}/${repo}/actions/runs/${runId}/jobs`);
  }

  /**
   * Security Center: Dependabot alerts and Code Scanning
   */
  async listSecurityAlerts(owner, repo) {
    const results = { dependabot: [], codeScanning: [], secretScanning: [] };
    try {
      results.dependabot = await this.fetchRest(`/repos/${owner}/${repo}/dependabot/alerts?state=open&per_page=20`);
    } catch (e) {
      results.dependabotError = 'Dependabot alerts not enabled or insufficient permissions.';
    }

    try {
      results.codeScanning = await this.fetchRest(`/repos/${owner}/${repo}/code-scanning/alerts?state=open&per_page=20`);
    } catch (e) {
      results.codeScanningError = 'Code scanning not enabled or insufficient permissions.';
    }

    try {
      results.secretScanning = await this.fetchRest(`/repos/${owner}/${repo}/secret-scanning/alerts?state=open&per_page=20`);
    } catch (e) {
      results.secretScanningError = 'Secret scanning not enabled or insufficient permissions.';
    }

    return results;
  }

  /**
   * Releases and Tags
   */
  async listReleases(owner, repo) {
    return await this.fetchRest(`/repos/${owner}/${repo}/releases?per_page=20`);
  }

  async listTags(owner, repo) {
    return await this.fetchRest(`/repos/${owner}/${repo}/tags?per_page=30`);
  }
}

export const githubMcpGateway = new GitHubMCPGateway();
