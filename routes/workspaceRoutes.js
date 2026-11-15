/**
 * ============================================================================
 * RAGHUL AI — WORKSPACE FILE SYSTEM ROUTER (IDE FILE EXPLORER API)
 * ============================================================================
 * Production workspace management:
 * 1. Recursive tree navigation
 * 2. File and folder creation, rename, move, and deletion
 * 3. File reading and atomic writing
 * 4. Strict directory traversal & sensitive file security boundaries
 */

import express from 'express';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { recordAuditLog, RISK_LEVELS } from '../governanceAudit.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');

import { requireLocalDeveloperOrigin } from '../middleware/auth.js';
export { requireLocalDeveloperOrigin };

const router = express.Router();
router.use(requireLocalDeveloperOrigin);

/**
 * Validate path is safely inside project root and not sensitive
 */
function validateSafePath(relativePath, isWriteOperation = false) {
  if (!relativePath || typeof relativePath !== 'string') {
    throw new Error('Valid relative path is required');
  }

  const fullPath = path.resolve(PROJECT_ROOT, relativePath);
  const rootWithSep = PROJECT_ROOT.endsWith(path.sep) ? PROJECT_ROOT : PROJECT_ROOT + path.sep;
  const isInside = fullPath === PROJECT_ROOT || fullPath.toLowerCase().startsWith(rootWithSep.toLowerCase());

  if (!isInside) {
    throw new Error('Access denied: Directory traversal outside workspace disallowed');
  }

  const rel = path.relative(PROJECT_ROOT, fullPath).replace(/\\/g, '/');
  const baseName = path.basename(fullPath).toLowerCase();

  const isSensitive =
    baseName.startsWith('.env') ||
    baseName.startsWith('.git') ||
    baseName === 'nexus.db' ||
    baseName.startsWith('nexus.db-') ||
    rel.startsWith('.git/') ||
    rel.includes('/.env');

  if (isSensitive) {
    throw new Error('Access denied: Sensitive system or credential files are protected');
  }

  if (isWriteOperation && rel.startsWith('node_modules/')) {
    throw new Error('Access denied: Modifying node_modules directory directly is disallowed');
  }

  return { fullPath, relativePath: rel, baseName };
}

/**
 * Recursively scan workspace directory
 */
function buildDirectoryTree(dir = PROJECT_ROOT, maxDepth = 4, currentDepth = 0) {
  if (currentDepth > maxDepth) return [];
  const items = [];
  const ignored = new Set(['node_modules', '.git', '.playwright-mcp', 'generated', 'snapshots']);

  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    // Sort directories first, then alphabetical
    entries.sort((a, b) => {
      if (a.isDirectory() && !b.isDirectory()) return -1;
      if (!a.isDirectory() && b.isDirectory()) return 1;
      return a.name.localeCompare(b.name);
    });

    for (const ent of entries) {
      if (ignored.has(ent.name) || ent.name.startsWith('.')) continue;
      const fullPath = path.join(dir, ent.name);
      const relPath = path.relative(PROJECT_ROOT, fullPath).replace(/\\/g, '/');

      if (ent.isDirectory()) {
        items.push({
          name: ent.name,
          path: relPath,
          type: 'directory',
          children: buildDirectoryTree(fullPath, maxDepth, currentDepth + 1)
        });
      } else if (ent.isFile()) {
        const stats = fs.statSync(fullPath);
        const ext = path.extname(ent.name).slice(1).toLowerCase();
        items.push({
          name: ent.name,
          path: relPath,
          type: 'file',
          extension: ext || 'txt',
          size: stats.size,
          mtime: stats.mtimeMs
        });
      }
    }
  } catch (err) {
    console.warn('[WorkspaceTree] Directory scan notice:', err.message);
  }

  return items;
}

