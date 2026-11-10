/**
 * ============================================================================
 * RAGHUL AI — ADVANCED CODE VALIDATOR & AST QUALITY GUARD
 * ============================================================================
 * Pre-delivery verification engine:
 * 1. AST syntax parsing (JavaScript, TypeScript, JSON, HTML, CSS, Python)
 * 2. Strict zero-placeholder enforcement
 * 3. Security vulnerability and antipattern detection
 * 4. Code Quality Index (CQI) scoring (0-100)
 */

import vm from 'node:vm';

/**
 * Forbidden placeholder patterns
 */
const PLACEHOLDER_PATTERNS = [
  { pattern: /\/\/\s*TODO\b/i, name: 'TODO comment placeholder' },
  { pattern: /\/\/\s*implement\s+(?:here|logic|code|later)\b/i, name: 'Unimplemented logic marker' },
  { pattern: /\/\/\s*\.{3}\s*(?:rest|more|existing|other)?\s*(?:of\s*code)?/i, name: 'Ellipsis truncation placeholder' },
  { pattern: /\/\*\s*(?:TODO|implement|rest\s*of\s*code|\.{3})\s*\*\//i, name: 'Block placeholder comment' },
  { pattern: /\bpass\s*#\s*(?:todo|implement|add\s*logic)/i, name: 'Python pass placeholder' },
  { pattern: /throw\s+new\s+(?:Error|NotImplementedException|NotImplementedError)\s*\(\s*['"](?:not\s*implemented|todo)/i, name: 'NotImplemented exception stub' }
];

/**
 * Security vulnerability and antipattern rules
 */
const SECURITY_PATTERNS = [
  {
    id: 'HARDCODED_SECRET',
    pattern: /(?:(?:api_?key|jwt_?secret|auth_?token|db_?password|private_?key|access_?secret)\s*[:=]\s*['"`][A-Za-z0-9_\-\.]{8,}['"`])/i,
    severity: 'HIGH',
    message: 'Potential hardcoded API key or credential secret detected. Use environment variables.'
  },
  {
    id: 'SQL_INJECTION_RISK',
    pattern: /(?:(?:execute|query|raw)\s*\(\s*['"`]\s*(?:SELECT|INSERT|UPDATE|DELETE))|(?:(?:SELECT|INSERT|UPDATE|DELETE|FROM)[\s\S]*?['"`]\s*\+\s*[a-zA-Z0-9_])|(?:\bWHERE\s+[a-zA-Z0-9_]+\s*=\s*['"`].*?['"`]\s*\+)/i,
    severity: 'HIGH',
    message: 'Raw SQL string concatenation detected. Use parameterized queries ($1, ?) to prevent SQL injection.'
  },
  {
    id: 'DANGEROUS_EVAL',
    pattern: /\b(?:eval\s*\(|new\s+Function\s*\(|setTimeout\s*\(\s*['"`])/i,
    severity: 'HIGH',
    message: 'Dynamic code execution (eval/Function) detected. This creates severe remote code execution vulnerabilities.'
  },
  {
    id: 'PROTOTYPE_POLLUTION',
    pattern: /(?:__proto__|prototype\s*\[\s*['"`]constructor['"`]\s*\])/i,
    severity: 'HIGH',
    message: 'Potential prototype pollution vulnerability pattern detected.'
  },
  {
    id: 'INSECURE_INNERHTML',
    pattern: /(?:\.innerHTML\s*=|\bdangerouslySetInnerHTML\b)/i,
    severity: 'MEDIUM',
    message: 'Unescaped HTML injection (innerHTML/dangerouslySetInnerHTML). Sanitize user content with DOMPurify.'
  },
  {
    id: 'WILDCARD_CORS_AUTH',
    pattern: /(?:origin\s*:\s*['"]\*['"][\s\S]*?(?:credentials\s*:\s*true|authorization))/i,
    severity: 'MEDIUM',
    message: 'Wildcard CORS origin paired with authenticated credentials is an insecure antipattern.'
  }
];

/**
 * Strip TypeScript type annotations to allow syntax check in node:vm
 */
function stripTypeScriptTypes(tsCode) {
  return tsCode
    // Remove type imports
    .replace(/import\s+type\s+[^;]+;/g, '')
    // Remove interface definitions
    .replace(/interface\s+[A-Za-z0-9_]+\s*(?:<[^>]+>)?\s*\{[\s\S]*?\}/g, '')
    // Remove type aliases
    .replace(/type\s+[A-Za-z0-9_]+\s*(?:<[^>]+>)?\s*=\s*[^;]+;/g, '')
    // Remove as Type assertions
    .replace(/\s+as\s+[A-Za-z0-9_<>[\]|&]+/g, '')
    // Remove function return types
    .replace(/\):\s*[A-Za-z0-9_<>[\]|&]+\s*=>/g, ') =>')
    .replace(/\):\s*[A-Za-z0-9_<>[\]|&]+\s*\{/g, ') {')
    // Remove parameter types
    .replace(/:\s*[A-Za-z0-9_<>[\]|&]+/g, '');
}

/**
 * Validate syntax for JavaScript / TypeScript
 */
function validateJsSyntax(code, isTypeScript = false) {
  const errors = [];
  const codeToTest = isTypeScript ? stripTypeScriptTypes(code) : code;

  try {
    // Attempt parsing as a Script
    new vm.Script(codeToTest, { displayErrors: true });
  } catch (scriptErr) {
    // If top-level 'import' or 'export' caused a SyntaxError, test as a module wrapper
    if (scriptErr.message.includes('Cannot use import statement') || scriptErr.message.includes('Unexpected token \'export\'')) {
      try {
        // Wrap inside an async function or compileFunction test
        const wrapped = `(async function() {\n${codeToTest.replace(/^export\s+(default\s+)?/gm, '').replace(/^import\s+[^;]+;/gm, '')}\n})()`;
        new vm.Script(wrapped, { displayErrors: true });
      } catch (wrapErr) {
        errors.push({
          line: wrapErr.stack?.match(/evalmachine\.<anonymous>:(\d+)/)?.[1] || 1,
          message: wrapErr.message,
          rule: 'SYNTAX_ERROR'
        });
      }
    } else {
      errors.push({
        line: scriptErr.stack?.match(/evalmachine\.<anonymous>:(\d+)/)?.[1] || 1,
        message: scriptErr.message,
        rule: 'SYNTAX_ERROR'
      });
    }
  }

  return errors;
}

/**
 * Validate JSON syntax
 */
function validateJsonSyntax(code) {
  const errors = [];
  try {
    JSON.parse(code);
  } catch (err) {
    errors.push({
      line: 1,
      message: 'Invalid JSON format: ' + err.message,
      rule: 'JSON_SYNTAX_ERROR'
    });
  }
  return errors;
}

/**
 * Validate HTML document balance
 */
function validateHtmlSyntax(code) {
  const errors = [];
  const openTags = [];
  const voidTags = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr']);
  const tagRegex = /<\/?([a-zA-Z0-9\-]+)(?:\s+[^>]*?)?(\/?)>/g;

  let match;
  while ((match = tagRegex.exec(code)) !== null) {
    const fullTag = match[0];
    const tagName = match[1].toLowerCase();
    const isSelfClosing = match[2] === '/' || voidTags.has(tagName) || fullTag.endsWith('/>');
    const isClosing = fullTag.startsWith('</');

    if (isSelfClosing) continue;

    if (isClosing) {
      if (openTags.length === 0) {
        errors.push({
          line: 1,
          message: `Unexpected closing tag </${tagName}> without matching open tag.`,
          rule: 'HTML_TAG_MISMATCH'
        });
      } else {
        const last = openTags.pop();
        if (last !== tagName) {
          errors.push({
            line: 1,
            message: `Mismatched HTML tags: expected </${last}> but found </${tagName}>.`,
            rule: 'HTML_TAG_MISMATCH'
          });
        }
      }
    } else {
      openTags.push(tagName);
    }
  }

  if (openTags.length > 0) {
    errors.push({
      line: 1,
      message: `Unclosed HTML tag(s): <${openTags.join('>, <')}>`,
      rule: 'HTML_UNCLOSED_TAG'
    });
  }

  return errors;
}

/**
 * Validate CSS braces balance
 */
function validateCssSyntax(code) {
  const errors = [];
  let openBraces = 0;
  for (let i = 0; i < code.length; i++) {
    if (code[i] === '{') openBraces++;
    if (code[i] === '}') {
      openBraces--;
      if (openBraces < 0) {
        errors.push({ line: 1, message: 'Unmatched closing brace "}" in CSS.', rule: 'CSS_BRACE_MISMATCH' });
        break;
      }
    }
  }
  if (openBraces > 0) {
    errors.push({ line: 1, message: `Unclosed block in CSS (${openBraces} missing "}" braces).`, rule: 'CSS_UNCLOSED_BLOCK' });
  }
  return errors;
}

/**
 * Scan for forbidden placeholders
 */
export function detectPlaceholders(code) {
  const findings = [];
  const lines = code.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const lineNum = i + 1;
    const lineText = lines[i];

    for (const p of PLACEHOLDER_PATTERNS) {
      if (p.pattern.test(lineText)) {
        findings.push({
          line: lineNum,
          rule: 'FORBIDDEN_PLACEHOLDER',
          message: `Forbidden placeholder detected: ${p.name} on line ${lineNum}`,
          snippet: lineText.trim()
        });
      }
    }
  }

  return findings;
}

/**
 * Scan for security antipatterns
 */
export function scanSecurityVulnerabilities(code) {
  const warnings = [];
  const lines = code.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const lineNum = i + 1;
    const lineText = lines[i];

    for (const rule of SECURITY_PATTERNS) {
      if (rule.pattern.test(lineText)) {
        warnings.push({
          line: lineNum,
          rule: rule.id,
          severity: rule.severity,
          message: rule.message,
          snippet: lineText.trim()
        });
      }
    }
  }

  return warnings;
}

/**
 * Master Code Validation & Quality Indexing
 */
export function validateCode({ code = '', language = 'javascript', filePath = '' }) {
  if (!code || typeof code !== 'string') {
    return {
      valid: false,
      cqi: 0,
      grade: 'F',
      errors: [{ line: 0, message: 'Empty or invalid code string provided', rule: 'EMPTY_CODE' }],
      warnings: [],
      metrics: { syntax: 0, completeness: 0, security: 0, maintainability: 0 }
    };
  }

  const cleanLang = language.toLowerCase();
  const errors = [];
  const warnings = [];

  // 1. AST Syntax Parsing
  if (['javascript', 'js', 'mjs', 'cjs'].includes(cleanLang)) {
    const syntaxErrors = validateJsSyntax(code, false);
    errors.push(...syntaxErrors);
  } else if (['typescript', 'ts', 'tsx'].includes(cleanLang)) {
    const syntaxErrors = validateJsSyntax(code, true);
    errors.push(...syntaxErrors);
  } else if (cleanLang === 'json') {
    const jsonErrors = validateJsonSyntax(code);
    errors.push(...jsonErrors);
  } else if (['html', 'htm'].includes(cleanLang)) {
    const htmlErrors = validateHtmlSyntax(code);
    errors.push(...htmlErrors);
  } else if (cleanLang === 'css') {
    const cssErrors = validateCssSyntax(code);
    errors.push(...cssErrors);
  }

  // 2. Placeholder Detection
  const placeholders = detectPlaceholders(code);
  for (const ph of placeholders) {
    errors.push({
      line: ph.line,
      message: ph.message,
      rule: ph.rule,
      snippet: ph.snippet
    });
  }

  // 3. Security Vulnerability Scan
  const securityIssues = scanSecurityVulnerabilities(code);
  for (const sec of securityIssues) {
    if (sec.severity === 'HIGH') {
      errors.push({
        line: sec.line,
        message: sec.message,
        rule: sec.rule,
        snippet: sec.snippet
      });
    } else {
      warnings.push({
        line: sec.line,
        message: sec.message,
        rule: sec.rule,
        snippet: sec.snippet
      });
    }
  }

  // 4. Calculate Code Quality Index (CQI)
  let syntaxScore = errors.some(e => e.rule.includes('SYNTAX')) ? 0 : 40;
  let completenessScore = placeholders.length > 0 ? 0 : 25;
  let securityScore = 25 - (errors.filter(e => e.rule.includes('SECURITY') || e.rule === 'HARDCODED_SECRET' || e.rule === 'SQL_INJECTION_RISK').length * 15) - (warnings.length * 5);
  if (securityScore < 0) securityScore = 0;

  // Maintainability & Comments
  let maintainabilityScore = 10;
  if (code.length > 50 && !/\/\/|\/\*|"""|'''|<!--/.test(code)) {
    maintainabilityScore -= 3; // Minor deduction if zero comments in non-trivial code
  }

  const cqi = Math.max(0, Math.min(100, syntaxScore + completenessScore + securityScore + maintainabilityScore));

  let grade = 'F';
  if (cqi >= 90) grade = 'A+';
  else if (cqi >= 80) grade = 'A';
  else if (cqi >= 70) grade = 'B';
  else if (cqi >= 50) grade = 'C';

  return {
    valid: errors.length === 0,
    cqi,
    grade,
    language: cleanLang,
    filePath,
    errors,
    warnings,
    metrics: {
      syntax: syntaxScore,
      completeness: completenessScore,
      security: securityScore,
      maintainability: maintainabilityScore
    }
  };
}

/**
 * Validate an entire multi-file project
 */
export function validateProjectFiles(files = []) {
  const fileResults = files.map(file => {
    const res = validateCode({
      code: file.content || '',
      language: file.language || 'javascript',
      filePath: file.name || 'unnamed'
    });
    return {
      fileName: file.name || 'unnamed',
      language: file.language,
      ...res
    };
  });

  const totalCqi = fileResults.length > 0
    ? Math.round(fileResults.reduce((acc, f) => acc + f.cqi, 0) / fileResults.length)
    : 100;

  const allValid = fileResults.every(f => f.valid);
  const totalErrors = fileResults.reduce((acc, f) => acc + f.errors.length, 0);
  const totalWarnings = fileResults.reduce((acc, f) => acc + f.warnings.length, 0);

  return {
    valid: allValid,
    projectCqi: totalCqi,
    totalFiles: fileResults.length,
    totalErrors,
    totalWarnings,
    files: fileResults
  };
}
