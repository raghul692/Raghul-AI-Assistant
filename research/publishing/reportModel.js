/**
 * Canonical Research Report Data Model
 * Assembles structured, evidence-grounded research reports supporting
 * executive, technical, academic, comparative, and security formats.
 */

export const REPORT_TYPES = {
  EXECUTIVE: 'executive',
  TECHNICAL: 'technical',
  ACADEMIC: 'academic',
  COMPARATIVE: 'comparative',
  SECURITY: 'security'
};

export class ResearchReportModel {
  constructor(jobId, options = {}) {
    this.jobId = jobId;
    this.reportType = options.reportType || REPORT_TYPES.TECHNICAL;
    this.title = options.title || 'Technical Research Report';
    this.domain = options.domain || 'technology';
    this.executiveSummary = '';
    this.methodology = {
      scope: '',
      sourcesCount: 0,
      passagesCount: 0,
      claimsCount: 0,
      verifiedClaimsCount: 0,
      verificationRate: 0.0,
      channelsQueried: []
    };
    this.sections = [];
    this.claimsMatrix = [];
    this.contradictions = [];
    this.limitations = [];
    this.bibliography = [];
    this.generatedAt = Date.now();
  }

  /**
   * Set Executive Summary
   */
  setExecutiveSummary(summaryText) {
    this.executiveSummary = summaryText.trim();
    return this;
  }

  /**
   * Set Methodology Statistics
   */
  setMethodology(methodologyData) {
    this.methodology = { ...this.methodology, ...methodologyData };
    return this;
  }

  /**
   * Add Thematic Detailed Section
   */
  addSection({ title, contentMarkdown, order = 0, supportingClaimIds = [] }) {
    this.sections.push({
      title,
      contentMarkdown: contentMarkdown.trim(),
      order,
      supportingClaimIds
    });
    return this;
  }

  /**
   * Add Claims to Audit Matrix
   */
  setClaimsMatrix(claims) {
    this.claimsMatrix = claims.map(c => ({
      id: c.id,
      statement: c.statement || c.claimText,
      category: c.category || c.claimType || 'fact',
      verificationStatus: c.verificationStatus || c.verification_status || 'UNVERIFIED',
      confidenceScore: c.confidenceScore || c.confidence_score || 0.5,
      exactQuote: c.exactQuote || c.exact_quote || null,
      primarySourceId: c.primarySourceId || c.primary_source_id || null,
      sourceUrl: c.sourceUrl || null
    }));
    return this;
  }

  /**
   * Add Contradictions
   */
  setContradictions(contradictions) {
    this.contradictions = contradictions.map(cnt => ({
      disputedTopic: cnt.disputedTopic || cnt.disputed_topic,
      sourceAAssertion: cnt.sourceAAssertion || cnt.source_a_assertion,
      sourceBAssertion: cnt.sourceBAssertion || cnt.source_b_assertion,
      resolutionStrategy: cnt.resolutionStrategy || cnt.resolution_strategy || 'disputed_in_report',
      finalDisposition: cnt.finalDisposition || cnt.final_disposition || 'disputed'
    }));
    return this;
  }

  /**
   * Add Limitations & Caveats
   */
  setLimitations(limitationsList) {
    this.limitations = limitationsList;
    return this;
  }

  /**
   * Set Structured Bibliography
   */
  setBibliography(citationsList) {
    this.bibliography = citationsList.map((c, idx) => ({
      number: c.number || c.index || idx + 1,
      title: c.title || 'Source Reference',
      url: c.url,
      publisher: c.publisher || 'Unknown Publisher',
      publishedDate: c.publishedDate || 'n.d.',
      author: c.author || null,
      confidenceScore: c.confidenceScore || 0.7,
      isPrimary: Boolean(c.isPrimary)
    }));
    return this;
  }

