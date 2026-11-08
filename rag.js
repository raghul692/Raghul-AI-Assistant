// In-Memory Hybrid RAG (Retrieval-Augmented Generation) & Knowledge Retrieval Engine

// Simple tokenization & stopword filtering
const STOP_WORDS = new Set([
  'a', 'about', 'above', 'after', 'again', 'against', 'all', 'am', 'an', 'and', 'any', 'are', 'as', 'at',
  'be', 'because', 'been', 'before', 'being', 'below', 'between', 'both', 'but', 'by', 'could', 'did',
  'do', 'does', 'doing', 'down', 'during', 'each', 'few', 'for', 'from', 'further', 'had', 'has', 'have',
  'having', 'he', 'her', 'here', 'hers', 'herself', 'him', 'himself', 'his', 'how', 'i', 'if', 'in',
  'into', 'is', 'it', 'its', 'itself', 'just', 'me', 'more', 'most', 'my', 'myself', 'no', 'nor', 'not',
  'of', 'off', 'on', 'once', 'only', 'or', 'other', 'ought', 'our', 'ours', 'ourselves', 'out', 'over',
  'own', 'same', 'she', 'should', 'so', 'some', 'such', 'than', 'that', 'the', 'their', 'theirs', 'them',
  'themselves', 'then', 'there', 'these', 'they', 'this', 'those', 'through', 'to', 'too', 'under',
  'until', 'up', 'very', 'was', 'we', 'were', 'what', 'when', 'where', 'which', 'while', 'who', 'whom',
  'why', 'with', 'would', 'you', 'your', 'yours', 'yourself', 'yourselves'
]);

function tokenize(text) {
  if (!text) return [];
  return text
    .toLowerCase()
    .replace(/[^\w\s\u0B80-\u0BFF]/g, ' ')
    .split(/\s+/)
    .filter(token => token.length > 1 && !STOP_WORDS.has(token));
}

export class KnowledgeIndex {
  constructor(chunkSize = 600, chunkOverlap = 100) {
    this.chunkSize = chunkSize;
    this.chunkOverlap = chunkOverlap;
    this.documents = []; // [{ id, sourceName, text, tokens, chunkIndex }]
  }

  // Chunk and add document
  addDocument(sourceName, fullText) {
    if (!fullText || typeof fullText !== 'string') return;
    
    // Simple sentence or paragraph boundary splitting
    const paragraphs = fullText.split(/\n\s*\n/);
    let currentChunk = '';
    let chunkIdx = 0;

    for (const para of paragraphs) {
      if ((currentChunk + ' ' + para).length > this.chunkSize) {
        if (currentChunk.trim().length > 30) {
          this.indexChunk(sourceName, currentChunk.trim(), chunkIdx++);
        }
        // Retain overlap
        currentChunk = currentChunk.slice(-this.chunkOverlap) + ' ' + para;
      } else {
        currentChunk += (currentChunk ? '\n\n' : '') + para;
      }
    }

    if (currentChunk.trim().length > 30) {
      this.indexChunk(sourceName, currentChunk.trim(), chunkIdx++);
    }
  }

  indexChunk(sourceName, text, chunkIndex) {
    const tokens = tokenize(text);
    if (tokens.length === 0) return;
    
    // Frequency map
    const termFreq = new Map();
    for (const t of tokens) {
      termFreq.set(t, (termFreq.get(t) || 0) + 1);
    }

    this.documents.push({
      id: `${sourceName}#${chunkIndex}`,
      sourceName,
      text,
      tokens,
      termFreq,
      length: tokens.length
    });
  }

  // Retrieve top-k chunks using BM25-like scoring
  search(query, topK = 4) {
    const queryTokens = tokenize(query);
    if (queryTokens.length === 0 || this.documents.length === 0) return [];

    const totalDocs = this.documents.length;
    const avgDocLength = this.documents.reduce((acc, d) => acc + d.length, 0) / (totalDocs || 1);
    const k1 = 1.5;
    const b = 0.75;

    // Calculate document frequencies for query tokens
    const docFreq = new Map();
    for (const qt of queryTokens) {
      let count = 0;
      for (const doc of this.documents) {
        if (doc.termFreq.has(qt)) count++;
      }
      docFreq.set(qt, count);
    }

    // Score each document
    const scores = [];
    for (const doc of this.documents) {
      let score = 0;
      for (const qt of queryTokens) {
        const tf = doc.termFreq.get(qt) || 0;
        if (tf > 0) {
          const df = docFreq.get(qt) || 0;
          // BM25 IDF
          const idf = Math.log(1 + (totalDocs - df + 0.5) / (df + 0.5));
          // BM25 TF weight
          const tfWeight = (tf * (k1 + 1)) / (tf + k1 * (1 - b + b * (doc.length / avgDocLength)));
          score += idf * tfWeight;
        }
      }

      if (score > 0) {
        scores.push({
          sourceName: doc.sourceName,
          text: doc.text,
          score
        });
      }
    }

    scores.sort((a, b) => b.score - a.score);
    return scores.slice(0, topK);
  }

  clear() {
    this.documents = [];
  }
}

// Global Knowledge Store for active sessions
export const sessionRAGStore = new Map();

export function getSessionIndex(sessionId) {
  if (!sessionRAGStore.has(sessionId)) {
    sessionRAGStore.set(sessionId, new KnowledgeIndex());
  }
  return sessionRAGStore.get(sessionId);
}

