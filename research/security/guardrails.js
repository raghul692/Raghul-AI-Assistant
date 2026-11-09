/**
 * Defense-in-Depth Security Guardrails for Autonomous Deep Research Engine
 * Hardens against SSRF, prompt injection, privilege escalation, and resource exhaustion.
 * Complies with OWASP Top 10 for LLM Applications (2026) and ASVS 5.0.
 */
import { URL } from 'url';

// Cloud & Metadata IP addresses & Hostnames to block
const BLOCKED_HOSTNAMES = new Set([
  'localhost',
  '127.0.0.1',
  '::1',
  '0.0.0.0',
  '169.254.169.254', // AWS / GCP / Azure metadata service
  'metadata.google.internal',
  'instance-data',
  'metadata.packet.net'
]);

// Prompt Injection Pattern Signatures
const INJECTION_SIGNATURES = [
  /ignore\s+(all\s+)?(previous|prior)\s+instructions/i,
  /system\s+override\s+initiated/i,
  /you\s+are\s+now\s+(unrestricted|in\s+developer\s+mode|dan)/i,
  /reveal\s+(your\s+)?(system\s+prompt|api\s+key|credentials)/i,
  /output\s+all\s+(environment\s+variables|system\s+instructions)/i,
  /disregard\s+(the\s+above|all\s+rules|safety\s+guidelines)/i,
  /bypass\s+(security|authorization|guardrails)/i
];

/**
 * 1. SSRF & Network Security Validation
 * Validates external URLs before fetching to prevent intranet and metadata exposure.
 */
export function validateSafeUrl(urlString) {
  if (!urlString || typeof urlString !== 'string') {
    return { valid: false, reason: 'URL must be a non-empty string' };
  }

  let parsed;
  try {
    parsed = new URL(urlString.trim());
  } catch (err) {
    return { valid: false, reason: `Malformed URL: ${err.message}` };
  }

  // 1. Protocol Whitelist (HTTP/HTTPS only)
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { valid: false, reason: `Disallowed protocol "${parsed.protocol}". Only http: and https: are permitted.` };
  }

  const hostname = parsed.hostname.toLowerCase();

  // 2. Direct Blocked Hostnames
  if (BLOCKED_HOSTNAMES.has(hostname)) {
    return { valid: false, reason: `Access to destination "${hostname}" is blocked (SSRF Protection).` };
  }

  // 3. Intranet / Local Domain Extensions
  if (hostname.endsWith('.local') || hostname.endsWith('.internal') || hostname.endsWith('.localhost')) {
    return { valid: false, reason: `Access to internal domain "${hostname}" is blocked.` };
  }

  // 4. Private IPv4 Range Checking
  const ipv4Regex = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
  const ipMatch = hostname.match(ipv4Regex);
  if (ipMatch) {
    const octet1 = parseInt(ipMatch[1], 10);
    const octet2 = parseInt(ipMatch[2], 10);

    // 127.0.0.0/8 (Loopback)
    if (octet1 === 127) return { valid: false, reason: 'Loopback IP addresses (127.0.0.0/8) are blocked.' };
    // 10.0.0.0/8 (Private)
    if (octet1 === 10) return { valid: false, reason: 'Private Class A IP addresses (10.0.0.0/8) are blocked.' };
    // 172.16.0.0/12 (Private)
    if (octet1 === 172 && octet2 >= 16 && octet2 <= 31) return { valid: false, reason: 'Private Class B IP addresses (172.16.0.0/12) are blocked.' };
    // 192.168.0.0/16 (Private)
    if (octet1 === 192 && octet2 === 168) return { valid: false, reason: 'Private Class C IP addresses (192.168.0.0/16) are blocked.' };
    // 169.254.0.0/16 (Link-Local & Cloud Metadata)
    if (octet1 === 169 && octet2 === 254) return { valid: false, reason: 'Link-local & Cloud Metadata IP addresses (169.254.0.0/16) are blocked.' };
    // 0.0.0.0/8
    if (octet1 === 0) return { valid: false, reason: 'Current network IP addresses (0.0.0.0/8) are blocked.' };
  }

  return { valid: true, url: parsed.toString() };
}

/**
 * 2. Prompt Injection Defense & Untrusted Source Isolation
 * Neutralizes prompt override payloads and wraps untrusted external text in strict delimiters.
 */
export function sanitizeUntrustedContent(rawContent) {
  if (!rawContent || typeof rawContent !== 'string') return '';

  // 1. Strip null bytes and non-printable control characters
  let cleaned = rawContent.replace(/\0/g, '').replace(/[\x01-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

  // 2. Scan for Prompt Injection Overrides
  let injectionDetected = false;
  for (const sig of INJECTION_SIGNATURES) {
    if (sig.test(cleaned)) {
      injectionDetected = true;
      cleaned = cleaned.replace(sig, '[SECURITY_NEUTRALIZED: PROMPT_INJECTION_PATTERN]');
    }
  }

  // 3. Strict Boundary Isolation
  const safeDemarcated = `<untrusted_source_passage injection_neutralized="${injectionDetected}">\n${cleaned}\n</untrusted_source_passage>`;
  return safeDemarcated;
}

/**
 * 3. Budget & Resource Ceilings
 * Prevents runaway resource consumption or cost exhaustion.
 */
export function enforceJobBudget({
  totalTokens = 0,
  spentUsd = 0.0,
  durationMs = 0,
  maxBudgetUsd = 2.00,
  maxTokens = 250000,
  maxDurationMs = 600000 // 10 minutes
}) {
  if (spentUsd >= maxBudgetUsd) {
    return { exceeded: true, reason: `Cost ceiling exceeded: $${spentUsd.toFixed(2)} >= $${maxBudgetUsd.toFixed(2)}` };
  }
  if (totalTokens >= maxTokens) {
    return { exceeded: true, reason: `Token ceiling exceeded: ${totalTokens} >= ${maxTokens} tokens` };
  }
  if (durationMs >= maxDurationMs) {
    return { exceeded: true, reason: `Execution deadline exceeded: ${Math.round(durationMs / 1000)}s >= ${Math.round(maxDurationMs / 1000)}s` };
  }
  return { exceeded: false };
}

/**
 * 4. Sensitive Data & Log Redaction
 * Prevents credentials, API keys, and sensitive tokens from leaking into audit logs.
 */
export function sanitizeLogOutput(text) {
  if (!text || typeof text !== 'string') return text;

  return text
    // Google Gemini API keys
    .replace(/AIza[0-9A-Za-z-_]{35}/g, '[REDACTED_GEMINI_KEY]')
    // Groq API keys
    .replace(/gsk_[0-9A-Za-z]{48,64}/g, '[REDACTED_GROQ_KEY]')
    // GitHub Personal Access Tokens
    .replace(/gh[pousr]_[0-9A-Za-z]{36,255}/g, '[REDACTED_GITHUB_TOKEN]')
    // Bearer authorization headers
    .replace(/Bearer\s+[A-Za-z0-9-_=.]+/gi, 'Bearer [REDACTED_TOKEN]')
    // Credit card patterns
    .replace(/\b\d{4}[ -]?\d{4}[ -]?\d{4}[ -]?\d{4}\b/g, '[REDACTED_CARD]');
}

