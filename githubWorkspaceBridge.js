/**
 * RAGHUL AI — GITHUB LOCAL WORKSPACE & CODING AGENT BRIDGE
 * 
 * Capabilities:
 * 1. Safe workspace repository exploration & AST file analysis
 * 2. Unified diff generation & patch previews
 * 3. Atomic snapshots & rollback protection
 * 4. Sandboxed command execution with strict allowlist & timeout
 * 5. Branch creation & commit staging with Confidence-Gated Human Approval
 */

import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { fileURLToPath } from 'url';
import { createSnapshot, rollbackSnapshot, scanWorkspaceTree } from './codingAgent.js';
import { createApprovalRequest, logGitHubAudit } from './db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Allowlisted command prefixes for developer safety
const ALLOWED_COMMAND_PREFIXES = [
  'npm test',
  'npm run test',
  'node -c',
  'node --check',
  'npm run lint',
  'npm run build',
  'git status',
  'git diff',
  'git log',
  'git branch',
  'git show'
];

export class GitHubWorkspaceBridge {
  constructor(workspaceDir = __dirname) {
    this.workspaceDir = path.resolve(workspaceDir);
  }

  /**
   * Verify file path is within authorized workspace boundary
   */
  _assertSafePath(relPath) {
    const target = path.resolve(this.workspaceDir, relPath);
    if (!target.startsWith(this.workspaceDir)) {
      throw new Error(`Security Exception: Access denied to path "${relPath}" outside workspace.`);
    }
    return target;
  }

  /**
   * Scan local repository workspace tree
   */
  getWorkspaceTree(maxDepth = 3) {
    return scanWorkspaceTree(this.workspaceDir, maxDepth);
  }

  /**
   * Read file safely
   */
  readFile(relPath) {
    const target = this._assertSafePath(relPath);
    if (!fs.existsSync(target)) {
      throw new Error(`File not found: ${relPath}`);
    }
    return fs.readFileSync(target, 'utf8');
  }

  /**
   * Safe file modification with snapshot & unified diff generation
   */
  stageFileChange(relPath, newContent, reason = 'Code modification requested') {
    const target = this._assertSafePath(relPath);
    const originalContent = fs.existsSync(target) ? fs.readFileSync(target, 'utf8') : '';
    
    // Take atomic backup snapshot
    const snapshotId = createSnapshot(relPath);

    // Compute diff preview
    const diff = this._generateDiff(relPath, originalContent, newContent);

    // Create Human-in-the-Loop approval request
    const approval = createApprovalRequest({
      action: fs.existsSync(target) ? 'MODIFY_FILE' : 'CREATE_FILE',
      repo: path.basename(this.workspaceDir),
      branch: 'current_workspace',
      agentRole: 'Coding Agent',
      riskLevel: 'high',
      reason,
      details: {
        relPath,
        snapshotId,
        bytesDelta: newContent.length - originalContent.length
      },
      diff
    });

    logGitHubAudit({
      actor: 'Coding Agent',
      action: 'STAGE_FILE_CHANGE',
      resource: relPath,
      status: 'PENDING_APPROVAL',
      details: { approvalId: approval.id, snapshotId }
    });

    return {
      approvalRequired: true,
      approvalId: approval.id,
      relPath,
      snapshotId,
      diff
    };
  }

  /**
   * Apply approved file change
   */
  applyApprovedChange(relPath, newContent) {
    const target = this._assertSafePath(relPath);
    const parentDir = path.dirname(target);
    if (!fs.existsSync(parentDir)) {
      fs.mkdirSync(parentDir, { recursive: true });
    }
    fs.writeFileSync(target, newContent, 'utf8');

    logGitHubAudit({
      actor: 'Coding Agent',
      action: 'APPLY_APPROVED_CHANGE',
      resource: relPath,
      status: 'SUCCESS'
    });

    return { success: true, relPath };
  }

  /**
   * Rollback file change to snapshot
   */
  rollback(snapshotId) {
    return rollbackSnapshot(snapshotId);
  }

  /**
   * Execute allowlisted verification command in workspace
   */
  async runVerificationCommand(command, timeoutMs = 15000) {
    const trimmed = command.trim();
    const isAllowed = ALLOWED_COMMAND_PREFIXES.some(prefix => trimmed.startsWith(prefix));

    if (!isAllowed) {
      throw new Error(`Command "${trimmed}" rejected. Allowed command patterns: ${ALLOWED_COMMAND_PREFIXES.join(', ')}`);
    }

    return new Promise((resolve, reject) => {
      const child = exec(trimmed, {
        cwd: this.workspaceDir,
        timeout: timeoutMs,
        maxBuffer: 1024 * 512
      }, (error, stdout, stderr) => {
        logGitHubAudit({
          actor: 'Testing Agent',
          action: 'RUN_VERIFICATION_CMD',
          resource: trimmed,
          status: error ? 'FAILED' : 'SUCCESS',
          details: { exitCode: error?.code || 0 }
        });

        resolve({
          command: trimmed,
          exitCode: error ? (error.code || 1) : 0,
          stdout: stdout || '',
          stderr: stderr || '',
          success: !error
        });
      });
    });
  }

  /**
   * Generate simple unified diff
   */
  _generateDiff(filePath, oldStr, newStr) {
    const oldLines = oldStr ? oldStr.split('\n') : [];
    const newLines = newStr ? newStr.split('\n') : [];
    let diff = `--- a/${filePath}\n+++ b/${filePath}\n@@ -1,${oldLines.length} +1,${newLines.length} @@\n`;

    const max = Math.max(oldLines.length, newLines.length);
    for (let i = 0; i < max; i++) {
      const o = oldLines[i];
      const n = newLines[i];
      if (o === n) {
        if (i < 5) diff += ` ${o}\n`;
      } else {
        if (o !== undefined) diff += `-${o}\n`;
        if (n !== undefined) diff += `+${n}\n`;
      }
    }
    return diff;
  }
}

export const githubWorkspaceBridge = new GitHubWorkspaceBridge();

