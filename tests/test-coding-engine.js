/**
 * ============================================================================
 * RAGHUL AI — ADVANCED CODING ENGINE TEST SUITE
 * ============================================================================
 * Comprehensive unit and integration verification for:
 * 1. Coding Knowledge Engine
 * 2. Pre-Delivery AST & Quality Validator
 * 3. Polyglot Sandboxed Execution Engine
 * 4. Codebase Context & Symbol Analyzer
 * 5. Self-Repair and Quality Indexing
 */

import { strict as assert } from 'node:assert';
import {
  classifyTechStack,
  getKnowledgeForStack,
  buildCodingSystemContext,
  getAllKnownStacks
} from '../services/codingKnowledgeEngine.js';
import {
  validateCode,
  validateProjectFiles,
  detectPlaceholders,
  scanSecurityVulnerabilities
} from '../services/codeValidator.js';
import {
  executeJavaScript,
  executeTestSuite,
  runCode
} from '../services/codeExecutionEngine.js';
import {
  detectProjectType,
  extractFileSymbols,
  getWorkspaceContextSummary
} from '../services/codebaseContextEngine.js';
import { runSelfRepairLoop } from '../codingAgent.js';

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

console.log('\n======================================================');
console.log('--- SUITE 10: ADVANCED AI CODING ENGINE VERIFICATION ---');
console.log('======================================================\n');

// 1. Coding Knowledge Engine Tests
console.log('1. Coding Knowledge Engine');

await test('classifyTechStack detects React and Next.js correctly', () => {
  const stacks = classifyTechStack('Build a Next.js 15 app with React Server Components', '');
  assert(stacks.some(s => s.id === 'react'), 'React stack should be matched');
});

await test('classifyTechStack detects Python and FastAPI', () => {
  const stacks = classifyTechStack('Create a REST API with FastAPI and Pydantic models', '');
  assert(stacks.some(s => s.id === 'python'), 'Python stack should be matched');
});

await test('classifyTechStack detects Go concurrency', () => {
  const stacks = classifyTechStack('Write high-throughput goroutine pipeline in Go', '');
  assert(stacks.some(s => s.id === 'golang'), 'Go stack should be matched');
});

await test('getKnowledgeForStack returns valid best practices and security rules', () => {
  const knowledge = getKnowledgeForStack(['react', 'database']);
  assert.equal(knowledge.length, 2);
  assert(knowledge[0].bestPractices.length > 0);
  assert(knowledge[0].security.length > 0);
});

await test('buildCodingSystemContext generates prompt context with zero-placeholder invariant', () => {
  const ctx = buildCodingSystemContext('Build PostgreSQL database schema with users table');
  assert(ctx.includes('ZERO PLACEHOLDERS'), 'Context must mandate zero placeholders');
  assert(ctx.includes('PostgreSQL'), 'Context must include PostgreSQL guidelines');
});

await test('getAllKnownStacks returns catalog of all registered stacks', () => {
  const catalog = getAllKnownStacks();
  assert(catalog.length >= 6);
  assert(catalog.some(c => c.id === 'react'));
  assert(catalog.some(c => c.id === 'architecture'));
});

// 2. Pre-Delivery AST Validator Tests
console.log('\n2. Pre-Delivery AST & Quality Validator');

await test('validateCode passes clean production JavaScript with A+ grade', () => {
  const cleanCode = `
    // Sum numbers cleanly
    function calculateTotal(items) {
      if (!Array.isArray(items)) return 0;
      return items.reduce((sum, item) => sum + (item.price || 0), 0);
    }
  `;
  const result = validateCode({ code: cleanCode, language: 'javascript' });
  assert.equal(result.valid, true);
  assert.equal(result.errors.length, 0);
  assert(result.cqi >= 90, `Expected CQI >= 90, got ${result.cqi}`);
});

await test('validateCode detects JavaScript syntax errors (unclosed brace)', () => {
  const brokenCode = `function broken() { if (true) { console.log('oops');`;
  const result = validateCode({ code: brokenCode, language: 'javascript' });
  assert.equal(result.valid, false);
  assert(result.errors.some(e => e.rule === 'SYNTAX_ERROR'));
  assert(result.cqi < 70);
});

await test('validateCode detects TypeScript interface and types cleanly', () => {
  const tsCode = `
    interface User { id: string; name: string; }
    type Role = 'admin' | 'user';
    function getUser(id: string): User {
      return { id, name: 'Alice' };
    }
  `;
  const result = validateCode({ code: tsCode, language: 'typescript' });
  assert.equal(result.valid, true);
  assert.equal(result.errors.length, 0);
});

await test('detectPlaceholders rejects // TODO and // ... rest of code', () => {
  const placeholderCode = `
    function processPayment() {
      // TODO: implement Stripe charge here
      // ... rest of code
    }
  `;
  const placeholders = detectPlaceholders(placeholderCode);
  assert(placeholders.length >= 2, `Expected at least 2 placeholders, found ${placeholders.length}`);
  const result = validateCode({ code: placeholderCode, language: 'javascript' });
  assert.equal(result.valid, false);
  assert(result.errors.some(e => e.rule === 'FORBIDDEN_PLACEHOLDER'));
});

