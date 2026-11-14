/**
 * FORENSIC SECURITY & DATABASE INTEGRITY TEST HARNESS
 * Raghul AI Portfolio OS v8.0 Independent Verification
 */

import {
  db,
  verifyAuditLedgerIntegrity,
  createSignedAuthorizationTicket,
  verifyAndConsumeAuthorizationTicket,
  computePayloadHash
} from '../governanceAudit.js';
import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

async function runForensicSecurityDatabaseTests() {
  console.log('⚡ Starting Forensic Security & Database Integrity Audit for V8...');
  const results = [];

  // TEST 1: SQLite WAL Mode and Pragmas
  try {
    const journalMode = db.pragma('journal_mode', { simple: true });
    const synchronous = db.pragma('synchronous', { simple: true });
    const foreignKeys = db.pragma('foreign_keys', { simple: true });
    
    if (journalMode.toLowerCase() === 'wal') {
      results.push({ id: 'SEC-DB-01', name: 'SQLite WAL Mode Enabled', status: 'PASS', details: { journalMode, synchronous, foreignKeys } });
    } else {
      results.push({ id: 'SEC-DB-01', name: 'SQLite WAL Mode Enabled', status: 'FAIL', details: { journalMode } });
    }
  } catch (e) {
    results.push({ id: 'SEC-DB-01', name: 'SQLite WAL Mode Enabled', status: 'ERROR', error: e.message });
  }

  // TEST 2: SHA-256 Ledger Tamper Detection
  try {
    // 2a. Check initial integrity
    const initialCheck = verifyAuditLedgerIntegrity();
    if (!initialCheck.valid) {
      throw new Error(`Initial audit ledger integrity check failed: ${initialCheck.error || initialCheck.reason}`);
    }

    const originalCount = db.prepare('SELECT COUNT(*) as count FROM audit_logs').get().count;
    
    // Check tamper-proofing triggers: try updating a record
    let updateBlocked = false;
    try {
      db.prepare("UPDATE audit_logs SET actor = 'HACKED' WHERE rowid = 1").run();
    } catch (triggerErr) {
      if (triggerErr.message.includes('IMMUTABLE_LEDGER_VIOLATION') || triggerErr.message.includes('strictly prohibited')) {
        updateBlocked = true;
      }
    }

    // Try deleting a record
    let deleteBlocked = false;
    try {
      db.prepare('DELETE FROM audit_logs WHERE rowid = 1').run();
    } catch (triggerErr) {
      if (triggerErr.message.includes('IMMUTABLE_LEDGER_VIOLATION') || triggerErr.message.includes('strictly prohibited')) {
        deleteBlocked = true;
      }
    }

    results.push({
      id: 'SEC-LEDGER-01',
      name: 'Audit Ledger Trigger Immutability (UPDATE/DELETE Prevention)',
      status: (updateBlocked && deleteBlocked) ? 'PASS' : 'FAIL',
      details: { updateBlocked, deleteBlocked, ledgerRecords: originalCount }
    });
  } catch (e) {
    results.push({ id: 'SEC-LEDGER-01', name: 'Audit Ledger Trigger Immutability', status: 'ERROR', error: e.message });
  }

  // TEST 3: Cryptographic Ticket Expiry & Tamper Rejection
  try {
    const targetPayload = { releaseVersion: '8.0.0-verified', target: 'render:srv-da9foaon74is73fvojn0' };
    const expectedHash = computePayloadHash(targetPayload);

    // 3a. Expired ticket test
    const expiredTicket = createSignedAuthorizationTicket({
      action: 'portfolio_production_deploy',
      target: 'render:srv-da9foaon74is73fvojn0',
      payload: targetPayload,
      operatorId: 'operator_raghul_sec_admin',
      ttlMs: -1000 // already expired
    });

    let expiredRejected = false;
    try {
      verifyAndConsumeAuthorizationTicket({
        ticketId: expiredTicket.ticketId,
        action: 'portfolio_production_deploy',
        target: 'render:srv-da9foaon74is73fvojn0',
        payload: targetPayload
      });
    } catch (err) {
      if (err.message.includes('TICKET_EXPIRED')) {
        expiredRejected = true;
      }
    }

    // 3b. Valid ticket test
    const validTicket = createSignedAuthorizationTicket({
      action: 'portfolio_production_deploy',
      target: 'render:srv-da9foaon74is73fvojn0',
      payload: targetPayload,
      operatorId: 'operator_raghul_sec_admin',
      ttlMs: 60000
    });

    // 3c. Tampered payload rejection
    let tamperRejected = false;
    try {
      verifyAndConsumeAuthorizationTicket({
        ticketId: validTicket.ticketId,
        action: 'portfolio_production_deploy',
        target: 'render:srv-da9foaon74is73fvojn0',
        payload: { ...targetPayload, maliciousInjectedField: true }
      });
    } catch (err) {
      if (err.message.includes('HASH_MISMATCH') || err.message.includes('PAYLOAD')) {
        tamperRejected = true;
      }
    }

    // 3d. Consume valid ticket
    const consumeRes = verifyAndConsumeAuthorizationTicket({
      ticketId: validTicket.ticketId,
      action: 'portfolio_production_deploy',
      target: 'render:srv-da9foaon74is73fvojn0',
      payload: targetPayload
    });

    // 3e. Replay attack rejection
    let replayRejected = false;
    try {
      verifyAndConsumeAuthorizationTicket({
        ticketId: validTicket.ticketId,
        action: 'portfolio_production_deploy',
        target: 'render:srv-da9foaon74is73fvojn0',
        payload: targetPayload
      });
    } catch (err) {
      if (err.message.includes('REPLAY_ATTACK_PREVENTED') || err.message.includes('ALREADY_CONSUMED')) {
        replayRejected = true;
      }
    }

    results.push({
      id: 'SEC-CRYPTO-01',
      name: 'Cryptographic Ticket Lifecycle (Expiry, Tamper & Replay Protection)',
      status: (expiredRejected && tamperRejected && consumeRes.valid && replayRejected) ? 'PASS' : 'FAIL',
      details: { expiredRejected, tamperRejected, consumedOnce: consumeRes.valid, replayRejected }
    });
  } catch (e) {
    results.push({ id: 'SEC-CRYPTO-01', name: 'Cryptographic Ticket Lifecycle', status: 'ERROR', error: e.message });
  }

  // TEST 4: Emergency Stop API Mutation Lock
  try {
    // 4a. Activate Emergency Stop
    const activateRes = await fetch('http://localhost:3000/api/portfolio/emergency-stop', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: true })
    }).then(r => r.json());

    // 4b. Test GitHub Branch mutation while locked
    const branchRes = await fetch('http://localhost:3000/api/portfolio/github/branches', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ branchName: 'test-estop-branch' })
    });

    let isBranchBlocked = branchRes.status === 403 || branchRes.status === 423;
    if (!isBranchBlocked) {
      const data = await branchRes.json();
      if (data.error && data.error.includes('EMERGENCY_STOP')) isBranchBlocked = true;
    }

    // 4c. Test Deployment Trigger while locked
    const deployRes = await fetch('http://localhost:3000/api/portfolio/deployments/trigger', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ service: 'render', authorizationTicket: 'dummy' })
    });

    let isDeployBlocked = deployRes.status === 403 || deployRes.status === 423;
    if (!isDeployBlocked) {
      const data = await deployRes.json();
      if (data.error && data.error.includes('EMERGENCY_STOP')) isDeployBlocked = true;
    }

    // 4d. Deactivate Emergency Stop
    const deactivateRes = await fetch('http://localhost:3000/api/portfolio/emergency-stop', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: false })
    }).then(r => r.json());

    results.push({
      id: 'SEC-ESTOP-01',
      name: 'Emergency Stop Operational Safety Gate',
      status: (activateRes.status?.emergencyStop === true && isBranchBlocked && isDeployBlocked && deactivateRes.status?.emergencyStop === false) ? 'PASS' : 'FAIL',
      details: { activateOk: activateRes.status?.emergencyStop, isBranchBlocked, isDeployBlocked, deactivateOk: !deactivateRes.status?.emergencyStop }
    });
  } catch (e) {
    results.push({ id: 'SEC-ESTOP-01', name: 'Emergency Stop Operational Safety Gate', status: 'ERROR', error: e.message });
  }

  // TEST 5: Database Backup Creation & Isolated Verification
  try {
    const backupRes = await fetch('http://localhost:3000/api/portfolio/database/backup', {
      method: 'POST'
    }).then(r => r.json());

    if (!backupRes.success || !backupRes.path) {
      throw new Error(`Backup API failed: ${JSON.stringify(backupRes)}`);
    }

    const backupFile = backupRes.path;
    if (!fs.existsSync(backupFile)) {
      throw new Error(`Backup file does not exist on disk: ${backupFile}`);
    }

    const stats = fs.statSync(backupFile);
    if (stats.size < 50000) {
      throw new Error(`Backup file is suspiciously small: ${stats.size} bytes`);
    }

    // Open isolated backup in read-only mode to verify schema & data
    const isolatedDb = new Database(backupFile, { readonly: true });
    const tables = isolatedDb.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all().map(r => r.name);
    
    // Check key tables in backup
    const expectedTables = ['audit_logs', 'portfolio_analytics_events', 'portfolio_notifications', 'portfolio_incidents'];
    const missingTables = expectedTables.filter(t => !tables.includes(t));
    
    const rowCounts = {};
    for (const t of expectedTables) {
      rowCounts[t] = isolatedDb.prepare(`SELECT COUNT(*) as count FROM ${t}`).get().count;
    }
    isolatedDb.close();

    results.push({
      id: 'SEC-BACKUP-01',
      name: 'Hot SQLite Backup & Disaster Recovery Verification',
      status: (missingTables.length === 0 && rowCounts['audit_logs'] > 0) ? 'PASS' : 'FAIL',
      details: {
        backupFile: path.basename(backupFile),
        sizeBytes: stats.size,
        tableCount: tables.length,
        verifiedTables: expectedTables,
        rowCounts
      }
    });
  } catch (e) {
    results.push({ id: 'SEC-BACKUP-01', name: 'Hot SQLite Backup & Disaster Recovery Verification', status: 'ERROR', error: e.message });
  }

  // Print results
  console.log('\n--- FORENSIC SECURITY & DATABASE TEST RESULTS ---');
  let passCount = 0;
  for (const r of results) {
    console.log(`[${r.status}] ${r.id}: ${r.name}`);
    if (r.details) console.log('   Details:', JSON.stringify(r.details));
    if (r.error) console.log('   Error:', r.error);
    if (r.status === 'PASS') passCount++;
  }
  console.log(`\nScore: ${passCount} / ${results.length} PASSED\n`);

  return { passCount, total: results.length, results };
}

runForensicSecurityDatabaseTests().then(res => {
  if (res.passCount === res.total) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}).catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
