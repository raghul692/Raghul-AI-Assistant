/**
 * RAGHUL AI — MASTER UNIFIED TEST HARNESS
 * Sequentially executes all core test suites and reports unified exit status.
 */

import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');

const SUITES = [
  { name: 'Repository Extraction & Regex Boundaries', file: 'tests/verify-repo-extraction.js' },
  { name: 'Intent Classification & Mutual Exclusion', file: 'tests/verify-intent-routing.js' },
  { name: 'Safe Read-Only GitHub Agent', file: 'tests/verify-github-agent-safe.js' },
  { name: 'Stage 4: Multi-Agent Orchestration & Supervisor', file: 'tests/test-stage4-orchestration.js' },
  { name: 'Stage 5: Publishing & PDF Publishing Engine', file: 'tests/test-stage5-publishing.js' },
  { name: 'Stage 6: Workspace UI & SSE Integration', file: 'tests/test-stage6-workspace.js' },
  { name: 'Stage 7: Security Guardrails & SSRF Protection', file: 'tests/test-stage7-security.js' },
  { name: 'Stage 8: Benchmark Topologies & Evaluation', file: 'tests/test-stage8-benchmark.js' },
  { name: 'Audited Real Executed Deep Research Job', file: 'tests/verify-completed-job.js' },
  { name: 'Stage 10: Advanced AI Coding Engine & AST Validator', file: 'tests/test-coding-engine.js' },
  { name: 'Stage 11: Canvas Studio IDE, Terminal & Workspace', file: 'tests/test-canvas-studio-ide.js' },
  { name: 'Stage 12: Portfolio OS Intelligence, Governance & Real-Time Telemetry', file: 'tests/test-portfolio-intelligence.js' }
];

async function runSuite(suite) {
  const startTime = Date.now();
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [path.resolve(PROJECT_ROOT, suite.file)], {
      cwd: PROJECT_ROOT,
      env: process.env,
      stdio: 'inherit'
    });

    child.on('close', (code) => {
      const durationMs = Date.now() - startTime;
      resolve({
        name: suite.name,
        file: suite.file,
        passed: code === 0,
        code,
        durationMs
      });
    });

    child.on('error', (err) => {
      resolve({
        name: suite.name,
        file: suite.file,
        passed: false,
        error: err.message,
        durationMs: Date.now() - startTime
      });
    });
  });
}

async function runAll() {
  console.log('================================================================');
  console.log('🚀 RAGHUL AI — EXECUTING MASTER TEST SUITE (NPM TEST)');
  console.log('================================================================\n');

  const totalStart = Date.now();
  const results = [];

  for (const suite of SUITES) {
    console.log(`\n▶️ Running: ${suite.name} (${suite.file})...`);
    const res = await runSuite(suite);
    results.push(res);
  }

  const totalDuration = ((Date.now() - totalStart) / 1000).toFixed(1);
  const passedCount = results.filter(r => r.passed).length;
  const failedCount = results.filter(r => !r.passed).length;

  console.log('\n================================================================');
  console.log(`📊 MASTER TEST SUMMARY: ${passedCount} / ${results.length} Suites Passed (${totalDuration}s)`);
  console.log('================================================================');

  results.forEach(r => {
    const mark = r.passed ? '✅' : '❌';
    console.log(`${mark} [${r.passed ? 'PASS' : 'FAIL'}] ${r.name} (${(r.durationMs / 1000).toFixed(1)}s)`);
  });

  if (failedCount > 0) {
    console.error(`\n❌ Master test run failed with ${failedCount} failing suites.`);
    process.exit(1);
  } else {
    console.log('\n🎉 All test suites passed with 100% success rate.');
    process.exit(0);
  }
}

runAll().catch(err => {
  console.error('Fatal harness error:', err);
  process.exit(1);
});