await test('scanSecurityVulnerabilities flags hardcoded secrets and SQL injection', () => {
  const insecureCode = `
    const api_key = "sk-live-1234567890abcdef123456";
    const query = "SELECT * FROM users WHERE username = '" + username + "'";
    eval("console.log(1)");
  `;
  const issues = scanSecurityVulnerabilities(insecureCode);
  assert(issues.some(i => i.rule === 'HARDCODED_SECRET'), 'Must flag hardcoded secret');
  assert(issues.some(i => i.rule === 'SQL_INJECTION_RISK'), 'Must flag SQL injection');
  assert(issues.some(i => i.rule === 'DANGEROUS_EVAL'), 'Must flag eval');
});

await test('validateProjectFiles aggregates multi-file project quality index', () => {
  const files = [
    { name: 'index.html', language: 'html', content: '<!DOCTYPE html><html><body><h1>Hello</h1></body></html>' },
    { name: 'style.css', language: 'css', content: 'body { margin: 0; background: #000; }' },
    { name: 'app.js', language: 'javascript', content: 'console.log("Ready");' }
  ];
  const project = validateProjectFiles(files);
  assert.equal(project.valid, true);
  assert.equal(project.totalFiles, 3);
  assert.equal(project.totalErrors, 0);
  assert(project.projectCqi >= 90);
});

// 3. Polyglot Sandboxed Execution Tests
console.log('\n3. Polyglot Sandboxed Execution Engine');

await test('executeJavaScript executes pure code and captures stdout', async () => {
  const code = `
    const a = 10;
    const b = 25;
    console.log("Result:", a + b);
  `;
  const res = await executeJavaScript(code);
  assert.equal(res.success, true);
  assert(res.output.includes('Result: 35'));
});

await test('executeJavaScript protects against infinite loops via timeout', async () => {
  const loopCode = `while(true) {}`;
  const res = await executeJavaScript(loopCode, { timeoutMs: 300 });
  assert.equal(res.success, false);
  assert(res.error.includes('timed out'));
});

await test('executeJavaScript blocks process escape patterns', async () => {
  const malicious = `const p = this.constructor.constructor('return process')();`;
  const res = await executeJavaScript(malicious);
  assert.equal(res.success, false);
  assert(res.error.includes('Security Guard'));
});

await test('executeTestSuite runs unit assertions successfully', async () => {
  const code = `function multiply(x, y) { return x * y; }`;
  const testCode = `
    expect(multiply(3, 4)).toBe(12);
    expect(multiply(0, 10)).toBe(0);
  `;
  const suite = await executeTestSuite({ code, testCode });
  assert.equal(suite.passed, true);
});

await test('executeTestSuite catches failing assertions accurately', async () => {
  const code = `function add(x, y) { return x - y; }`; // Bug: subtracts instead of adds
  const testCode = `expect(add(2, 3)).toBe(5);`;
  const suite = await executeTestSuite({ code, testCode });
  assert.equal(suite.passed, false);
  assert(suite.failedAssertion.includes('Assertion failed'));
});

// 4. Codebase Context Engine Tests
console.log('\n4. Codebase Context & Symbol Analyzer');

await test('detectProjectType identifies current Node.js project', () => {
  const types = detectProjectType();
  assert(types.some(t => t.type === 'node'));
  const node = types.find(t => t.type === 'node');
  assert(node.name.length > 0);
});

await test('extractFileSymbols extracts functions, classes and routes', () => {
  const sampleCode = `
    class UserManager {}
    export async function fetchUser(id) {}
    const validateToken = (t) => true;
    router.get('/api/users', (req, res) => {});
  `;
  const symbols = extractFileSymbols(sampleCode, 'javascript');
  assert(symbols.some(s => s.type === 'class' && s.name === 'UserManager'));
  assert(symbols.some(s => s.type === 'function' && s.name === 'fetchUser'));
  assert(symbols.some(s => s.type === 'route' && s.path === '/api/users'));
});

await test('getWorkspaceContextSummary returns structured architectural summary', () => {
  const summary = getWorkspaceContextSummary();
  assert(summary.nodeDetails !== null);
  assert(summary.structure.length > 0);
});

// 5. Self-Repair and Quality Integration Tests
console.log('\n5. Self-Repair & Quality Integration');

await test('runSelfRepairLoop validates clean code without repair iterations', async () => {
  const cleanCode = `function square(n) { return n * n; }`;
  const testCode = `expect(square(4)).toBe(16);`;
  const repair = await runSelfRepairLoop({ codeToVerify: cleanCode, testCode, maxIterations: 1 });
  assert.equal(repair.success, true);
  assert.equal(repair.iterations, 1);
  assert(repair.cqi >= 85);
});

console.log('\n======================================================');
console.log(`TOTAL TESTS: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
console.log('======================================================\n');

if (failed > 0) {
  process.exit(1);
} else {
  process.exit(0);
}

