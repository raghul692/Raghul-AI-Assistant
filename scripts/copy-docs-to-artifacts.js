import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const targetDir = 'C:/Users/acer/.gemini/antigravity/brain/124539f6-51c5-41ee-bf25-22c5b6ad2b6d';

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

if (!fs.existsSync(targetDir)) {
  fs.mkdirSync(targetDir, { recursive: true });
}

let copied = 0;
for (const doc of docs) {
  const src = path.join(rootDir, doc);
  const dst = path.join(targetDir, doc);
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, dst);
    const srcSize = fs.statSync(src).size;
    const dstSize = fs.statSync(dst).size;
    console.log(`Copied ${doc}: ${srcSize} bytes -> ${dstSize} bytes`);
    copied++;
  } else {
    console.error(`Missing source doc: ${doc}`);
  }
}

console.log(`\nSuccessfully copied ${copied} / ${docs.length} documentation files to ${targetDir}`);
if (copied !== docs.length) {
  process.exit(1);
} else {
  process.exit(0);
}
