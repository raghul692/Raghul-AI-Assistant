/**
 * ============================================================================
 * RAGHUL AI — GIT SOURCE CONTROL ROUTER (IDE GIT INTEGRATION API)
 * ============================================================================
 * Provides REST endpoints for IDE Git source control.
 */

import express from 'express';
import {
  getGitStatus,
  getGitDiff,
  stageGitFile,
  unstageGitFile,
  commitGitChanges,
  getGitBranches,
  getGitLog
} from '../services/gitManager.js';

const router = express.Router();

// Middleware: Restrict access strictly to local developer origin
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

// 1. Get Status
router.get('/status', async (req, res) => {
  try {
    const status = await getGitStatus();
    res.json(status);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 2. Get Diff
router.get('/diff', async (req, res) => {
  try {
    const file = req.query.file || '';
    const staged = req.query.staged === 'true';
    const diffResult = await getGitDiff(file, staged);
    res.json(diffResult);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3. Stage File
router.post('/stage', async (req, res) => {
  try {
    const { file } = req.body;
    if (!file) return res.status(400).json({ error: 'File is required' });
    const result = await stageGitFile(file);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 4. Unstage File
router.post('/unstage', async (req, res) => {
  try {
    const { file } = req.body;
    if (!file) return res.status(400).json({ error: 'File is required' });
    const result = await unstageGitFile(file);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 5. Commit Staged Changes
router.post('/commit', async (req, res) => {
  try {
    const { message } = req.body;
    if (!message) return res.status(400).json({ error: 'Commit message is required' });
    const result = await commitGitChanges(message);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 6. Get Branches
router.get('/branches', async (req, res) => {
  try {
    const branches = await getGitBranches();
    res.json(branches);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 7. Get Recent Log
router.get('/log', async (req, res) => {
  try {
    const count = parseInt(req.query.count || '15', 10);
    const logs = await getGitLog(count);
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
