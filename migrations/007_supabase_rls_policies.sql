-- ============================================================================
-- MIGRATION 007: SUPABASE ROW LEVEL SECURITY (RLS) & SERVICE ROLE HARDENING
-- Platform: Supabase PostgreSQL
-- ============================================================================

-- Enable RLS on sensitive conversation, memory and audit tables
ALTER TABLE chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_memories ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE github_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE github_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE research_jobs ENABLE ROW LEVEL SECURITY;

-- Service Role Key (Render Web Service & Background Worker) has full access
CREATE POLICY service_role_all_chats ON chats
    FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY service_role_all_messages ON messages
    FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY service_role_all_memories ON user_memories
    FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY service_role_all_user_settings ON user_settings
    FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY service_role_all_audit_logs ON audit_logs
    FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY service_role_all_gh_conn ON github_connections
    FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY service_role_all_gh_approvals ON github_approvals
    FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY service_role_all_job_queue ON job_queue
    FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY service_role_all_research_jobs ON research_jobs
    FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Public (anon) is granted read-only access to public portfolio config and live activity
ALTER TABLE portfolio_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY anon_read_portfolio_config ON portfolio_config
    FOR SELECT TO anon USING (true);

ALTER TABLE portfolio_live_activity ENABLE ROW LEVEL SECURITY;
CREATE POLICY anon_read_portfolio_activity ON portfolio_live_activity
    FOR SELECT TO anon USING (true);
