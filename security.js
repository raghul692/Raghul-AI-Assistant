// AI Security, Guardrails & Privacy Module (Hardening based on OWASP Top 10 for LLMs)

// 1. Prompt Injection & Jailbreak Signatures
const INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?(previous|prior|above)\s+instructions/i,
  /forget\s+(all\s+)?(previous|prior|above)\s+instructions/i,
  /you\s+are\s+now\s+(unrestricted|in\s+dan\s+mode|jailbroken)/i,
  /new\s+instructions?:?\s*you\s+are/i,
  /system\s+override\s*:/i,
  /<\s*system\s*>/i,
  /\[\s*system\s*\]/i,
  /\[\s*INST\s*\]/i,
  /bypass\s+safety\s+filter/i,
  /act\s+as\s+(an\s+unfiltered|an\s+evil|dan)/i
];

export function detectPromptInjection(input) {
  if (!input || typeof input !== 'string') return { isSuspicious: false };
  const normalized = input.trim();
  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.test(normalized)) {
      return {
        isSuspicious: true,
        pattern: pattern.toString(),
        reason: 'Potential prompt injection or instruction override detected.'
      };
    }
  }
  return { isSuspicious: false };
}

// 2. Sensitive PII & Secret Redaction (Privacy Protection)
const PII_PATTERNS = [
  // Credit card numbers (13-19 digits with dashes/spaces)
  { pattern: /\b(?:\d{4}[ -]?){3}\d{4}\b/g, replacement: '[REDACTED_CREDIT_CARD]' },
  // OpenAI API Key pattern
  { pattern: /\bsk-[A-Za-z0-9-_]{20,}\b/g, replacement: '[REDACTED_API_KEY]' },
  // Google Gemini API Key pattern
  { pattern: /\bAIza[0-9A-Za-z-_]{35}\b/g, replacement: '[REDACTED_API_KEY]' },
  // Generic Bearer tokens
  { pattern: /\bBearer\s+[A-Za-z0-9\-._~+/]+=*\b/gi, replacement: 'Bearer [REDACTED_TOKEN]' }
];

export function redactSensitiveData(text) {
  if (!text || typeof text !== 'string') return text;
  let sanitized = text;
  for (const { pattern, replacement } of PII_PATTERNS) {
    sanitized = sanitized.replace(pattern, replacement);
  }
  return sanitized;
}

// 3. User Input Sanitization & Boundary Bounds
export function sanitizeUserInput(input, maxLength = 32000) {
  if (!input || typeof input !== 'string') return '';
  // Strip dangerous null bytes and unicode control characters
  let clean = input.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '');
  // Bound max length to avoid memory denial of service
  if (clean.length > maxLength) {
    clean = clean.slice(0, maxLength);
  }
  return clean;
}

// 4. In-Memory Sliding Window Rate Limiter
const requestCounts = new Map();
export function rateLimiterMiddleware(maxRequests = 40, windowMs = 60000) {
  return (req, res, next) => {
    const ip = req.ip || req.headers['x-forwarded-for'] || '127.0.0.1';
    const now = Date.now();
    const clientRecord = requestCounts.get(ip) || [];
    
    // Filter timestamps within current window
    const recent = clientRecord.filter(time => now - time < windowMs);
    if (recent.length >= maxRequests) {
      return res.status(429).json({
        error: 'Too many requests. Please slow down.',
        retryAfterMs: windowMs - (now - recent[0])
      });
    }
    recent.push(now);
    requestCounts.set(ip, recent);
    next();
  };
}

