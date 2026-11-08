import { RESEARCH_CONFIG } from '../config.js';

/**
 * Standard Normalized Search Result Interface:
 * {
 *   sourceId: string,
 *   sourceType: 'web' | 'academic' | 'github' | 'official' | 'news',
 *   title: string,
 *   url: string,
 *   author: string | null,
 *   publishedDate: string | null,
 *   publisher: string | null,
 *   snippet: string,
 *   rawContent: string | null,
 *   confidenceScore: number (0-1),
 *   provider: 'tavily' | 'exa' | 'google' | 'github' | 'openalex' | 'arxiv' | 'pubmed' | 'crossref',
 *   metadata: object
 * }
 */

// Helper to make timeout-guarded fetch calls
async function fetchWithTimeout(url, options = {}, timeoutMs = 25000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(timer);
    return res;
  } catch (err) {
    clearTimeout(timer);
    throw err;
  }
}

// ============================================================================
// 1. TAVILY SEARCH ADAPTER
// ============================================================================
export class TavilySearchAdapter {
  constructor(apiKey = RESEARCH_CONFIG.tavilyApiKey) {
    this.apiKey = apiKey;
    this.endpoint = 'https://api.tavily.com/search';
  }

  isConfigured() {
    return Boolean(this.apiKey && this.apiKey.trim().length > 5);
  }

  async search(query, options = {}) {
    if (!this.isConfigured()) {
      return { success: false, error: 'Tavily API key not configured', results: [] };
    }

    try {
      const payload = {
        api_key: this.apiKey,
        query: query,
        search_depth: options.searchDepth || 'advanced',
        include_answer: true,
        include_raw_content: Boolean(options.includeRawContent),
        max_results: options.maxResults || 8,
        include_domains: options.includeDomains || [],
        exclude_domains: options.excludeDomains || []
      };

      const res = await fetchWithTimeout(this.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }, 20000);

      if (!res.ok) {
        const errText = await res.text();
        return { success: false, error: `Tavily HTTP ${res.status}: ${errText.slice(0, 200)}`, results: [] };
      }

      const data = await res.json();
      const normalized = (data.results || []).map(r => ({
        sourceType: 'web',
        title: r.title || 'Untitled Web Source',
        url: r.url,
        author: null,
        publishedDate: r.published_date || null,
        publisher: new URL(r.url).hostname.replace('www.', ''),
        snippet: r.content || '',
        rawContent: r.raw_content || null,
        confidenceScore: r.score ? Math.min(Math.max(r.score, 0.4), 0.95) : 0.75,
        provider: 'tavily',
        metadata: {
          tavilyScore: r.score,
          answer: data.answer || null
        }
      }));

      return {
        success: true,
        provider: 'tavily',
        query,
        aiAnswer: data.answer || null,
        results: normalized
      };
    } catch (err) {
      return { success: false, error: `Tavily search failed: ${err.message}`, results: [] };
    }
  }
}

// ============================================================================
// 2. EXA SEARCH ADAPTER (Neural / Semantic Search)
// ============================================================================
export class ExaSearchAdapter {
  constructor(apiKey = RESEARCH_CONFIG.exaApiKey) {
    this.apiKey = apiKey;
    this.endpoint = 'https://api.exa.ai/search';
  }

  isConfigured() {
    return Boolean(this.apiKey && this.apiKey.trim().length > 5);
  }

  async search(query, options = {}) {
    if (!this.isConfigured()) {
      return { success: false, error: 'Exa API key not configured', results: [] };
    }

    try {
      const payload = {
        query: query,
        numResults: options.maxResults || 8,
        useAutoprompt: true,
        type: options.type || 'neural',
        contents: {
          text: { maxCharacters: 1200 },
          highlights: { numSentences: 3 }
        }
      };

      const res = await fetchWithTimeout(this.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey
        },
        body: JSON.stringify(payload)
      }, 20000);

      if (!res.ok) {
        const errText = await res.text();
        return { success: false, error: `Exa HTTP ${res.status}: ${errText.slice(0, 200)}`, results: [] };
      }

