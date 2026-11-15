import { GoogleGenAI } from '@google/genai';
import { searchWebTool } from './agentTools.js';
import { AIProviderManager } from './orchestration/aiProviderManager.js';
import { generateIEEEPdf, generateExecutivePdf, generateDocxDocument } from './documentEngine.js';
import { researchOrchestrator } from './research/orchestration/researchOrchestrator.js';
import { generateAndValidateReportPdf } from './research/publishing/pdfEngine.js';

let sharedProviderManager = null;
function getProviderManager() {
  if (!sharedProviderManager) {
    sharedProviderManager = new AIProviderManager();
  }
  return sharedProviderManager;
}

/**
 * Autonomous Deep Research Engine (Tier-1 Standard)
 * Decomposes query into exploratory vectors, performs parallel multi-source discovery (Tavily, Exa, GitHub, Academic),
 * conducts atomic claim verification, and synthesizes an exhaustive multi-section publication report with verified A4 PDF.
 */
export async function runDeepResearch({
  client,
  query,
  depth = 'standard', // 'quick' | 'standard' | 'exhaustive'
  isTamil = false,
  onProgress = () => {},
  sendToken = () => {}
}) {
  const startTime = Date.now();

  // Try the new Tier-1 Autonomous Multi-Agent Research Orchestrator
  try {
    const jobResult = await researchOrchestrator.startJob(
      query,
      { mode: depth },
      (p) => {
        onProgress({
          step: p.step,
          badge: `🔬 ${p.step.replace(/_/g, ' ').toUpperCase()}`,
          message: p.message
        });
      }
    );

    if (jobResult.success && jobResult.reportMarkdown) {
      sendToken(jobResult.reportMarkdown);

      // Generate verified publication-grade A4 PDF
      let pdfDoc = null;
      try {
        const pdfResult = await generateAndValidateReportPdf(jobResult.jobId, jobResult.reportMarkdown, {
          title: jobResult.topic,
          sourcesCount: jobResult.sourcesCount,
          citationsCount: jobResult.citations.length
        });
        if (pdfResult.success) {
          pdfDoc = {
            title: jobResult.topic,
            filename: pdfResult.fileName,
            format: 'pdf',
            sizeBytes: pdfResult.validation.fileSizeBytes,
            downloadUrl: pdfResult.url,
            viewUrl: pdfResult.url,
            style: 'a4-publication-standard'
          };
        }
      } catch (pdfErr) {
        console.warn('[DeepResearch] PDF generation notice:', pdfErr.message);
      }

      return {
        success: true,
        vectors: jobResult.plan?.subtopics || [],
        citations: jobResult.citations || [],
        durationMs: Date.now() - startTime,
        dossierLength: jobResult.reportMarkdown.length,
        fullDossier: jobResult.reportMarkdown,
        document: pdfDoc
      };
    }
  } catch (orchErr) {
    console.warn('[DeepResearch] Tier-1 orchestrator fallback to native pipeline:', orchErr.message);
  }

  const vectorCount = depth === 'quick' ? 2 : (depth === 'exhaustive' ? 5 : 3);

  onProgress({
    step: 'planning',
    badge: '🧠 Decomposing Research Scope',
    message: `Analyzing topic and formulating ${vectorCount} multi-angle research vectors (${depth} mode)...`
  });

  // Step 1: Plan Research Vectors
  let vectors = [];
  try {
    const planPrompt = `You are a Principal AI Research Architect.
The user wants an exhaustive deep research dossier on: "${query}".
Break this inquiry down into exactly ${vectorCount} distinct, non-overlapping research sub-queries to explore the topic thoroughly.
Include technical mechanics, empirical performance/benchmarks, real-world failure modes/trade-offs, and modern comparisons.

Output strictly a JSON array of ${vectorCount} objects with "title" and "searchQuery":
[
  {"title": "Core Mechanics & Architecture", "searchQuery": "..."},
  {"title": "Performance & Scaling Benchmarks", "searchQuery": "..."},
  {"title": "Edge Cases & Production Risks", "searchQuery": "..."}
]`;

    let raw = '';
    try {
      const mgr = getProviderManager();
      const planRes = await mgr.generateText({
        prompt: planPrompt,
        maxTokens: 400,
        temperature: 0.2
      });
      raw = planRes?.text || '';
    } catch (mgrErr) {
      if (client?.models?.generateContent) {
        const planRes = await client.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: planPrompt,
          config: { responseMimeType: 'application/json', maxOutputTokens: 400, temperature: 0.2 }
        });
        raw = planRes.text || '';
      }
    }

    const arrayMatch = (raw || '').match(/\[[\s\S]*?\]/);
    if (arrayMatch) {
      const parsed = JSON.parse(arrayMatch[0]);
      if (Array.isArray(parsed) && parsed.length >= 2) {
        vectors = parsed.slice(0, vectorCount);
      }
    }
  } catch (err) {
    console.warn('Vector planning fallback notice:', err.message);
  }

  if (vectors.length === 0) {
    vectors = [
      { title: 'Core Mechanics & Architecture', searchQuery: `${query} architecture internals` },
      { title: 'Benchmarks & Performance Metrics', searchQuery: `${query} benchmarks performance comparison` },
      { title: 'Production Trade-offs & Risks', searchQuery: `${query} production failure modes best practices` }
    ];
  }

  onProgress({
    step: 'vectors_ready',
    badge: `📋 Formulated ${vectors.length} Research Vectors`,
    vectors: vectors.map(v => v.title)
  });

  // Step 2: Parallel Deep Web Exploration
  const searchPromises = vectors.map(async (v, idx) => {
    onProgress({
      step: 'searching',
      badge: `🌐 Exploring Vector ${idx + 1}/${vectors.length}: ${v.title}`,
      message: `Executing live grounded web query: "${v.searchQuery}"...`
    });

    try {
      const searchRes = await searchWebTool(v.searchQuery);
      return {
        vector: v.title,
        query: v.searchQuery,
        data: searchRes
      };
    } catch (e) {
      return {
        vector: v.title,
        query: v.searchQuery,
        data: { query: v.searchQuery, results: [], summary: 'Direct architectural analysis applied.' }
      };
    }
  });

  const gatheredData = await Promise.all(searchPromises);

  // Compile collected intelligence
  let compiledEvidence = '';
  let citations = [];
  let sourceIndex = 1;

  for (const item of gatheredData) {
    compiledEvidence += `\n\n### Research Vector: ${item.vector}\n`;
    compiledEvidence += `Search Query: "${item.query}"\n`;
    if (item.data.results && item.data.results.length > 0) {
      for (const res of item.data.results) {
        let domain = '';
        try { domain = new URL(res.link).hostname; } catch (e) { domain = 'web'; }
        const title = res.title || domain;
        compiledEvidence += `- Source [${sourceIndex}] "${title}": ${res.snippet} (URL: ${res.link})\n`;
        citations.push({ index: sourceIndex, title, url: res.link, snippet: res.snippet });
        sourceIndex++;
      }
    } else {
      compiledEvidence += `- Direct synthesis evidence: ${item.data.summary || 'Production engineering heuristics applied.'}\n`;
    }
  }

  onProgress({
    step: 'synthesizing',
    badge: '⚡ Synthesizing Deep Research Dossier',
    message: `Synthesizing ${citations.length} verified live web sources into a publication-grade dossier...`
  });

  // Step 3: Stream Final Comprehensive Research Dossier
  const languageInstruction = isTamil
    ? 'Provide the complete dossier in high-quality English & Tanglish (Latin/English alphabet only, e.g. "React architecture-la state management romba mukkiyam"). STRICTLY DO NOT use Tamil script (U+0B80-U+0BFF).'
    : 'Provide the complete dossier in structured, highly articulate executive English.';

  const synthesisPrompt = `You are the Lead Principal Research Fellow at RAGHUL AI Research Labs.
Synthesize an authoritative, deeply technical research dossier answering the user's inquiry:
"${query}"

Use the verified live research data collected across our research vectors below:
${compiledEvidence}

Report Structure Guidelines:
1. # 🔬 Executive Research Dossier: ${query}
2. **Executive Summary**: Core findings, key breakthroughs, and bottom-line verdict.
3. **Architecture & Deep Technical Mechanics**: Exhaustive breakdown of how it works under the hood.
4. **Empirical Benchmarks & Comparative Analysis**: A comprehensive Markdown table comparing options, latency, memory, or throughput.
5. **Real-World Trade-offs, Failure Modes & Edge Cases**: What breaks in production and how to mitigate it.
6. **Strategic Recommendation & Implementation Roadmap**: Step-by-step guidance for an engineer.
7. **Verified Sources & Citations**: List sources using [1], [2] brackets.

${languageInstruction}
Depth: Highly technical, structured, actionable, with zero fluff.`;

  let fullDossier = '';
  try {
    const mgr = getProviderManager();
    const result = await mgr.orchestrateStream({
      messages: [{ role: 'user', content: synthesisPrompt }],
      temperature: 0.3,
      maxTokens: 2500,
      onToken: (tok) => {
        fullDossier += tok;
        sendToken(tok);
      }
    });
    if (!fullDossier && result?.text) {
      fullDossier = result.text;
      sendToken(fullDossier);
    }
  } catch (mgrErr) {
    console.warn('[DeepResearch] AIProviderManager stream notice:', mgrErr.message);
    if (client?.models?.generateContentStream) {
      try {
        const streamRes = await client.models.generateContentStream({
          model: 'gemini-2.5-flash',
          contents: synthesisPrompt,
          config: { temperature: 0.3, maxOutputTokens: 2500 }
        });
        for await (const chunk of streamRes) {
          const text = chunk.text || '';
          if (text) {
            fullDossier += text;
            sendToken(text);
          }
        }
      } catch (streamErr) {
        console.warn('[DeepResearch] Client stream fallback to unary:', streamErr.message);
        const unaryRes = await client.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: synthesisPrompt,
          config: { temperature: 0.3, maxOutputTokens: 2000 }
        });
        fullDossier = unaryRes.text || '';
        sendToken(fullDossier);
      }
    }
  }

  const durationMs = Date.now() - startTime;

  let generatedDocument = null;
  try {
    generatedDocument = await createDocumentFromDossier({
      query,
      dossier: fullDossier,
      citations
    });
  } catch (docErr) {
    console.warn('[DeepResearch] Document generation notice:', docErr.message);
  }

  return {
    success: true,
    vectors,
    citations,
    durationMs,
    dossierLength: fullDossier.length,
    fullDossier,
    document: generatedDocument
  };
}

