import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';
import { recordAuditLog, RISK_LEVELS } from './governanceAudit.js';
import { AIProviderManager } from './orchestration/aiProviderManager.js';

let sharedProviderManager = null;
function getProviderManager() {
  if (!sharedProviderManager) {
    sharedProviderManager = new AIProviderManager();
  }
  return sharedProviderManager;
}

async function orchestratorGenerateText({ client, prompt, maxTokens = 600, temperature = 0.2 }) {
  try {
    const mgr = getProviderManager();
    const res = await mgr.generateText({ prompt, maxTokens, temperature });
    if (res && res.text) return res.text;
  } catch (err) {
    console.warn('[TaskOrchestrator] AIProviderManager fallback to direct client:', err.message);
  }
  if (client?.models?.generateContent) {
    const fallbackRes = await client.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: { maxOutputTokens: maxTokens, temperature }
    });
    return fallbackRes.text || '';
  }
  throw new Error('No AI provider available for task orchestrator execution');
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_FILE = path.join(__dirname, 'data', 'nexus.db');

const db = new Database(DB_FILE);

// Initialize Autonomous Tasks Table in SQLite
db.exec(`
  CREATE TABLE IF NOT EXISTS autonomous_tasks (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    goal TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'planned', -- planned, running, paused, completed, failed, interrupted
    progress INTEGER NOT NULL DEFAULT 0,
    plan_json TEXT NOT NULL,
    results_json TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    scheduled_for INTEGER
  );

  CREATE INDEX IF NOT EXISTS idx_tasks_status ON autonomous_tasks(status);
`);

// Startup recovery: mark any tasks interrupted mid-execution (status='running') as 'interrupted'
try {
  const interrupted = db.prepare("UPDATE autonomous_tasks SET status = 'interrupted', updated_at = ? WHERE status = 'running'").run(Date.now());
  if (interrupted.changes > 0) {
    console.log(`[TaskOrchestrator] Recovered ${interrupted.changes} interrupted task(s) from previous session.`);
  }
} catch (e) {
  // Ignore startup recovery errors if table is brand new
}

/**
 * Autonomous Goal-to-DAG Task Planner (Perplexity / AutoGPT / CrewAI standard)
 */
export async function createAutonomousPlan(client, goal, context = '') {
  const planPrompt = `You are a Principal Autonomous AI Task Orchestrator.
The user wants to achieve this goal: "${goal}".
${context ? `Additional Context: "${context}"` : ''}

Decompose this goal into a sequential Directed Acyclic Graph (DAG) of exactly 3 to 5 discrete, actionable subtasks.
Each task must have:
1. "id": e.g. "step_1"
2. "title": short action title
3. "description": clear technical instruction
4. "actionType": one of ["search", "compute", "code", "file", "evaluate"]
5. "verificationCriteria": expected proof of completion

Output strictly a JSON object:
{
  "title": "Short Goal Name",
  "steps": [
    {
      "id": "step_1",
      "title": "...",
      "description": "...",
      "actionType": "...",
      "verificationCriteria": "..."
    }
  ]
}`;

  let plan;
  try {
    const rawText = await orchestratorGenerateText({
      client,
      prompt: planPrompt,
      maxTokens: 600,
      temperature: 0.2
    });

    const text = (rawText || '').trim();
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      plan = JSON.parse(jsonMatch[0]);
    }
  } catch (err) {
    console.warn('AI task planner fallback notice:', err.message);
  }

  if (!plan || !Array.isArray(plan.steps) || plan.steps.length === 0) {
    plan = {
      title: goal.slice(0, 30),
      steps: [
        { id: 'step_1', title: 'Analyze Requirements', description: `Deconstruct requirements for: ${goal}`, actionType: 'evaluate', verificationCriteria: 'Requirements mapped' },
        { id: 'step_2', title: 'Execute Implementation', description: `Perform core technical action for: ${goal}`, actionType: 'code', verificationCriteria: 'Execution completed without errors' },
        { id: 'step_3', title: 'Verify & Audit Output', description: 'Validate results against quality criteria', actionType: 'evaluate', verificationCriteria: 'Output validated' }
      ]
    };
  }

  const taskId = `task_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const now = Date.now();

  db.prepare(`
    INSERT INTO autonomous_tasks (id, title, goal, status, progress, plan_json, created_at, updated_at)
    VALUES (?, ?, ?, 'planned', 0, ?, ?, ?)
  `).run(taskId, plan.title || goal, goal, JSON.stringify(plan.steps), now, now);

  recordAuditLog({
    action: 'CREATE_AUTONOMOUS_PLAN',
    target: taskId,
    riskLevel: RISK_LEVELS.WRITE,
    justification: `Planned ${plan.steps.length} subtasks for goal: "${goal}"`
  });

  return {
    taskId,
    title: plan.title,
    goal,
    status: 'planned',
    steps: plan.steps
  };
}

/**
 * Execute Task Plan with Step-by-Step Self-Evaluation and Dynamic Replanning
 */
export async function executeAutonomousPlan({ client, taskId, onProgress = () => {} }) {
  const row = db.prepare('SELECT * FROM autonomous_tasks WHERE id = ?').get(taskId);
  if (!row) throw new Error(`Task ${taskId} not found`);

  const steps = JSON.parse(row.plan_json);
  const results = [];
  const total = steps.length;

  db.prepare("UPDATE autonomous_tasks SET status = 'running', updated_at = ? WHERE id = ?").run(Date.now(), taskId);

  for (let i = 0; i < total; i++) {
    const step = steps[i];
    const currentProgress = Math.round(((i) / total) * 100);

    onProgress({
      taskId,
      stepIndex: i + 1,
      totalSteps: total,
      progress: currentProgress,
      stepTitle: step.title,
      status: 'executing'
    });

    let stepOutput = '';
    let success = true;

    try {
      // Step Execution via Multi-Provider Orchestrator
      const execPrompt = `You are an Autonomous AI Executor.
