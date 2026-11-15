-- ============================================================================
-- MIGRATION 002: DEEP RESEARCH & CITATION VERIFICATION SYSTEM
-- Platform: Supabase PostgreSQL
-- ============================================================================

CREATE TABLE IF NOT EXISTS research_jobs (
    id TEXT PRIMARY KEY,
    session_id TEXT,
    user_query TEXT NOT NULL,
    domain TEXT,
    mode TEXT NOT NULL DEFAULT 'deep',
    status TEXT NOT NULL DEFAULT 'IDLE',
    require_approval INTEGER NOT NULL DEFAULT 1,
    approved_at BIGINT,
    current_stage TEXT NOT NULL DEFAULT 'IDLE',
    progress INTEGER NOT NULL DEFAULT 0,
    estimated_duration_ms BIGINT,
    actual_duration_ms BIGINT,
    budget_usd DOUBLE PRECISION NOT NULL DEFAULT 2.00,
    spent_usd DOUBLE PRECISION NOT NULL DEFAULT 0.00,
    total_tokens BIGINT NOT NULL DEFAULT 0,
    sources_count INTEGER NOT NULL DEFAULT 0,
    claims_count INTEGER NOT NULL DEFAULT 0,
    error_message TEXT,
    created_at BIGINT NOT NULL,
    updated_at BIGINT NOT NULL,
    completed_at BIGINT
);

CREATE INDEX IF NOT EXISTS idx_research_jobs_status ON research_jobs(status);
CREATE INDEX IF NOT EXISTS idx_research_jobs_created ON research_jobs(created_at DESC);

