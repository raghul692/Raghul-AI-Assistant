/**
 * ============================================================================
 * SETTINGS VALIDATOR & SCHEMA DEFINITION
 * ============================================================================
 * Enforces strict typing, allowed keys, and validation rules for ChatGPT General Settings.
 */

export const SETTINGS_METADATA = {
  theme: {
    type: 'string',
    allowed: ['system', 'dark', 'light'],
    default: 'system',
    description: 'Interface visual color theme (System OS, Dark OLED, or Light)'
  },
  language: {
    type: 'string',
    allowed: ['auto', 'en', 'tanglish'],
    default: 'auto',
    description: 'Interface and conversational response language preference'
  },
  always_show_code: {
    type: 'boolean',
    default: false,
    description: 'Always display code blocks expanded when using data analysis'
  },
  enter_sends_message: {
    type: 'boolean',
    default: true,
    description: 'Press Enter to send message, Shift+Enter for newline'
  },
  sound_effects: {
    type: 'boolean',
    default: false,
    description: 'Play audio cues on completion or key actions'
  }
};

export const DEFAULT_SETTINGS = Object.fromEntries(
  Object.entries(SETTINGS_METADATA).map(([k, v]) => [k, v.default])
);

export class SettingsValidator {
  /**
   * Validate a single setting key-value pair
   */
  validateSetting(key, value) {
    if (!key || typeof key !== 'string') {
      return { valid: false, error: 'Setting key must be a non-empty string.' };
    }

    const schema = SETTINGS_METADATA[key];
    if (!schema) {
      return {
        valid: false,
        error: `Setting key '${key}' is not allowed. Allowed keys: ${Object.keys(SETTINGS_METADATA).join(', ')}`
      };
    }

    if (schema.type === 'string') {
      if (typeof value !== 'string') {
        return { valid: false, error: `Setting '${key}' must be a string.` };
      }
      if (schema.allowed && !schema.allowed.includes(value.toLowerCase())) {
        return {
          valid: false,
          error: `Invalid value for '${key}'. Allowed values: ${schema.allowed.join(', ')}`
        };
      }
      return { valid: true, sanitized: value.toLowerCase() };
    }

    if (schema.type === 'boolean') {
      if (typeof value !== 'boolean') {
        return { valid: false, error: `Setting '${key}' must be a boolean (true or false).` };
      }
      return { valid: true, sanitized: Boolean(value) };
    }

    return { valid: true, sanitized: value };
  }

  /**
   * Validate a batch of settings
   */
  validateBatch(settingsObj) {
    if (!settingsObj || typeof settingsObj !== 'object' || Array.isArray(settingsObj) || Object.keys(settingsObj).length === 0) {
      return { valid: false, error: 'Settings payload must be a non-empty JSON object.' };
    }

    const sanitized = {};
    const errors = [];

    for (const [key, val] of Object.entries(settingsObj)) {
      const res = this.validateSetting(key, val);
      if (!res.valid) {
        errors.push(res.error);
      } else {
        sanitized[key] = res.sanitized;
      }
    }

    if (errors.length > 0) {
      return { valid: false, errors };
    }

    return { valid: true, sanitized };
  }
}

export const settingsValidator = new SettingsValidator();
export default settingsValidator;