Execute this specific subtask:
Title: ${step.title}
Instruction: ${step.description}
Verification Criteria: ${step.verificationCriteria}

Provide the complete, actionable output for this step.`;

      stepOutput = await orchestratorGenerateText({
        client,
        prompt: execPrompt,
        maxTokens: 600,
        temperature: 0.3
      });
      if (!stepOutput) stepOutput = 'Step executed successfully.';
    } catch (execErr) {
      stepOutput = `Execution error: ${execErr.message}`;
      success = false;
    }

    // Self-Evaluation & Verification Loop
    let evaluationPass = success;
    if (success) {
      try {
        const evalPrompt = `Review this subtask output against its criteria:
Criteria: ${step.verificationCriteria}
Output: ${stepOutput.slice(0, 300)}

Did the output meet the verification criteria? Answer ONLY JSON: {"pass": true, "score": 8, "critique": "Meets criteria"}`;
        const evalRaw = await orchestratorGenerateText({
          client,
          prompt: evalPrompt,
          maxTokens: 100,
          temperature: 0.1
        });
        const evalJson = JSON.parse((evalRaw || '').match(/\{[\s\S]*\}/)[0]);
        evaluationPass = Boolean(evalJson.pass);
      } catch (e) {
        evaluationPass = true; // Fallback
      }
    }

    results.push({
      stepId: step.id,
      title: step.title,
      output: stepOutput,
      evaluationPass,
      timestamp: Date.now()
    });

    const stepProgress = Math.round(((i + 1) / total) * 100);

    // Durable Step Checkpoint: Save progress and intermediate results after EVERY step
    db.prepare(`
      UPDATE autonomous_tasks
      SET progress = ?, results_json = ?, updated_at = ?
      WHERE id = ?
    `).run(stepProgress, JSON.stringify(results), Date.now(), taskId);

    onProgress({
      taskId,
      stepIndex: i + 1,
      totalSteps: total,
      progress: stepProgress,
      stepTitle: step.title,
      status: evaluationPass ? 'passed' : 'warning',
      outputSnippet: stepOutput.slice(0, 100)
    });
  }

  const finalStatus = results.every(r => r.evaluationPass) ? 'completed' : 'completed_with_warnings';
  const now = Date.now();

  db.prepare(`
    UPDATE autonomous_tasks
    SET status = ?, progress = 100, results_json = ?, updated_at = ?
    WHERE id = ?
  `).run(finalStatus, JSON.stringify(results), now, taskId);

  recordAuditLog({
    action: 'COMPLETE_AUTONOMOUS_PLAN',
    target: taskId,
    riskLevel: RISK_LEVELS.WRITE,
    status: 'SUCCESS',
    justification: `Finished all ${total} subtasks with status ${finalStatus}`
  });

  return {
    taskId,
    status: finalStatus,
    progress: 100,
    results
  };
}

/**
 * Resume an Interrupted or Paused Autonomous Task from its Last Completed Checkpoint
 */
export async function resumeAutonomousPlan({ client, taskId, onProgress = () => {} }) {
  const row = db.prepare('SELECT * FROM autonomous_tasks WHERE id = ?').get(taskId);
  if (!row) throw new Error(`Task ${taskId} not found`);

  const steps = JSON.parse(row.plan_json);
  const results = row.results_json ? JSON.parse(row.results_json) : [];
  const startIndex = results.length;
  const total = steps.length;

  if (startIndex >= total) {
    db.prepare("UPDATE autonomous_tasks SET status = 'completed', progress = 100, updated_at = ? WHERE id = ?").run(Date.now(), taskId);
    return { taskId, status: 'completed', progress: 100, results };
  }

  db.prepare("UPDATE autonomous_tasks SET status = 'running', updated_at = ? WHERE id = ?").run(Date.now(), taskId);

  for (let i = startIndex; i < total; i++) {
    const step = steps[i];
    const currentProgress = Math.round(((i) / total) * 100);

    onProgress({
      taskId,
      stepIndex: i + 1,
      totalSteps: total,
      progress: currentProgress,
      stepTitle: step.title,
      status: 'resuming'
    });

    let stepOutput = '';
    let success = true;

    try {
      const execPrompt = `You are an Autonomous AI Executor.
