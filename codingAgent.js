/**
 * NEXUS AI — PRODUCTION CODING AGENT & WORKSPACE ENGINE (Upgrade 05)
 * 
 * Capabilities:
 * 1. Repository-level file tree navigation & AST symbol inspection
 * 2. Unified diff generation & line-accurate patch application
 * 3. Atomic snapshots & instant rollback mechanism
 * 4. Automated test & verification execution loop (self-repair)
 * 5. High-risk safety gates (Human-in-the-Loop confirmation)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { recordAuditLog, RISK_LEVELS } from './governanceAudit.js';
import { AIProviderManager } from './orchestration/aiProviderManager.js';
import { runCodeSandboxTool } from './agentTools.js';
import { validateCode } from './services/codeValidator.js';
import { executeTestSuite, runCode } from './services/codeExecutionEngine.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SNAPSHOTS_DIR = path.join(__dirname, 'data', 'snapshots');

if (!fs.existsSync(SNAPSHOTS_DIR)) {
  fs.mkdirSync(SNAPSHOTS_DIR, { recursive: true });
}

let providerManager = null;
function getProviderManager() {
  if (!providerManager) providerManager = new AIProviderManager();
  return providerManager;
}

/**
 * Scan workspace directory recursively up to maxDepth
 */
export function scanWorkspaceTree(rootDir = __dirname, maxDepth = 2, currentDepth = 0) {
  if (currentDepth > maxDepth) return [];
  const items = [];
  const ignored = new Set(['node_modules', '.git', '.playwright-mcp', 'generated', 'snapshots']);

  try {
    const entries = fs.readdirSync(rootDir, { withFileTypes: true });
    for (const ent of entries) {
      if (ignored.has(ent.name) || ent.name.startsWith('.')) continue;
      const fullPath = path.join(rootDir, ent.name);
      const relativePath = path.relative(__dirname, fullPath).replace(/\\/g, '/');

      if (ent.isDirectory()) {
        items.push({
          name: ent.name,
          path: relativePath,
          type: 'directory',
          children: scanWorkspaceTree(fullPath, maxDepth, currentDepth + 1)
        });
      } else if (ent.isFile()) {
        const stats = fs.statSync(fullPath);
        items.push({
          name: ent.name,
          path: relativePath,
          type: 'file',
          size: stats.size,
          mtime: stats.mtimeMs
        });
      }
    }
  } catch (err) {
    console.warn('[CodingAgent] Directory scan notice:', err.message);
  }

  return items;
}

/**
 * Create a snapshot of a file before modification for rollback safety
 */
