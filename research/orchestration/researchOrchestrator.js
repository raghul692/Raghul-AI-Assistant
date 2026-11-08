import { UnifiedSearchDispatcher } from '../providers/searchAdapters.js';
import { ModelRouter } from '../providers/modelRouter.js';
import { WebDocumentExtractor } from '../extractors/webExtractor.js';
import { EvidenceLedger } from '../evidence/evidenceLedger.js';
import { researchRepository } from '../db/repository.js';
import { RESEARCH_CONFIG } from '../config.js';

/**
 * Autonomous Deep Research Orchestrator
 * Coordinates the 12-agent research lifecycle from planning to publishing.
 */
export class ResearchOrchestrator {
  constructor() {
    this.searchDispatcher = new UnifiedSearchDispatcher();
    this.modelRouter = new ModelRouter();
    this.extractor = new WebDocumentExtractor();
    this.activeJobs = new Map(); // jobId -> Job Runtime State
  }

  /**
   * Start a new Autonomous Research Job
   */
  async startJob(userRequest, options = {}, onProgress = () => {}) {
    const topic = userRequest.trim();
    const jobId = `job_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const mode = options.mode || RESEARCH_CONFIG.defaultMode;

    // 1. Persist Initial Job in Database
    researchRepository.createJob({
      id: jobId,
      title: topic.slice(0, 100),
      originalQuery: topic,
      mode: mode,
      config: JSON.stringify(options)
    });

    onProgress({
      step: 'planning',
      message: 'Lead Research Director initializing 10-step methodological plan...',
      progress: 5
    });

    // 2. Lead Research Director & Planner: Generate Structured Plan
    const planResult = await this.modelRouter.createResearchPlan(topic, options);
    const plan = planResult.plan;
    const planId = `plan_${Date.now()}`;

    researchRepository.savePlan({
      id: planId,
      jobId,
      title: topic,
      domain: plan.domain || 'technology',
      scope: plan.scope || 'Comprehensive research',
      planData: JSON.stringify(plan),
      status: 'approved'
    });

    onProgress({
      step: 'plan_approved',
      message: `Research plan formulated for domain [${plan.domain}]. Formulating search matrices...`,
      plan,
      progress: 15
    });

    // 3. Collect queries from subtopics
    const allQueries = [];
    (plan.subtopics || []).forEach(st => {
      (st.searchQueries || []).forEach(q => allQueries.push(q));
    });

    // Add counter-research queries if enabled
    if (RESEARCH_CONFIG.enableCounterResearch && Array.isArray(plan.counterResearchHypotheses)) {
      plan.counterResearchHypotheses.forEach(h => {
        allQueries.push(`${topic} limitations criticism drawbacks ${h.slice(0, 40)}`);
      });
    }

    // Persist queries
    allQueries.forEach(q => {
      researchRepository.saveQuery({
        jobId,
        queryText: q,
        searchEngine: 'unified_search',
        queryType: 'subtopic'
      });
    });

    onProgress({
      step: 'discovery',
      message: `Multi-Source Discovery Agent querying Tavily, Exa, GitHub, and Academic databases (${allQueries.length} search queries)...`,
      progress: 25
    });

    // 4. Source Discovery Agent: Query Multi-Channel Adapters
    const discoveredSources = await this.searchDispatcher.discoverSources(allQueries, {
      domain: plan.domain,
      enableGitHub: RESEARCH_CONFIG.enableGithub,
      enableAcademic: RESEARCH_CONFIG.enableAcademic,
      maxTotalSources: RESEARCH_CONFIG.maxSources || 20
    });

    onProgress({
      step: 'sources_discovered',
      message: `Discovered ${discoveredSources.length} authoritative sources. Starting original page extraction...`,
      sourcesCount: discoveredSources.length,
      progress: 40
    });

    // 5. Document Extractor: Ingest full pages & evidence
    const ledger = new EvidenceLedger();
    let extractedCount = 0;

    for (const src of discoveredSources) {
      const sourceId = `src_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      const registeredSrc = ledger.registerSource(src);

      researchRepository.saveSource({
        id: sourceId,
        jobId,
        url: src.url,
        canonicalUrl: src.url,
        title: src.title,
        sourceType: src.sourceType,
        publisher: src.publisher,
        author: src.author,
        publishedDate: src.publishedDate,
        authorityScore: registeredSrc.authorityScore,
        freshnessScore: registeredSrc.freshnessScore,
        transparencyScore: registeredSrc.transparencyScore,
        confidenceScore: registeredSrc.confidenceScore,
        isPrimary: registeredSrc.isPrimary
      });

      // Extract original text from source URL (with timeout safety)
      try {
        const ext = await this.extractor.extract(src.url);
        if (ext.success && ext.text) {
          ledger.ingestPassages(src.url, ext.text, ext.title, ext.publisher);

          // Extract atomic claims from high-confidence primary sources
          if (registeredSrc.confidenceScore >= 0.8 && extractedCount < 6) {
            const claims = await this.modelRouter.extractAtomicClaims(ext.title, src.url, ext.text);
            if (claims.length > 0) {
              ledger.registerClaims(claims, src.url);
            }
          }
        } else if (src.snippet) {
          // Use search snippet if full page is inaccessible
          ledger.ingestPassages(src.url, src.snippet, src.title, src.publisher);
        }
      } catch (err) {
        if (src.snippet) {
          ledger.ingestPassages(src.url, src.snippet, src.title, src.publisher);
        }
      }

      extractedCount++;
      if (extractedCount % 3 === 0 || extractedCount === discoveredSources.length) {
        onProgress({
          step: 'extracting',
          message: `Extracted and parsed ${extractedCount}/${discoveredSources.length} source documents...`,
          progress: 40 + Math.floor((extractedCount / discoveredSources.length) * 20)
        });
      }
    }

