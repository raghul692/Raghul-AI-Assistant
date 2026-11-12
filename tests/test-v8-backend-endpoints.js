/**
 * RAGHUL AI — PORTFOLIO OS V8 BACKEND ENDPOINTS & DATABASE TEST SUITE
 */

import {
  initDatabase,
  createPortfolioNotification,
  listPortfolioNotifications,
  markPortfolioNotificationRead,
  markAllPortfolioNotificationsRead,
  clearReadPortfolioNotifications,
  getPortfolioNotificationCount,
  createPortfolioIncident,
  listPortfolioIncidents,
  resolvePortfolioIncident,
  getPortfolioUserSettings,
  setPortfolioUserSetting,
  bulkSetPortfolioUserSettings
} from '../db.js';
import { integrationManager } from '../services/integrationManager.js';
import assert from 'assert';

console.log('🧪 Starting Portfolio OS V8 Backend Verification...');

// 1. Initialize Database
initDatabase();
console.log('✅ Database schema initialized');

// 2. Notifications Test
const testNotif = createPortfolioNotification({
  title: 'Test Notification',
  message: 'Testing notification creation',
  severity: 'info',
  category: 'system'
});
assert(testNotif.id, 'Notification should have an ID');
console.log('✅ Notification created:', testNotif.id);

const notifs = listPortfolioNotifications({ limit: 10 });
assert(notifs.length > 0, 'Should return notifications list');
console.log(`✅ Listed ${notifs.length} notifications`);

const counts = getPortfolioNotificationCount();
assert(counts.total > 0, 'Total notifications > 0');
console.log(`✅ Notification counts: total=${counts.total}, unread=${counts.unread}`);

const readResult = markPortfolioNotificationRead(testNotif.id);
assert(readResult === true, 'Notification should be marked read');
console.log('✅ Marked notification as read');

// 3. Incidents Test
const testInc = createPortfolioIncident({
  title: 'Test Incident',
  service: 'github',
  severity: 'medium',
  status: 'active'
});
assert(testInc.id, 'Incident should have an ID');
console.log('✅ Incident created:', testInc.id);

const incidents = listPortfolioIncidents({ limit: 10 });
assert(incidents.length > 0, 'Should return incidents list');
console.log(`✅ Listed ${incidents.length} incidents`);

const resolveResult = resolvePortfolioIncident(testInc.id, 'Resolved during test');
assert(resolveResult === true, 'Incident should be resolved');
console.log('✅ Resolved incident');

// 4. User Settings Test
const settings = getPortfolioUserSettings();
assert(settings.theme, 'Settings should contain theme');
console.log('✅ Loaded user settings:', settings);

setPortfolioUserSetting('density', 'compact');
const updatedSettings = getPortfolioUserSettings();
assert.strictEqual(updatedSettings.density, 'compact', 'Density should be compact');
console.log('✅ Updated setting density=compact');

// 5. GitHub Integration Methods
console.log('🔍 Testing GitHub Integration Methods...');
integrationManager.getGitHubRepoDetails().then(repo => {
  console.log('✅ GitHub Repo:', repo.fullName, 'Default branch:', repo.defaultBranch);
  return integrationManager.listGitHubCommits(3);
}).then(commits => {
  assert(commits.length > 0, 'Should list commits');
  console.log(`✅ Fetched ${commits.length} commits. Latest: [${commits[0].shortSha}] ${commits[0].message.slice(0, 40)}`);
  return integrationManager.listGitHubBranches(5);
}).then(branches => {
  assert(branches.length > 0, 'Should list branches');
  console.log(`✅ Fetched ${branches.length} branches:`, branches.map(b => b.name).join(', '));
  return integrationManager.listGitHubPullRequests('all', 3);
}).then(pulls => {
  console.log(`✅ Fetched ${pulls.length} PRs`);
  console.log('🎉 ALL V8 BACKEND CONTRACT TESTS PASSED PERFECTLY!');
  process.exit(0);
}).catch(err => {
  console.error('❌ GitHub method error:', err.message);
  process.exit(1);
});
