import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';
import { githubMcpGateway } from './githubMcpGateway.js';
import { portfolioMcpGateway } from './portfolioMcpGateway.js';

import { sequentialThinkingServer } from './mcp/sequentialThinkingMcp.js';
import { knowledgeGraphMemoryServer } from './mcp/knowledgeGraphMemoryMcp.js';
import { filesystemMcpServer } from './mcp/filesystemMcp.js';
import { terminalCommanderServer } from './mcp/terminalCommanderMcp.js';
import { webScraperServer } from './mcp/webScraperMcp.js';
import { databaseMcpServer } from './mcp/databaseMcp.js';
import { productivityConnectorsServer } from './mcp/productivityConnectorsMcp.js';
import { documentGeneratorServer } from './mcp/documentGeneratorMcp.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CONFIG_FILE = path.join(__dirname, 'data', 'mcp_servers.json');

/**
 * ============================================================================
 * MODEL CONTEXT PROTOCOL (MCP) MASTER CLIENT ENGINE (5-Tier Production Suite)
 * Integrates:
 * 1. Cognitive & Deliberate Reasoning (Sequential-Thinking, Knowledge Graph)
 * 2. Developer & Code Execution (Filesystem, Terminal Commander, GitHub)
 * 3. Live Web Research & Scraper (Firecrawl / Fetch Markdown, Live Search)
 * 4. Database & Storage (SQLite Introspection, PostgreSQL / Supabase)
 * 5. Productivity & Connectors (Zapier, Slack, Linear, Notion)
 * ============================================================================
 */
class MCPClientEngine {
  constructor() {
    this.builtinTools = this._registerBuiltinTools();
    this.activeProcesses = new Map();
    this._loadConfig();
  }

  _loadConfig() {
    try {
      if (!fs.existsSync(CONFIG_FILE)) {
        const defaultConfig = {
          servers: {
            "sequential-thinking": { enabled: true, tier: "cognition", description: "Anthropic Official Sequential Thinking" },
            "knowledge-graph-memory": { enabled: true, tier: "cognition", description: "Anthropic Entity-Relation Graph Memory" },
            "filesystem": { enabled: true, tier: "developer", description: "Scoped Project Filesystem Operations" },
            "terminal-commander": { enabled: true, tier: "developer", description: "Safe Project Terminal Execution" },
            "web-scraper": { enabled: true, tier: "research", description: "Firecrawl / Clean Markdown Scraper" },
            "database-sqlite": { enabled: true, tier: "database", description: "SQLite & PostgreSQL Introspection" },
            "productivity-connectors": { enabled: true, tier: "productivity", description: "Zapier, Slack, Linear & Notion" },
            "document-generator": { enabled: true, tier: "document-studio", description: "IEEE PDF, DOCX, PPTX & Dual-Engine Editor" },
            "system-metrics": { enabled: true, tier: "telemetry", description: "Host OS Telemetry & Hardware Observability" }
          }
        };
        fs.writeFileSync(CONFIG_FILE, JSON.stringify(defaultConfig, null, 2), 'utf8');
      }
    } catch (err) {
      console.warn('[MCPClient] Config initialization notice:', err.message);
    }
  }

