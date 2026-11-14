/**
 * ============================================================================
 * RAGHUL AI — ADVANCED GIT SOURCE CONTROL MANAGER
 * ============================================================================
 * Production Git service:
 * 1. Status parsing (branch, staged, unstaged, untracked)
 * 2. Unified diff generation
 * 3. File staging, unstaging, and commit creation
 * 4. Branch detection and recent log extraction
 */

import { exec } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { recordAuditLog, RISK_LEVELS } from '../governanceAudit.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');

/**
 * Execute Git CLI command safely in workspace root
 */
function execGit(cmd) {
  return new Promise((resolve, reject) => {
    exec(cmd, { cwd: PROJECT_ROOT, maxBuffer: 1024 * 1024 }, (err, stdout, stderr) => {
      if (err) return reject(new Error(stderr || err.message));
      resolve(stdout.trim());
    });
  });
}

/**
 * Get comprehensive Git status
 */
export async function getGitStatus() {
  try {
    const raw = await execGit('git status --porcelain=v1 -b');
    const lines = raw.split('\n');

    let branch = 'main';
    let ahead = 0;
    let behind = 0;
    const staged = [];
    const unstaged = [];
    const untracked = [];

    for (const line of lines) {
      if (!line.trim()) continue;

      // Header line: ## branch...upstream [ahead X, behind Y]
      if (line.startsWith('## ')) {
        const header = line.slice(3);
        const branchMatch = header.match(/^([^\s\.]+)/);
        if (branchMatch) branch = branchMatch[1];

        const aheadMatch = header.match(/ahead\s+(\d+)/i);
        if (aheadMatch) ahead = parseInt(aheadMatch[1], 10);

        const behindMatch = header.match(/behind\s+(\d+)/i);
        if (behindMatch) behind = parseInt(behindMatch[1], 10);
        continue;
      }

      const x = line[0]; // Staged status
      const y = line[1]; // Unstaged status
      const file = line.slice(3).trim();

      if (x === '?' && y === '?') {
        untracked.push({ file, status: '?' });
      } else {
        if (x !== ' ' && x !== '?') {
          staged.push({ file, status: x });
        }
        if (y !== ' ' && y !== '?') {
          unstaged.push({ file, status: y });
        }
      }
    }

    const clean = staged.length === 0 && unstaged.length === 0 && untracked.length === 0;

    return {
      success: true,
      branch,
      ahead,
      behind,
      clean,
      counts: {
        staged: staged.length,
        unstaged: unstaged.length,
        untracked: untracked.length,
        total: staged.length + unstaged.length + untracked.length
      },
      staged,
      unstaged,
      untracked
    };
  } catch (err) {
    return {
      success: false,
      error: err.message,
      branch: 'unknown',
      clean: true,
      staged: [],
      unstaged: [],
      untracked: []
    };
  }
}

/**
 * Get unified diff for a file or repository
 */
export async function getGitDiff(file = '', staged = false) {
  try {
    const target = file ? `"${file.replace(/"/g, '')}"` : '';
    const flag = staged ? '--cached' : '';
    const diff = await execGit(`git diff ${flag} ${target}`);
    return { success: true, file, staged, diff: diff || '(No differences detected)' };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Stage file(s) for commit
 */
export async function stageGitFile(file) {
  if (!file) throw new Error('File path required for git stage');
  const target = (file === 'all' || file === '.') ? '-A' : `"${file.replace(/"/g, '')}"`;
  await execGit(`git add ${target}`);

  recordAuditLog({
    actor: 'GitManager',
    action: 'STAGE_FILE',
    target: file,
    riskLevel: RISK_LEVELS.WRITE,
    status: 'SUCCESS',
    justification: 'IDE Source Control stage'
  });

  return { success: true, file };
}

/**
 * Unstage file(s) from index
 */
export async function unstageGitFile(file) {
  if (!file) throw new Error('File path required for git unstage');
  const target = (file === 'all' || file === '.') ? '.' : `"${file.replace(/"/g, '')}"`;
  await execGit(`git restore --staged ${target}`);

  recordAuditLog({
    actor: 'GitManager',
    action: 'UNSTAGE_FILE',
    target: file,
    riskLevel: RISK_LEVELS.WRITE,
    status: 'SUCCESS',
    justification: 'IDE Source Control unstage'
  });

  return { success: true, file };
}

/**
 * Create a Git commit
 */
export async function commitGitChanges(message) {
  if (!message || !message.trim()) {
    throw new Error('Commit message is required');
  }
  const sanitized = message.trim().replace(/"/g, '\\"');
  const output = await execGit(`git commit -m "${sanitized}"`);

  recordAuditLog({
    actor: 'GitManager',
    action: 'COMMIT_CHANGES',
    target: message,
    riskLevel: RISK_LEVELS.WRITE,
    status: 'SUCCESS',
    justification: 'IDE Source Control commit'
  });

  return { success: true, message, output };
}

/**
 * Get list of branches
 */
export async function getGitBranches() {
  try {
    const raw = await execGit('git branch -a');
    const branches = raw.split('\n').map(b => {
      const active = b.startsWith('*');
      const name = b.replace(/^\*\s*/, '').trim();
      return { name, active };
    }).filter(b => b.name);
    return { success: true, branches };
  } catch (err) {
    return { success: false, error: err.message, branches: [] };
  }
}

/**
 * Get recent Git commit log
 */
export async function getGitLog(count = 15) {
  try {
    const raw = await execGit(`git log -n ${parseInt(count, 10)} --pretty=format:"%h|%an|%ad|%s" --date=short`);
    const commits = raw.split('\n').filter(Boolean).map(line => {
      const [hash, author, date, message] = line.split('|');
      return { hash, author, date, message };
    });
    return { success: true, count: commits.length, commits };
  } catch (err) {
    return { success: false, error: err.message, commits: [] };
  }
}

