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

export function requireLocalDeveloperOrigin(req, res, next) {
  const authHeader = req.headers['authorization'] || req.headers['x-api-key'] || req.headers['x-admin-key'];
  const devKey = process.env.ADMIN_API_KEY || process.env.DEVELOPER_API_KEY;

  const hasValidKey = Boolean(
    devKey &&
    authHeader &&
    (authHeader === devKey || authHeader === `Bearer ${devKey}`)
  );

  // In production: Server-side token authentication is strictly mandatory.
  // Origin and loopback headers are never trusted as identity in production.
  if (process.env.NODE_ENV === 'production') {
    if (!devKey) {
      return res.status(500).json({
        error: 'Configuration Error: ADMIN_API_KEY is required in production for privileged endpoints.',
        requestId: req.id
      });
    }

    if (hasValidKey) {
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

  if (hasValidKey || isLoopback || isAllowedOrigin) {
    return next();
  }

  return res.status(403).json({
    error: 'Forbidden: Access restricted to authorized developer origin or credentials.',
    requestId: req.id
  });
}

export const requireSensitiveOperationAuth = requireLocalDeveloperOrigin;
