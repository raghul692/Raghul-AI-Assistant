-- ============================================================================
-- MIGRATION 013: RECONCILE CHECKPOINTS AND PROVIDER SETTINGS CONSTRAINTS
-- Platform: Supabase PostgreSQL
-- Resolves historical NOT NULL discrepancies for audit checkpoints and provider settings
-- ============================================================================

ALTER TABLE audit_ledger_checkpoints ALTER COLUMN "timestamp" DROP NOT NULL;
ALTER TABLE audit_ledger_checkpoints ALTER COLUMN "up_to_audit_id" DROP NOT NULL;
ALTER TABLE audit_ledger_checkpoints ALTER COLUMN "accumulated_hash" DROP NOT NULL;
ALTER TABLE audit_ledger_checkpoints ALTER COLUMN "signed_by" DROP NOT NULL;
ALTER TABLE audit_ledger_checkpoints ALTER COLUMN "log_count" DROP NOT NULL;

ALTER TABLE provider_settings ALTER COLUMN "value" DROP NOT NULL;
