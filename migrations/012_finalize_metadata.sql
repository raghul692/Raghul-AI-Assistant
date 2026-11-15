-- ============================================================================
-- MIGRATION 012: FINALIZE METADATA COLUMN ALIGNMENT
-- Platform: Supabase PostgreSQL
-- ============================================================================

ALTER TABLE audit_ledger_checkpoints ALTER COLUMN "id" DROP NOT NULL;
ALTER TABLE github_webhooks ALTER COLUMN "id" DROP NOT NULL;
ALTER TABLE operator_keystore ALTER COLUMN "key_id" DROP NOT NULL;
ALTER TABLE provider_settings ALTER COLUMN "key" DROP NOT NULL;