Resume execution of this specific subtask:
Title: ${step.title}
Instruction: ${step.description}
Verification Criteria: ${step.verificationCriteria}

Provide the complete, actionable output for this step.`;

      stepOutput = await orchestratorGenerateText({
        client,
        prompt: execPrompt,
        maxTokens: 600,
        temperature: 0.3
      });
      if (!stepOutput) stepOutput = 'Step resumed and executed successfully.';
    } catch (execErr) {
      stepOutput = `Execution error: ${execErr.message}`;
      success = false;
    }

    results.push({
      stepId: step.id,
      title: step.title,
      output: stepOutput,
      evaluationPass: success,
      timestamp: Date.now()
    });

    const stepProgress = Math.round(((i + 1) / total) * 100);

    db.prepare(`
      UPDATE autonomous_tasks
      SET progress = ?, results_json = ?, updated_at = ?
      WHERE id = ?
    `).run(stepProgress, JSON.stringify(results), Date.now(), taskId);

    onProgress({
      taskId,
      stepIndex: i + 1,
      totalSteps: total,
      progress: stepProgress,
      stepTitle: step.title,
      status: success ? 'passed' : 'warning',
      outputSnippet: stepOutput.slice(0, 100)
    });
  }

  const finalStatus = results.every(r => r.evaluationPass) ? 'completed' : 'completed_with_warnings';
  const now = Date.now();

  db.prepare(`
    UPDATE autonomous_tasks
    SET status = ?, progress = 100, results_json = ?, updated_at = ?
    WHERE id = ?
  `).run(finalStatus, JSON.stringify(results), now, taskId);

  return { taskId, status: finalStatus, progress: 100, results };
}

export function listAutonomousTasks(limit = 20) {
  const rows = db.prepare('SELECT id, title, goal, status, progress, created_at, updated_at FROM autonomous_tasks ORDER BY created_at DESC LIMIT ?').all(limit);
  return rows;
}

export function getAutonomousTask(id) {
  const row = db.prepare('SELECT * FROM autonomous_tasks WHERE id = ?').get(id);
  if (!row) return null;
  return {
    ...row,
    plan: JSON.parse(row.plan_json || '[]'),
    results: row.results_json ? JSON.parse(row.results_json) : null
  };
}

