/**
 * ============================================================================
 * SETTINGS AUDIT SERVICE
 * ============================================================================
 * Immutable audit logging for user setting changes and destructive actions.
 */

import { settingsRepository } from './settingsRepository.js';

export class SettingsAuditService {
  /**
   * Log an update to a single setting
   */
  async logChange(userId, key, previousValue, newValue) {
    return settingsRepository.logAudit(userId, key, previousValue, newValue, 'UPDATE');
  }

  /**
   * Log a batch update
   */
  async logBatchChange(userId, previousValues, newValues) {
    const promises = Object.keys(newValues).map(key => {
      const prev = previousValues[key] !== undefined ? previousValues[key] : null;
      const next = newValues[key];
      return settingsRepository.logAudit(userId, key, prev, next, 'BATCH_UPDATE');
    });
    return Promise.all(promises);
  }

  /**
   * Log a settings reset
   */
  async logReset(userId, previousSettings) {
    return settingsRepository.logAudit(userId, 'ALL_SETTINGS', previousSettings, 'DEFAULTS_APPLIED', 'RESET');
  }

  /**
   * Log a destructive chat action (e.g. archive all, delete all)
   */
  async logDestructiveAction(userId, action, details) {
    return settingsRepository.logAudit(userId, 'CONVERSATIONS', null, details, action);
  }

  /**
   * Fetch audit trail history
   */
  async getAuditTrail(userId, limit = 50) {
    return settingsRepository.getAuditLogs(userId, limit);
  }
}

export const settingsAuditService = new SettingsAuditService();
export default settingsAuditService;

