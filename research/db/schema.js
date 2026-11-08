import { db } from '../../db.js';

/**
 * Additive Migrations for Tier-1 Deep Research System
 * Preserves all existing tables (chats, messages, projects, etc.)
 */
export function initResearchSchema() {
  db.exec(`
    -- 1. Research Jobs
    CREATE TABLE IF NOT EXISTS research_jobs (
      id TEXT PRIMARY KEY,
      session_id TEXT,
      user_query TEXT NOT NULL,
      domain TEXT,
      mode TEXT NOT NULL DEFAULT 'deep', -- 'quick' | 'deep' | 'exhaustive'
      status TEXT NOT NULL DEFAULT 'IDLE',
      require_approval INTEGER NOT NULL DEFAULT 1,
      approved_at INTEGER,
      current_stage TEXT NOT NULL DEFAULT 'IDLE',
      progress INTEGER NOT NULL DEFAULT 0,
      estimated_duration_ms INTEGER,
      actual_duration_ms INTEGER,
      budget_usd REAL NOT NULL DEFAULT 2.00,
      spent_usd REAL NOT NULL DEFAULT 0.00,
      total_tokens INTEGER NOT NULL DEFAULT 0,
      sources_count INTEGER NOT NULL DEFAULT 0,
      claims_count INTEGER NOT NULL DEFAULT 0,
      error_message TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      completed_at INTEGER
    );

    CREATE INDEX IF NOT EXISTS idx_research_jobs_status ON research_jobs(status);
    CREATE INDEX IF NOT EXISTS idx_research_jobs_created ON research_jobs(created_at DESC);

    -- 2. Research Plans
    CREATE TABLE IF NOT EXISTS research_plans (
      id TEXT PRIMARY KEY,
      job_id TEXT NOT NULL,
      title TEXT NOT NULL,
      domain TEXT NOT NULL,
      time_sensitivity TEXT,
      target_entities TEXT, -- JSON array
      constraints TEXT, -- JSON array
      subtopics TEXT NOT NULL, -- JSON array of subtopics
      primary_questions TEXT NOT NULL, -- JSON array
      search_strategy TEXT NOT NULL, -- JSON object
      approved INTEGER NOT NULL DEFAULT 0,
      user_feedback TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (job_id) REFERENCES research_jobs(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_research_plans_job ON research_plans(job_id);

    -- 3. Research Queries
    CREATE TABLE IF NOT EXISTS research_queries (
      id TEXT PRIMARY KEY,
      job_id TEXT NOT NULL,
      channel TEXT NOT NULL, -- 'google' | 'tavily' | 'exa' | 'github' | 'academic'
      subtopic TEXT,
      query TEXT NOT NULL,
      purpose TEXT NOT NULL, -- 'discovery' | 'deepening' | 'counter_research' | 'fact_check'
      is_counter_research INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'PENDING',
      result_count INTEGER NOT NULL DEFAULT 0,
      duration_ms INTEGER,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (job_id) REFERENCES research_jobs(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_research_queries_job ON research_queries(job_id);

    -- 4. Research Sources (Registry & Scoring)
    CREATE TABLE IF NOT EXISTS research_sources (
      id TEXT PRIMARY KEY,
      job_id TEXT NOT NULL,
      url TEXT NOT NULL,
      canonical_url TEXT,
      domain TEXT NOT NULL,
      title TEXT,
      author TEXT,
      published_date TEXT,
      category TEXT NOT NULL DEFAULT 'web', -- 'primary_doc' | 'github' | 'academic' | 'news' | 'web'
      credibility_score REAL NOT NULL DEFAULT 0.5, -- 0.0 to 1.0
      credibility_reasons TEXT, -- JSON array
      is_primary_source INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      UNIQUE(job_id, url),
      FOREIGN KEY (job_id) REFERENCES research_jobs(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_research_sources_job ON research_sources(job_id);

    -- 5. Source Fetches (Original Content & Hashes)
    CREATE TABLE IF NOT EXISTS source_fetches (
      id TEXT PRIMARY KEY,
      source_id TEXT NOT NULL,
      job_id TEXT NOT NULL,
      content_hash TEXT NOT NULL,
      http_status INTEGER NOT NULL DEFAULT 200,
      content_type TEXT,
      raw_text TEXT,
      clean_text TEXT NOT NULL,
      word_count INTEGER NOT NULL DEFAULT 0,
      extraction_method TEXT NOT NULL, -- 'cheerio' | 'readability' | 'pdf_parse' | 'api'
      fetched_at INTEGER NOT NULL,
      FOREIGN KEY (source_id) REFERENCES research_sources(id) ON DELETE CASCADE,
      FOREIGN KEY (job_id) REFERENCES research_jobs(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_source_fetches_source ON source_fetches(source_id);

    -- 6. Evidence Items (Granular Evidence)
    CREATE TABLE IF NOT EXISTS evidence_items (
      id TEXT PRIMARY KEY,
      job_id TEXT NOT NULL,
      source_id TEXT NOT NULL,
      snippet TEXT NOT NULL,
      relevance_score REAL NOT NULL DEFAULT 0.5,
      supports_subtopic TEXT,
      is_counter_evidence INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (job_id) REFERENCES research_jobs(id) ON DELETE CASCADE,
      FOREIGN KEY (source_id) REFERENCES research_sources(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_evidence_items_job ON evidence_items(job_id);

    -- 7. Research Claims (Atomic Claims)
    CREATE TABLE IF NOT EXISTS research_claims (
      id TEXT PRIMARY KEY,
      job_id TEXT NOT NULL,
      statement TEXT NOT NULL,
      category TEXT NOT NULL, -- 'fact' | 'statistic' | 'finding' | 'market_metric'
      verification_status TEXT NOT NULL DEFAULT 'UNVERIFIED', -- 'SUPPORTED' | 'PARTIALLY_SUPPORTED' | 'DISPUTED' | 'CONTRADICTED' | 'UNVERIFIED' | 'OUTDATED'
      confidence_score REAL NOT NULL DEFAULT 0.5,
      verification_notes TEXT,
      is_critical INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (job_id) REFERENCES research_jobs(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_research_claims_job ON research_claims(job_id);

    -- 8. Claim Evidence Mapping (M:N)
    CREATE TABLE IF NOT EXISTS claim_evidence (
      claim_id TEXT NOT NULL,
      evidence_id TEXT NOT NULL,
      relationship TEXT NOT NULL DEFAULT 'supports', -- 'supports' | 'contradicts' | 'qualifies'
      PRIMARY KEY (claim_id, evidence_id),
      FOREIGN KEY (claim_id) REFERENCES research_claims(id) ON DELETE CASCADE,
      FOREIGN KEY (evidence_id) REFERENCES evidence_items(id) ON DELETE CASCADE
    );

    -- 9. Research Sections (Synthesized Chapters)
    CREATE TABLE IF NOT EXISTS research_sections (
      id TEXT PRIMARY KEY,
      job_id TEXT NOT NULL,
      section_index INTEGER NOT NULL,
      title TEXT NOT NULL,
      section_type TEXT NOT NULL, -- 'executive_summary' | 'methodology' | 'chapter' | 'market' | 'comparison' | 'contradictions' | 'recommendations'
      content_markdown TEXT NOT NULL,
      tables_json TEXT, -- JSON array of structured tables
      created_at INTEGER NOT NULL,
      FOREIGN KEY (job_id) REFERENCES research_jobs(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_research_sections_job ON research_sections(job_id, section_index);

    -- 10. Research Citations
    CREATE TABLE IF NOT EXISTS research_citations (
      id TEXT PRIMARY KEY,
      job_id TEXT NOT NULL,
      citation_number INTEGER NOT NULL,
      source_id TEXT NOT NULL,
      claim_id TEXT,
      formatted_text TEXT NOT NULL,
      url TEXT,
      doi TEXT,
      verified INTEGER NOT NULL DEFAULT 1,
      FOREIGN KEY (job_id) REFERENCES research_jobs(id) ON DELETE CASCADE,
      FOREIGN KEY (source_id) REFERENCES research_sources(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_research_citations_job ON research_citations(job_id, citation_number);

    -- 11. Research Artifacts (Deliverables)
    CREATE TABLE IF NOT EXISTS research_artifacts (
      id TEXT PRIMARY KEY,
      job_id TEXT NOT NULL,
      artifact_type TEXT NOT NULL, -- 'pdf' | 'markdown' | 'json_dossier'
      filename TEXT NOT NULL,
      file_path TEXT NOT NULL,
      file_size INTEGER NOT NULL,
      content_hash TEXT NOT NULL,
      page_count INTEGER,
      validation_passed INTEGER NOT NULL DEFAULT 0,
      validation_report TEXT, -- JSON report
      created_at INTEGER NOT NULL,
      FOREIGN KEY (job_id) REFERENCES research_jobs(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_research_artifacts_job ON research_artifacts(job_id);

    -- 12. Research Runs (Execution Logs & Cost Accounting)
    CREATE TABLE IF NOT EXISTS research_runs (
      id TEXT PRIMARY KEY,
      job_id TEXT NOT NULL,
      agent_role TEXT NOT NULL,
      provider TEXT NOT NULL,
      model TEXT NOT NULL,
      step_name TEXT NOT NULL,
      prompt_tokens INTEGER NOT NULL DEFAULT 0,
      completion_tokens INTEGER NOT NULL DEFAULT 0,
      cost_usd REAL NOT NULL DEFAULT 0.00,
      duration_ms INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'COMPLETED',
      created_at INTEGER NOT NULL,
      FOREIGN KEY (job_id) REFERENCES research_jobs(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_research_runs_job ON research_runs(job_id);

    -- 13. Research Quality Checks (Automated Quality Gate Audits)
    CREATE TABLE IF NOT EXISTS research_quality_checks (
      id TEXT PRIMARY KEY,
      job_id TEXT NOT NULL,
      overall_score REAL NOT NULL, -- 0.0 to 100.0
      passed INTEGER NOT NULL,
      metrics_json TEXT NOT NULL, -- JSON object of all 15 evaluated criteria
      blocking_failures TEXT, -- JSON array
      audited_at INTEGER NOT NULL,
      FOREIGN KEY (job_id) REFERENCES research_jobs(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_research_quality_job ON research_quality_checks(job_id);
  `);
}

