import crypto from 'crypto';
import * as cheerio from 'cheerio';
import { createRequire } from 'module';
import { validateSafeUrl } from '../security/guardrails.js';

const require = createRequire(import.meta.url);
const { PDFParse } = require('pdf-parse');

/**
 * SSRF Safety Guard: Checks if a target URL resolves to private / loopback IP space
 */
export function isSsrfSafe(urlStr) {
  const check = validateSafeUrl(urlStr);
  return check.valid;
}

/**
 * Clean & Canonicalize URLs
 */
export function canonicalizeUrl(urlStr) {
  try {
    const u = new URL(urlStr);
    // Remove UTM tracking query parameters
    const paramsToRemove = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'fbclid', 'gclid'];
    paramsToRemove.forEach(p => u.searchParams.delete(p));
    // Remove fragment
    u.hash = '';
    return u.toString().replace(/\/$/, '');
  } catch (_) {
    return urlStr;
  }
}

/**
 * Compute SHA-256 hash of extracted text
 */
export function computeContentHash(text) {
  return crypto.createHash('sha256').update(text || '', 'utf8').digest('hex');
}

/**
 * Web & Document Extractor
 */
export class WebDocumentExtractor {
  constructor() {
    this.userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 (RaghulAI Deep Research Bot)';
  }

  async extract(urlStr) {
    let currentUrl = canonicalizeUrl(urlStr);

    if (!isSsrfSafe(currentUrl)) {
      return {
        success: false,
        url: currentUrl,
        error: 'SSRF guard blocked request to internal/private network.'
      };
    }

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 18000);
      let res;
      let redirectCount = 0;
      const maxRedirects = 4;

      while (true) {
        if (!isSsrfSafe(currentUrl)) {
          clearTimeout(timer);
          return {
            success: false,
            url: currentUrl,
            error: 'SSRF guard blocked redirect to internal/private network.'
          };
        }

        res = await fetch(currentUrl, {
          headers: {
            'User-Agent': this.userAgent,
            'Accept': 'text/html,application/xhtml+xml,application/pdf,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9'
          },
          signal: controller.signal,
          redirect: 'manual'
        });

        if ([301, 302, 303, 307, 308].includes(res.status)) {
          redirectCount++;
          if (redirectCount > maxRedirects) {
            clearTimeout(timer);
            return {
              success: false,
              url: currentUrl,
              error: 'Exceeded maximum allowed redirects.'
            };
          }
          const location = res.headers.get('location');
          if (!location) break;
          currentUrl = new URL(location, currentUrl).toString();
          continue;
        }
        break;
      }

      clearTimeout(timer);

      if (!res.ok) {
        return {
          success: false,
          url: currentUrl,
          statusCode: res.status,
          error: `HTTP ${res.status}: ${res.statusText}`
        };
      }

      const contentType = res.headers.get('content-type') || '';

      // 1. PDF Document Handling
      if (contentType.includes('application/pdf') || currentUrl.endsWith('.pdf')) {
        const arrayBuf = await res.arrayBuffer();
        const buffer = Buffer.from(arrayBuf);
        return await this.extractPdfBuffer(buffer, currentUrl);
      }

      // 2. HTML Web Page Handling
      const html = await res.text();
      return this.extractHtml(html, currentUrl);
    } catch (err) {
      return {
        success: false,
        url: currentUrl,
        error: `Extraction failed: ${err.message}`
      };
    }
  }

  /**
   * Structured HTML Extraction using Cheerio
   */
  extractHtml(html, url) {
    try {
      const $ = cheerio.load(html);

      // Remove non-content elements
      $('script, style, noscript, iframe, nav, footer, header, aside, .advertisement, .ad, .social-share, .cookie-banner, .popup').remove();

      // Extract metadata
      const title = $('meta[property="og:title"]').attr('content') ||
                    $('title').text().trim() ||
                    $('h1').first().text().trim() ||
                    'Untitled Document';

      const author = $('meta[name="author"]').attr('content') ||
                     $('meta[property="article:author"]').attr('content') ||
                     $('.author, .byline, [rel="author"]').first().text().trim() ||
                     null;

      const publishedDate = $('meta[property="article:published_time"]').attr('content') ||
                            $('time').attr('datetime') ||
                            $('meta[name="date"]').attr('content') ||
                            null;

      const publisher = $('meta[property="og:site_name"]').attr('content') ||
                        new URL(url).hostname.replace('www.', '');

      // Priority article containers
      let articleText = '';
      const articleEl = $('article, main, .post-content, .article-content, #content, .content').first();

      if (articleEl.length > 0) {
        articleText = articleEl.text();
      } else {
        articleText = $('body').text();
      }

      // Clean excessive whitespace
      const cleanText = articleText.replace(/\s+/g, ' ').trim();
      const contentHash = computeContentHash(cleanText);

      // Extract key headings for outline mapping
      const headings = [];
      $('h1, h2, h3').each((_, el) => {
        const hText = $(el).text().trim();
        if (hText.length > 3 && hText.length < 120) {
          headings.push({ level: el.tagName.toLowerCase(), text: hText });
        }
      });

      return {
        success: true,
        url,
        title,
        author,
        publishedDate,
        publisher,
        headings,
        text: cleanText,
        wordCount: cleanText.split(/\s+/).length,
        contentHash,
        extractedAt: new Date().toISOString()
      };
    } catch (err) {
      return {
        success: false,
        url,
        error: `HTML parse error: ${err.message}`
      };
    }
  }

  /**
   * PDF Document Extraction using pdf-parse
   */
  async extractPdfBuffer(buffer, url = '') {
    try {
      const parser = new PDFParse({ data: buffer });
      await parser.load();
      const parsed = await parser.getText();
      const cleanText = (parsed?.text || '').replace(/\s+/g, ' ').trim();
      const contentHash = computeContentHash(cleanText);

      return {
        success: true,
        url,
        title: 'Extracted PDF Report',
        author: null,
        publishedDate: null,
        publisher: 'PDF Document',
        text: cleanText,
        pageCount: parser.pages?.length || 1,
        wordCount: cleanText.split(/\s+/).length,
        contentHash,
        extractedAt: new Date().toISOString()
      };
    } catch (err) {
      return {
        success: false,
        url,
        error: `PDF extraction failed: ${err.message}`
      };
    }
  }
}
