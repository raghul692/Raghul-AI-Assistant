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

  const authHeader = req.headers['authorization'] || req.headers['x-api-key'] || req.headers['x-admin-key'];
  const devKey = process.env.ADMIN_API_KEY || process.env.DEVELOPER_API_KEY;

  const hasValidKey = devKey && authHeader && (
    authHeader === devKey ||
    authHeader === `Bearer ${devKey}`
  );

  if (isLoopback || hasValidKey || (isAllowedOrigin && process.env.NODE_ENV !== 'production')) {
    return next();
  }

  return res.status(403).json({
    error: 'Forbidden: Access restricted to authorized developer origin or credentials.',
    requestId: req.id
  });
}
