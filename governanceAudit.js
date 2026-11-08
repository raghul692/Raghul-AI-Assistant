import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_FILE = path.join(__dirname, 'data', 'nexus.db');

const db = new Database(DB_FILE);

// Initialize Audit Logs & Pending Approvals Tables in SQLite
db.exec(`
  CREATE TABLE IF NOT EXISTS audit_logs (
    id TEXT PRIMARY KEY,
    timestamp INTEGER NOT NULL,
    actor TEXT NOT NULL,
    action TEXT NOT NULL,
    target TEXT,
    risk_level TEXT NOT NULL,
    status TEXT NOT NULL,
    justification TEXT,
    metadata TEXT,
    previous_hash TEXT,
    hash TEXT
  );

  CREATE TABLE IF NOT EXISTS pending_approvals (
    id TEXT PRIMARY KEY,
    timestamp INTEGER NOT NULL,
    action TEXT NOT NULL,
    target TEXT,
    params TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    requested_by TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_logs(timestamp DESC);
  CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_logs(action);
`);

try { db.exec(`ALTER TABLE audit_logs ADD COLUMN previous_hash TEXT;`); } catch(e) {}
try { db.exec(`ALTER TABLE audit_logs ADD COLUMN hash TEXT;`); } catch(e) {}

// RBAC Risk Levels
export const RISK_LEVELS = {
  READ: 'READ',         // Reading files, listing items - No approval needed
  COMPUTE: 'COMPUTE',   // Math, JS VM execution - Safe
  WRITE: 'WRITE',       // Creating files, updating database, saving events - Logged
  CRITICAL: 'CRITICAL'  // Terminal command, deleting records - Human-in-the-Loop approval required
};

/**
 * Immutable Audit Logger with SHA-256 Hash Chaining
 */
export function recordAuditLog({
  actor = 'Nexus-Agent',
  action,
  target = null,
  riskLevel = RISK_LEVELS.READ,
  status = 'SUCCESS',
  justification = '',
  metadata = {}
}) {
  const id = `audit_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const now = Date.now();
  try {
    // Get hash of previous record
    const lastRow = db.prepare('SELECT hash FROM audit_logs WHERE hash IS NOT NULL ORDER BY timestamp DESC LIMIT 1').get();
    const previousHash = lastRow?.hash || 'GENESIS_NEXUS_GOVERNANCE_LEDGER';

    const payload = `${id}|${now}|${actor}|${action}|${target || ''}|${riskLevel}|${status}|${previousHash}`;
    const hash = crypto.createHash('sha256').update(payload).digest('hex');

    const stmt = db.prepare(`
      INSERT INTO audit_logs (id, timestamp, actor, action, target, risk_level, status, justification, metadata, previous_hash, hash)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      id,
      now,
      actor,
      action,
      target,
      riskLevel,
      status,
      justification,
      JSON.stringify(metadata),
      previousHash,
      hash
    );
  } catch (err) {
    console.error('Audit logging error:', err);
  }
  return id;
}

/**
 * Cryptographic Tamper-Verification of the Audit Ledger
 */
export function verifyAuditLedgerIntegrity() {
  const rows = db.prepare('SELECT * FROM audit_logs WHERE hash IS NOT NULL ORDER BY timestamp ASC').all();
  if (rows.length === 0) return { valid: true, auditedCount: 0, message: 'Audit ledger is empty' };

  let expectedPrevHash = 'GENESIS_NEXUS_GOVERNANCE_LEDGER';

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (i === 0 && row.previous_hash !== expectedPrevHash) {
      expectedPrevHash = row.previous_hash;
    }

    if (row.previous_hash !== expectedPrevHash) {
      return {
        valid: false,
        tamperedRowId: row.id,
        index: i,
        error: `Broken hash chain: expected previous_hash ${expectedPrevHash}, got ${row.previous_hash}`
      };
    }

    const payload = `${row.id}|${row.timestamp}|${row.actor}|${row.action}|${row.target || ''}|${row.risk_level}|${row.status}|${row.previous_hash}`;
    const calculatedHash = crypto.createHash('sha256').update(payload).digest('hex');

    if (row.hash !== calculatedHash) {
      return {
        valid: false,
        tamperedRowId: row.id,
        index: i,
        error: `Content tampering detected: recalculated hash does not match stored hash`
      };
    }

    expectedPrevHash = row.hash;
  }

  return {
    valid: true,
    auditedCount: rows.length,
    latestBlockHash: expectedPrevHash
  };
}

/**
 * Query Audit Trail with Filtering
 */
