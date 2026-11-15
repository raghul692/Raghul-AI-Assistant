import express from 'express';
import {
  getAuditLogs,
  listPendingApprovals,
  resolveHumanApproval,
  verifyAuditLedgerIntegrity
} from '../governanceAudit.js';
import { requireSensitiveOperationAuth } from '../middleware/auth.js';

const router = express.Router();

// 1. Audit Logs
router.get('/audit', (req, res) => {
  const limit = parseInt(req.query.limit || '50', 10);
  res.json({ logs: getAuditLogs(limit) });
});

// 2. Pending Approvals
router.get('/approvals', (req, res) => {
  res.json({ approvals: listPendingApprovals() });
});

// 3. Resolve Approval (Privileged human governance action)
router.post('/approvals/:id', requireSensitiveOperationAuth, (req, res) => {
  try {
    const { approved = true, reviewer = 'Raghul' } = req.body;
    const result = resolveHumanApproval(req.params.id, Boolean(approved), reviewer);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 4. Verify Immutable Audit Ledger Integrity
router.get('/verify', (req, res) => {
  try {
    const verification = verifyAuditLedgerIntegrity();
    res.json({ success: true, verification });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;

