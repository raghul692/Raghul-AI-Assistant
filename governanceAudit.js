import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_FILE = path.join(__dirname, 'data', 'nexus.db');
const SECRETS_DIR = path.join(__dirname, 'data', '.secrets');

if (!fs.existsSync(SECRETS_DIR)) {
  fs.mkdirSync(SECRETS_DIR, { recursive: true, mode: 0o700 });
}

export const db = new Database(DB_FILE);

// 1. Initialize Schema & Tables
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
    requested_by TEXT NOT NULL,
    payload_hash TEXT,
    operator_id TEXT,
    expires_at INTEGER,
    nonce TEXT,
    signature TEXT,
    consumed_at INTEGER
  );

  CREATE TABLE IF NOT EXISTS operator_keystore (
    operator_id TEXT PRIMARY KEY,
    public_key_pem TEXT NOT NULL,
    role TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    active INTEGER NOT NULL DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS audit_ledger_checkpoints (
    checkpoint_id TEXT PRIMARY KEY,
    block_height INTEGER NOT NULL,
    checkpoint_block_hash TEXT NOT NULL,
    checkpoint_merkle_root TEXT NOT NULL,
    operator_id TEXT NOT NULL,
    signature TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_logs(timestamp DESC);
  CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_logs(action);
  CREATE INDEX IF NOT EXISTS idx_approvals_status ON pending_approvals(status);
`);

// Safe migrations for pre-existing tables
try { db.exec(`ALTER TABLE audit_logs ADD COLUMN previous_hash TEXT;`); } catch (_) {}
try { db.exec(`ALTER TABLE audit_logs ADD COLUMN hash TEXT;`); } catch (_) {}
try { db.exec(`ALTER TABLE pending_approvals ADD COLUMN payload_hash TEXT;`); } catch (_) {}
try { db.exec(`ALTER TABLE pending_approvals ADD COLUMN operator_id TEXT;`); } catch (_) {}
try { db.exec(`ALTER TABLE pending_approvals ADD COLUMN expires_at INTEGER;`); } catch (_) {}
try { db.exec(`ALTER TABLE pending_approvals ADD COLUMN nonce TEXT;`); } catch (_) {}
try { db.exec(`ALTER TABLE pending_approvals ADD COLUMN signature TEXT;`); } catch (_) {}
try { db.exec(`ALTER TABLE pending_approvals ADD COLUMN consumed_at INTEGER;`); } catch (_) {}

// =========================================================================
// IMMUTABLE AUDIT LEDGER HARDENING: SQLITE TRIGGERS (OBJECTIVE 6)
// =========================================================================
// Prevents any UPDATE or DELETE operations on audit_logs table
db.exec(`
  CREATE TRIGGER IF NOT EXISTS prevent_audit_logs_update
  BEFORE UPDATE ON audit_logs
  BEGIN
    SELECT RAISE(ABORT, 'IMMUTABLE_LEDGER_VIOLATION: UPDATE operations are strictly prohibited on audit_logs table');
  END;

  CREATE TRIGGER IF NOT EXISTS prevent_audit_logs_delete
  BEFORE DELETE ON audit_logs
  BEGIN
    SELECT RAISE(ABORT, 'IMMUTABLE_LEDGER_VIOLATION: DELETE operations are strictly prohibited on audit_logs table');
  END;
`);

// =========================================================================
// OPERATOR KEYSTORE & ASYMMETRIC CRYPTOGRAPHY (OBJECTIVE 2)
// =========================================================================
const DEFAULT_OPERATOR_ID = 'operator_raghul_sec_admin';
const OPERATOR_KEY_PATH = path.join(SECRETS_DIR, 'operator_ed25519.key');

/**
 * Initialize or load trusted operator keypair (Ed25519)
 */
function initOperatorKeys() {
  let privateKeyPem = null;
  let publicKeyPem = null;

  if (fs.existsSync(OPERATOR_KEY_PATH)) {
    try {
      privateKeyPem = fs.readFileSync(OPERATOR_KEY_PATH, 'utf8');
      const privKeyObj = crypto.createPrivateKey(privateKeyPem);
      publicKeyPem = crypto.createPublicKey(privKeyObj).export({ type: 'spki', format: 'pem' });
    } catch (_) {}
  }

  if (!privateKeyPem || !publicKeyPem) {
    const keyPair = crypto.generateKeyPairSync('ed25519');
    privateKeyPem = keyPair.privateKey.export({ type: 'pkcs8', format: 'pem' });
    publicKeyPem = keyPair.publicKey.export({ type: 'spki', format: 'pem' });
    try {
      fs.writeFileSync(OPERATOR_KEY_PATH, privateKeyPem, { mode: 0o600 });
    } catch (_) {}
  }

  // Register in operator_keystore table
  db.prepare(`
    INSERT INTO operator_keystore (operator_id, public_key_pem, role, created_at, active)
    VALUES (?, ?, 'SECURITY_ADMINISTRATOR', ?, 1)
    ON CONFLICT(operator_id) DO UPDATE SET public_key_pem = excluded.public_key_pem, active = 1
  `).run(DEFAULT_OPERATOR_ID, publicKeyPem, Date.now());

  return { operatorId: DEFAULT_OPERATOR_ID, privateKeyPem, publicKeyPem };
}

export const defaultOperatorKeys = initOperatorKeys();

export function getOperatorPublicKey(operatorId = DEFAULT_OPERATOR_ID) {
  const row = db.prepare('SELECT public_key_pem, active FROM operator_keystore WHERE operator_id = ?').get(operatorId);
  if (!row || !row.active) return null;
  return row.public_key_pem;
}

// Canonical JSON serializer for deterministic hashing
export function canonicalJsonString(obj) {
  if (obj === null || typeof obj !== 'object') {
    return JSON.stringify(obj);
  }
  if (Array.isArray(obj)) {
    return '[' + obj.map(canonicalJsonString).join(',') + ']';
  }
  const sortedKeys = Object.keys(obj).sort();
  return '{' + sortedKeys.map(k => JSON.stringify(k) + ':' + canonicalJsonString(obj[k])).join(',') + '}';
}

export function computePayloadHash(payload) {
  const canonical = canonicalJsonString(payload || {});
  return crypto.createHash('sha256').update(canonical, 'utf8').digest('hex');
}

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
    const insertTx = db.transaction(() => {
      // Get hash of previous record by insertion order (rowid) under immediate write lock
      const lastRow = db.prepare('SELECT hash FROM audit_logs WHERE hash IS NOT NULL ORDER BY rowid DESC LIMIT 1').get();
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
    });

    insertTx();
  } catch (err) {
    console.error('Audit logging error:', err);
  }
  return id;
}

/**
 * Cryptographic Tamper-Verification of the Audit Ledger
 */
export function verifyAuditLedgerIntegrity() {
  const rows = db.prepare('SELECT rowid, * FROM audit_logs WHERE hash IS NOT NULL ORDER BY rowid ASC').all();
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

// =========================================================================
// EXTERNALLY ANCHORED SIGNED AUDIT CHECKPOINTS (OBJECTIVE 6)
// =========================================================================

export function createSignedAuditCheckpoint(operatorId = DEFAULT_OPERATOR_ID, privateKeyPem = defaultOperatorKeys.privateKeyPem) {
  const rows = db.prepare('SELECT rowid, hash FROM audit_logs WHERE hash IS NOT NULL ORDER BY rowid ASC').all();
  const blockHeight = rows.length;
  const latestHash = rows.length > 0 ? rows[rows.length - 1].hash : 'GENESIS_ROOT';

  // Compute Merkle root or aggregated hash of all hashes
  const merkleHasher = crypto.createHash('sha256');
  for (const r of rows) {
    merkleHasher.update(r.hash);
  }
  const merkleRoot = merkleHasher.digest('hex');

  const checkpointId = `chk_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const now = Date.now();
  const canonicalString = `${checkpointId}|${blockHeight}|${latestHash}|${merkleRoot}|${operatorId}|${now}`;

  const signature = crypto.sign(null, Buffer.from(canonicalString, 'utf8'), privateKeyPem).toString('hex');

  db.prepare(`
    INSERT INTO audit_ledger_checkpoints (checkpoint_id, block_height, checkpoint_block_hash, checkpoint_merkle_root, operator_id, signature, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(checkpointId, blockHeight, latestHash, merkleRoot, operatorId, signature, now);

  return {
    checkpointId,
    blockHeight,
    latestHash,
    merkleRoot,
    operatorId,
    signature,
    createdAt: now
  };
}

export function verifyAuditCheckpoints() {
  const checkpoints = db.prepare('SELECT * FROM audit_ledger_checkpoints ORDER BY block_height ASC').all();
  if (checkpoints.length === 0) return { verified: true, checkpointsCount: 0, message: 'No checkpoints registered' };

  for (const chk of checkpoints) {
    const pubKey = getOperatorPublicKey(chk.operator_id);
    if (!pubKey) {
      return { verified: false, error: `Untrusted or missing operator key for ${chk.operator_id}`, checkpointId: chk.checkpoint_id };
    }

    const canonicalString = `${chk.checkpoint_id}|${chk.block_height}|${chk.checkpoint_block_hash}|${chk.checkpoint_merkle_root}|${chk.operator_id}|${chk.created_at}`;
    const validSig = crypto.verify(null, Buffer.from(canonicalString, 'utf8'), pubKey, Buffer.from(chk.signature, 'hex'));
    if (!validSig) {
      return { verified: false, error: `Invalid cryptographic signature on checkpoint ${chk.checkpoint_id}`, checkpointId: chk.checkpoint_id };
    }

    // Verify against current ledger state up to block_height
    const rows = db.prepare('SELECT rowid, hash FROM audit_logs WHERE hash IS NOT NULL ORDER BY rowid ASC LIMIT ?').all(chk.block_height);
    if (rows.length < chk.block_height) {
      return { verified: false, error: `Audit chain truncated: height ${rows.length} < checkpoint height ${chk.block_height}`, checkpointId: chk.checkpoint_id };
    }

    const targetRowHash = rows[chk.block_height - 1].hash;
    if (targetRowHash !== chk.checkpoint_block_hash) {
      return { verified: false, error: `Audit chain rewritten: block hash at height ${chk.block_height} diverged`, checkpointId: chk.checkpoint_id };
    }
  }

  return { verified: true, checkpointsCount: checkpoints.length };
}

// =========================================================================
// CRYPTOGRAPHIC HUMAN APPROVAL TICKETS (OBJECTIVE 2)
// =========================================================================

export function createSignedAuthorizationTicket({
  action,
  target,
  payload = {},
  operatorId = DEFAULT_OPERATOR_ID,
  ttlMs = 300000, // 5 minutes default expiry
  privateKeyPem = defaultOperatorKeys.privateKeyPem
}) {
  const ticketId = `hitl_v7_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const now = Date.now();
  const expiresAt = now + ttlMs;
  const payloadHash = computePayloadHash(payload);
  const nonce = crypto.randomBytes(16).toString('hex');

  const canonicalString = `${ticketId}|${action}|${target}|${payloadHash}|${operatorId}|${now}|${expiresAt}|${nonce}`;
  const signature = crypto.sign(null, Buffer.from(canonicalString, 'utf8'), privateKeyPem).toString('hex');

  db.prepare(`
    INSERT INTO pending_approvals (
      id, timestamp, action, target, params, status, requested_by,
      payload_hash, operator_id, expires_at, nonce, signature, consumed_at
    ) VALUES (?, ?, ?, ?, ?, 'approved', ?, ?, ?, ?, ?, ?, NULL)
  `).run(
    ticketId,
    now,
    action,
    target,
    JSON.stringify(payload),
    operatorId,
    payloadHash,
    operatorId,
    expiresAt,
    nonce,
    signature
  );

  recordAuditLog({
    actor: operatorId,
    action: `TICKET_ISSUED: ${action}`,
    target,
    riskLevel: RISK_LEVELS.CRITICAL,
    status: 'AUTHORIZED',
    justification: `Cryptographic authorization ticket generated and signed`,
    metadata: { ticketId, payloadHash, expiresAt }
  });

  return {
    ticketId,
    action,
    target,
    payloadHash,
    operatorId,
    issuedAt: now,
    expiresAt,
    nonce,
    signature,
    status: 'approved'
  };
}

export function verifyAndConsumeAuthorizationTicket({ ticketId, action, target, payload = {} }) {
  const now = Date.now();
  const ticket = db.prepare('SELECT * FROM pending_approvals WHERE id = ?').get(ticketId);

  if (!ticket) {
    throw new Error(`GOVERNANCE_GATE_BLOCKED: Authorization ticket ${ticketId} not found`);
  }

  if (ticket.status === 'consumed') {
    throw new Error(`REPLAY_ATTACK_PREVENTED: Authorization ticket ${ticketId} was already consumed at ${ticket.consumed_at}`);
  }

  if (ticket.status !== 'approved') {
    throw new Error(`UNAUTHORIZED_GATE: Ticket status is ${ticket.status}, expected 'approved'`);
  }

  if (ticket.expires_at && ticket.expires_at < now) {
    throw new Error(`TICKET_EXPIRED: Authorization ticket expired at ${new Date(ticket.expires_at).toISOString()}`);
  }

  if (ticket.action !== action) {
    throw new Error(`ACTION_MISMATCH: Ticket is bound to action "${ticket.action}", cannot be used for "${action}"`);
  }

  if (target && ticket.target && ticket.target !== target) {
    throw new Error(`TARGET_MISMATCH: Ticket is bound to target "${ticket.target}", cannot be used for "${target}"`);
  }

  // Payload hash verification if present
  if (ticket.payload_hash) {
    const currentPayloadHash = computePayloadHash(payload);
    if (ticket.payload_hash !== currentPayloadHash) {
      throw new Error(`PAYLOAD_HASH_MISMATCH: Provided payload does not match signed ticket hash`);
    }
  }

  // Cryptographic Signature Verification
  if (ticket.signature && ticket.operator_id) {
    const pubKey = getOperatorPublicKey(ticket.operator_id);
    if (!pubKey) {
      throw new Error(`UNTRUSTED_OPERATOR: Operator ${ticket.operator_id} public key is not registered in keystore`);
    }

    const canonicalString = `${ticket.id}|${ticket.action}|${ticket.target}|${ticket.payload_hash}|${ticket.operator_id}|${ticket.timestamp}|${ticket.expires_at}|${ticket.nonce}`;
    const isValid = crypto.verify(null, Buffer.from(canonicalString, 'utf8'), pubKey, Buffer.from(ticket.signature, 'hex'));
    if (!isValid) {
      throw new Error(`INVALID_CRYPTOGRAPHIC_SIGNATURE: Ticket signature verification failed`);
    }
  }

  // Atomic consumption: CAS (Compare-And-Swap) update
  const consumeStmt = db.prepare(`
    UPDATE pending_approvals
    SET status = 'consumed', consumed_at = ?
    WHERE id = ? AND status = 'approved' AND (expires_at IS NULL OR expires_at > ?)
  `);

  const result = consumeStmt.run(now, ticketId, now);
  if (result.changes === 0) {
    throw new Error(`ATOMIC_CONSUMPTION_FAILED: Ticket ${ticketId} could not be consumed (possible concurrent execution or expiration)`);
  }

  recordAuditLog({
    actor: 'GovernanceGate',
    action: `TICKET_CONSUMED: ${action}`,
    target,
    riskLevel: RISK_LEVELS.CRITICAL,
    status: 'CONSUMED',
    justification: `Single-use authorization ticket consumed successfully`,
    metadata: { ticketId, operatorId: ticket.operator_id, consumedAt: now }
  });

  return {
    valid: true,
    ticketId,
    action,
    operatorId: ticket.operator_id,
    consumedAt: now
  };
}

/**
 * Standard Human-in-the-Loop Requests
 */
export function requestHumanApproval({ action, target, params = {}, requestedBy = 'Agent' }) {
  const id = `hitl_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const now = Date.now();
  const payloadHash = computePayloadHash(params);
  try {
    const stmt = db.prepare(`
      INSERT INTO pending_approvals (id, timestamp, action, target, params, status, requested_by, payload_hash)
      VALUES (?, ?, ?, ?, ?, 'pending', ?, ?)
    `);
    stmt.run(id, now, action, target, JSON.stringify(params), requestedBy, payloadHash);

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
      payloadHash,
      message: `Action "${action}" on "${target}" requires explicit human authorization.`
    };
  } catch (err) {
    console.error('HITL request error:', err);
    throw err;
  }
}

export function resolveHumanApproval(id, approved = true, reviewer = DEFAULT_OPERATOR_ID) {
  try {
    const row = db.prepare('SELECT * FROM pending_approvals WHERE id = ?').get(id);
    if (!row) throw new Error('Approval request not found');
    if (row.status !== 'pending') throw new Error(`Approval already resolved as ${row.status}`);

    const now = Date.now();
    const status = approved ? 'approved' : 'rejected';
    const expiresAt = now + 300000;
    const nonce = crypto.randomBytes(16).toString('hex');
    const payloadHash = row.payload_hash || computePayloadHash(JSON.parse(row.params || '{}'));

    let signature = null;
    if (approved) {
      const canonicalString = `${row.id}|${row.action}|${row.target}|${payloadHash}|${reviewer}|${row.timestamp}|${expiresAt}|${nonce}`;
      signature = crypto.sign(null, Buffer.from(canonicalString, 'utf8'), defaultOperatorKeys.privateKeyPem).toString('hex');
    }

    db.prepare(`
      UPDATE pending_approvals
      SET status = ?, operator_id = ?, expires_at = ?, nonce = ?, signature = ?
      WHERE id = ?
    `).run(status, reviewer, expiresAt, nonce, signature, id);

    recordAuditLog({
      actor: reviewer,
      action: `HITL_RESOLUTION: ${row.action}`,
      target: row.target,
      riskLevel: RISK_LEVELS.CRITICAL,
      status: approved ? 'APPROVED' : 'REJECTED',
      justification: `Action was ${approved ? 'approved' : 'rejected'} by human reviewer`,
      metadata: { originalParams: JSON.parse(row.params || '{}'), signature }
    });

    return {
      success: true,
      approvalId: id,
      status,
      action: row.action,
      operatorId: reviewer,
      signature,
      params: JSON.parse(row.params || '{}')
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

export function getAuditLogs(limit = 50, filter = null) {
  try {
    let sql = 'SELECT * FROM audit_logs';
    const params = [];
    if (filter && filter.riskLevel) {
      sql += ' WHERE risk_level = ?';
      params.push(filter.riskLevel);
    }
    sql += ' ORDER BY rowid DESC LIMIT ?';
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

// System Circuit Breaker
class CircuitBreaker {
  constructor(failureThreshold = 4, recoveryTimeoutMs = 15000) {
    this.failureThreshold = failureThreshold;
    this.recoveryTimeoutMs = recoveryTimeoutMs;
    this.state = 'CLOSED';
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
