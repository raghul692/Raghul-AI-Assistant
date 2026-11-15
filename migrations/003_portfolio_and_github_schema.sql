-- ============================================================================
-- MIGRATION 003: PORTFOLIO INTELLIGENCE & GITHUB AUTONOMOUS AGENT SYSTEM
-- Platform: Supabase PostgreSQL
-- ============================================================================

CREATE TABLE IF NOT EXISTS github_connections (
    id TEXT PRIMARY KEY,
    owner TEXT NOT NULL,
    repo TEXT NOT NULL,
    default_branch TEXT NOT NULL DEFAULT 'main',
    connected_at BIGINT NOT NULL,
    last_sync BIGINT,
    scopes TEXT,
    webhook_id TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    metadata TEXT
);

CREATE TABLE IF NOT EXISTS github_automations (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    workflow_type TEXT NOT NULL,
    trigger_type TEXT NOT NULL,
    schedule_cron TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    requires_approval INTEGER NOT NULL DEFAULT 1,
    action_type TEXT NOT NULL,
    action_payload TEXT,
    last_run_at BIGINT,
    last_run_status TEXT,
    success_count INTEGER NOT NULL DEFAULT 0,
    failure_count INTEGER NOT NULL DEFAULT 0,
    created_at BIGINT NOT NULL,
    updated_at BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS github_automation_runs (
    id TEXT PRIMARY KEY,
    automation_id TEXT NOT NULL REFERENCES github_automations(id) ON DELETE CASCADE,
    trigger_source TEXT NOT NULL,
    status TEXT NOT NULL,
    started_at BIGINT NOT NULL,
    finished_at BIGINT,
    duration_ms BIGINT,
    input_payload TEXT,
    output_result TEXT,
    error_message TEXT,
    approval_id TEXT,
    commit_sha TEXT
);

CREATE INDEX IF NOT EXISTS idx_gh_runs_auto_id ON github_automation_runs(automation_id);

CREATE TABLE IF NOT EXISTS github_webhooks (
    id TEXT PRIMARY KEY,
    event_type TEXT NOT NULL,
    delivery_id TEXT UNIQUE,
    payload TEXT NOT NULL,
    processed INTEGER NOT NULL DEFAULT 0,
    created_at BIGINT NOT NULL,
    processed_at BIGINT,
    status TEXT NOT NULL DEFAULT 'received',
    error TEXT
);

CREATE TABLE IF NOT EXISTS github_approvals (
    id TEXT PRIMARY KEY,
    action_type TEXT NOT NULL,
    target_repo TEXT NOT NULL,
    branch TEXT,
    summary TEXT NOT NULL,
    diff_or_content TEXT,
    risk_level TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    requested_by TEXT NOT NULL,
    approved_by TEXT,
    decision_reason TEXT,
    created_at BIGINT NOT NULL,
    decided_at BIGINT
);

CREATE INDEX IF NOT EXISTS idx_gh_approvals_status ON github_approvals(status);

CREATE TABLE IF NOT EXISTS github_audit_ledger (
    id TEXT PRIMARY KEY,
    timestamp BIGINT NOT NULL,
    actor TEXT NOT NULL,
    action TEXT NOT NULL,
    target TEXT NOT NULL,
    status TEXT NOT NULL,
    details TEXT,
    previous_hash TEXT NOT NULL,
    entry_hash TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_gh_audit_timestamp ON github_audit_ledger(timestamp DESC);

-- Portfolio OS Tables
CREATE TABLE IF NOT EXISTS portfolio_config (
    id TEXT PRIMARY KEY,
    hero_headline TEXT NOT NULL,
    hero_subtext TEXT NOT NULL,
    status_badge TEXT NOT NULL,
    current_focus TEXT NOT NULL,
    auto_sync_github INTEGER NOT NULL DEFAULT 1,
    updated_at BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS portfolio_content_drafts (
    id TEXT PRIMARY KEY,
    section TEXT NOT NULL,
    title TEXT NOT NULL,
    current_content TEXT,
    proposed_content TEXT NOT NULL,
    diff_summary TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    approval_id TEXT,
    created_at BIGINT NOT NULL,
    updated_at BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS portfolio_deployments (
    id TEXT PRIMARY KEY,
    platform TEXT NOT NULL,
    deployment_id TEXT NOT NULL,
    url TEXT,
    commit_sha TEXT,
    status TEXT NOT NULL,
    build_time_ms BIGINT,
    triggered_by TEXT NOT NULL,
    error_message TEXT,
    created_at BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS portfolio_analytics_cache (
    key TEXT PRIMARY KEY,
    data_json TEXT NOT NULL,
    period_start BIGINT,
    period_end BIGINT,
    computed_at BIGINT NOT NULL,
    ttl_seconds INTEGER NOT NULL DEFAULT 3600
);

CREATE TABLE IF NOT EXISTS portfolio_knowledge_index (
    id TEXT PRIMARY KEY,
    doc_type TEXT NOT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    embedding_json TEXT,
    tags TEXT,
    metadata TEXT,
    indexed_at BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS portfolio_contacts_cache (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    message TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'new',
    created_at BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS portfolio_analytics_events (
    id TEXT PRIMARY KEY,
    event_type TEXT NOT NULL,
    path TEXT NOT NULL,
    target TEXT,
    referrer TEXT,
    country TEXT,
    country_code TEXT,
    ip_hash TEXT,
    user_agent TEXT,
    created_at BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_pae_event_type ON portfolio_analytics_events(event_type);
CREATE INDEX IF NOT EXISTS idx_pae_created ON portfolio_analytics_events(created_at DESC);

CREATE TABLE IF NOT EXISTS portfolio_live_activity (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    detail TEXT,
    country TEXT,
    country_code TEXT,
    status TEXT NOT NULL DEFAULT 'SUCCESS',
    badge TEXT,
    timestamp BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_pla_timestamp ON portfolio_live_activity(timestamp DESC);

CREATE TABLE IF NOT EXISTS portfolio_automation_tasks (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    status TEXT NOT NULL,
    progress INTEGER NOT NULL DEFAULT 0,
    current_step TEXT,
    details TEXT,
    created_at BIGINT NOT NULL,
    updated_at BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS portfolio_notifications (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'info',
    is_read INTEGER NOT NULL DEFAULT 0,
    link TEXT,
    metadata TEXT,
    created_at BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_pnotif_read ON portfolio_notifications(is_read);

CREATE TABLE IF NOT EXISTS portfolio_incidents (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    severity TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'open',
    detected_at BIGINT NOT NULL,
    resolved_at BIGINT,
    resolution_notes TEXT,
    affected_service TEXT,
    mitigation_steps TEXT,
    root_cause TEXT
);

CREATE TABLE IF NOT EXISTS portfolio_user_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS portfolio_system_state (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS portfolio_job_queue (
    id TEXT PRIMARY KEY,
    idempotency_key TEXT UNIQUE,
    name TEXT NOT NULL,
    job_type TEXT NOT NULL,
    payload TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    attempts INTEGER NOT NULL DEFAULT 0,
    max_attempts INTEGER NOT NULL DEFAULT 3,
    next_retry_at BIGINT,
    error_message TEXT,
    result TEXT,
    created_at BIGINT NOT NULL,
    started_at BIGINT,
    finished_at BIGINT
);

CREATE INDEX IF NOT EXISTS idx_pjq_status ON portfolio_job_queue(status);