  _registerBuiltinTools() {
    const tools = [];

    // 1. Host Telemetry
    tools.push({
      name: 'mcp_system_metrics',
      description: 'Host Telemetry MCP: Real-time CPU, RAM, OS architecture and uptime metrics.',
      parameters: { type: 'OBJECT', properties: {} },
      execute: async () => {
        const cpus = os.cpus();
        const totalMem = os.totalmem();
        const freeMem = os.freemem();
        return {
          platform: os.platform(),
          arch: os.arch(),
          cpuModel: cpus[0]?.model || 'Standard CPU',
          cpuCores: cpus.length,
          memoryTotalMB: Math.round(totalMem / (1024 * 1024)),
          memoryUsedMB: Math.round((totalMem - freeMem) / (1024 * 1024)),
          memoryFreeMB: Math.round(freeMem / (1024 * 1024)),
          uptimeSeconds: Math.round(os.uptime())
        };
      }
    });

    // 2. Backward compatibility wrappers for legacy tools
    tools.push({
      name: 'mcp_fs_list_files',
      description: 'Filesystem MCP: List files and folders in workspace directory (Legacy alias for fs_list_directory).',
      parameters: {
        type: 'OBJECT',
        properties: { subDir: { type: 'STRING', description: 'Relative directory inside project' } }
      },
      execute: async (args = {}) => {
        const res = filesystemMcpServer.listDirectory({ dirPath: args.subDir || '' });
        return res.entries;
      }
    });

    tools.push({
      name: 'mcp_fs_read_file',
      description: 'Filesystem MCP: Read text content of a project file (Legacy alias for fs_read_file).',
      parameters: {
        type: 'OBJECT',
        properties: { filePath: { type: 'STRING', description: 'Relative file path inside project' } },
        required: ['filePath']
      },
      execute: async (args = {}) => {
        return filesystemMcpServer.readFile(args);
      }
    });

    // 3. Register All 5-Tier MCP Server Tool Suites
    tools.push(...sequentialThinkingServer.getToolDeclarations());
    tools.push(...knowledgeGraphMemoryServer.getToolDeclarations());
    tools.push(...filesystemMcpServer.getToolDeclarations());
    tools.push(...terminalCommanderServer.getToolDeclarations());
    tools.push(...webScraperServer.getToolDeclarations());
    tools.push(...databaseMcpServer.getToolDeclarations());
    tools.push(...productivityConnectorsServer.getToolDeclarations());
    tools.push(...documentGeneratorServer.getToolDeclarations());

    return tools;
  }

  /**
   * Get list of all available MCP tools across built-in and external stdio servers
   */
  async listAllTools() {
    const tools = [...this.builtinTools];

    // Dynamically include all GitHub MCP tools if gateway is connected or initialized
    try {
      if (githubMcpGateway.toolsRegistry.size === 0) {
        await githubMcpGateway.initialize().catch(() => {});
      }
      for (const [name, meta] of githubMcpGateway.toolsRegistry.entries()) {
        tools.push({
          name: `github_${name}`,
          originalName: name,
          description: meta.description,
          parameters: meta.inputSchema,
          riskLevel: meta.riskLevel,
          requiresApproval: meta.requiresApproval,
          category: meta.category || 'github'
        });
      }
    } catch (err) {
      console.warn('[MCPClient] GitHub tools discovery notice:', err.message);
    }

    // Dynamically include all Portfolio Intelligence MCP tools
    try {
      const portTools = portfolioMcpGateway.listTools();
      for (const pt of portTools) {
        tools.push({
          name: pt.name,
          originalName: pt.name,
          description: pt.description,
          parameters: pt.parameters,
          riskLevel: pt.riskLevel,
          requiresApproval: pt.requiresApproval,
          category: pt.category || 'portfolio'
        });
      }
    } catch (err) {
      console.warn('[MCPClient] Portfolio tools registration notice:', err.message);
    }

    // Return tool signatures formatted for Gemini & autonomous agents
    return tools.map(t => ({
      name: t.name,
      description: t.description,
      parameters: t.parameters,
      riskLevel: t.riskLevel || 'read_only',
      requiresApproval: !!t.requiresApproval,
      category: t.category || 'system'
    }));
  }

  /**
   * Execute any registered MCP tool by name with arguments
   */
  async callTool(name, args = {}, options = {}) {
    const builtin = this.builtinTools.find(t => t.name === name);
    if (builtin) {
      return await builtin.execute(args);
    }

    // Check if it's a GitHub tool (with or without 'github_' prefix)
    const githubToolName = name.startsWith('github_') ? name.slice(7) : name;
    if (githubMcpGateway.toolsRegistry.has(githubToolName)) {
      return await githubMcpGateway.callTool(githubToolName, args, options);
    }

    // Check if it's a Portfolio Intelligence tool
    if (portfolioMcpGateway.toolsRegistry.has(name)) {
      return await portfolioMcpGateway.callTool(name, args, options);
    }

    throw new Error(`Unknown MCP tool: ${name}`);
  }

  /**
   * Convert MCP tools to Gemini functionDeclarations format
   */
  async getGeminiToolDeclarations() {
    const tools = await this.listAllTools();
    return tools.map(t => ({
      name: t.name,
      description: t.description,
      parameters: t.parameters
    }));
  }