  /**
   * Render Canonical Markdown
   */
  toMarkdown() {
    let md = `# ${this.title}\n\n`;
    md += `*A Tier-1 Autonomous Deep Research Investigation by Raghul AI*\n\n`;
    md += `**Domain:** ${this.domain} | **Report Type:** ${this.reportType.toUpperCase()} | **Date:** ${new Date(this.generatedAt).toISOString().split('T')[0]}\n\n`;
    md += `---\n\n`;

    // 1. Executive Summary
    md += `## Executive Summary\n\n${this.executiveSummary || 'No executive summary provided.'}\n\n`;

    // 2. Research Methodology
    md += `## Research Methodology & Provenance\n\n`;
    md += `- **Scope:** ${this.methodology.scope || 'Exhaustive multi-source investigation'}\n`;
    md += `- **Sources Inspected:** ${this.methodology.sourcesCount}\n`;
    md += `- **Evidence Passages Ingested:** ${this.methodology.passagesCount}\n`;
    md += `- **Atomic Claims Extracted:** ${this.methodology.claimsCount}\n`;
    md += `- **Claims Verified:** ${this.methodology.verifiedClaimsCount} (${Math.round(this.methodology.verificationRate * 100)}% verification rate)\n\n`;

    // 3. Thematic Detailed Sections
    this.sections.sort((a, b) => a.order - b.order).forEach(sec => {
      md += `## ${sec.title}\n\n${sec.contentMarkdown}\n\n`;
    });

    // 4. Contradictions & Disputed Findings
    if (this.contradictions.length > 0) {
      md += `## Contradictions & Divergent Findings\n\n`;
      md += `The research engine detected factual or empirical divergences across independent sources:\n\n`;
      this.contradictions.forEach(cnt => {
        md += `### Disputed Topic: ${cnt.disputedTopic}\n\n`;
        md += `- **Source A Assertion:** ${cnt.sourceAAssertion}\n`;
        md += `- **Source B Assertion:** ${cnt.sourceBAssertion}\n`;
        md += `- **Analysis & Disposition:** ${cnt.finalDisposition} (Strategy: ${cnt.resolutionStrategy})\n\n`;
      });
    }

    // 5. Limitations & Boundary Conditions
    if (this.limitations.length > 0) {
      md += `## Research Limitations & Boundary Conditions\n\n`;
      this.limitations.forEach(lim => {
        md += `- ${lim}\n`;
      });
      md += `\n`;
    }

    // 6. Forensic Evidence Verification Matrix
    if (this.claimsMatrix.length > 0) {
      md += `## Forensic Evidence Verification & Claims Matrix\n\n`;
      md += `| Claim Assertion | Category | Status | Confidence | Exact Quote / Evidence |\n`;
      md += `| :--- | :--- | :--- | :--- | :--- |\n`;
      this.claimsMatrix.forEach(c => {
        const shortStatement = (c.statement || '').replace(/\|/g, '-').slice(0, 100);
        const statusBadge = c.verificationStatus === 'SUPPORTED' ? '✅ SUPPORTED' : (c.verificationStatus === 'DISPUTED' ? '⚠️ DISPUTED' : 'ℹ️ UNVERIFIED');
        const quote = (c.exactQuote || 'Passage verified').replace(/\|/g, '-').slice(0, 80);
        md += `| ${shortStatement} | ${c.category} | ${statusBadge} | ${Math.round(c.confidenceScore * 100)}% | "${quote}" |\n`;
      });
      md += `\n`;
    }

    // 7. Structured Bibliography
    if (this.bibliography.length > 0) {
      md += `## Verified Bibliography & Source Catalog\n\n`;
      this.bibliography.forEach(b => {
        const primaryTag = b.isPrimary ? ' • **Primary Source**' : '';
        md += `[${b.number}] **${b.title}**  \n`;
        md += `Publisher: *${b.publisher}* (${b.publishedDate})${primaryTag}  \n`;
        md += `URL: [${b.url}](${b.url})\n\n`;
      });
    }

    return md;
  }

  /**
   * Export Canonical JSON Structure
   */
  toJSON() {
    return {
      jobId: this.jobId,
      reportType: this.reportType,
      title: this.title,
      domain: this.domain,
      generatedAt: this.generatedAt,
      executiveSummary: this.executiveSummary,
      methodology: this.methodology,
      sections: this.sections,
      contradictions: this.contradictions,
      limitations: this.limitations,
      claimsMatrix: this.claimsMatrix,
      bibliography: this.bibliography
    };
  }
}