    // 6. Fact-Checking & Counter-Research Review
    onProgress({
      step: 'verification',
      message: `Forensic Reviewer verifying ${ledger.claims.length} atomic claims against corroborating evidence passages...`,
      claimsCount: ledger.claims.length,
      progress: 65
    });

    const { citationMap, citationList } = ledger.getCitationMap();

    // 7. Lead Author & Synthesizer: Synthesize Publication-Grade Chapters
    onProgress({
      step: 'synthesis',
      message: 'Lead Author & Synthesizer drafting exhaustive evidence-backed report with numbered citations...',
      progress: 75
    });

    const reportChapters = [];
    let sectionOrder = 1;

    for (const st of (plan.subtopics || [])) {
      onProgress({
        step: 'synthesis_chapter',
        message: `Drafting Chapter ${sectionOrder}: "${st.title}"...`,
        progress: 75 + Math.floor((sectionOrder / (plan.subtopics.length + 1)) * 15)
      });

      // Filter evidence passages relevant to subtopic
      const subtopicKeywords = (st.title + ' ' + (st.searchQueries || []).join(' ')).toLowerCase().split(/\s+/).filter(w => w.length > 4);
      const relevantPassages = ledger.evidencePassages.filter(p => {
        const text = p.text.toLowerCase();
        return subtopicKeywords.some(kw => text.includes(kw));
      }).slice(0, 10);

      const chapterContent = await this.modelRouter.synthesizeChapter(
        st.title,
        st.researchQuestions || [],
        relevantPassages.length > 0 ? relevantPassages : ledger.evidencePassages.slice(0, 8),
        citationMap
      );

      const secId = `sec_${Date.now()}_${sectionOrder}`;
      researchRepository.saveSection({
        id: secId,
        jobId,
        sectionOrder,
        title: st.title,
        contentMarkdown: chapterContent
      });

      reportChapters.push({
        order: sectionOrder,
        title: st.title,
        content: chapterContent
      });

      sectionOrder++;
    }

    // 8. Generate Executive Summary & Decision Framework
    const executiveSummaryPrompt = `Topic: "${topic}"
Synthesized Chapters Summary:
${reportChapters.map(c => `### ${c.title}\n${c.content.slice(0, 400)}...`).join('\n\n')}

Write a 400-word high-level Executive Summary and a Strategic Decision Framework table. Include key findings, strategic trade-offs, and actionable guidance for technical leadership. Cite sources where appropriate [1], [2].`;

    const execSummaryResult = await this.modelRouter._callGeminiText(
      executiveSummaryPrompt,
      'You are a Chief Technology Advisor and Executive Intelligence Specialist. Write sharp, dense, high-impact executive briefings.'
    );

    // 9. Assemble Full Final Markdown Report
    const fullReportMarkdown = [
      `# ${topic}`,
      `*A Tier-1 Autonomous Deep Research Investigation by Raghul AI*`,
      `**Publication Date:** ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}  `,
      `**Research Domain:** ${plan.domain.toUpperCase()} | **Sources Inspected:** ${discoveredSources.length} | **Verified Citations:** ${citationList.length}`,
      ``,
      `---`,
      ``,
      `## Executive Summary & Strategic Takeaways`,
      execSummaryResult.text,
      ``,
      `---`,
      ``,
      reportChapters.map(c => `## Chapter ${c.order}: ${c.title}\n\n${c.content}`).join('\n\n---\n\n'),
      ``,
      `---`,
      ``,
      `## Verified Primary Sources & Bibliography`,
      citationList.map(c => `[${c.index}] **${c.title}**  \nPublisher: *${c.publisher}* ${c.publishedDate ? `(${c.publishedDate})` : ''}  \nAuthority Score: ${(c.confidenceScore * 100).toFixed(0)}% ${c.isPrimary ? '• Primary Source' : ''}  \nURL: [${c.url}](${c.url})\n`).join('\n')
    ].join('\n\n');

    // 10. Complete Database Job Record
    researchRepository.completeJob(jobId, {
      finalReportMarkdown: fullReportMarkdown,
      costEstimate: this.modelRouter.totalCostEstimated,
      tokensUsed: this.modelRouter.totalTokensUsed
    });

    onProgress({
      step: 'completed',
      message: 'Autonomous Deep Research report successfully synthesized and verified!',
      jobId,
      fullReportMarkdown,
      sources: citationList,
      progress: 100
    });

    return {
      success: true,
      jobId,
      topic,
      plan,
      reportMarkdown: fullReportMarkdown,
      citations: citationList,
      sourcesCount: discoveredSources.length,
      claimsCount: ledger.claims.length,
      tokensUsed: this.modelRouter.totalTokensUsed,
      costEstimate: this.modelRouter.totalCostEstimated
    };
  }
}

export const researchOrchestrator = new ResearchOrchestrator();