      const data = await res.json();
      const normalized = (data.results || []).map(r => ({
        sourceType: 'web',
        title: r.title || 'Untitled Source',
        url: r.url,
        author: r.author || null,
        publishedDate: r.publishedDate || null,
        publisher: new URL(r.url).hostname.replace('www.', ''),
        snippet: (r.highlights && r.highlights[0]) || (r.text ? r.text.slice(0, 350) : ''),
        rawContent: r.text || null,
        confidenceScore: 0.85,
        provider: 'exa',
        metadata: {
          highlights: r.highlights || [],
          autopromptString: data.autopromptString || null
        }
      }));

      return {
        success: true,
        provider: 'exa',
        query,
        results: normalized
      };
    } catch (err) {
      return { success: false, error: `Exa search failed: ${err.message}`, results: [] };
    }
  }
}

// ============================================================================
// 3. GITHUB RESEARCH ADAPTER (Deep Technical & Repo Inspection)
// ============================================================================
export class GitHubSearchAdapter {
  constructor(token = RESEARCH_CONFIG.githubToken) {
    this.token = token;
    this.apiBase = 'https://api.github.com';
  }

  isConfigured() {
    return Boolean(this.token && this.token.trim().length > 5);
  }

  getHeaders() {
    const headers = {
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'RaghulAI-DeepResearch-Engine'
    };
    if (this.isConfigured()) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }
    return headers;
  }

  async searchRepositories(query, maxResults = 5) {
    try {
      const q = encodeURIComponent(`${query} sort:stars-desc`);
      const res = await fetchWithTimeout(`${this.apiBase}/search/repositories?q=${q}&per_page=${maxResults}`, {
        headers: this.getHeaders()
      }, 15000);

      if (!res.ok) {
        return { success: false, error: `GitHub search HTTP ${res.status}`, results: [] };
      }

      const data = await res.json();
      const repos = await Promise.all((data.items || []).map(async item => {
        // Fetch readme snippet and release details safely
        let readmePreview = '';
        try {
          const rmRes = await fetchWithTimeout(`${this.apiBase}/repos/${item.full_name}/readme`, {
            headers: { ...this.getHeaders(), 'Accept': 'application/vnd.github.raw' }
          }, 8000);
          if (rmRes.ok) {
            const raw = await rmRes.text();
            readmePreview = raw.slice(0, 1500);
          }
        } catch (_) {}

        return {
          sourceType: 'github',
          title: `${item.full_name}: ${item.description || 'Open Source Project'}`,
          url: item.html_url,
          author: item.owner?.login || null,
          publishedDate: item.updated_at || item.created_at,
          publisher: 'GitHub',
          snippet: `${item.description || ''} | ⭐ ${item.stargazers_count} stars | 🍴 ${item.forks_count} forks | Language: ${item.language || 'N/A'} | License: ${item.license?.spdx_id || 'None'} | Open Issues: ${item.open_issues_count}`,
          rawContent: readmePreview || null,
          confidenceScore: 0.92,
          provider: 'github',
          metadata: {
            stars: item.stargazers_count,
            forks: item.forks_count,
            language: item.language,
            license: item.license?.name,
            topics: item.topics || [],
            archived: item.archived,
            openIssues: item.open_issues_count,
            defaultBranch: item.default_branch
          }
        };
      }));

      return {
        success: true,
        provider: 'github',
        query,
        results: repos
      };
    } catch (err) {
      return { success: false, error: `GitHub repo search failed: ${err.message}`, results: [] };
    }
  }
}

// ============================================================================
// 4. ACADEMIC & PEER-REVIEWED RESEARCH ADAPTER (OpenAlex, Crossref, arXiv)
// ============================================================================
export class AcademicSearchAdapter {
  constructor() {}

