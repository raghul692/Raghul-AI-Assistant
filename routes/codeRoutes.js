import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { scanWorkspaceTree, rollbackSnapshot, applyFilePatch, runSelfRepairLoop } from '../codingAgent.js';
import { validateCode, validateProjectFiles } from '../services/codeValidator.js';
import { runCode, executeTestSuite } from '../services/codeExecutionEngine.js';
import { getAllKnownStacks, classifyTechStack } from '../services/codingKnowledgeEngine.js';
import { getWorkspaceContextSummary } from '../services/codebaseContextEngine.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');

const router = express.Router();

// Middleware: Restrict access strictly to local loopback and developer origin
export function requireLocalDeveloperOrigin(req, res, next) {
  const remoteIp = req.ip || req.connection?.remoteAddress || '';
  const isLoopback = ['127.0.0.1', '::1', '::ffff:127.0.0.1'].some(ip => remoteIp.includes(ip));
  const origin = req.headers.origin;
  const isAllowedOrigin = !origin || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
  if (!isLoopback || !isAllowedOrigin) {
    return res.status(403).json({ error: 'Forbidden: Access restricted to authorized local developer origin.' });
  }
  next();
}

router.use(requireLocalDeveloperOrigin);

// 1. Scan Workspace Tree
router.get('/tree', (req, res) => {
  try {
    const tree = scanWorkspaceTree();
    res.json({ success: true, tree });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 2. Read File Safely (with strict path traversal and credential protections)
router.get('/read', (req, res) => {
  try {
    const filePath = req.query.path;
    if (!filePath) return res.status(400).json({ error: 'Path is required' });
    const fullPath = path.resolve(PROJECT_ROOT, filePath);
    if (!fullPath.startsWith(PROJECT_ROOT)) {
      return res.status(403).json({ error: 'Access denied: Directory traversal blocked' });
    }

    const rel = path.relative(PROJECT_ROOT, fullPath).replace(/\\/g, '/');
    const baseName = path.basename(fullPath).toLowerCase();
    const isSensitive = 
      baseName.startsWith('.env') ||
      baseName.startsWith('.git') ||
      baseName === 'nexus.db' ||
      baseName.startsWith('nexus.db-') ||
      rel.startsWith('.git/') ||
      rel.startsWith('node_modules/') ||
      rel.includes('/.env');

    if (isSensitive) {
      return res.status(403).json({ error: 'Access denied: Reading sensitive configuration or system files is blocked.' });
    }

    if (!fs.existsSync(fullPath)) return res.status(404).json({ error: 'File not found' });
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) return res.status(400).json({ error: 'Path is a directory' });
    const content = fs.readFileSync(fullPath, 'utf8');
    res.json({ success: true, filePath: rel, content });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3. Patch File Safely
router.post('/patch', (req, res) => {
  try {
    const { filePath, targetText, replacementText } = req.body;
    if (!filePath) return res.status(400).json({ error: 'File path required' });
    const fullPath = path.resolve(PROJECT_ROOT, filePath);
    if (!fullPath.startsWith(PROJECT_ROOT)) {
      return res.status(403).json({ error: 'Access denied: Directory traversal blocked' });
    }

    const rel = path.relative(PROJECT_ROOT, fullPath).replace(/\\/g, '/');
    const baseName = path.basename(fullPath).toLowerCase();
    if (baseName.startsWith('.env') || baseName.startsWith('.git') || rel.startsWith('node_modules/')) {
      return res.status(403).json({ error: 'Access denied: Modifying sensitive files is blocked.' });
    }

    const result = applyFilePatch(filePath, targetText, replacementText);
    res.json({ success: true, result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 4. Rollback Snapshot
router.post('/rollback', (req, res) => {
  try {
    const { snapshotId } = req.body;
    const result = rollbackSnapshot(snapshotId);
    res.json({ success: true, result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 5. Self-Repair Execution (Enhanced with AST and Multi-Language support)
router.post('/self-repair', async (req, res) => {
  try {
    const { code, testCode, language = 'javascript', maxIterations } = req.body;
    const result = await runSelfRepairLoop({ codeToVerify: code, testCode, language, maxIterations });
    res.json({ success: true, result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 6. Pre-Delivery AST Code Validation
router.post('/validate', (req, res) => {
  try {
    const { code, language = 'javascript', filePath = '', files = null } = req.body;

    if (Array.isArray(files) && files.length > 0) {
      const projectResult = validateProjectFiles(files);
      return res.json({ success: true, result: projectResult });
    }

    const validation = validateCode({ code, language, filePath });
    res.json({ success: true, result: validation });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 7. Sandboxed Polyglot Code Execution
router.post('/execute', async (req, res) => {
  try {
    const { code, language = 'javascript', testCode = null, timeoutMs = 3000 } = req.body;
    if (!code) return res.status(400).json({ error: 'Code is required' });

    if (testCode && typeof testCode === 'string') {
      const suiteResult = await executeTestSuite({ code, testCode, language, timeoutMs });
      return res.json({ success: true, result: suiteResult });
    }

    const result = await runCode({ code, language, options: { timeoutMs } });
    res.json({ success: true, result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 8. Supported Knowledge Domains
router.get('/knowledge', (req, res) => {
  try {
    const stacks = getAllKnownStacks();
    res.json({ success: true, count: stacks.length, stacks });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 9. Workspace Context & Architectural Summary
router.get('/context', (req, res) => {
  try {
    const summary = getWorkspaceContextSummary();
    res.json({ success: true, summary });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