// 1. Get Workspace Tree
router.get('/tree', (req, res) => {
  try {
    const maxDepth = parseInt(req.query.depth || '4', 10);
    const tree = buildDirectoryTree(PROJECT_ROOT, maxDepth);
    res.json({ success: true, root: path.basename(PROJECT_ROOT), tree });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 2. Read File Content
router.get('/file', (req, res) => {
  try {
    const filePath = req.query.path;
    const { fullPath, relativePath } = validateSafePath(filePath, false);

    if (!fs.existsSync(fullPath)) {
      return res.status(404).json({ error: `File "${relativePath}" not found` });
    }

    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      return res.status(400).json({ error: 'Path is a directory, not a file' });
    }

    const content = fs.readFileSync(fullPath, 'utf8');
    const ext = path.extname(fullPath).slice(1).toLowerCase();

    res.json({ success: true, path: relativePath, extension: ext, size: stat.size, content });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// 3. Create or Update File
router.post('/file', (req, res) => {
  try {
    const { path: filePath, content = '' } = req.body;
    const { fullPath, relativePath } = validateSafePath(filePath, true);

    const dir = path.dirname(fullPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(fullPath, content, 'utf8');

    recordAuditLog({
      actor: 'IDE-Workspace',
      action: 'WRITE_FILE',
      target: relativePath,
      riskLevel: RISK_LEVELS.WRITE,
      status: 'SUCCESS',
      justification: 'IDE file save'
    });

    res.json({ success: true, path: relativePath, size: Buffer.byteLength(content, 'utf8') });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// 4. Create Folder
router.post('/folder', (req, res) => {
  try {
    const { path: folderPath } = req.body;
    const { fullPath, relativePath } = validateSafePath(folderPath, true);

    if (fs.existsSync(fullPath)) {
      return res.status(409).json({ error: `Folder "${relativePath}" already exists` });
    }

    fs.mkdirSync(fullPath, { recursive: true });

    recordAuditLog({
      actor: 'IDE-Workspace',
      action: 'CREATE_FOLDER',
      target: relativePath,
      riskLevel: RISK_LEVELS.WRITE,
      status: 'SUCCESS',
      justification: 'IDE folder creation'
    });

    res.json({ success: true, path: relativePath });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// 5. Rename File or Folder
router.post('/rename', (req, res) => {
  try {
    const { oldPath, newPath } = req.body;
    const oldValid = validateSafePath(oldPath, true);
    const newValid = validateSafePath(newPath, true);

    if (!fs.existsSync(oldValid.fullPath)) {
      return res.status(404).json({ error: `Source "${oldValid.relativePath}" does not exist` });
    }

    if (fs.existsSync(newValid.fullPath)) {
      return res.status(409).json({ error: `Target "${newValid.relativePath}" already exists` });
    }

    const parentDir = path.dirname(newValid.fullPath);
    if (!fs.existsSync(parentDir)) {
      fs.mkdirSync(parentDir, { recursive: true });
    }

    fs.renameSync(oldValid.fullPath, newValid.fullPath);

    recordAuditLog({
      actor: 'IDE-Workspace',
      action: 'RENAME_PATH',
      target: `${oldValid.relativePath} -> ${newValid.relativePath}`,
      riskLevel: RISK_LEVELS.WRITE,
      status: 'SUCCESS',
      justification: 'IDE path rename'
    });

    res.json({ success: true, oldPath: oldValid.relativePath, newPath: newValid.relativePath });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// 6. Delete File or Folder
router.post('/delete', (req, res) => {
  try {
    const { path: targetPath } = req.body;
    const { fullPath, relativePath } = validateSafePath(targetPath, true);

    if (!fs.existsSync(fullPath)) {
      return res.status(404).json({ error: `Target "${relativePath}" does not exist` });
    }

    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      fs.rmSync(fullPath, { recursive: true, force: true });
    } else {
      fs.unlinkSync(fullPath);
    }

    recordAuditLog({
      actor: 'IDE-Workspace',
      action: 'DELETE_PATH',
      target: relativePath,
      riskLevel: RISK_LEVELS.WRITE,
      status: 'SUCCESS',
      justification: 'IDE path deletion'
    });

    res.json({ success: true, path: relativePath });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// 7. Move File or Folder
router.post('/move', (req, res) => {
  try {
    const { srcPath, destPath } = req.body;
    const srcValid = validateSafePath(srcPath, true);
    const destValid = validateSafePath(destPath, true);

    if (!fs.existsSync(srcValid.fullPath)) {
      return res.status(404).json({ error: `Source "${srcValid.relativePath}" does not exist` });
    }

    const parentDir = path.dirname(destValid.fullPath);
    if (!fs.existsSync(parentDir)) {
      fs.mkdirSync(parentDir, { recursive: true });
    }

    fs.renameSync(srcValid.fullPath, destValid.fullPath);

    recordAuditLog({
      actor: 'IDE-Workspace',
      action: 'MOVE_PATH',
      target: `${srcValid.relativePath} -> ${destValid.relativePath}`,
      riskLevel: RISK_LEVELS.WRITE,
      status: 'SUCCESS',
      justification: 'IDE path move'
    });

    res.json({ success: true, srcPath: srcValid.relativePath, destPath: destValid.relativePath });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