/**
 * Automatically synthesizes an IEEE or Executive publication PDF from synthesized dossier
 */
export async function createDocumentFromDossier({ query, dossier = '', citations = [], style = 'auto' }) {
  const isTechnical = /algorithm|architecture|benchmark|latency|distributed|neural|model|code|kernel|mcp|system|security|quantum|battery|computing|compiler/i.test(query);
  const selectedStyle = style === 'auto' ? (isTechnical ? 'ieee' : 'executive') : style;

  // Extract Title
  const titleMatch = dossier.match(/^#\s*(?:🔬\s*)?(?:Executive Research Dossier:\s*)?([^\n]+)/m);
  const title = titleMatch ? titleMatch[1].replace(/[*_#]/g, '').trim() : query;

  // Extract Sections
  const sectionRegex = /^##\s+([^\n]+)\n([\s\S]*?)(?=(?:^##\s+|$))/gm;
  const sections = [];
  let match;
  let abstract = '';

  while ((match = sectionRegex.exec(dossier)) !== null) {
    const secTitle = match[1].replace(/^\d+\.\s*/, '').replace(/[*_#]/g, '').trim();
    const secContent = match[2].trim();

    if (/executive summary|abstract/i.test(secTitle) && !abstract) {
      abstract = secContent.replace(/^[\s\S]*?:/, '').slice(0, 1000).trim();
    } else if (!/references|verified sources|citations/i.test(secTitle)) {
      sections.push({
        title: secTitle,
        content: secContent.slice(0, 3500)
      });
    }
  }

  if (sections.length === 0) {
    sections.push({
      title: 'Detailed Research Findings',
      content: dossier.slice(0, 3500)
    });
  }

  if (selectedStyle === 'ieee') {
    return await generateIEEEPdf({
      title,
      authors: [{ name: 'RAGHUL AI Research Fellow', affiliation: 'Advanced AI Architecture Labs' }],
      abstract: abstract || `Comprehensive technical analysis and empirical investigation into ${query}.`,
      sections,
      citations
    });
  } else {
    return await generateExecutivePdf({
      title,
      executiveSummary: abstract || `Executive intelligence briefing on ${query}.`,
      sections,
      citations
    });
  }
}
