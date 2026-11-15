import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const artifactDir = 'C:/Users/acer/.gemini/antigravity/brain/124539f6-51c5-41ee-bf25-22c5b6ad2b6d';

const filesToCheck = [
  'server.js',
  'worker.js',
  'database/postgresPool.js',
  'database/adapter.js',
  'services/storageService.js',
  'services/eventBus.js',
  'queue/jobQueue.js',
  'middleware/auth.js',
  'routes/jobRoutes.js',
  'routes/codeRoutes.js',
  'routes/gitRoutes.js',
  'routes/terminalRoutes.js',
  'routes/workspaceRoutes.js',
  'research/routes/researchRoutes.js',
  'vercel.json',
  'render.yaml',
  '.env.example',
  'README.md',
  'ARCHITECTURE.md',
  'DEPLOYMENT.md',
  'DATABASE_MIGRATION.md',
  'WORKER_GUIDE.md',
  'STORAGE_GUIDE.md',
  'SECURITY.md',
  'ENVIRONMENT_VARIABLES.md',
  'PRODUCTION_CHECKLIST.md',
  'ROLLBACK_PLAN.md',
  'tests/test-production-db-adapter.js',
  'tests/test-production-queue-worker.js',
  'tests/test-production-storage.js',
  'tests/test-production-health-ready.js',
  'tests/test-production-sse-realtime.js',
  'tests/test-production-simulation-e2e.js'
];

let violations = 0;
const tamilRegex = /[\u0B80-\u0BFF]/;

for (const file of filesToCheck) {
  const fullPath = path.resolve(rootDir, file);
  if (fs.existsSync(fullPath)) {
    const content = fs.readFileSync(fullPath, 'utf8');
    if (tamilRegex.test(content)) {
      console.error(`[VIOLATION] Found Tamil Unicode characters in root file: ${file}`);
      violations++;
    } else {
      console.log(`[PASS] Clean root: ${file}`);
    }
  }
}

// Check artifact directory
const docs = [
  'README.md',
  'ARCHITECTURE.md',
  'DEPLOYMENT.md',
  'DATABASE_MIGRATION.md',
  'WORKER_GUIDE.md',
  'STORAGE_GUIDE.md',
  'SECURITY.md',
  'ENVIRONMENT_VARIABLES.md',
  'PRODUCTION_CHECKLIST.md',
  'ROLLBACK_PLAN.md'
];

for (const doc of docs) {
  const fullPath = path.join(artifactDir, doc);
  if (fs.existsSync(fullPath)) {
    const content = fs.readFileSync(fullPath, 'utf8');
    if (tamilRegex.test(content)) {
      console.error(`[VIOLATION] Found Tamil Unicode characters in artifact file: ${doc}`);
      violations++;
    } else {
      console.log(`[PASS] Clean artifact: ${doc}`);
    }
  }
}

console.log(`\nExhaustive Language Policy Scan Result: ${violations} violations found.`);
process.exit(violations > 0 ? 1 : 0);
