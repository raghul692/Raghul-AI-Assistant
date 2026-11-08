import { exec } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import { recordAuditLog, RISK_LEVELS } from './governanceAudit.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname);

// Safe developer commands allowlist regex patterns
const ALLOWED_COMMAND_PATTERNS = [
  /^node(\.exe)?\s+/i,
  /^npm(\.cmd)?\s+(test|run\s+[a-zA-Z0-9_-]+|list|--version)/i,
  /^git(\.exe)?\s+(status|log|diff|branch|show)/i,
  /^(dir|ls)(\s+.*)?$/i,
  /^(echo|type|cat)\s+/i,
  /^(findstr|grep)\s+/i,
  /^whoami$/i,
  /^tasklist$/i
];

// Explicit blocklist of high-risk / destructive commands
const FORBIDDEN_COMMAND_PATTERNS = [
  /rm\s+-rf/i,
  /del\s+\/[a-z]/i,
  /format\s+/i,
  /mkfs/i,
  /curl\s+.*\|\s*(bash|sh|cmd|powershell)/i,
  /powershell.*-enc/i,
  /shutdown/i,
  /drop\s+database/i
];

/**
 * Executes a developer terminal command in a secure project sandbox
 */
export async function runTerminalCommand(commandString, options = {}) {
  const startTime = Date.now();
  const trimmed = (commandString || '').trim();

  if (!trimmed) {
    return { success: false, error: 'Empty command string' };
  }

  // 1. Check Forbidden Patterns
  for (const pattern of FORBIDDEN_COMMAND_PATTERNS) {
    if (pattern.test(trimmed)) {
      recordAuditLog({
        actor: 'TerminalSandbox',
        action: 'COMMAND_BLOCKED',
        target: trimmed,
        riskLevel: RISK_LEVELS.CRITICAL,
        status: 'BLOCKED',
        justification: `Matched dangerous pattern: ${pattern}`
      });
      return {
        success: false,
        error: `Security Violation: Command "${trimmed}" is blocked by system safety guardrails.`,
        durationMs: Date.now() - startTime
      };
    }
  }

  // 2. Validate Against Allowed Safe Patterns
  const isAllowed = ALLOWED_COMMAND_PATTERNS.some(p => p.test(trimmed));
  if (!isAllowed) {
    recordAuditLog({
      actor: 'TerminalSandbox',
      action: 'COMMAND_REJECTED',
      target: trimmed,
      riskLevel: RISK_LEVELS.CRITICAL,
      status: 'REJECTED',
      justification: 'Command not present in sandboxed allowlist'
    });
    return {
      success: false,
      error: `Permission Denied: Command is not in the safe developer allowlist. Allowed: node, npm test, git status, dir, echo, grep.`,
      durationMs: Date.now() - startTime
    };
  }

  // 3. Execute with Timeout & Directory Sandbox
  return new Promise((resolve) => {
    exec(trimmed, {
      cwd: PROJECT_ROOT,
      timeout: options.timeout || 6000,
      maxBuffer: 512 * 1024,
      windowsHide: true
    }, (error, stdout, stderr) => {
      const durationMs = Date.now() - startTime;
      const success = !error;

      recordAuditLog({
        actor: 'TerminalSandbox',
        action: 'EXECUTE_COMMAND',
        target: trimmed,
        riskLevel: RISK_LEVELS.COMPUTE,
        status: success ? 'SUCCESS' : 'FAILED',
        justification: `Executed in ${durationMs}ms with exit code ${error?.code || 0}`,
        metadata: { exitCode: error?.code || 0, outputLength: (stdout + stderr).length }
      });

      resolve({
        success,
        stdout: (stdout || '').trim(),
        stderr: (stderr || '').trim(),
        exitCode: error ? (error.code || 1) : 0,
        error: error ? error.message : null,
        durationMs
      });
    });
  });
}

