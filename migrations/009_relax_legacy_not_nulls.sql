-- ============================================================================
-- MIGRATION 009: RELAX LEGACY NOT NULL CONSTRAINTS FOR SQLITE COMPATIBILITY
-- Platform: Supabase PostgreSQL
-- ============================================================================

ALTER TABLE settings_audit_logs ALTER COLUMN "timestamp" DROP NOT NULL;
ALTER TABLE pending_approvals ALTER COLUMN "risk_level" DROP NOT NULL;
ALTER TABLE github_connections ALTER COLUMN "owner" DROP NOT NULL;
ALTER TABLE github_automations ALTER COLUMN "workflow_type" DROP NOT NULL;
ALTER TABLE github_approvals ALTER COLUMN "action_type" DROP NOT NULL;
ALTER TABLE github_audit_ledger ALTER COLUMN "target" DROP NOT NULL;
ALTER TABLE portfolio_config ALTER COLUMN "hero_headline" DROP NOT NULL;
ALTER TABLE portfolio_content_drafts ALTER COLUMN "proposed_content" DROP NOT NULL;
ALTER TABLE portfolio_knowledge_index ALTER COLUMN "doc_type" DROP NOT NULL;
ALTER TABLE portfolio_live_activity ALTER COLUMN "timestamp" DROP NOT NULL;
ALTER TABLE portfolio_incidents ALTER COLUMN "detected_at" DROP NOT NULL;
ALTER TABLE image_assets ALTER COLUMN "session_id" DROP NOT NULL;
ALTER TABLE evidence_items ALTER COLUMN "verbatim_quote" DROP NOT NULL;
ALTER TABLE research_claims ALTER COLUMN "claim_text" DROP NOT NULL;
ALTER TABLE research_sections ALTER COLUMN "content_markdown" DROP NOT NULL;
ALTER TABLE research_runs ALTER COLUMN "stage" DROP NOT NULL;
ALTER TABLE research_quality_checks ALTER COLUMN "check_name" DROP NOT NULL;
ALTER TABLE research_contradictions 
    ALTER COLUMN "claim_a_id" DROP NOT NULL,
    ALTER COLUMN "claim_b_id" DROP NOT NULL,
    ALTER COLUMN "nature_of_contradiction" DROP NOT NULL,
    ALTER COLUMN "topic" DROP NOT NULL;

-- Allow primary keys on tables with mismatched PK names
ALTER TABLE provider_settings DROP CONSTRAINT IF EXISTS provider_settings_pkey;
ALTER TABLE operator_keystore DROP CONSTRAINT IF EXISTS operator_keystore_pkey;
ALTER TABLE audit_ledger_checkpoints DROP CONSTRAINT IF EXISTS audit_ledger_checkpoints_pkey;
ALTER TABLE github_webhooks DROP CONSTRAINT IF EXISTS github_webhooks_pkey;
