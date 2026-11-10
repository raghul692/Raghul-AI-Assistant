/**
 * ============================================================================
 * RAGHUL AI — ADVANCED INTERACTIVE TERMINAL PROCESS MANAGER
 * ============================================================================
 * Production terminal manager:
 * 1. Persistent interactive shell process spawning (PowerShell / Bash / CMD)
 * 2. Bidirectional Server-Sent Events (SSE) stdout/stderr streaming
 * 3. Terminal session lifecycle management & automated inactivity watchdog
 * 4. Safe single-shot command runner with execution limits
 */

import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { recordAuditLog, RISK_LEVELS } from '../governanceAudit.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');

const SESSIONS = new Map();
const SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes inactivity timeout

/**
 * Get the platform-appropriate shell command
 */
function getDefaultShell() {
  if (process.platform === 'win32') {
    return {
      shell: 'powershell.exe',
      args: ['-NoLogo', '-NoProfile', '-ExecutionPolicy', 'Bypass']
    };
  }
  return {
    shell: process.env.SHELL || 'bash',
    args: ['-l']
  };
}

class TerminalSession {
  constructor(sessionId, options = {}) {
    this.sessionId = sessionId;
    this.createdAt = Date.now();
    this.lastActivity = Date.now();
    this.cols = options.cols || 80;
    this.rows = options.rows || 24;
    this.listeners = new Set();
    this.buffer = [];
    this.maxBufferLength = 200;

    const { shell, args } = getDefaultShell();
    this.shellName = shell;

    try {
      this.process = spawn(shell, args, {
        cwd: PROJECT_ROOT,
        env: {
          ...process.env,
          TERM: 'xterm-256color',
          COLORTERM: 'truecolor',
          COLUMNS: String(this.cols),
          LINES: String(this.rows)
        },
        windowsHide: true
      });

      this.process.stdout.on('data', (chunk) => {
        const text = chunk.toString('utf8');
        this.broadcast('data', text);
      });

      this.process.stderr.on('data', (chunk) => {
        const text = chunk.toString('utf8');
        this.broadcast('data', text);
      });

      this.process.on('close', (exitCode) => {
        this.broadcast('exit', { exitCode });
        this.destroy();
      });

      this.process.on('error', (err) => {
        this.broadcast('error', { message: err.message });
      });

      recordAuditLog({
        actor: 'TerminalManager',
        action: 'SPAWN_TERMINAL_SESSION',
        target: `Session: ${this.sessionId} (${this.shellName})`,
        riskLevel: RISK_LEVELS.READ,
        status: 'SUCCESS',
        justification: 'Interactive IDE terminal session created'
      });
    } catch (err) {
      console.error('[TerminalManager] Process spawn failure:', err.message);
      throw err;
    }
  }

  broadcast(type, payload) {
    this.lastActivity = Date.now();
    const eventData = JSON.stringify({ type, payload, timestamp: Date.now() });

    // Store in ring buffer for reconnecting clients
    if (type === 'data') {
      this.buffer.push(payload);
      if (this.buffer.length > this.maxBufferLength) {
        this.buffer.shift();
      }
    }

    for (const res of this.listeners) {
      try {
        res.write(`data: ${eventData}\n\n`);
      } catch {
        this.listeners.delete(res);
      }
    }
  }

  addListener(res) {
    this.listeners.add(res);

    // Replay buffer on connection
    if (this.buffer.length > 0) {
      const replay = JSON.stringify({ type: 'replay', payload: this.buffer.join(''), timestamp: Date.now() });
      res.write(`data: ${replay}\n\n`);
    }

    res.on('close', () => {
      this.listeners.delete(res);
    });
  }

  write(data) {
    if (!this.process || !this.process.stdin.writable) {
      throw new Error('Terminal session process stdin is not writable');
    }
    this.lastActivity = Date.now();
    this.process.stdin.write(data);
  }

  resize(cols, rows) {
    this.cols = cols;
    this.rows = rows;
    this.lastActivity = Date.now();
  }

