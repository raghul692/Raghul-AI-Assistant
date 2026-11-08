/**
 * ============================================================================
 * WEB SCRAPER & RESEARCH MCP SERVER (Firecrawl & Fetch Protocol)
 * Source: modelcontextprotocol/servers/src/fetch & Firecrawl standard
 * ============================================================================
 * Scrapes any URL, strips HTML noise, scripts, and advertisements, and converts
 * articles, documentation, and blog posts into clean, high-signal Markdown.
 */

class WebScraperServer {
  /**
   * Convert messy HTML to clean, readable Markdown
   */
  _htmlToMarkdown(html = '') {
    let clean = html
      // Remove scripts, styles, iframes, svgs, noscripts
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
      .replace(/<svg\b[^<]*(?:(?!<\/svg>)<[^<]*)*<\/svg>/gi, '')
      .replace(/<noscript\b[^<]*(?:(?!<\/noscript>)<[^<]*)*<\/noscript>/gi, '')
      .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
      .replace(/<!--[\s\S]*?-->/g, '');

    // Convert Headings
    clean = clean.replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, '\n# $1\n')
                 .replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, '\n## $1\n')
                 .replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, '\n### $1\n')
                 .replace(/<h4[^>]*>([\s\S]*?)<\/h4>/gi, '\n#### $1\n');

    // Convert Links
    clean = clean.replace(/<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi, (m, url, text) => {
      const label = text.replace(/<[^>]+>/g, '').trim();
      return label ? `[${label}](${url})` : '';
    });

    // Convert Code Blocks & Inlines
    clean = clean.replace(/<pre[^>]*><code[^>]*>([\s\S]*?)<\/code><\/pre>/gi, '\n```\n$1\n```\n')
                 .replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, '`$1`');

    // Convert Lists
    clean = clean.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, '- $1\n');

    // Convert Paragraphs & Line Breaks
    clean = clean.replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, '\n$1\n')
                 .replace(/<br\s*\/?>/gi, '\n');

    // Strip remaining tags
    clean = clean.replace(/<[^>]+>/g, ' ');

    // Normalize whitespace & entities
    clean = clean.replace(/&nbsp;/gi, ' ')
                 .replace(/&amp;/gi, '&')
                 .replace(/&lt;/gi, '<')
                 .replace(/&gt;/gi, '>')
                 .replace(/&quot;/gi, '"')
                 .replace(/&#39;/gi, "'")
                 .replace(/\n\s*\n\s*\n/g, '\n\n')
                 .trim();

    return clean;
  }

  async fetchMarkdown({ url, maxChars = 12000 }) {
    if (!url || !url.startsWith('http')) {
      throw new Error('Valid HTTP/HTTPS URL required');
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);

    try {
      const res = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,text/plain;q=0.9'
        }
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }

      const rawHtml = await res.text();
      const markdown = this._htmlToMarkdown(rawHtml);
      const isTruncated = markdown.length > maxChars;
      const content = isTruncated ? markdown.slice(0, maxChars) + '\n\n...[Content truncated for token context budget]' : markdown;

      return {
        url,
        status: res.status,
        contentLength: markdown.length,
        isTruncated,
        markdown: content
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  async searchWeb({ query, maxResults = 5 }) {
    if (!query) throw new Error('Query string required');
    try {
      const searchUrl = 'https://html.duckduckgo.com/html/?q=' + encodeURIComponent(query);
      const res = await fetch(searchUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
        }
      });
      if (!res.ok) throw new Error(`Search failed: HTTP ${res.status}`);
      const html = await res.text();
      const results = [];
      const parts = html.split('<h2 class="result__title">');

      for (let i = 1; i < parts.length && results.length < maxResults; i++) {
        const part = parts[i];
        const tm = part.match(/<a[^>]*class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/);
        const sm = part.match(/<a[^>]*class="result__snippet"[^>]*>([\s\S]*?)<\/a>/);
        if (tm) {
          let rawUrl = tm[1];
          const uddg = rawUrl.match(/uddg=([^&]+)/);
          const link = uddg ? decodeURIComponent(uddg[1]) : rawUrl;
          const title = tm[2].replace(/<[^>]+>/g, '').trim();
          const snippet = sm ? sm[1].replace(/<[^>]+>/g, '').trim() : '';
          if (title && link.startsWith('http')) {
            results.push({ title, link, snippet });
          }
        }
      }

      return { query, count: results.length, results };
    } catch (err) {
      return { query, count: 0, results: [], error: err.message };
    }
  }

  getToolDeclarations() {
    return [
      {
        name: 'web_fetch_markdown',
        description: 'Firecrawl / Fetch MCP: Scrapes any web page URL and converts it into clean, ad-free Markdown.',
        parameters: {
          type: 'OBJECT',
          properties: {
            url: { type: 'STRING', description: 'Full URL to fetch and convert to Markdown' },
            maxChars: { type: 'INTEGER', description: 'Max characters to extract (default: 12000)' }
          },
          required: ['url']
        },
        execute: async (args) => this.fetchMarkdown(args)
      },
      {
        name: 'web_live_search',
        description: 'Brave/DDG Search MCP: Search real-time web for current news, technical documentation, or library versions.',
        parameters: {
          type: 'OBJECT',
          properties: {
            query: { type: 'STRING', description: 'Search keywords or inquiry phrase' },
            maxResults: { type: 'INTEGER', description: 'Max links to retrieve (default: 5)' }
          },
          required: ['query']
        },
        execute: async (args) => this.searchWeb(args)
      }
    ];
  }
}

export const webScraperServer = new WebScraperServer();