  /**
   * Get server status report across all 5 tiers (Backend only)
   */
  getServerStatus() {
    const tokenMeta = githubMcpGateway.getTokenStatus();
    return [
      {
        id: 'sequential-thinking',
        name: 'Anthropic Sequential Thinking MCP',
        tier: 'Tier 1: Cognition & Reasoning',
        status: 'connected',
        transport: 'in-process (JSON-RPC 2.0)',
        toolsCount: 3,
        tools: ['sequential_thinking', 'sequential_thinking_reset', 'sequential_thinking_get_history']
      },
      {
        id: 'knowledge-graph-memory',
        name: 'Anthropic Entity-Relation Graph Memory MCP',
        tier: 'Tier 1: Cognition & Reasoning',
        status: 'connected',
        transport: 'in-process / persistent-json (JSON-RPC 2.0)',
        toolsCount: 5,
        tools: ['memory_create_entities', 'memory_create_relations', 'memory_add_observations', 'memory_read_graph', 'memory_search_nodes']
      },
      {
        id: 'filesystem',
        name: 'Production Scoped Filesystem MCP',
        tier: 'Tier 2: Code & Development',
        status: 'connected',
        transport: 'in-process / stdio (JSON-RPC 2.0)',
        toolsCount: 5,
        tools: ['fs_read_file', 'fs_write_file', 'fs_patch_file', 'fs_list_directory', 'fs_search_files']
      },
      {
        id: 'terminal-commander',
        name: 'Desktop Commander / Terminal Sandbox MCP',
        tier: 'Tier 2: Code & Development',
        status: 'connected',
        transport: 'in-process / exec (JSON-RPC 2.0)',
        toolsCount: 2,
        tools: ['terminal_execute_command', 'terminal_check_tool']
      },
      {
        id: 'web-scraper',
        name: 'Firecrawl & Fetch Markdown Research MCP',
        tier: 'Tier 3: Live Research & Automation',
        status: 'connected',
        transport: 'streamable-http (JSON-RPC 2.0)',
        toolsCount: 2,
        tools: ['web_fetch_markdown', 'web_live_search']
      },
      {
        id: 'database-mcp',
        name: 'SQLite & PostgreSQL Introspection MCP',
        tier: 'Tier 4: Data & Databases',
        status: 'connected',
        transport: 'better-sqlite3 / in-process (JSON-RPC 2.0)',
        toolsCount: 3,
        tools: ['sqlite_list_tables', 'sqlite_describe_table', 'sqlite_run_query']
      },
      {
        id: 'productivity-connectors',
        name: 'Zapier, Slack, Linear & Notion Connectors MCP',
        tier: 'Tier 5: Productivity & Workspace',
        status: 'connected',
        transport: 'webhooks / REST (JSON-RPC 2.0)',
        toolsCount: 4,
        tools: ['zapier_dispatch_webhook', 'slack_send_notification', 'linear_create_issue', 'notion_format_page']
      },
      {
        id: 'official-github-mcp',
        name: 'Official GitHub Remote MCP Server',
        tier: 'Tier 2: Code & Development',
        status: githubMcpGateway.status === 'connected' ? 'connected' : (tokenMeta.configured ? 'ready' : 'disconnected'),
        transport: 'streamable-http (JSON-RPC 2.0)',
        endpoint: githubMcpGateway.endpointUrl,
        toolsCount: githubMcpGateway.toolsRegistry.size || 46,
        user: githubMcpGateway.cachedIdentity ? `@${githubMcpGateway.cachedIdentity.login}` : (tokenMeta.configured ? 'Authorized' : 'Unconfigured'),
        tools: Array.from(githubMcpGateway.toolsRegistry.keys()).slice(0, 8).map(t => `github_${t}`)
      },
      {
        id: 'portfolio-intelligence-mcp',
        name: 'Portfolio Intelligence & Management MCP Server',
        tier: 'Tier 4: Data & Systems',
        status: 'connected',
        transport: 'streamable-http / in-process (JSON-RPC 2.0)',
        endpoint: portfolioMcpGateway.siteUrl,
        toolsCount: portfolioMcpGateway.toolsRegistry.size || 24,
        user: 'Raghul Raja (https://raghulraja.is-a.dev/)',
        tools: Array.from(portfolioMcpGateway.toolsRegistry.keys()).slice(0, 8)
      },
      {
        id: 'system-metrics',
        name: 'MCP Host Telemetry Server',
        tier: 'Telemetry',
        status: 'connected',
        transport: 'in-process / os',
        toolsCount: 1,
        tools: ['mcp_system_metrics']
      }
    ];
  }
}

export const mcpEngine = new MCPClientEngine();