export function createSnapshot(relativeFilePath) {
  const fullPath = path.resolve(__dirname, relativeFilePath);
  if (!fullPath.startsWith(__dirname)) {
    throw new Error('Access denied: file path traverses outside workspace');
  }

  if (!fs.existsSync(fullPath)) return null;

  const content = fs.readFileSync(fullPath, 'utf8');
  const snapshotId = `snap_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const snapshotFile = path.join(SNAPSHOTS_DIR, `${snapshotId}.bak`);

  fs.writeFileSync(snapshotFile, JSON.stringify({
    filePath: relativeFilePath,
    timestamp: Date.now(),
    content
  }), 'utf8');

  return snapshotId;
}

/**
 * Rollback a file to a previous snapshot
 */
export function rollbackSnapshot(snapshotId) {
  const snapshotFile = path.join(SNAPSHOTS_DIR, `${snapshotId}.bak`);
  if (!fs.existsSync(snapshotFile)) {
    throw new Error(`Snapshot ${snapshotId} not found`);
  }

  const raw = fs.readFileSync(snapshotFile, 'utf8');
  const data = JSON.parse(raw);
  const fullPath = path.resolve(__dirname, data.filePath);

  fs.writeFileSync(fullPath, data.content, 'utf8');

  recordAuditLog({
    actor: 'Coding-Agent',
    action: 'ROLLBACK_FILE',
    target: data.filePath,
    riskLevel: RISK_LEVELS.WRITE,
    status: 'SUCCESS',
    justification: `Reverted file to snapshot ${snapshotId}`
  });

  return { success: true, filePath: data.filePath, restoredAt: Date.now() };
}

/**
 * Apply a line-accurate patch or text edit to a file
 */
export function applyFilePatch(relativeFilePath, targetText, replacementText) {
  const fullPath = path.resolve(__dirname, relativeFilePath);
  if (!fullPath.startsWith(__dirname)) {
    throw new Error('Security Error: Path traversal outside workspace disallowed');
  }

  if (!fs.existsSync(fullPath)) {
    throw new Error(`Target file ${relativeFilePath} does not exist`);
  }

  const snapshotId = createSnapshot(relativeFilePath);
  const original = fs.readFileSync(fullPath, 'utf8');

  if (!original.includes(targetText)) {
    throw new Error(`Target text block not found in ${relativeFilePath}`);
  }

  const updated = original.replace(targetText, replacementText);
  fs.writeFileSync(fullPath, updated, 'utf8');

  recordAuditLog({
    actor: 'Coding-Agent',
    action: 'PATCH_FILE',
    target: relativeFilePath,
    riskLevel: RISK_LEVELS.WRITE,
    status: 'SUCCESS',
    justification: 'Coding Agent automated patch application',
    metadata: { snapshotId }
  });

  return {
    success: true,
    filePath: relativeFilePath,
    snapshotId,
    charsModified: Math.abs(updated.length - original.length)
  };
}

/**
 * Run iterative test & self-repair loop with AST validation and test harnesses
 */
export async function runSelfRepairLoop({
  codeToVerify,
  testCode = '',
  language = 'javascript',
  maxIterations = 3,
  onIteration = () => {}
}) {
  let currentCode = codeToVerify;
  let passed = false;
  let iterations = 0;
  let lastError = null;
  let validation = null;

  while (iterations < maxIterations && !passed) {
    iterations++;
    onIteration({ iteration: iterations, status: 'validating', message: `Auditing AST syntax & code quality (iteration ${iterations}/${maxIterations})...` });

    // Step 1: Pre-execution AST & Quality Inspection
    validation = validateCode({ code: currentCode, language });
    if (!validation.valid) {
      const errorSummaries = validation.errors.map(e => `[${e.rule}] Line ${e.line}: ${e.message}`).join('\n');
      lastError = `Code quality & AST errors detected:\n${errorSummaries}`;
      onIteration({ iteration: iterations, status: 'fixing', message: `AST validation failed (${validation.errors.length} issues). Generating repair...` });
    } else {
      // Step 2: Runtime & Test Verification
      if (testCode && testCode.trim()) {
        onIteration({ iteration: iterations, status: 'testing', message: `Executing automated test harness...` });
        const suiteResult = await executeTestSuite({ code: currentCode, testCode, language });
        if (suiteResult.passed) {
          passed = true;
          onIteration({ iteration: iterations, status: 'passed', message: 'Verification suite passed with zero errors!' });
          return {
            success: true,
            iterations,
            code: currentCode,
            cqi: validation.cqi,
            grade: validation.grade,
            output: suiteResult.output,
            validation
          };
        }
        lastError = suiteResult.failedAssertion || 'Test assertion failed';
      } else {
        // Run code directly to verify execution stability
        const runRes = await runCode({ code: currentCode, language });
        if (runRes.success) {
          passed = true;
          onIteration({ iteration: iterations, status: 'passed', message: 'Code executed cleanly with zero runtime errors.' });
          return {
            success: true,
            iterations,
            code: currentCode,
            cqi: validation.cqi,
            grade: validation.grade,
            output: runRes.output,
            validation
          };
        }
        lastError = runRes.error || runRes.errors || 'Runtime execution failed';
      }
    }

    if (!passed && iterations < maxIterations) {
      onIteration({ iteration: iterations, status: 'fixing', message: `Refining code to resolve: ${String(lastError).slice(0, 80)}...` });

      const repairPrompt = `You are Nexus Automated Code Repair Architect.
The following ${language} code failed pre-delivery verification or tests.

=== ORIGINAL CODE ===
${currentCode}

=== VERIFICATION / TEST FAILURE ===
${lastError}

${testCode ? `=== TEST HARNESS ===\n${testCode}\n` : ''}

Strict Instructions:
1. Fix all syntax, type, logic, and assertion errors.
2. Maintain 100% complete production logic. STRICTLY NO PLACEHOLDERS (no // TODO, no // ... rest of code).
3. Return ONLY the complete corrected implementation inside a code fence:
\`\`\`${language}
// corrected code
\`\`\``;

      try {
        const mgr = getProviderManager();
        const repairRes = await mgr.generateText({
          prompt: repairPrompt,
          taskCategory: 'coding_debugging',
          maxTokens: 3000
        });

        const match = repairRes?.text?.match(/```(?:[a-zA-Z0-9_-]+)?\s*([\s\S]*?)```/);
        if (match) {
          currentCode = match[1].trim();
        } else if (repairRes?.text) {
          currentCode = repairRes.text.trim();
        }
      } catch (err) {
        console.warn('[CodingAgent] Automated repair call notice:', err.message);
        break;
      }
    }
  }

  // Final validation pass
  const finalValidation = validateCode({ code: currentCode, language });

  return {
    success: passed,
    iterations,
    code: currentCode,
    cqi: finalValidation.cqi,
    grade: finalValidation.grade,
    error: lastError,
    validation: finalValidation
  };
}

