-- ============================================================================
-- MIGRATION 011: RELAX METADATA NOT NULL CONSTRAINTS
-- Platform: Supabase PostgreSQL
-- ============================================================================

ALTER TABLE portfolio_config ALTER COLUMN "updated_at" DROP NOT NULL;
ALTER TABLE github_connections ALTER COLUMN "connected_at" DROP NOT NULL;
ALTER TABLE github_webhooks ALTER COLUMN "event_type" DROP NOT NULL, ALTER COLUMN "payload" DROP NOT NULL;
ALTER TABLE audit_ledger_checkpoints ALTER COLUMN "checkpoint_id" DROP NOT NULL;
ALTER TABLE operator_keystore ALTER COLUMN "public_key_hex" DROP NOT NULL;
ALTER TABLE provider_settings ALTER COLUMN "updated_at" DROP NOT NULL;
