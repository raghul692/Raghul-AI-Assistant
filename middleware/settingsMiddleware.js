/**
 * ============================================================================
 * SETTINGS MIDDLEWARE
 * ============================================================================
 * Authentication verification, user isolation, input sanitization, and security guards.
 */

export function requireSettingsAuth(req, res, next) {
  // In our local single-user system, attach authenticated user 'raghul'
  req.user = {
    id: 'raghul',
    username: 'raghulraja',
    role: 'owner'
  };
  next();
}

export function sanitizeSettingsInput(req, res, next) {
  if (req.body && typeof req.body === 'object') {
    const sanitizeValue = (val) => {
      if (typeof val === 'string') {
        // Strip potential script tags or HTML injection
        return val.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '').trim();
      }
      return val;
    };

    if (req.body.value !== undefined) {
      req.body.value = sanitizeValue(req.body.value);
    }
    if (req.body.settings && typeof req.body.settings === 'object') {
      for (const k of Object.keys(req.body.settings)) {
        req.body.settings[k] = sanitizeValue(req.body.settings[k]);
      }
    }
  }
  next();
}

export default {
  requireSettingsAuth,
  sanitizeSettingsInput
};

