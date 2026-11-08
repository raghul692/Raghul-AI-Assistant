/**
 * ============================================================================
 * SETTINGS REPOSITORY
 * ============================================================================
 * Direct SQLite persistence layer for user settings and audit logs.
 */

import {
  getUserSettingsDb,
  getUserSettingDb,
  upsertUserSettingDb,
  bulkUpsertUserSettingsDb,
  resetUserSettingsDb,
  insertSettingsAuditLogDb,
  listSettingsAuditLogsDb
} from '../db.js';

export class SettingsRepository {
  /**
   * Fetch all settings for a specific user
   */
  async getAll(userId) {
    return getUserSettingsDb(userId);
  }

  /**
   * Fetch a single setting by key
   */
  async getByKey(userId, key) {
    return getUserSettingDb(userId, key);
  }

  /**
   * Upsert a single setting
   */
  async setKey(userId, key, value) {
    return upsertUserSettingDb(userId, key, value);
  }

  /**
   * Bulk upsert multiple settings in a single transaction
   */
  async setBulk(userId, settingsObj) {
    return bulkUpsertUserSettingsDb(userId, settingsObj);
  }

  /**
   * Reset all settings for a user to defaults
   */
  async reset(userId, defaults) {
    return resetUserSettingsDb(userId, defaults);
  }

  /**
   * Record an audit log event
   */
  async logAudit(userId, key, previousValue, newValue, action) {
    return insertSettingsAuditLogDb(userId, key, previousValue, newValue, action);
  }

  /**
   * List recent audit logs for user
   */
  async getAuditLogs(userId, limit = 50) {
    return listSettingsAuditLogsDb(userId, limit);
  }
}

export const settingsRepository = new SettingsRepository();
export default settingsRepository;

