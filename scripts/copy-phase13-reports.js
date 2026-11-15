import fs from 'fs';
import path from 'path';

const artifactDir = 'C:/Users/acer/.gemini/antigravity/brain/124539f6-51c5-41ee-bf25-22c5b6ad2b6d';
const reports = [
  'PRODUCTION_REALITY_AUDIT.md',
  'ARCHITECTURE_GAP_ANALYSIS.md',
  'DATABASE_INTEGRITY_REPORT.md',
  'SECURITY_VERIFICATION_REPORT.md',
  'WORKER_RELIABILITY_REPORT.md',
  'PRODUCTION_TEST_REPORT.md',
  'DEPLOYMENT_BLOCKERS.md',
  'FINAL_DEPLOYMENT_READINESS.md'
];

console.log('Copying 8 Phase 13 Reports to Artifacts Directory...');
const tamilRegex = /[\u0B80-\u0BFF]/;

for (const report of reports) {
  const content = fs.readFileSync(report, 'utf8');
  if (tamilRegex.test(content)) {
    console.error(`❌ Language policy violation in ${report}! Contains Tamil characters.`);
    process.exit(1);
  }
  const targetPath = path.join(artifactDir, report);
  fs.writeFileSync(targetPath, content, 'utf8');
  console.log(`✅ Copied ${report} -> ${targetPath}`);
}

console.log('\nAll 8 reports successfully copied and verified clean of Tamil Unicode!');
