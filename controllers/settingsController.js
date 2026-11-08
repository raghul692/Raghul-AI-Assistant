/**
 * ============================================================================
 * SETTINGS CONTROLLER
 * ============================================================================
 * HTTP Request/Response handlers for the Settings REST API.
 */

import { settingsService } from '../services/settingsService.js';
import {
  listArchivedChats,
  archiveChat,
  unarchiveChat,
  archiveAllChats,
  deleteAllChats
} from '../storage.js';
import { settingsAuditService } from '../services/settingsAuditService.js';

export class SettingsController {
  /**
   * GET /api/settings
   */
  async getAllSettings(req, res) {
    try {
      const userId = req.user?.id || 'raghul';
      const result = await settingsService.getUserSettings(userId);
      res.json({ success: true, ...result });
    } catch (err) {
      res.status(err.statusCode || 500).json({ success: false, error: err.message });
    }
  }

  /**
   * GET /api/settings/metadata
   */
  async getMetadata(req, res) {
    try {
      const meta = settingsService.getMetadata();
      res.json({ success: true, ...meta });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  }

  /**
   * GET /api/settings/audit
   */
  async getAuditLogs(req, res) {
    try {
      const userId = req.user?.id || 'raghul';
      const limit = parseInt(req.query.limit, 10) || 50;
      const logs = await settingsService.getAuditHistory(userId, limit);
      res.json({ success: true, count: logs.length, logs });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  }

  /**
   * GET /api/settings/:key
   */
  async getSettingByKey(req, res) {
    try {
      const userId = req.user?.id || 'raghul';
      const { key } = req.params;
      const result = await settingsService.getSetting(userId, key);
      res.json({ success: true, ...result });
    } catch (err) {
      res.status(err.statusCode || 404).json({ success: false, error: err.message });
    }
  }

  /**
   * PATCH /api/settings/:key
   */
  async updateSetting(req, res) {
    try {
      const userId = req.user?.id || 'raghul';
      const { key } = req.params;
      const { value } = req.body;

      if (value === undefined) {
        return res.status(400).json({ success: false, error: "Missing required 'value' property in body." });
      }

      const updated = await settingsService.updateSetting(userId, key, value);
      res.json({ success: true, ...updated });
    } catch (err) {
      res.status(err.statusCode || 400).json({ success: false, error: err.message });
    }
  }

  /**
   * PATCH /api/settings
   */
  async updateBatchSettings(req, res) {
    try {
      const userId = req.user?.id || 'raghul';
      const settingsPayload = req.body.settings || req.body;

      const result = await settingsService.updateMultipleSettings(userId, settingsPayload);
      res.json({ success: true, ...result });
    } catch (err) {
      res.status(err.statusCode || 400).json({ success: false, error: err.message });
    }
  }

  /**
   * POST /api/settings/reset
   */
  async resetSettings(req, res) {
    try {
      const userId = req.user?.id || 'raghul';
      const result = await settingsService.resetSettings(userId);
      res.json({ success: true, ...result });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  }

  // =========================================================================
  // Archived Conversations Controllers
  // =========================================================================

  /**
   * GET /api/chats/archived
   */
  async getArchivedChats(req, res) {
    try {
      const chats = listArchivedChats();
      res.json({ success: true, count: chats.length, chats });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  }

  /**
   * POST /api/chats/:id/archive
   */
  async archiveSingleChat(req, res) {
    try {
      const { id } = req.params;
      const ok = archiveChat(id);
      if (!ok) return res.status(404).json({ success: false, error: 'Chat not found' });
      await settingsAuditService.logDestructiveAction('raghul', 'ARCHIVE_CHAT', `Archived chat ${id}`);
      res.json({ success: true, message: 'Chat successfully archived', id });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  }

  /**
   * POST /api/chats/:id/unarchive
   */
  async unarchiveSingleChat(req, res) {
    try {
      const { id } = req.params;
      const ok = unarchiveChat(id);
      if (!ok) return res.status(404).json({ success: false, error: 'Chat not found in archive' });
      await settingsAuditService.logDestructiveAction('raghul', 'UNARCHIVE_CHAT', `Unarchived chat ${id}`);
      res.json({ success: true, message: 'Chat restored to active history', id });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  }

  /**
   * POST /api/chats/archive-all
   */
  async archiveAllConversations(req, res) {
    try {
      const count = archiveAllChats();
      await settingsAuditService.logDestructiveAction('raghul', 'ARCHIVE_ALL_CHATS', `Archived ${count} chats`);
      res.json({ success: true, message: `Successfully archived ${count} chats.`, count });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  }

  /**
   * DELETE /api/chats/all
   */
  async deleteAllConversations(req, res) {
    try {
      deleteAllChats();
      await settingsAuditService.logDestructiveAction('raghul', 'DELETE_ALL_CHATS', 'Permanently deleted all conversation history');
      res.json({ success: true, message: 'All conversations permanently deleted.' });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  }
}

export const settingsController = new SettingsController();
export default settingsController;

