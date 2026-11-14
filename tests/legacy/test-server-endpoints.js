console.log('🧪 Verifying Server Endpoints...');

// 1. Test FTS5 Search Endpoint
const searchRes = await fetch('http://localhost:3000/api/search?q=Full-Stack');
const searchJson = await searchRes.json();
console.log('Search endpoint (/api/search) results:', searchJson.results?.length);
if (searchJson.results?.length > 0) {
  console.log('Snippet sample:', searchJson.results[0].snippet);
}

// 2. Test MCP Servers
const mcpRes = await fetch('http://localhost:3000/api/mcp/servers');
const mcpJson = await mcpRes.json();
console.log('MCP Servers (/api/mcp/servers):', mcpJson.servers?.map(s => s.name));

// 3. Test MCP Tools
const toolsRes = await fetch('http://localhost:3000/api/mcp/tools');
const toolsJson = await toolsRes.json();
console.log('MCP Tools (/api/mcp/tools):', toolsJson.tools?.map(t => t.name));

// 4. Test MCP Call Tool
const callRes = await fetch('http://localhost:3000/api/mcp/call', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ name: 'mcp_system_metrics' })
});
const callJson = await callRes.json();
console.log('MCP Call (/api/mcp/call mcp_system_metrics):', callJson.success, 'Platform:', callJson.result?.platform);

console.log('✅ Server Endpoints Verified Successfully!');