  async searchOpenAlex(query, maxResults = 6) {
    try {
      const q = encodeURIComponent(query);
      const url = `https://api.openalex.org/works?search=${q}&per-page=${maxResults}&mailto=raghulraja692@gmail.com`;
      const res = await fetchWithTimeout(url, { headers: { 'User-Agent': 'RaghulAI-DeepResearch-Engine' } }, 15000);

      if (!res.ok) {
        return { success: false, results: [] };
      }

      const data = await res.json();
      const results = (data.results || []).map(w => {
        const authors = (w.authorships || []).slice(0, 4).map(a => a.author?.display_name).filter(Boolean).join(', ');
        const doi = w.doi || (w.ids && w.ids.doi) || null;
        const landingUrl = doi || w.primary_location?.landing_page_url || w.id;

        // Reconstruct abstract from inverted index if present
        let abstract = '';
        if (w.abstract_inverted_index) {
          const wordPositions = [];
          for (const [word, positions] of Object.entries(w.abstract_inverted_index)) {
            positions.forEach(pos => wordPositions.push({ pos, word }));
          }
          wordPositions.sort((a, b) => a.pos - b.pos);
          abstract = wordPositions.map(wp => wp.word).join(' ').slice(0, 1000);
        }

        return {
          sourceType: 'academic',
          title: w.title || 'Peer-Reviewed Academic Paper',
          url: landingUrl,
          author: authors || null,
          publishedDate: w.publication_date || `${w.publication_year || ''}`,
          publisher: w.primary_location?.source?.display_name || 'OpenAlex / Academic Journal',
          snippet: abstract || `Cited by ${w.cited_by_count || 0} scholarly works. Published in ${w.publication_year}.`,
          rawContent: abstract || null,
          confidenceScore: 0.95,
          provider: 'openalex',
          metadata: {
            doi: doi,
            citedByCount: w.cited_by_count,
            publicationYear: w.publication_year,
            journal: w.primary_location?.source?.display_name,
            isOpenAccess: w.open_access?.is_oa,
            oaUrl: w.open_access?.oa_url
          }
        };
      });

      return { success: true, provider: 'openalex', results };
    } catch (err) {
      return { success: false, error: err.message, results: [] };
    }
  }

  async searchArXiv(query, maxResults = 5) {
    try {
      const q = encodeURIComponent(`all:${query}`);
      const url = `https://export.arxiv.org/api/query?search_query=${q}&start=0&max_results=${maxResults}&sortBy=relevance&sortOrder=descending`;
      const res = await fetchWithTimeout(url, { headers: { 'User-Agent': 'RaghulAI-DeepResearch-Engine' } }, 15000);

      if (!res.ok) {
        return { success: false, results: [] };
      }

      const xml = await res.text();
      // Fast lightweight XML extraction for arXiv entries
      const entries = [];
      const entryRegex = /<entry>([\s\S]*?)<\/entry>/g;
      let match;
      while ((match = entryRegex.exec(xml)) !== null && entries.length < maxResults) {
        const chunk = match[1];
        const titleMatch = /<title>([\s\S]*?)<\/title>/.exec(chunk);
        const summaryMatch = /<summary>([\s\S]*?)<\/summary>/.exec(chunk);
        const publishedMatch = /<published>([\s\S]*?)<\/published>/.exec(chunk);
        const idMatch = /<id>([\s\S]*?)<\/id>/.exec(chunk);

        const title = titleMatch ? titleMatch[1].replace(/\s+/g, ' ').trim() : 'arXiv Preprint';
        const summary = summaryMatch ? summaryMatch[1].replace(/\s+/g, ' ').trim() : '';
        const published = publishedMatch ? publishedMatch[1].slice(0, 10) : null;
        const link = idMatch ? idMatch[1].trim() : '';

        if (link) {
          entries.push({
            sourceType: 'academic',
            title,
            url: link,
            author: null,
            publishedDate: published,
            publisher: 'arXiv.org',
            snippet: summary.slice(0, 800),
            rawContent: summary,
            confidenceScore: 0.90,
            provider: 'arxiv',
            metadata: {
              archiveId: link.split('/').pop(),
              publishedDate: published
            }
          });
        }
      }

      return { success: true, provider: 'arxiv', results: entries };
    } catch (err) {
      return { success: false, error: err.message, results: [] };
    }
  }

