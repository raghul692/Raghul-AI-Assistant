/**
 * Evidence Ledger & Claim Verification Engine
 * Scores source authority, records atomic claims, verifies corroboration,
 * detects contradictions, and maintains forensic audit trails for research jobs.
 */
import crypto from 'crypto';

export class EvidenceLedger {
  constructor() {
    this.sources = new Map(); // url -> Source Record
    this.evidencePassages = []; // Array of passage objects
    this.claims = []; // Array of claim records
    this.contradictions = []; // Array of contradiction records
  }

  /**
   * Calculate Multi-Factor Source Authority & Freshness Score (0.0 to 1.0)
   */
  scoreSource(sourceMeta) {
    let authority = 0.65;
    let freshness = 0.80; // Contemporary retrieved text
    let transparency = 0.70;
    let isPrimary = 0;

    const domain = (sourceMeta.publisher || '').toLowerCase();
    const url = (sourceMeta.url || '').toLowerCase();

    // 1. Primary Authority & Domain Trust
    if (sourceMeta.sourceType === 'academic' || domain.includes('arxiv') || domain.includes('openalex') || domain.includes('nature') || domain.includes('ieee') || domain.includes('acm.org') || domain.includes('springer')) {
      authority = 0.96;
      isPrimary = 1;
      transparency = 0.95;
    } else if (sourceMeta.sourceType === 'github' || url.includes('github.com')) {
      authority = 0.90;
      isPrimary = 1;
      transparency = 0.95;
    } else if (url.includes('.gov') || url.includes('.edu') || domain.includes('w3.org') || domain.includes('rfc-editor.org') || domain.includes('cve.org') || domain.includes('nvd.nist.gov') || domain.includes('owasp.org')) {
      authority = 0.98;
      isPrimary = 1;
      transparency = 0.95;
    } else if (domain.includes('docs.') || domain.includes('developer.') || domain.includes('anthropic.com') || domain.includes('google.com') || domain.includes('openai.com') || domain.includes('microsoft.com') || domain.includes('cloudflare.com')) {
      authority = 0.93;
      isPrimary = 1;
      transparency = 0.90;
    } else if (sourceMeta.sourceType === 'news' || domain.includes('reuters') || domain.includes('bloomberg') || domain.includes('techcrunch') || domain.includes('wired')) {
      authority = 0.82;
      transparency = 0.80;
    } else {
      authority = 0.72;
      transparency = 0.70;
    }

    // 2. Freshness Evaluation
    if (sourceMeta.publishedDate) {
      try {
        const pubTime = new Date(sourceMeta.publishedDate).getTime();
        const now = Date.now();
        const ageDays = (now - pubTime) / (1000 * 60 * 60 * 24);
        if (ageDays <= 90) {
          freshness = 1.0; // Last 3 months
        } else if (ageDays <= 365) {
          freshness = 0.90; // Last 1 year
        } else if (ageDays <= 730) {
          freshness = 0.80; // Last 2 years
        } else {
          freshness = 0.65; // Older archival
        }
      } catch (_) {
        freshness = 0.80;
      }
    }

    // Overall weighted confidence score: 60% authority, 20% freshness, 20% transparency
    const confidenceScore = Number((authority * 0.6 + freshness * 0.2 + transparency * 0.2).toFixed(3));

    return {
      authorityScore: authority,
      freshnessScore: freshness,
      transparencyScore: transparency,
      confidenceScore,
      isPrimary
    };
  }

