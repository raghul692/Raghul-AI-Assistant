-- ============================================================================
-- MIGRATION 006: DISTRIBUTED JOB QUEUE & REAL-TIME EVENT STREAM
-- Platform: Supabase PostgreSQL
-- ============================================================================

CREATE TABLE IF NOT EXISTS job_queue (
    id TEXT PRIMARY KEY,
    idempotency_key TEXT UNIQUE,
    job_type TEXT NOT NULL,
    priority INTEGER NOT NULL DEFAULT 5, -- 1 (highest) to 10 (lowest)
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    status TEXT NOT NULL DEFAULT 'pending', -- pending, running, completed, failed, cancelled, dlq
    worker_id TEXT,
    attempts INTEGER NOT NULL DEFAULT 0,
    max_attempts INTEGER NOT NULL DEFAULT 3,
    next_retry_at BIGINT,
    locked_at BIGINT,
    expires_at BIGINT,
    error_message TEXT,
    result JSONB,
    created_at BIGINT NOT NULL,
    started_at BIGINT,
    finished_at BIGINT
);

CREATE INDEX IF NOT EXISTS idx_jq_status_priority_retry 
ON job_queue(status, priority ASC, next_retry_at ASC, created_at ASC);

CREATE INDEX IF NOT EXISTS idx_jq_worker ON job_queue(worker_id);

-- Real-Time Cross-Process Event Bus for SSE delivery
CREATE TABLE IF NOT EXISTS job_events (
    id BIGSERIAL PRIMARY KEY,
    job_id TEXT NOT NULL,
    event_type TEXT NOT NULL,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_job_events_job_id_id ON job_events(job_id, id ASC);

-- PostgreSQL Notification Function on new job event
CREATE OR REPLACE FUNCTION notify_job_event_trigger()
RETURNS TRIGGER AS $$
BEGIN
    PERFORM pg_notify('job_event_' || NEW.job_id, json_build_object(
        'id', NEW.id,
        'job_id', NEW.job_id,
        'event_type', NEW.event_type,
        'payload', NEW.payload,
        'created_at', NEW.created_at
    )::text);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_notify_job_event ON job_events;
CREATE TRIGGER trg_notify_job_event
AFTER INSERT ON job_events
FOR EACH ROW EXECUTE FUNCTION notify_job_event_trigger();
