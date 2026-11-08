/**
 * ============================================================================
 * SETTINGS SERVICE
 * ============================================================================
 * Central business logic layer orchestrating settings repository, validator, and audit service.
 */

import { settingsRepository } from './settingsRepository.js';
import { settingsValidator, DEFAULT_SETTINGS, SETTINGS_METADATA } from './settingsValidator.js';
import { settingsAuditService } from './settingsAuditService.js';

export class SettingsService {
  /**
   * Get all settings for user, overlaying stored values on top of system defaults
   */
  async getUserSettings(userId = 'raghul') {
    const stored = await settingsRepository.getAll(userId);
    const merged = { ...DEFAULT_SETTINGS, ...stored };
    return {
      userId,
      settings: merged,
      metadata: SETTINGS_METADATA,
      updatedAt: Date.now()
    };
  }

  /**
   * Get a single setting by key
   */
  async getSetting(userId = 'raghul', key) {
    const validation = settingsValidator.validateSetting(key, DEFAULT_SETTINGS[key]);
    if (!validation.valid && !SETTINGS_METADATA[key]) {
      throw new Error(`Setting key '${key}' is not recognized.`);
    }

    const storedValue = await settingsRepository.getByKey(userId, key);
    const value = storedValue !== null && storedValue !== undefined ? storedValue : DEFAULT_SETTINGS[key];

    return {
      key,
      value,
      metadata: SETTINGS_METADATA[key]
    };
  }

  /**
   * Update a single setting with validation and audit logging
   */
  async updateSetting(userId = 'raghul', key, rawValue) {
    const validation = settingsValidator.validateSetting(key, rawValue);
    if (!validation.valid) {
      const err = new Error(validation.error);
      err.statusCode = 400;
      throw err;
    }

    const prevValue = await settingsRepository.getByKey(userId, key);
    const result = await settingsRepository.setKey(userId, key, validation.sanitized);
    await settingsAuditService.logChange(userId, key, prevValue, validation.sanitized);

    return result;
  }

  /**
   * Bulk update multiple settings in a transaction
   */
  async updateMultipleSettings(userId = 'raghul', rawSettings) {
    const validation = settingsValidator.validateBatch(rawSettings);
    if (!validation.valid) {
      const err = new Error(validation.errors ? validation.errors.join('; ') : validation.error);
      err.statusCode = 400;
      throw err;
    }

    const prevSettings = await settingsRepository.getAll(userId);
    const updated = await settingsRepository.setBulk(userId, validation.sanitized);
    await settingsAuditService.logBatchChange(userId, prevSettings, validation.sanitized);

    const merged = { ...DEFAULT_SETTINGS, ...updated };
    return {
      userId,
      settings: merged,
      updatedKeys: Object.keys(validation.sanitized)
    };
  }

  /**
   * Reset all user settings to factory defaults
   */
  async resetSettings(userId = 'raghul') {
    const prevSettings = await settingsRepository.getAll(userId);
    const resetResult = await settingsRepository.reset(userId, DEFAULT_SETTINGS);
    await settingsAuditService.logReset(userId, prevSettings);

    return {
      userId,
      settings: { ...DEFAULT_SETTINGS, ...resetResult },
      message: 'All settings successfully reset to factory defaults.'
    };
  }

  /**
   * Get settings metadata & schema
   */
  getMetadata() {
    return {
      schemaVersion: '1.0.0',
      keys: SETTINGS_METADATA,
      defaults: DEFAULT_SETTINGS
    };
  }

  /**
   * Get user settings audit history
   */
  async getAuditHistory(userId = 'raghul', limit = 50) {
    return settingsAuditService.getAuditTrail(userId, limit);
  }
}

export const settingsService = new SettingsService();
export default settingsService;