export function getAuditLogs(limit = 50, filter = null) {
  try {
    let sql = 'SELECT * FROM audit_logs';
    const params = [];
    if (filter && filter.riskLevel) {
      sql += ' WHERE risk_level = ?';
      params.push(filter.riskLevel);
    }
    sql += ' ORDER BY timestamp DESC LIMIT ?';
    params.push(limit);

    const rows = db.prepare(sql).all(...params);
    return rows.map(r => ({
      ...r,
      metadata: r.metadata ? JSON.parse(r.metadata) : {}
    }));
  } catch (err) {
    console.error('Get audit logs error:', err);
    return [];
  }
}

/**
 * Human-in-the-Loop (HITL) Gate
 */
export function requestHumanApproval({ action, target, params = {}, requestedBy = 'Agent' }) {
  const id = `hitl_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const now = Date.now();
  try {
    const stmt = db.prepare(`
      INSERT INTO pending_approvals (id, timestamp, action, target, params, status, requested_by)
      VALUES (?, ?, ?, ?, ?, 'pending', ?)
    `);
    stmt.run(id, now, action, target, JSON.stringify(params), requestedBy);

    recordAuditLog({
      actor: requestedBy,
      action: `HITL_REQUEST: ${action}`,
      target,
      riskLevel: RISK_LEVELS.CRITICAL,
      status: 'PENDING_APPROVAL',
      justification: `Action requires human confirmation`,
      metadata: params
    });

    return {
      pendingApproval: true,
      approvalId: id,
      action,
      target,
      message: `Action "${action}" on "${target}" requires explicit human authorization.`
    };
  } catch (err) {
    console.error('HITL request error:', err);
    throw err;
  }
}

export function resolveHumanApproval(id, approved = true, reviewer = 'Raghul') {
  try {
    const row = db.prepare('SELECT * FROM pending_approvals WHERE id = ?').get(id);
    if (!row) throw new Error('Approval request not found');
    if (row.status !== 'pending') throw new Error(`Approval already resolved as ${row.status}`);

    const status = approved ? 'approved' : 'rejected';
    db.prepare('UPDATE pending_approvals SET status = ? WHERE id = ?').run(status, id);

    recordAuditLog({
      actor: reviewer,
      action: `HITL_RESOLUTION: ${row.action}`,
      target: row.target,
      riskLevel: RISK_LEVELS.CRITICAL,
      status: approved ? 'APPROVED' : 'REJECTED',
      justification: `Action was ${approved ? 'approved' : 'rejected'} by human reviewer`,
      metadata: { originalParams: JSON.parse(row.params) }
    });

    return {
      success: true,
      approvalId: id,
      status,
      action: row.action,
      params: JSON.parse(row.params)
    };
  } catch (err) {
    console.error('Resolve HITL error:', err);
    throw err;
  }
}

export function listPendingApprovals() {
  try {
    const rows = db.prepare("SELECT * FROM pending_approvals WHERE status = 'pending' ORDER BY timestamp DESC").all();
    return rows.map(r => ({
      ...r,
      params: r.params ? JSON.parse(r.params) : {}
    }));
  } catch (err) {
    console.error('List pending approvals error:', err);
    return [];
  }
}

/**
 * Circuit Breaker for Resilient Model & Tool Invocations
 */
class CircuitBreaker {
  constructor(failureThreshold = 4, recoveryTimeoutMs = 15000) {
    this.failureThreshold = failureThreshold;
    this.recoveryTimeoutMs = recoveryTimeoutMs;
    this.state = 'CLOSED'; // CLOSED, OPEN, HALF-OPEN
    this.failureCount = 0;
    this.lastFailureTime = null;
  }

  async execute(fn, fallbackFn = null) {
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailureTime > this.recoveryTimeoutMs) {
        this.state = 'HALF-OPEN';
      } else {
        if (fallbackFn) return await fallbackFn();
        throw new Error('Circuit Breaker is OPEN: Temporary service isolation active.');
      }
    }

    try {
      const result = await fn();
      if (this.state === 'HALF-OPEN') {
        this.state = 'CLOSED';
        this.failureCount = 0;
      }
      return result;
    } catch (err) {
      this.failureCount++;
      this.lastFailureTime = Date.now();
      if (this.failureCount >= this.failureThreshold) {
        this.state = 'OPEN';
        recordAuditLog({
          actor: 'CircuitBreaker',
          action: 'CIRCUIT_TRIPPED',
          target: fn.name || 'AnonymousOperation',
          riskLevel: RISK_LEVELS.CRITICAL,
          status: 'TRIPPED',
          justification: `Failures reached threshold (${this.failureCount})`
        });
      }
      if (fallbackFn) return await fallbackFn();
      throw err;
    }
  }

  getStatus() {
    return {
      state: this.state,
      failureCount: this.failureCount,
      lastFailureTime: this.lastFailureTime
    };
  }
}

export const systemCircuitBreaker = new CircuitBreaker();

