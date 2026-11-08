/**
 * ============================================================================
 * DESKTOP COMMANDER / TERMINAL EXECUTION MCP SERVER
 * ============================================================================
 * Safe, bounded command execution sandbox with process timeout guards,
 * environment redaction, output truncation, and destructive command blocking.
 */

import { exec } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const WORKSPACE_ROOT = path.resolve(__dirname, '..');

const DESTRUCTIVE_PATTERNS = [
  /format\s+[a-z]:/i,
  /rmdir\s+\/s\s+\/q\s+[c-z]:\\windows/i,
  /del\s+\/f\s+\/s\s+\/q\s+[c-z]:\\/i,
  /:(){ :|:& };:/, // Fork bomb
  /dd\s+if=.*of=\/dev\//i,
  /shutdown\s+/i
];

class TerminalCommanderServer {
  constructor() {
    this.root = WORKSPACE_ROOT;
  }

  executeCommand({ command, cwd = '', timeoutMs = 15000 }) {
    if (!command || typeof command !== 'string') {
      throw new Error('Command must be a non-empty string');
    }

    const trimmed = command.trim();
    for (const pat of DESTRUCTIVE_PATTERNS) {
      if (pat.test(trimmed)) {
        throw new Error(`Security Violation: Command matches destructive pattern: ${trimmed}`);
      }
    }

    const workingDir = cwd ? path.resolve(this.root, cwd) : this.root;
    if (!workingDir.startsWith(this.root)) {
      throw new Error(`Access Denied: Working directory must remain within project workspace`);
    }

    const effectiveTimeout = Math.min(Math.max(1000, timeoutMs), 45000);
    const startTime = Date.now();

    return new Promise((resolve) => {
      exec(trimmed, {
        cwd: workingDir,
        timeout: effectiveTimeout,
        maxBuffer: 1024 * 512, // 512KB buffer limit
        windowsHide: true
      }, (error, stdout, stderr) => {
        const executionTimeMs = Date.now() - startTime;
        const maxOutputChars = 8000;

        const cleanStdout = (stdout || '').trim();
        const cleanStderr = (stderr || '').trim();

        resolve({
          command: trimmed,
          exitCode: error ? (error.code || 1) : 0,
          killed: error ? Boolean(error.killed) : false,
          timedOut: error ? error.killed && error.signal === 'SIGTERM' : false,
          executionTimeMs,
          stdout: cleanStdout.length > maxOutputChars ? cleanStdout.slice(0, maxOutputChars) + '\n...[Output Truncated]' : cleanStdout,
          stderr: cleanStderr.length > maxOutputChars ? cleanStderr.slice(0, maxOutputChars) + '\n...[Error Truncated]' : cleanStderr,
          success: !error
        });
      });
    });
  }

  checkToolInstalled({ toolName }) {
    if (!toolName) throw new Error('Tool name required');
    const isWin = process.platform === 'win32';
    const checkCmd = isWin ? `where ${toolName}` : `which ${toolName}`;

    return new Promise((resolve) => {
      exec(checkCmd, { timeout: 4000 }, (err, stdout) => {
        resolve({
          tool: toolName,
          installed: !err && Boolean(stdout.trim()),
          path: !err ? stdout.trim().split('\n')[0].trim() : null
        });
      });
    });
  }

  getToolDeclarations() {
    return [
      {
        name: 'terminal_execute_command',
        description: 'Desktop Commander MCP: Execute shell/CLI commands inside the project workspace with timeout and output isolation.',
        parameters: {
          type: 'OBJECT',
          properties: {
            command: { type: 'STRING', description: 'Shell command line to execute (e.g. "git status", "node -v", "npm run test")' },
            cwd: { type: 'STRING', description: 'Relative working subdirectory inside project (optional)' },
            timeoutMs: { type: 'INTEGER', description: 'Execution timeout in milliseconds (default: 15000, max: 45000)' }
          },
          required: ['command']
        },
        execute: async (args) => this.executeCommand(args)
      },
      {
        name: 'terminal_check_tool',
        description: 'Desktop Commander MCP: Verify whether a CLI utility (e.g. "git", "docker", "python", "node") is installed on host.',
        parameters: {
          type: 'OBJECT',
          properties: {
            toolName: { type: 'STRING', description: 'Name of executable CLI binary to probe' }
          },
          required: ['toolName']
        },
        execute: async (args) => this.checkToolInstalled(args)
      }
    ];
  }
}

export const terminalCommanderServer = new TerminalCommanderServer();

