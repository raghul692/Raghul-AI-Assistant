import vm from 'node:vm';

/**
 * Safe Mathematical Expression Evaluator
 * Evaluates arithmetic, trigonometry, powers, percentages without eval
 */
export function calculateTool(expression) {
  if (!expression || typeof expression !== 'string') {
    return { error: 'Invalid expression' };
  }

  let sanitized = expression
    .trim()
    .replace(/×/g, '*')
    .replace(/÷/g, '/')
    .replace(/(\d+)%/g, '($1/100)')
    .replace(/\^/g, '**');

  // Math functions mapping
  const mathScope = {
    sqrt: Math.sqrt,
    cbrt: Math.cbrt,
    sin: (x) => Math.sin((x * Math.PI) / 180),
    cos: (x) => Math.cos((x * Math.PI) / 180),
    tan: (x) => Math.tan((x * Math.PI) / 180),
    asin: Math.asin,
    acos: Math.acos,
    atan: Math.atan,
    log: Math.log10,
    ln: Math.log,
    abs: Math.abs,
    round: Math.round,
    floor: Math.floor,
    ceil: Math.ceil,
    min: Math.min,
    max: Math.max,
    pi: Math.PI,
    PI: Math.PI,
    e: Math.E,
    E: Math.E
  };

  // Only allow valid mathematical characters, numbers, and allowed function names
  const allowedChars = /^[\d\s+\-*/().,%^a-zA-Z_]+$/;
  if (!allowedChars.test(sanitized)) {
    return { error: 'Expression contains disallowed characters' };
  }

  try {
    const script = new vm.Script(`result = (${sanitized})`);
    const context = vm.createContext({ ...mathScope, result: null });
    script.runInContext(context, { timeout: 1000 });
    const result = context.result;

    if (typeof result !== 'number' || isNaN(result)) {
      return { error: 'Could not compute a valid numeric result' };
    }

    return {
      success: true,
      expression,
      result: Number.isInteger(result) ? result : Number(result.toFixed(8)),
      formatted: Number.isInteger(result) ? result.toLocaleString() : result.toString()
    };
  } catch (err) {
    return { error: 'Calculation failed: ' + err.message };
  }
}

/**
 * Sandboxed Code Runner (JavaScript / Node.js runtime)
 * Runs code in a secured VM with timeout, memory isolation, and output capture
 */
export function runCodeSandboxTool(language, code) {
  if (!code || typeof code !== 'string') {
    return { error: 'Code is required' };
  }

  // Security guard against prototype chain reflection escapes and host process access
  const dangerousPatterns = [
    /constructor\s*\.\s*constructor/i,
    /__proto__/i,
    /process\s*\.\s*(mainModule|binding|dlopen|env|exit)/i,
    /require\s*\(/i,
    /import\s*\(/i,
    /child_process/i,
    /fs\s*\.\s*/i
  ];

  for (const pat of dangerousPatterns) {
    if (pat.test(code)) {
      return {
        success: false,
        language: language || 'javascript',
        output: '',
        error: 'Security Violation: Sandboxed execution blocked potentially unsafe reflection or process escape pattern.',
        durationMs: 0
      };
    }
  }

  const logs = [];
  const errors = [];

  const sandbox = {
    console: {
      log: (...args) => logs.push(args.map(a => typeof a === 'object' ? JSON.stringify(a, null, 2) : String(a)).join(' ')),
      error: (...args) => errors.push(args.map(a => String(a)).join(' ')),
      warn: (...args) => logs.push('[WARN] ' + args.map(a => String(a)).join(' ')),
      info: (...args) => logs.push('[INFO] ' + args.map(a => String(a)).join(' '))
    },
    Math,
    Date,
    JSON,
    Array,
    Object,
    String,
    Number,
    Boolean,
    RegExp,
    Map,
    Set,
    parseInt,
    parseFloat,
    isNaN,
    isFinite
  };

  const startTime = Date.now();
  try {
    const context = vm.createContext(sandbox);
    const script = new vm.Script(code);
    const result = script.runInContext(context, {
      timeout: 2500, // max 2.5s execution time
      displayErrors: true
    });
    const durationMs = Date.now() - startTime;

    return {
      success: true,
      language: language || 'javascript',
      output: logs.join('\n') || (result !== undefined ? JSON.stringify(result, null, 2) : '(Executed with no output)'),
      returnedValue: result !== undefined ? String(result) : null,
      errors: errors.join('\n') || null,
      durationMs
    };
  } catch (err) {
    return {
      success: false,
      language: language || 'javascript',
      output: logs.join('\n'),
      error: err.message,
      durationMs: Date.now() - startTime
    };
  }
}

/**
 * Live Web Search Tool
 * Automatically queries DuckDuckGo HTML / Instant Answers for fresh external data
 */
export async function searchWebTool(query) {
  if (!query || typeof query !== 'string') return { error: 'Search query is required' };
  const cleanQuery = query.trim();

  try {
    const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(cleanQuery)}`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
      },
      signal: AbortSignal.timeout(6000)
    });

    if (!res.ok) throw new Error(`Search returned status ${res.status}`);
    const html = await res.text();

    const results = [];
    const resultRegex = /<a class="result__url"[^>]*href="([^"]+)"[^>]*>[\s\S]*?<a class="result__snippet"[^>]*>([\s\S]*?)<\/a>/gi;
    let match;
    while ((match = resultRegex.exec(html)) !== null && results.length < 4) {
      let link = match[1];
      const uddgMatch = link.match(/uddg=([^&]+)/);
      if (uddgMatch) {
        link = decodeURIComponent(uddgMatch[1]);
      }
      const snippet = match[2].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
      if (snippet && link.startsWith('http')) {
        results.push({ link, snippet });
      }
    }

    // Fallback parser if DuckDuckGo layout varies
    if (results.length === 0) {
      const genericLinkRegex = /<a class="result__snippet[^"]*"[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi;
      while ((match = genericLinkRegex.exec(html)) !== null && results.length < 3) {
        results.push({
          link: match[1],
          snippet: match[2].replace(/<[^>]+>/g, '').trim()
        });
      }
    }

    return {
      success: true,
      query: cleanQuery,
      count: results.length,
      results: results.slice(0, 4)
    };
  } catch (err) {
    return {
      success: false,
      query: cleanQuery,
      error: 'Web search unavailable: ' + err.message,
      results: []
    };
  }
}

/**
 * Tool dispatcher
 */
export async function executeAgentTool(name, args) {
  if (name === 'calculate') {
    return calculateTool(args.expression);
  }
  if (name === 'run_code') {
    return runCodeSandboxTool(args.language, args.code);
  }
  if (name === 'search_web') {
    return await searchWebTool(args.query);
  }
  return { error: `Tool ${name} not recognized` };
}