  destroy() {
    if (this.process) {
      try {
        this.process.kill();
      } catch {
        // Process may already be dead
      }
      this.process = null;
    }
    for (const res of this.listeners) {
      try {
        res.end();
      } catch {
        // Ignore end errors
      }
    }
    this.listeners.clear();
    SESSIONS.delete(this.sessionId);
  }
}

/**
 * Create a new interactive terminal session
 */
export function createTerminalSession(options = {}) {
  const sessionId = `term_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const session = new TerminalSession(sessionId, options);
  SESSIONS.set(sessionId, session);
  return { sessionId, shell: session.shellName, createdAt: session.createdAt };
}

/**
 * Get active terminal session by ID
 */
export function getTerminalSession(sessionId) {
  return SESSIONS.get(sessionId) || null;
}

/**
 * Write input data to a terminal session
 */
export function writeTerminalInput(sessionId, data) {
  const session = SESSIONS.get(sessionId);
  if (!session) {
    throw new Error(`Terminal session "${sessionId}" not found`);
  }
  session.write(data);
  return { success: true };
}

/**
 * Resize a terminal session
 */
export function resizeTerminalSession(sessionId, cols, rows) {
  const session = SESSIONS.get(sessionId);
  if (!session) {
    throw new Error(`Terminal session "${sessionId}" not found`);
  }
  session.resize(cols, rows);
  return { success: true, cols, rows };
}

/**
 * Kill a terminal session
 */
export function killTerminalSession(sessionId) {
  const session = SESSIONS.get(sessionId);
  if (!session) {
    return { success: false, message: 'Session not found' };
  }
  session.destroy();
  return { success: true, sessionId };
}

/**
 * List all active sessions
 */
export function listTerminalSessions() {
  const list = [];
  for (const [id, s] of SESSIONS.entries()) {
    list.push({
      sessionId: id,
      shell: s.shellName,
      createdAt: s.createdAt,
      lastActivity: s.lastActivity,
      activeListeners: s.listeners.size
    });
  }
  return list;
}

/**
 * Run a single-shot terminal command with timeout and buffer capture
 */
export async function runTerminalCommandDirect(commandString, options = {}) {
  const startTime = Date.now();
  const trimmed = (commandString || '').trim();
  if (!trimmed) return { success: false, error: 'Empty command string' };

  const { shell, args } = getDefaultShell();
  const isWin = process.platform === 'win32';
  const execArgs = isWin ? [...args, '-Command', trimmed] : ['-c', trimmed];

  return new Promise((resolve) => {
    let stdout = '';
    let stderr = '';
    let resolved = false;

    const proc = spawn(shell, execArgs, {
      cwd: PROJECT_ROOT,
      env: { ...process.env, TERM: 'xterm-256color' },
      windowsHide: true
    });

    proc.stdout.on('data', (d) => { stdout += d.toString('utf8'); });
    proc.stderr.on('data', (d) => { stderr += d.toString('utf8'); });

    const timer = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        try { proc.kill(); } catch {}
        resolve({
          success: false,
          error: `Command execution timed out after ${options.timeout || 10000}ms`,
          stdout,
          stderr,
          durationMs: Date.now() - startTime
        });
      }
    }, options.timeout || 10000);

    proc.on('close', (code) => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timer);
        resolve({
          success: code === 0,
          exitCode: code,
          stdout,
          stderr,
          output: stdout + (stderr ? '\n' + stderr : ''),
          durationMs: Date.now() - startTime
        });
      }
    });

    proc.on('error', (err) => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timer);
        resolve({
          success: false,
          error: err.message,
          stdout,
          stderr,
          durationMs: Date.now() - startTime
        });
      }
    });
  });
}

// Inactivity watchdog: sweeps every 5 minutes to clean up stale sessions
setInterval(() => {
  const now = Date.now();
  for (const [id, s] of SESSIONS.entries()) {
    if (now - s.lastActivity > SESSION_TIMEOUT_MS) {
      s.destroy();
    }
  }
}, 5 * 60 * 1000).unref();
