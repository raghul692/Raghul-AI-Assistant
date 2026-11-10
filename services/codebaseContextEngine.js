/**
 * ============================================================================
 * RAGHUL AI — CODEBASE CONTEXT & DEPENDENCY GRAPH ANALYZER
 * ============================================================================
 * Analyzes workspace structure, packages, dependencies, and symbols:
 * 1. Project type detection (Node.js, Python, Go, Rust, Java)
 * 2. Dependency and configuration indexing
 * 3. File symbol extraction (classes, exports, functions, routes)
 * 4. Architectural context generator for LLM prompts
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const WORKSPACE_ROOT = path.resolve(__dirname, '..');

/**
 * Detect project type and package configurations
 */
export function detectProjectType(rootDir = WORKSPACE_ROOT) {
  const configs = [];

  const packageJsonPath = path.join(rootDir, 'package.json');
  if (fs.existsSync(packageJsonPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
      configs.push({
        type: 'node',
        name: pkg.name || 'unnamed-node-project',
        version: pkg.version || '1.0.0',
        main: pkg.main || 'index.js',
        scripts: Object.keys(pkg.scripts || {}),
        dependencies: Object.keys(pkg.dependencies || {}),
        devDependencies: Object.keys(pkg.devDependencies || {})
      });
    } catch {
      // Ignore parse failure
    }
  }

  if (fs.existsSync(path.join(rootDir, 'requirements.txt')) || fs.existsSync(path.join(rootDir, 'pyproject.toml'))) {
    configs.push({ type: 'python', name: 'python-project' });
  }

  if (fs.existsSync(path.join(rootDir, 'go.mod'))) {
    configs.push({ type: 'go', name: 'go-project' });
  }

  return configs;
}

/**
 * Extract symbols (functions, classes, exports) from source file
 */
export function extractFileSymbols(content = '', language = 'javascript') {
  const symbols = [];
  const lines = content.split('\n');

  // Regex patterns for symbols
  const patterns = [
    { type: 'class', regex: /class\s+([A-Za-z0-9_]+)/ },
    { type: 'function', regex: /(?:export\s+)?(?:async\s+)?function\s+([A-Za-z0-9_]+)/ },
    { type: 'const_fn', regex: /(?:export\s+)?const\s+([A-Za-z0-9_]+)\s*=\s*(?:async\s*)?\([^)]*\)\s*=>/ },
    { type: 'route', regex: /(?:router|app)\.(get|post|put|delete|patch)\s*\(\s*['"]([^'"]+)['"]/ }
  ];

  for (let i = 0; i < lines.length; i++) {
    const lineNum = i + 1;
    const line = lines[i].trim();

    for (const p of patterns) {
      const match = line.match(p.regex);
      if (match) {
        if (p.type === 'route') {
          symbols.push({
            type: 'route',
            method: match[1].toUpperCase(),
            path: match[2],
            line: lineNum
          });
        } else {
          symbols.push({
            type: p.type,
            name: match[1],
            line: lineNum
          });
        }
      }
    }
  }

  return symbols;
}

/**
 * Generate high-level workspace architectural context summary
 */
export function getWorkspaceContextSummary(rootDir = WORKSPACE_ROOT) {
  const projectTypes = detectProjectType(rootDir);
  const nodeProject = projectTypes.find(p => p.type === 'node');

  const summary = {
    root: path.basename(rootDir),
    projectTypes: projectTypes.map(p => p.type),
    nodeDetails: nodeProject ? {
      name: nodeProject.name,
      version: nodeProject.version,
      keyDependencies: nodeProject.dependencies.slice(0, 15),
      keyScripts: nodeProject.scripts
    } : null,
    structure: []
  };

  const keyDirs = ['routes', 'services', 'orchestration', 'research', 'public', 'tests'];
  for (const dir of keyDirs) {
    const fullDir = path.join(rootDir, dir);
    if (fs.existsSync(fullDir)) {
      try {
        const files = fs.readdirSync(fullDir)
          .filter(f => !f.startsWith('.') && fs.statSync(path.join(fullDir, f)).isFile())
          .slice(0, 10);
        summary.structure.push({ directory: dir, fileCount: files.length, sampleFiles: files });
      } catch {
        // Ignore read errors
      }
    }
  }

  return summary;
}

