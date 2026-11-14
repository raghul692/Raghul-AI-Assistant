/**
 * ============================================================================
 * RAGHUL AI — TERMINAL ROUTER (INTERACTIVE SHELL & STREAMING API)
 * ============================================================================
 * Provides REST & SSE endpoints for the IDE integrated terminal.
 */

import express from 'express';
import {
  createTerminalSession,
  getTerminalSession,
  writeTerminalInput,
  resizeTerminalSession,
  killTerminalSession,
  listTerminalSessions,
  runTerminalCommandDirect
} from '../services/terminalManager.js';

const router = express.Router();

// Middleware: Restrict access strictly to local developer loopback
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

// 1. Create a new interactive terminal session
router.post('/session', (req, res) => {
  try {
    const { cols = 80, rows = 24 } = req.body;
    const sessionInfo = createTerminalSession({ cols, rows });
    res.json({ success: true, ...sessionInfo });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 2. Stream terminal output via Server-Sent Events (SSE)
router.get('/stream', (req, res) => {
  const sessionId = req.query.sessionId;
  if (!sessionId) {
    return res.status(400).json({ error: 'Query parameter "sessionId" is required' });
  }

  const session = getTerminalSession(sessionId);
  if (!session) {
    return res.status(404).json({ error: `Terminal session "${sessionId}" not found` });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  session.addListener(res);
});

// 3. Write input keystrokes or commands to terminal stdin
router.post('/input', (req, res) => {
  try {
    const { sessionId, data } = req.body;
    if (!sessionId || data === undefined) {
      return res.status(400).json({ error: 'Both "sessionId" and "data" are required' });
    }
    const result = writeTerminalInput(sessionId, data);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 4. Resize terminal viewport dimensions
router.post('/resize', (req, res) => {
  try {
    const { sessionId, cols = 80, rows = 24 } = req.body;
    if (!sessionId) return res.status(400).json({ error: 'sessionId is required' });
    const result = resizeTerminalSession(sessionId, cols, rows);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 5. Terminate terminal session
router.post('/kill', (req, res) => {
  try {
    const { sessionId } = req.body;
    if (!sessionId) return res.status(400).json({ error: 'sessionId is required' });
    const result = killTerminalSession(sessionId);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 6. List active sessions
router.get('/list', (req, res) => {
  try {
    const sessions = listTerminalSessions();
    res.json({ success: true, count: sessions.length, sessions });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 7. Execute single-shot command with process buffer
router.post('/run', async (req, res) => {
  try {
    const { command, timeout = 15000 } = req.body;
    if (!command) return res.status(400).json({ error: 'command is required' });
    const result = await runTerminalCommandDirect(command, { timeout });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;

