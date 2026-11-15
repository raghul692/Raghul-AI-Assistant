-- ============================================================================
-- MIGRATION 004: GOVERNANCE, AUDIT LEDGER & PRODUCTIVITY ENGINE
-- Platform: Supabase PostgreSQL
-- ============================================================================

CREATE TABLE IF NOT EXISTS audit_logs (
    id TEXT PRIMARY KEY,
    timestamp BIGINT NOT NULL,
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

CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_actor ON audit_logs(actor);

CREATE TABLE IF NOT EXISTS pending_approvals (
    id TEXT PRIMARY KEY,
    timestamp BIGINT NOT NULL,
    action TEXT NOT NULL,
    target TEXT,
    params TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    risk_level TEXT NOT NULL,
    required_role TEXT NOT NULL DEFAULT 'OPERATOR',
    approver TEXT,
    decision_reason TEXT,
    resolved_at BIGINT,
    signature TEXT,
    rejection_reason TEXT
);

CREATE INDEX IF NOT EXISTS idx_pending_approvals_status ON pending_approvals(status);

CREATE TABLE IF NOT EXISTS operator_keystore (
    key_id TEXT PRIMARY KEY,
    public_key_hex TEXT NOT NULL,
    role TEXT NOT NULL,
    created_at BIGINT NOT NULL,
    revoked INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS audit_ledger_checkpoints (
    id TEXT PRIMARY KEY,
    timestamp BIGINT NOT NULL,
    up_to_audit_id TEXT NOT NULL,
    accumulated_hash TEXT NOT NULL,
    signature TEXT NOT NULL,
    signed_by TEXT NOT NULL,
    log_count INTEGER NOT NULL
);

-- Autonomous Tasks (Orchestrator)
CREATE TABLE IF NOT EXISTS autonomous_tasks (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    goal TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'planned',
    progress INTEGER NOT NULL DEFAULT 0,
    plan_json TEXT NOT NULL,
    results_json TEXT,
    created_at BIGINT NOT NULL,
    updated_at BIGINT NOT NULL,
    scheduled_for BIGINT
);

CREATE INDEX IF NOT EXISTS idx_autonomous_tasks_status ON autonomous_tasks(status);

-- Productivity Engine Tables
CREATE TABLE IF NOT EXISTS emails (
    id TEXT PRIMARY KEY,
    folder TEXT NOT NULL DEFAULT 'inbox',
    sender TEXT NOT NULL,
    recipient TEXT NOT NULL,
    subject TEXT NOT NULL,
    body TEXT NOT NULL,
    timestamp BIGINT NOT NULL,
    is_read INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_emails_folder ON emails(folder);

CREATE TABLE IF NOT EXISTS calendar_events (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    start_time BIGINT NOT NULL,
    end_time BIGINT NOT NULL,
    location TEXT,
    description TEXT,
    is_all_day INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_calendar_start ON calendar_events(start_time ASC);

CREATE TABLE IF NOT EXISTS reminders (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    due_date BIGINT,
    priority TEXT NOT NULL DEFAULT 'medium',
    is_completed INTEGER NOT NULL DEFAULT 0,
    notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_reminders_completed ON reminders(is_completed);

-- Image Assets (Multimodal Engine)
CREATE TABLE IF NOT EXISTS image_assets (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    prompt TEXT NOT NULL,
    enriched_prompt TEXT,
    intent_category TEXT NOT NULL,
    aspect_ratio TEXT NOT NULL DEFAULT '1:1',
    provider TEXT NOT NULL,
    model TEXT NOT NULL,
    file_path TEXT NOT NULL,
    storage_url TEXT,
    blur_hash TEXT,
    width INTEGER,
    height INTEGER,
    format TEXT NOT NULL DEFAULT 'png',
    created_at BIGINT NOT NULL,
    parent_asset_id TEXT,
    mask_path TEXT
);

CREATE INDEX IF NOT EXISTS idx_image_assets_session ON image_assets(session_id);