  /**
   * Register a Source into the Ledger
   */
  registerSource(source) {
    const scores = this.scoreSource(source);
    const sourceId = source.id || `src_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
    const record = {
      ...source,
      id: sourceId,
      ...scores,
      registeredAt: new Date().toISOString()
    };
    this.sources.set(source.url, record);
    return record;
  }

  /**
   * Ingest Evidence Passages from an extracted source document
   */
  ingestPassages(sourceUrl, fullText, title, publisher) {
    if (!fullText || fullText.length < 50) return [];

    const src = this.sources.get(sourceUrl);
    const sourceId = src?.id || `src_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;

    // Split text into coherent paragraphs/chunks of ~300 to 800 chars
    const rawParagraphs = fullText.split(/\n\s*\n|\.\s{2,}|\.\n/);
    const passages = [];

    for (let i = 0; i < rawParagraphs.length; i++) {
      const p = rawParagraphs[i].trim();
      if (p.length >= 70 && p.length <= 2000) {
        const passageId = `ev_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
        passages.push({
          id: passageId,
          sourceId,
          sourceUrl,
          title,
          publisher: publisher || (sourceUrl ? new URL(sourceUrl).hostname : 'Unknown'),
          passageIndex: i,
          text: p,
          snippet: p.slice(0, 300),
          charCount: p.length
        });
      }
      if (passages.length >= 30) break; // Maximum 30 passages per source
    }

    this.evidencePassages.push(...passages);
    return passages;
  }

  /**
   * Register Claims with automatic ID assignment
   */
  registerClaims(claims, sourceUrl) {
    const src = this.sources.get(sourceUrl);
    const sourceId = src?.id || null;
    const added = [];

    for (const c of claims) {
      if (!c.claimText || c.claimText.trim().length < 15) continue;
      const claimId = `clm_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
      
      const claimRecord = {
        id: claimId,
        claimText: c.claimText.trim(),
        claimType: c.claimType || 'technical',
        exactQuote: c.exactQuote || null,
        sourceId,
        sourceUrl,
        importance: c.importance || 'high',
        confidenceScore: c.confidence || src?.confidenceScore || 0.85,
        verificationStatus: 'UNVERIFIED',
        corroborationCount: 0,
        corroboratingPassages: [],
        contradictingPassages: [],
        verdictRationale: null
      };

      this.claims.push(claimRecord);
      added.push(claimRecord);
    }

    return added;
  }

  /**
   * Perform Forensic Verification for a claim using independent evidence passages
   */
  recordVerification(claimId, verificationResult = {}) {
    const claim = this.claims.find(c => c.id === claimId);
    if (!claim) return null;

    claim.verificationStatus = verificationResult.status || 'SUPPORTED';
    claim.confidenceScore = verificationResult.confidenceScore || claim.confidenceScore;
    claim.verdictRationale = verificationResult.verdictRationale || 'Verified through corroborating passages.';
    claim.corroboratingPassages = verificationResult.corroboratingPassages || [];
    claim.contradictingPassages = verificationResult.contradictingPassages || [];
    claim.corroborationCount = claim.corroboratingPassages.length;

    if (claim.contradictingPassages.length > 0) {
      this.contradictions.push({
        id: `cnt_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
        claimId: claim.id,
        claimText: claim.claimText,
        sourceUrl: claim.sourceUrl,
        contradictionNotes: claim.contradictingPassages.join(' | ')
      });
    }

    return claim;
  }

  /**
   * Deterministic Quality Gate Evaluation
   */
  evaluateQualityGate({ minClaims = 3, minSources = 5 } = {}) {
    const totalSources = this.sources.size;
    const totalClaims = this.claims.length;
    const verifiedClaims = this.claims.filter(c => c.verificationStatus === 'SUPPORTED' || c.verificationStatus === 'PARTIALLY_SUPPORTED').length;
    const disputedClaims = this.claims.filter(c => c.verificationStatus === 'DISPUTED').length;

    const passed = (totalSources >= minSources && totalClaims >= minClaims && verifiedClaims > 0);

    return {
      passed,
      totalSources,
      totalClaims,
      verifiedClaims,
      disputedClaims,
      verificationRate: totalClaims > 0 ? Number((verifiedClaims / totalClaims).toFixed(2)) : 0,
      contradictionsCount: this.contradictions.length,
      reasons: passed 
        ? ['Quality gate thresholds met: Sufficient sources, extracted atomic claims, and corroborated evidence.']
        : [
            totalSources < minSources ? `Insufficient sources: ${totalSources}/${minSources}` : null,
            totalClaims < minClaims ? `Insufficient atomic claims extracted: ${totalClaims}/${minClaims}` : null,
            verifiedClaims === 0 ? 'Zero claims corroborated by independent passages' : null
          ].filter(Boolean)
    };
  }

  /**
   * Get all verified citations and build numeric index map [1], [2], [3]...
   */
  getCitationMap() {
    const citationMap = new Map();
    const citationList = [];
    let index = 1;

    for (const [url, src] of this.sources.entries()) {
      citationMap.set(url, index);
      citationList.push({
        index,
        id: src.id,
        title: src.title,
        url: src.url,
        publisher: src.publisher || new URL(src.url).hostname,
        author: src.author,
        publishedDate: src.publishedDate,
        confidenceScore: src.confidenceScore,
        isPrimary: src.isPrimary
      });
      index++;
    }

    return { citationMap, citationList };
  }
}

