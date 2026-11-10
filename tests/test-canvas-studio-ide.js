/**
 * ============================================================================
 * RAGHUL AI — CANVAS STUDIO IDE & TERMINAL VERIFICATION TEST SUITE
 * ============================================================================
 * Verification for:
 * 1. Workspace File System API (Tree, Create, Read, Rename, Delete, Path Traversal Security)
 * 2. Terminal Process Management (Session spawn, input, single-shot run, kill)
 * 3. Git Source Control API (Status, Diff, Branches, Log)
 * 4. IDE Asset Integrity (Monaco Loader, xterm.js, studioIde.js)
 */

import { strict as assert } from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');
const BASE_URL = 'http://localhost:3000';

let passed = 0;
let failed = 0;

async function test(name, fn) {
  try {
    await fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(`    Error: ${err.message}`);
    failed++;
  }
}

console.log('\n=================================================================');
console.log('--- SUITE 11: CANVAS STUDIO IDE, TERMINAL & WORKSPACE TESTS ---');
console.log('=================================================================\n');

// 1. Workspace File System Operations
console.log('1. Workspace File System Operations');

await test('GET /api/workspace/tree returns recursive directory structure', async () => {
  const res = await fetch(`${BASE_URL}/api/workspace/tree?depth=2`);
  const data = await res.json();
  assert.equal(res.status, 200);
  assert.equal(data.success, true);
  assert.equal(data.root, 'ai-chatbot');
  assert(Array.isArray(data.tree), 'Tree must be an array');
  assert(data.tree.length > 0, 'Tree must contain files and directories');
});

const TEST_FILE_REL = 'data/test_ide_verify.txt';
const TEST_FILE_RENAMED = 'data/test_ide_renamed.txt';

await test('POST /api/workspace/file creates file in workspace', async () => {
  const res = await fetch(`${BASE_URL}/api/workspace/file`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path: TEST_FILE_REL, content: 'Hello VS Code Studio IDE' })
  });
  const data = await res.json();
  assert.equal(res.status, 200);
  assert.equal(data.success, true);
  assert.equal(data.path, TEST_FILE_REL);
});

await test('GET /api/workspace/file reads created file content', async () => {
  const res = await fetch(`${BASE_URL}/api/workspace/file?path=${encodeURIComponent(TEST_FILE_REL)}`);
  const data = await res.json();
  assert.equal(res.status, 200);
  assert.equal(data.success, true);
  assert.equal(data.content, 'Hello VS Code Studio IDE');
});

await test('POST /api/workspace/rename renames file safely', async () => {
  const res = await fetch(`${BASE_URL}/api/workspace/rename`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ oldPath: TEST_FILE_REL, newPath: TEST_FILE_RENAMED })
  });
  const data = await res.json();
  assert.equal(res.status, 200);
  assert.equal(data.success, true);
  assert.equal(data.newPath, TEST_FILE_RENAMED);
});

await test('POST /api/workspace/delete deletes file cleanly', async () => {
  const res = await fetch(`${BASE_URL}/api/workspace/delete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path: TEST_FILE_RENAMED })
  });
  const data = await res.json();
  assert.equal(res.status, 200);
  assert.equal(data.success, true);
  assert(!fs.existsSync(path.join(PROJECT_ROOT, TEST_FILE_RENAMED)), 'File must be deleted from disk');
});

await test('Security: Path traversal and sensitive files blocked by workspace API', async () => {
  // Test traversal
  const resTraversal = await fetch(`${BASE_URL}/api/workspace/file?path=../../test.txt`);
  assert(resTraversal.status === 400 || resTraversal.status === 403, 'Traversal must be blocked');

  // Test .env access
  const resEnv = await fetch(`${BASE_URL}/api/workspace/file?path=.env`);
  assert(resEnv.status === 400 || resEnv.status === 403, 'Access to .env must be blocked');
});

// 2. Terminal Process Management Tests
console.log('\n2. Terminal Process Management');

let activeSessionId = null;

await test('POST /api/terminal/session spawns interactive shell process', async () => {
  const res = await fetch(`${BASE_URL}/api/terminal/session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cols: 80, rows: 24 })
  });
  const data = await res.json();
  assert.equal(res.status, 200);
  assert.equal(data.success, true);
  assert(data.sessionId.startsWith('term_'));
  assert(data.shell.length > 0);
  activeSessionId = data.sessionId;
});

await test('POST /api/terminal/input writes data to shell stdin', async () => {
  assert(activeSessionId !== null, 'Session must exist');
  const res = await fetch(`${BASE_URL}/api/terminal/input`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId: activeSessionId, data: 'echo "hello from ide"\r\n' })
  });
  const data = await res.json();
  assert.equal(res.status, 200);
  assert.equal(data.success, true);
});

