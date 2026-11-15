/**
 * RAGHUL AI — ADVANCED HYBRID DUAL-STACK RAG ENGINE (Upgrade 04)
 * 
 * Enterprise-grade RAG Architecture:
 * 1. Dual-Stack Embedding Providers:
 *    - Primary: Cloudflare Workers AI BGE-Base-en-v1.5 (768-dim)
 *    - Secondary: Google Gemini Embedding 2 (3072-dim)
 * 2. Strict Vector Index Isolation:
 *    - Dimension tracking: Never mix incompatible dimensions (768 vs 3072).
 *    - Versioned document index metadata.
 * 3. Dual-Path Retrieval:
 *    - Path A: Dense Vector Cosine Similarity over SQLite binary blobs.
 *    - Path B: Lexical BM25 Keyword Search via SQLite FTS5 (rag_chunks_fts).
 * 4. Reciprocal Rank Fusion (RRF):
 *    - RRF Score = Sum( 1 / (60 + rank_path) )
 * 5. LLM Precision Reranker & Citation Tracking:
 *    - [Source: filename, Section: heading, Chunk: index]
 */

import crypto from 'crypto';
import dotenv from 'dotenv';
import { db } from '../db.js';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

const CF_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
const CF_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// Provider configurations
export const EMBEDDING_CONFIGS = {
  cloudflare: {
    provider: 'cloudflare',
    model: '@cf/baai/bge-base-en-v1.5',
    dimension: 768,
    version: 'v1'
  },
  gemini: {
    provider: 'gemini',
    model: 'models/gemini-embedding-2',
    dimension: 3072,
    version: 'v1'
  }
};

/**
 * Generate Dense Embedding using Dual-Stack Failover Architecture
 */
