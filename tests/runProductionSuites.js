import { spawnSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const productionSuites = [
  'tests/test-production-db-adapter.js',
  'tests/test-production-queue-worker.js',
  'tests/test-production-storage.js',
  'tests/test-production-health-ready.js',
  'tests/test-production-sse-realtime.js',
  'tests/test-production-simulation-e2e.js'
];

console.log('================================================================');
console.log('🚀 RAGHUL AI — RUNNING PRODUCTION VERIFICATION SUITES');
console.log('================================================================\n');

let passedCount = 0;
let failedCount = 0;

for (const suite of productionSuites) {
  console.log(`▶️ Executing: ${suite}...`);
  const fullPath = path.resolve(rootDir, suite);
  const result = spawnSync('node', [fullPath], {
    cwd: rootDir,
    stdio: 'inherit',
    env: process.env
  });

  if (result.status === 0) {
    passedCount++;
    console.log(`✅ [PASS] ${suite}\n`);
  } else {
    failedCount++;
    console.error(`❌ [FAIL] ${suite} (Exit code: ${result.status})\n`);
  }
}

console.log('================================================================');
console.log(`PRODUCTION SUITE SUMMARY: ${passedCount} Passed, ${failedCount} Failed`);
console.log('================================================================');

process.exit(failedCount > 0 ? 1 : 0);
