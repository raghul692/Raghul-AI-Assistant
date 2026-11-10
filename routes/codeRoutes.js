import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { scanWorkspaceTree, rollbackSnapshot, applyFilePatch, runSelfRepairLoop } from '../codingAgent.js';

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

// 5. Self-Repair Execution
router.post('/self-repair', async (req, res) => {
  try {
    const { code, testCode, maxIterations } = req.body;
    const result = await runSelfRepairLoop({ codeToVerify: code, testCode, maxIterations });
    res.json({ success: true, result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
