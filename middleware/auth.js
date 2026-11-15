/**
 * RAGHUL AI — PRODUCTION AUTHENTICATION & ACCESS CONTROL MIDDLEWARE
 * 
 * Protects privileged operational endpoints:
 * - Loopback development support
 * - Vercel / Cloud HTTPS Origin verification
 * - Secure API key & Bearer token authorization
 * - Request ID tracking
 */

import crypto from 'crypto';

export function requestIdMiddleware(req, res, next) {
  const reqId = req.headers['x-request-id'] || `req_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  req.id = reqId;
  res.setHeader('X-Request-Id', reqId);
  next();
}

/**
 * Constant-time string comparison to prevent timing attack side channels.
 */
function safeCompareTokens(provided, secret) {
  if (!provided || !secret || typeof provided !== 'string' || typeof secret !== 'string') return false;
  const provBuf = Buffer.from(provided);
  const secBuf = Buffer.from(secret);
  if (provBuf.length !== secBuf.length) return false;
  return crypto.timingSafeEqual(provBuf, secBuf);
}

/**
 * Validates whether the incoming request contains a valid server-side API key.
 * Checks Bearer token in Authorization header, x-api-key / x-admin-key, or query param.
 */
export function hasValidApiKey(req) {
  const devKey = process.env.ADMIN_API_KEY || process.env.DEVELOPER_API_KEY;
  if (!devKey) return false;

  const rawHeader = req.headers['authorization'] || req.headers['x-api-key'] || req.headers['x-admin-key'];
  const queryToken = req.query?.token || req.query?.apiKey || req.query?.key;
  const candidate = (rawHeader || queryToken || '').trim();

  if (!candidate) return false;

  // Exact key match
  if (safeCompareTokens(candidate, devKey)) return true;

  // Bearer prefix match
  if (candidate.startsWith('Bearer ')) {
    const bearerToken = candidate.slice(7).trim();
    if (safeCompareTokens(bearerToken, devKey)) return true;
  }

  return false;
}

export function requireLocalDeveloperOrigin(req, res, next) {
  const devKey = process.env.ADMIN_API_KEY || process.env.DEVELOPER_API_KEY;
  const isKeyValid = hasValidApiKey(req);

  // In production: Server-side token authentication is strictly mandatory.
  // Origin and loopback headers are never trusted as identity in production.
  if (process.env.NODE_ENV === 'production') {
    if (!devKey) {
      return res.status(500).json({
        error: 'Configuration Error: ADMIN_API_KEY is required in production for privileged endpoints.',
        requestId: req.id
      });
    }

    if (isKeyValid) {
      return next();
    }

    return res.status(401).json({
      error: 'Unauthorized: Valid ADMIN_API_KEY Bearer token or x-api-key is required for privileged operations.',
      requestId: req.id
    });
  }

  // Local development & testing environment:
  const remoteIp = req.ip || req.connection?.remoteAddress || '';
  const isLoopback = ['127.0.0.1', '::1', '::ffff:127.0.0.1'].some(ip => remoteIp.includes(ip));
  const origin = req.headers.origin || '';

  const allowedOrigins = process.env.ALLOWED_ORIGINS 
    ? process.env.ALLOWED_ORIGINS.split(',').map(s => s.trim())
    : [];

  const isAllowedOrigin = !origin 
    || allowedOrigins.includes(origin)
    || /\.vercel\.app$/.test(origin)
    || /\.onrender\.com$/.test(origin)
    || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);

  if (isKeyValid || isLoopback || isAllowedOrigin) {
    return next();
  }

  return res.status(403).json({
    error: 'Forbidden: Access restricted to authorized developer origin or credentials.',
    requestId: req.id
  });
}

export const requireSensitiveOperationAuth = requireLocalDeveloperOrigin;
export const requireAdminAuth = requireLocalDeveloperOrigin;
