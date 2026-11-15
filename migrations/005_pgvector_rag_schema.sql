-- ============================================================================
-- MIGRATION 005: PGVECTOR EXTENSION & HYBRID RAG VECTOR STORAGE
-- Platform: Supabase PostgreSQL + pgvector
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS rag_documents (
    id TEXT PRIMARY KEY,
    project_id TEXT,
    filename TEXT NOT NULL,
    file_type TEXT,
    content_hash TEXT NOT NULL,
    chunk_count INTEGER NOT NULL,
    provider TEXT NOT NULL,
    model TEXT NOT NULL,
    dimension INTEGER NOT NULL,
    version TEXT NOT NULL DEFAULT 'v1',
    created_at BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_rag_docs_project ON rag_documents(project_id);

CREATE TABLE IF NOT EXISTS rag_chunks (
    id TEXT PRIMARY KEY,
    document_id TEXT NOT NULL REFERENCES rag_documents(id) ON DELETE CASCADE,
    project_id TEXT,
    chunk_index INTEGER NOT NULL,
    text TEXT NOT NULL,
    heading TEXT,
    token_count INTEGER NOT NULL,
    created_at BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_rag_chunks_doc ON rag_chunks(document_id);
CREATE INDEX IF NOT EXISTS idx_rag_chunks_project ON rag_chunks(project_id);

-- GIN Full-Text Search Index on Chunks and Messages
CREATE INDEX IF NOT EXISTS idx_rag_chunks_text_fts ON rag_chunks USING gin(to_tsvector('english', text));
CREATE INDEX IF NOT EXISTS idx_messages_text_fts ON messages USING gin(to_tsvector('english', text));

-- pgvector Embeddings Table supporting both 768-dim and 3072-dim embeddings
CREATE TABLE IF NOT EXISTS rag_embeddings (
    chunk_id TEXT PRIMARY KEY REFERENCES rag_chunks(id) ON DELETE CASCADE,
    document_id TEXT NOT NULL,
    project_id TEXT,
    provider TEXT NOT NULL,
    model TEXT NOT NULL,
    dimension INTEGER NOT NULL,
    vector BYTEA NOT NULL,
    embedding_768 vector(768),
    created_at BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_rag_emb_doc ON rag_embeddings(document_id);
CREATE INDEX IF NOT EXISTS idx_rag_emb_768_ivfflat ON rag_embeddings USING hnsw (embedding_768 vector_cosine_ops);
