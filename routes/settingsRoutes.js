/**
 * ============================================================================
 * SETTINGS ROUTES
 * ============================================================================
 * Express router mounting the ChatGPT General Settings REST API.
 */

import express from 'express';
import { settingsController } from '../controllers/settingsController.js';
import { requireSettingsAuth, sanitizeSettingsInput } from '../middleware/settingsMiddleware.js';

const router = express.Router();

router.use(requireSettingsAuth);

// 1. Settings Schema Metadata
router.get('/settings/metadata', settingsController.getMetadata);

// 2. Settings Audit Logs
router.get('/settings/audit', settingsController.getAuditLogs);

// 3. User Settings CRUD
router.get('/settings', settingsController.getAllSettings);
router.get('/settings/:key', settingsController.getSettingByKey);
router.patch('/settings/:key', sanitizeSettingsInput, settingsController.updateSetting);
router.patch('/settings', sanitizeSettingsInput, settingsController.updateBatchSettings);
router.post('/settings/reset', settingsController.resetSettings);

// 4. Chat Archive & Purge Endpoints (General Settings Chat Management)
router.get('/chats/archived', settingsController.getArchivedChats);
router.post('/chats/:id/archive', settingsController.archiveSingleChat);
router.post('/chats/:id/unarchive', settingsController.unarchiveSingleChat);
router.post('/chats/archive-all', settingsController.archiveAllConversations);
router.delete('/chats/all', settingsController.deleteAllConversations);

export default router;