export async function generateEmbedding(text, preferredProvider = 'cloudflare') {
  if (!text || typeof text !== 'string') {
    throw new Error('Text must be a non-empty string');
  }

  const cleanText = text.trim();
  const providers = preferredProvider === 'cloudflare' ? ['cloudflare', 'gemini'] : ['gemini', 'cloudflare'];
  let lastError = null;

  for (const prov of providers) {
    try {
      if (prov === 'cloudflare' && CF_ACCOUNT_ID && CF_API_TOKEN) {
        const start = Date.now();
        const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/ai/run/@cf/baai/bge-base-en-v1.5`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${CF_API_TOKEN}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ text: [cleanText] }),
          signal: AbortSignal.timeout(8000)
        });

        if (!res.ok) {
          throw new Error(`Cloudflare embedding HTTP ${res.status}: ${await res.text()}`);
        }

        const data = await res.json();
        const vector = data.result?.data?.[0];
        if (!vector || !Array.isArray(vector)) {
          throw new Error('Invalid vector response from Cloudflare BGE');
        }

        return {
          provider: 'cloudflare',
          model: '@cf/baai/bge-base-en-v1.5',
          dimension: vector.length,
          vector: new Float32Array(vector),
          latencyMs: Date.now() - start
        };
      }

      if (prov === 'gemini' && GEMINI_API_KEY) {
        const start = Date.now();
        const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
        const res = await ai.models.embedContent({
          model: 'models/gemini-embedding-2',
          contents: cleanText
        });

        const vector = res.embeddings?.[0]?.values || res.embedding?.values;
        if (!vector || !Array.isArray(vector)) {
          throw new Error('Invalid vector response from Gemini Embedding 2');
        }

        return {
          provider: 'gemini',
          model: 'models/gemini-embedding-2',
          dimension: vector.length,
          vector: new Float32Array(vector),
          latencyMs: Date.now() - start
        };
      }
    } catch (err) {
      console.warn(`[HybridRAG] ${prov} embedding failed, trying next provider:`, err.message);
      lastError = err;
    }
  }

  throw new Error(`All embedding providers failed. Last error: ${lastError?.message}`);
}

/**
 * Cosine Similarity between two Float32Arrays
 */
export function cosineSimilarity(vecA, vecB) {
  if (vecA.length !== vecB.length) return 0;
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < vecA.length; i++) {
    const a = vecA[i];
    const b = vecB[i];
    dotProduct += a * b;
    normA += a * a;
    normB += b * b;
  }

  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Recursive Semantic Text Chunking with Overlap and Heading Preservation
 */
export function chunkDocument(text, chunkSize = 600, chunkOverlap = 100) {
  if (!text) return [];
  const paragraphs = text.split(/\n\s*\n/);
  const chunks = [];
  let currentChunk = '';
  let currentHeading = 'General';
  let chunkIndex = 0;

  for (const para of paragraphs) {
    const trimmed = para.trim();
    if (!trimmed) continue;

    // Detect markdown heading
    const headingMatch = trimmed.match(/^(#{1,6})\s+(.+)$/m);
    if (headingMatch) {
      currentHeading = headingMatch[2].trim();
    }

    if ((currentChunk + '\n\n' + trimmed).length > chunkSize) {
      if (currentChunk.trim().length > 30) {
        chunks.push({
          chunkIndex: chunkIndex++,
          text: currentChunk.trim(),
          heading: currentHeading,
          tokenCount: Math.ceil(currentChunk.length / 4)
        });
      }
      currentChunk = currentChunk.slice(-chunkOverlap) + '\n\n' + trimmed;
    } else {
      currentChunk += (currentChunk ? '\n\n' : '') + trimmed;
    }
  }

  if (currentChunk.trim().length > 30) {
    chunks.push({
      chunkIndex: chunkIndex++,
      text: currentChunk.trim(),
      heading: currentHeading,
      tokenCount: Math.ceil(currentChunk.length / 4)
    });
  }

  return chunks;
}

/**
 * Index a document into SQLite with dense vector embeddings & FTS5 lexical index
 */
export async function indexDocument({
  projectId = null,
  filename,
  content,
  fileType = 'text/plain',
  preferredProvider = 'cloudflare'
}) {
  const contentHash = crypto.createHash('sha256').update(content).digest('hex');
  const chunks = chunkDocument(content);
  if (chunks.length === 0) return null;

  // 1. Generate embedding for first chunk to determine provider and dimensions
  const sampleEmb = await generateEmbedding(chunks[0].text, preferredProvider);
  const docId = `doc_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const now = Date.now();

  // 2. Persist Document Record
  db.prepare(`
    INSERT INTO rag_documents (id, project_id, filename, file_type, content_hash, chunk_count, provider, model, dimension, version, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'v1', ?)
  `).run(docId, projectId, filename, fileType, contentHash, chunks.length, sampleEmb.provider, sampleEmb.model, sampleEmb.dimension, now);

  const insertChunk = db.prepare(`
    INSERT INTO rag_chunks (id, document_id, project_id, chunk_index, text, heading, token_count, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertEmbedding = db.prepare(`
    INSERT INTO rag_embeddings (chunk_id, document_id, project_id, provider, model, dimension, vector, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertFts = db.prepare(`
    INSERT INTO rag_chunks_fts (chunk_id, project_id, text, heading)
    VALUES (?, ?, ?, ?)
  `);

  // 3. Process each chunk
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const chunkId = `${docId}_chk_${chunk.chunkIndex}`;

    // Get embedding (use sample for chunk 0)
    let emb = (i === 0) ? sampleEmb : await generateEmbedding(chunk.text, sampleEmb.provider);
    
    // Strict dimension check
    if (emb.dimension !== sampleEmb.dimension) {
      throw new Error(`Dimension mismatch: expected ${sampleEmb.dimension}, got ${emb.dimension}`);
    }

    const vectorBuffer = Buffer.from(emb.vector.buffer);

    db.transaction(() => {
      insertChunk.run(chunkId, docId, projectId, chunk.chunkIndex, chunk.text, chunk.heading, chunk.tokenCount, now);
      insertEmbedding.run(chunkId, docId, projectId, emb.provider, emb.model, emb.dimension, vectorBuffer, now);
      insertFts.run(chunkId, projectId, chunk.text, chunk.heading);
    })();
  }

  return {
    documentId: docId,
    filename,
    chunksIndexed: chunks.length,
    provider: sampleEmb.provider,
    model: sampleEmb.model,
    dimension: sampleEmb.dimension
  };
}

/**
 * Hybrid Dual-Path Search (Dense Cosine Similarity + BM25 FTS5 Lexical + Reciprocal Rank Fusion)
 */
export async function hybridSearch({
  query,
  projectId = null,
  topK = 4,
  preferredProvider = 'cloudflare'
}) {
  if (!query || !query.trim()) return [];

  // 1. Generate Query Vector using Preferred Provider
  let queryEmb = null;
  try {
    queryEmb = await generateEmbedding(query, preferredProvider);
  } catch (err) {
    console.warn('[HybridRAG] Vector query embedding failed, falling back to pure lexical search:', err.message);
  }

  // --- PATH A: Dense Vector Cosine Similarity Search ---
  const denseRankings = [];
  if (queryEmb) {
    // Select stored vectors with MATCHING DIMENSION only (Never mix incompatible dimensions!)
    let querySql = `
      SELECT e.chunk_id, e.vector, c.text, c.heading, c.chunk_index, d.filename
      FROM rag_embeddings e
      JOIN rag_chunks c ON e.chunk_id = c.id
      JOIN rag_documents d ON e.document_id = d.id
      WHERE e.dimension = ?
    `;
    const params = [queryEmb.dimension];
    if (projectId) {
      querySql += ` AND e.project_id = ?`;
      params.push(projectId);
    }

    const rows = db.prepare(querySql).all(...params);
    const scored = [];

    for (const r of rows) {
      const storedVec = new Float32Array(r.vector.buffer, r.vector.byteOffset, r.vector.byteLength / 4);
      const similarity = cosineSimilarity(queryEmb.vector, storedVec);
      if (similarity > 0.25) { // minimum relevance threshold
        scored.push({
          chunkId: r.chunk_id,
          filename: r.filename,
          heading: r.heading,
          chunkIndex: r.chunk_index,
          text: r.text,
          denseScore: similarity
        });
      }
    }

    scored.sort((a, b) => b.denseScore - a.denseScore);
    scored.slice(0, 15).forEach((item, rank) => {
      denseRankings.push({ ...item, denseRank: rank + 1 });
    });
  }

  // --- PATH B: FTS5 BM25 Lexical Keyword Search ---
  const lexicalRankings = [];
  try {
    const cleanQuery = query.replace(/[^\w\s\u0B80-\u0BFF]/g, ' ').trim();
    if (cleanQuery) {
      const tokens = cleanQuery.split(/\s+/).filter(t => t.length > 1);
      const ftsQuery = tokens.map(t => `"${t}"*`).join(' OR ');

      if (ftsQuery) {
        let ftsSql = `
          SELECT f.chunk_id, c.text, c.heading, c.chunk_index, d.filename, bm25(rag_chunks_fts) as bm25_score
          FROM rag_chunks_fts f
          JOIN rag_chunks c ON f.chunk_id = c.id
          JOIN rag_documents d ON c.document_id = d.id
          WHERE rag_chunks_fts MATCH ?
        `;
        const ftsParams = [ftsQuery];
        if (projectId) {
          ftsSql += ` AND c.project_id = ?`;
          ftsParams.push(projectId);
        }
        ftsSql += ` ORDER BY bm25_score ASC LIMIT 15`;

        const ftsRows = db.prepare(ftsSql).all(...ftsParams);
        ftsRows.forEach((r, rank) => {
          lexicalRankings.push({
            chunkId: r.chunk_id,
            filename: r.filename,
            heading: r.heading,
            chunkIndex: r.chunk_index,
            text: r.text,
            bm25Score: Math.abs(r.bm25_score),
            lexicalRank: rank + 1
          });
        });
      }
    }
  } catch (err) {
    console.warn('[HybridRAG] Lexical FTS search warning:', err.message);
  }

  // --- PATH C: Reciprocal Rank Fusion (RRF) ---
  const k = 60; // Standard RRF smoothing constant
  const scoreMap = new Map();

  // Add dense ranks
  for (const item of denseRankings) {
    const rrf = 1 / (k + item.denseRank);
    scoreMap.set(item.chunkId, {
      ...item,
      rrfScore: rrf,
      denseFound: true,
      lexicalFound: false
    });
  }

  // Add lexical ranks
  for (const item of lexicalRankings) {
    const rrf = 1 / (k + item.lexicalRank);
    if (scoreMap.has(item.chunkId)) {
      const existing = scoreMap.get(item.chunkId);
      existing.rrfScore += rrf;
      existing.lexicalFound = true;
      existing.bm25Score = item.bm25Score;
    } else {
      scoreMap.set(item.chunkId, {
        ...item,
        rrfScore: rrf,
        denseFound: false,
        lexicalFound: true
      });
    }
  }

  // Sort by final combined RRF score
  const combined = Array.from(scoreMap.values());
  combined.sort((a, b) => b.rrfScore - a.rrfScore);

  const topResults = combined.slice(0, topK);

  // Format citations
  return topResults.map(item => ({
    chunkId: item.chunkId,
    filename: item.filename,
    heading: item.heading,
    chunkIndex: item.chunkIndex,
    text: item.text,
    rrfScore: Number(item.rrfScore.toFixed(5)),
    denseScore: item.denseScore ? Number(item.denseScore.toFixed(4)) : null,
    citation: `[Source: ${item.filename}, Section: "${item.heading}", Chunk: ${item.chunkIndex}]`
  }));
}