await test('POST /api/terminal/run executes single-shot command and captures stdout', async () => {
  const res = await fetch(`${BASE_URL}/api/terminal/run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ command: 'node -v' })
  });
  const data = await res.json();
  assert.equal(res.status, 200);
  assert.equal(data.success, true);
  assert(data.stdout.startsWith('v'), 'Must return Node version');
  assert.equal(data.exitCode, 0);
});

await test('POST /api/terminal/kill terminates session and frees process handles', async () => {
  assert(activeSessionId !== null, 'Session must exist');
  const res = await fetch(`${BASE_URL}/api/terminal/kill`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId: activeSessionId })
  });
  const data = await res.json();
  assert.equal(res.status, 200);
  assert.equal(data.success, true);
});

// 3. Git Source Control Integration Tests
console.log('\n3. Git Source Control Integration');

await test('GET /api/git/status returns current branch and file change lists', async () => {
  const res = await fetch(`${BASE_URL}/api/git/status`);
  const data = await res.json();
  assert.equal(res.status, 200);
  assert.equal(data.success, true);
  assert(data.branch.length > 0, 'Branch must be identified');
  assert(typeof data.counts.total === 'number');
  assert(Array.isArray(data.staged));
  assert(Array.isArray(data.unstaged));
  assert(Array.isArray(data.untracked));
});

await test('GET /api/git/branches returns repository branches', async () => {
  const res = await fetch(`${BASE_URL}/api/git/branches`);
  const data = await res.json();
  assert.equal(res.status, 200);
  assert.equal(data.success, true);
  assert(data.branches.length > 0);
  assert(data.branches.some(b => b.active === true), 'Must have active branch');
});

await test('GET /api/git/diff executes without errors', async () => {
  const res = await fetch(`${BASE_URL}/api/git/diff`);
  const data = await res.json();
  assert.equal(res.status, 200);
  assert.equal(data.success, true);
  assert(typeof data.diff === 'string');
});

await test('GET /api/git/log returns recent commit history', async () => {
  const res = await fetch(`${BASE_URL}/api/git/log?count=5`);
  const data = await res.json();
  assert.equal(res.status, 200);
  assert.equal(data.success, true);
  assert(Array.isArray(data.commits));
  assert(data.commits.length > 0);
  assert(data.commits[0].hash.length > 0);
});

// 4. Studio IDE Assets & Frontend Integrity
console.log('\n4. Studio IDE Assets & Frontend Integrity');

await test('public/studioIde.js exists and exports master IDE functions', () => {
  const filePath = path.join(PROJECT_ROOT, 'public', 'studioIde.js');
  assert(fs.existsSync(filePath), 'public/studioIde.js must exist');
  const content = fs.readFileSync(filePath, 'utf8');
  assert(content.includes('initMonacoEditor'), 'Must include initMonacoEditor');
  assert(content.includes('initInteractiveTerminal'), 'Must include initInteractiveTerminal');
  assert(content.includes('loadWorkspaceTree'), 'Must include loadWorkspaceTree');
  assert(content.includes('loadGitStatus'), 'Must include loadGitStatus');
  assert(content.includes('toggleCommandPalette'), 'Must include toggleCommandPalette');
});

await test('public/index.html includes Monaco AMD loader, xterm.js, studioIde.js, and Project Files tree', () => {
  const htmlPath = path.join(PROJECT_ROOT, 'public', 'index.html');
  const content = fs.readFileSync(htmlPath, 'utf8');
  assert(content.includes('xterm.js'), 'Must load xterm.js');
  assert(content.includes('monaco-editor'), 'Must load monaco loader');
  assert(content.includes('studioIde.js'), 'Must load studioIde.js');
  assert(content.includes('id="monacoMount"'), 'Must have monaco mount');
  assert(content.includes('id="xtermMount"'), 'Must have xterm mount');
  assert(content.includes('id="studioFileTreeList"'), 'Must have studioFileTreeList for project files');
  assert(content.includes('id="artifactBodyWrapper"'), 'Must have artifactBodyWrapper for live viewport');
  assert(content.includes('id="commandPaletteModal"'), 'Must have command palette modal');
});

await test('public/style.css includes responsive split view and editor container layouts', () => {
  const cssPath = path.join(PROJECT_ROOT, 'public', 'style.css');
  const content = fs.readFileSync(cssPath, 'utf8');
  assert(content.includes('view-split'), 'Must have view-split styles');
  assert(content.includes('view-preview'), 'Must have view-preview styles');
  assert(content.includes('monaco-editor-mount'), 'Must have monaco-editor-mount styles');
});

console.log('\n=================================================================');
console.log(`TOTAL TESTS: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
console.log('=================================================================\n');

if (failed > 0) {
  process.exit(1);
} else {
  process.exit(0);
}

