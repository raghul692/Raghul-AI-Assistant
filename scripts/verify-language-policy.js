import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const artifactDir = 'C:/Users/acer/.gemini/antigravity/brain/124539f6-51c5-41ee-bf25-22c5b6ad2b6d';

const tamilRegex = /[\u0B80-\u0BFF]/;
const textExts = new Set(['.js', '.mjs', '.json', '.md', '.html', '.css', '.sql', '.yaml', '.yml', '.env', '.sh']);
let violations = 0;
let scannedFiles = 0;

function scanDirectory(dir) {
  if (!fs.existsSync(dir)) return;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (['node_modules', '.git', '.system_generated', '.playwright-mcp'].includes(entry.name)) continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      scanDirectory(fullPath);
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase();
      if (textExts.has(ext)) {
        scannedFiles++;
        try {
          const content = fs.readFileSync(fullPath, 'utf8');
          if (tamilRegex.test(content)) {
            console.error(`[VIOLATION] Found Tamil Unicode characters in: ${fullPath}`);
            violations++;
          }
        } catch (_) {}
      }
    }
  }
}

console.log('================================================================');
console.log('🔍 RAGHUL AI — EXHAUSTIVE STRICT LANGUAGE POLICY SCANNER');
console.log('================================================================\n');

scanDirectory(rootDir);
if (fs.existsSync(artifactDir)) {
  scanDirectory(artifactDir);
}

console.log(`\nExhaustive Language Policy Scan Complete.`);
console.log(`Scanned ${scannedFiles} text files across repository and artifact directories.`);
console.log(`Result: ${violations} violations found.`);

process.exit(violations > 0 ? 1 : 0);
