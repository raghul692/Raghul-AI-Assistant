-- ============================================================================
-- MIGRATION 001: CORE CONVERSATIONAL STATE & USER PREFERENCES
-- Platform: Supabase PostgreSQL
-- ============================================================================

CREATE TABLE IF NOT EXISTS chats (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    persona TEXT NOT NULL DEFAULT 'assistant',
    is_archived INTEGER NOT NULL DEFAULT 0,
    archived_at BIGINT,
    created_at BIGINT NOT NULL,
    updated_at BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_chats_updated_at ON chats(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_chats_archived ON chats(is_archived);

CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    chat_id TEXT NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
    role TEXT NOT NULL,
    text TEXT NOT NULL,
    timestamp BIGINT NOT NULL,
    metadata TEXT
);

CREATE INDEX IF NOT EXISTS idx_messages_chat_id ON messages(chat_id);
CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages(timestamp ASC);

-- Projects Workspace
CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    custom_instructions TEXT,
    created_at BIGINT NOT NULL,
    updated_at BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS project_files (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    filename TEXT NOT NULL,
    file_type TEXT,
    content TEXT NOT NULL,
    size BIGINT NOT NULL,
    created_at BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_project_files_project_id ON project_files(project_id);

-- User Settings & Preferences
CREATE TABLE IF NOT EXISTS user_settings (
    user_id TEXT NOT NULL,
    setting_key TEXT NOT NULL,
    setting_value TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'general',
    updated_at BIGINT NOT NULL,
    PRIMARY KEY (user_id, setting_key)
);

CREATE INDEX IF NOT EXISTS idx_user_settings_user ON user_settings(user_id);

CREATE TABLE IF NOT EXISTS settings_audit_logs (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    setting_key TEXT NOT NULL,
    previous_value TEXT,
    new_value TEXT NOT NULL,
    action TEXT NOT NULL,
    timestamp BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_settings_audit_user ON settings_audit_logs(user_id);

-- Persistent Agent Memory
CREATE TABLE IF NOT EXISTS user_memories (
    id TEXT PRIMARY KEY,
    category TEXT NOT NULL,
    content TEXT NOT NULL,
    importance DOUBLE PRECISION DEFAULT 0.5,
    access_count INTEGER DEFAULT 0,
    last_accessed BIGINT,
    expires_at BIGINT,
    created_at BIGINT NOT NULL,
    updated_at BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_memories_category ON user_memories(category);
CREATE INDEX IF NOT EXISTS idx_memories_importance ON user_memories(importance DESC);

CREATE TABLE IF NOT EXISTS conversation_summaries (
    chat_id TEXT PRIMARY KEY REFERENCES chats(id) ON DELETE CASCADE,
    summary TEXT NOT NULL,
    key_decisions TEXT,
    unresolved_tasks TEXT,
    last_summarized_msg_idx INTEGER DEFAULT 0,
    updated_at BIGINT NOT NULL
);

-- AI Provider Runtime Settings
CREATE TABLE IF NOT EXISTS provider_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at BIGINT NOT NULL
);
