-- ============================================================================
-- MIGRATION 010: RELAX REMAINING NOT NULL CONSTRAINTS FOR 100% MIGRATION FIDELITY
-- Platform: Supabase PostgreSQL
-- ============================================================================

ALTER TABLE research_sections ALTER COLUMN "heading" DROP NOT NULL;
ALTER TABLE research_runs ALTER COLUMN "agent_name" DROP NOT NULL;
ALTER TABLE image_assets ALTER COLUMN "intent_category" DROP NOT NULL, ALTER COLUMN "file_path" DROP NOT NULL;
ALTER TABLE github_automations ALTER COLUMN "action_type" DROP NOT NULL, ALTER COLUMN "name" DROP NOT NULL;
ALTER TABLE github_audit_ledger ALTER COLUMN "previous_hash" DROP NOT NULL, ALTER COLUMN "entry_hash" DROP NOT NULL;
ALTER TABLE research_quality_checks ALTER COLUMN "created_at" DROP NOT NULL;
ALTER TABLE github_connections ALTER COLUMN "repo" DROP NOT NULL;
ALTER TABLE github_approvals ALTER COLUMN "target_repo" DROP NOT NULL, ALTER COLUMN "summary" DROP NOT NULL, ALTER COLUMN "risk_level" DROP NOT NULL, ALTER COLUMN "requested_by" DROP NOT NULL;
ALTER TABLE portfolio_config ALTER COLUMN "hero_subtext" DROP NOT NULL, ALTER COLUMN "status_badge" DROP NOT NULL, ALTER COLUMN "current_focus" DROP NOT NULL;
