import { mcpEngine } from './mcpClient.js';

console.log('🔌 Testing MCP Client Engine...');

const servers = mcpEngine.getServerStatus();
console.log('Active MCP Servers:', servers.map(s => `${s.name} (${s.status})`));

const tools = await mcpEngine.listAllTools();
console.log('Registered MCP Tools:', tools.map(t => t.name));

// Call System Metrics
const metrics = await mcpEngine.callTool('mcp_system_metrics');
console.log('Executed mcp_system_metrics:', metrics);

// Call Filesystem List
const files = await mcpEngine.callTool('mcp_fs_list_files', { subDir: 'public' });
console.log('Executed mcp_fs_list_files (public):', files.length, 'items found');

console.log('✅ MCP Client Engine 100% Operational!');

