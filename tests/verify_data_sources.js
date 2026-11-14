/**
 * Verify Data Sources & Provenance Traceability
 */

import Database from 'better-sqlite3';
import os from 'os';
import path from 'path';

const db = new Database('data/nexus.db', { readonly: true });

console.log('🔍 DATA PROVENANCE TRACEABILITY AUDIT:');

// 1. Analytics Events
const eventCount = db.prepare('SELECT COUNT(*) as count FROM portfolio_analytics_events').get().count;
const recentEvents = db.prepare('SELECT event_type, path, referrer, user_agent, created_at FROM portfolio_analytics_events ORDER BY created_at DESC LIMIT 3').all();
console.log(`\n1. Analytics Events: Total=${eventCount}`);
console.log('   Recent Sample:', recentEvents);

// 2. Deployments
const deployCount = db.prepare('SELECT COUNT(*) as count FROM portfolio_deployments').get().count;
const recentDeploys = db.prepare('SELECT target, deployment_id, status, commit_sha, created_at FROM portfolio_deployments ORDER BY created_at DESC LIMIT 3').all();
console.log(`\n2. Deployments: Total=${deployCount}`);
console.log('   Recent Sample:', recentDeploys);

// 3. Incidents
const incCount = db.prepare('SELECT COUNT(*) as count FROM portfolio_incidents').get().count;
const incidents = db.prepare('SELECT id, title, service, severity, status, created_at FROM portfolio_incidents ORDER BY created_at DESC LIMIT 3').all();
console.log(`\n3. Incidents: Total=${incCount}`);
console.log('   Recent Sample:', incidents);

// 4. Notifications
const notifCount = db.prepare('SELECT COUNT(*) as count FROM portfolio_notifications').get().count;
const unreadCount = db.prepare('SELECT COUNT(*) as count FROM portfolio_notifications WHERE read = 0').get().count;
console.log(`\n4. Notifications: Total=${notifCount}, Unread=${unreadCount}`);

// 5. Audit Logs
const auditCount = db.prepare('SELECT COUNT(*) as count FROM audit_logs').get().count;
const latestAudit = db.prepare('SELECT id, action, actor, timestamp, hash FROM audit_logs ORDER BY rowid DESC LIMIT 1').get();
console.log(`\n5. SHA-256 Audit Ledger: Total=${auditCount}`);
console.log('   Latest Block:', latestAudit);

// 6. Host OS Telemetry
const hostTelemetry = {
  platform: os.platform(),
  arch: os.arch(),
  totalMemoryMb: Math.round(os.totalmem() / 1024 / 1024),
  freeMemoryMb: Math.round(os.freemem() / 1024 / 1024),
  cpus: os.cpus().length,
  processRssMb: (process.memoryUsage().rss / 1024 / 1024).toFixed(1),
  processHeapMb: (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(1)
};
console.log('\n6. Real Host Telemetry:', hostTelemetry);

db.close();