  async searchCrossref(query, maxResults = 5) {
    try {
      const q = encodeURIComponent(query);
      const url = `https://api.crossref.org/works?query=${q}&rows=${maxResults}&select=DOI,title,author,published,container-title,abstract,is-referenced-by-count`;
      const res = await fetchWithTimeout(url, {
        headers: { 'User-Agent': 'RaghulAI-DeepResearch-Engine (mailto:raghulraja692@gmail.com)' }
      }, 15000);

      if (!res.ok) {
        return { success: false, results: [] };
      }

      const data = await res.json();
      const items = (data.message?.items || []).map(item => {
        const title = (item.title && item.title[0]) || 'Academic Publication';
        const authors = (item.author || []).map(a => `${a.given || ''} ${a.family || ''}`).join(', ').trim();
        const doi = item.DOI;
        const journal = (item['container-title'] && item['container-title'][0]) || 'Crossref Indexed Journal';
        const pubDate = item.published?.['date-parts']?.[0]?.join('-') || null;

        return {
          sourceType: 'academic',
          title,
          url: doi ? `https://doi.org/${doi}` : 'https://crossref.org',
          author: authors || null,
          publishedDate: pubDate,
          publisher: journal,
          snippet: item.abstract ? item.abstract.replace(/<[^>]+>/g, '').slice(0, 600) : `Indexed DOI: ${doi}. Citations: ${item['is-referenced-by-count'] || 0}`,
          rawContent: item.abstract || null,
          confidenceScore: 0.94,
          provider: 'crossref',
          metadata: {
            doi,
            citations: item['is-referenced-by-count']
          }
        };
      });

      return { success: true, provider: 'crossref', results: items };
    } catch (err) {
      return { success: false, error: err.message, results: [] };
    }
  }
}

// ============================================================================
// 5. UNIFIED MULTI-PROVIDER SEARCH DISPATCHER
// ============================================================================
export class UnifiedSearchDispatcher {
  constructor() {
    this.tavily = new TavilySearchAdapter();
    this.exa = new ExaSearchAdapter();
    this.github = new GitHubSearchAdapter();
    this.academic = new AcademicSearchAdapter();
  }

  async discoverSources(queries, options = {}) {
    const {
      domain = 'general',
      enableGitHub = RESEARCH_CONFIG.enableGithub,
      enableAcademic = RESEARCH_CONFIG.enableAcademic,
      maxTotalSources = RESEARCH_CONFIG.maxSources || 25
    } = options;

    const allSources = [];
    const sourceUrls = new Set();

    function addUnique(results) {
      for (const r of results) {
        if (!r.url) continue;
        const cleanUrl = r.url.split('#')[0].replace(/\/$/, '');
        if (!sourceUrls.has(cleanUrl)) {
          sourceUrls.add(cleanUrl);
          allSources.push(r);
          if (allSources.length >= maxTotalSources) break;
        }
      }
    }

    // Run parallel discovery across available adapters for each query
    for (const q of queries.slice(0, 5)) {
      if (allSources.length >= maxTotalSources) break;

      const promises = [];

      // 1. Tavily
      if (this.tavily.isConfigured()) {
        promises.push(this.tavily.search(q, { maxResults: 6 }).then(res => res.results || []));
      }

      // 2. Exa
      if (this.exa.isConfigured()) {
        promises.push(this.exa.search(q, { maxResults: 6 }).then(res => res.results || []));
      }

      // 3. GitHub (if technical / software / AI domain)
      if (enableGitHub && (domain === 'software' || domain === 'ai' || domain === 'technology' || /github|code|library|framework|repo|sdk/i.test(q))) {
        promises.push(this.github.searchRepositories(q, 3).then(res => res.results || []));
      }

      // 4. Academic (if scientific, biomedical, AI benchmarks, academic research)
      if (enableAcademic && (domain === 'academic' || domain === 'biomedical' || domain === 'ai' || /paper|algorithm|benchmark|study|model|clinical/i.test(q))) {
        promises.push(this.academic.searchOpenAlex(q, 3).then(res => res.results || []));
        promises.push(this.academic.searchArXiv(q, 3).then(res => res.results || []));
      }

      const settled = await Promise.allSettled(promises);
      for (const s of settled) {
        if (s.status === 'fulfilled' && Array.isArray(s.value)) {
          addUnique(s.value);
        }
      }
    }

    return allSources.slice(0, maxTotalSources);
  }
}