CREATE TABLE IF NOT EXISTS research_plans (
    id TEXT PRIMARY KEY,
    job_id TEXT NOT NULL REFERENCES research_jobs(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    domain TEXT NOT NULL,
    time_sensitivity TEXT,
    target_entities TEXT,
    constraints TEXT,
    subtopics TEXT NOT NULL,
    primary_questions TEXT NOT NULL,
    search_strategy TEXT NOT NULL,
    approved INTEGER NOT NULL DEFAULT 0,
    user_feedback TEXT,
    created_at BIGINT NOT NULL,
    updated_at BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_research_plans_job ON research_plans(job_id);

CREATE TABLE IF NOT EXISTS research_queries (
    id TEXT PRIMARY KEY,
    job_id TEXT NOT NULL REFERENCES research_jobs(id) ON DELETE CASCADE,
    channel TEXT NOT NULL,
    subtopic TEXT,
    query TEXT NOT NULL,
    purpose TEXT NOT NULL,
    is_counter_research INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'PENDING',
    result_count INTEGER NOT NULL DEFAULT 0,
    duration_ms BIGINT,
    created_at BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_research_queries_job ON research_queries(job_id);

CREATE TABLE IF NOT EXISTS research_sources (
    id TEXT PRIMARY KEY,
    job_id TEXT NOT NULL REFERENCES research_jobs(id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    canonical_url TEXT,
    domain TEXT NOT NULL,
    title TEXT,
    author TEXT,
    published_date TEXT,
    category TEXT NOT NULL DEFAULT 'web',
    credibility_score DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    credibility_reasons TEXT,
    is_primary_source INTEGER NOT NULL DEFAULT 0,
    created_at BIGINT NOT NULL,
    CONSTRAINT uq_research_sources_job_url UNIQUE(job_id, url)
);

CREATE INDEX IF NOT EXISTS idx_research_sources_job ON research_sources(job_id);

CREATE TABLE IF NOT EXISTS source_fetches (
    id TEXT PRIMARY KEY,
    source_id TEXT NOT NULL REFERENCES research_sources(id) ON DELETE CASCADE,
    job_id TEXT NOT NULL REFERENCES research_jobs(id) ON DELETE CASCADE,
    content_raw TEXT,
    content_clean TEXT,
    content_hash TEXT NOT NULL,
    http_status INTEGER,
    content_type TEXT,
    fetch_latency_ms BIGINT,
    etag TEXT,
    last_modified TEXT,
    created_at BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_source_fetches_source ON source_fetches(source_id);

CREATE TABLE IF NOT EXISTS evidence_items (
    id TEXT PRIMARY KEY,
    job_id TEXT NOT NULL REFERENCES research_jobs(id) ON DELETE CASCADE,
    source_id TEXT NOT NULL REFERENCES research_sources(id) ON DELETE CASCADE,
    subtopic TEXT,
    verbatim_quote TEXT NOT NULL,
    context TEXT,
    relevance_score DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    confidence_score DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    perspective TEXT NOT NULL DEFAULT 'supporting',
    is_counter_evidence INTEGER NOT NULL DEFAULT 0,
    created_at BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_evidence_items_job ON evidence_items(job_id);

CREATE TABLE IF NOT EXISTS research_claims (
    id TEXT PRIMARY KEY,
    job_id TEXT NOT NULL REFERENCES research_jobs(id) ON DELETE CASCADE,
    claim_text TEXT NOT NULL,
    domain TEXT,
    status TEXT NOT NULL DEFAULT 'UNVERIFIED',
    confidence_score DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    verification_method TEXT,
    supporting_count INTEGER NOT NULL DEFAULT 0,
    refuting_count INTEGER NOT NULL DEFAULT 0,
    neutral_count INTEGER NOT NULL DEFAULT 0,
    cross_verified INTEGER NOT NULL DEFAULT 0,
    created_at BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_research_claims_job ON research_claims(job_id);

CREATE TABLE IF NOT EXISTS claim_evidence (
    claim_id TEXT NOT NULL REFERENCES research_claims(id) ON DELETE CASCADE,
    evidence_id TEXT NOT NULL REFERENCES evidence_items(id) ON DELETE CASCADE,
    alignment TEXT NOT NULL DEFAULT 'supports',
    PRIMARY KEY(claim_id, evidence_id)
);

CREATE TABLE IF NOT EXISTS research_sections (
    id TEXT PRIMARY KEY,
    job_id TEXT NOT NULL REFERENCES research_jobs(id) ON DELETE CASCADE,
    section_index INTEGER NOT NULL,
    heading TEXT NOT NULL,
    content_markdown TEXT NOT NULL,
    source_citations TEXT,
    claims_referenced TEXT,
    created_at BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_research_sections_job ON research_sections(job_id);

CREATE TABLE IF NOT EXISTS research_citations (
    id TEXT PRIMARY KEY,
    job_id TEXT NOT NULL REFERENCES research_jobs(id) ON DELETE CASCADE,
    source_id TEXT NOT NULL REFERENCES research_sources(id) ON DELETE CASCADE,
    citation_index INTEGER NOT NULL,
    inline_marker TEXT NOT NULL,
    formatted_entry TEXT NOT NULL,
    doi TEXT,
    bibtex TEXT,
    created_at BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_research_citations_job ON research_citations(job_id);

CREATE TABLE IF NOT EXISTS research_artifacts (
    id TEXT PRIMARY KEY,
    job_id TEXT NOT NULL REFERENCES research_jobs(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    filename TEXT NOT NULL,
    storage_path TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    size_bytes BIGINT NOT NULL,
    hash_sha256 TEXT NOT NULL,
    metadata TEXT,
    created_at BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_research_artifacts_job ON research_artifacts(job_id);

CREATE TABLE IF NOT EXISTS research_runs (
    id TEXT PRIMARY KEY,
    job_id TEXT NOT NULL REFERENCES research_jobs(id) ON DELETE CASCADE,
    stage TEXT NOT NULL,
    agent_name TEXT NOT NULL,
    model_used TEXT,
    tokens_in INTEGER NOT NULL DEFAULT 0,
    tokens_out INTEGER NOT NULL DEFAULT 0,
    duration_ms BIGINT NOT NULL DEFAULT 0,
    cost_usd DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    status TEXT NOT NULL DEFAULT 'COMPLETED',
    error_details TEXT,
    created_at BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_research_runs_job ON research_runs(job_id);

CREATE TABLE IF NOT EXISTS research_quality_checks (
    id TEXT PRIMARY KEY,
    job_id TEXT NOT NULL REFERENCES research_jobs(id) ON DELETE CASCADE,
    check_name TEXT NOT NULL,
    passed INTEGER NOT NULL DEFAULT 0,
    score DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    details TEXT,
    created_at BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_research_quality_checks_job ON research_quality_checks(job_id);

CREATE TABLE IF NOT EXISTS research_contradictions (
    id TEXT PRIMARY KEY,
    job_id TEXT NOT NULL REFERENCES research_jobs(id) ON DELETE CASCADE,
    claim_a_id TEXT NOT NULL,
    claim_b_id TEXT NOT NULL,
    nature_of_contradiction TEXT NOT NULL,
    topic TEXT NOT NULL,
    severity TEXT NOT NULL DEFAULT 'MODERATE',
    resolution_status TEXT NOT NULL DEFAULT 'UNRESOLVED',
    resolution_notes TEXT,
    created_at BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_research_contradictions_job ON research_contradictions(job_id);
