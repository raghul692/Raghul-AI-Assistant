import { UnifiedSearchDispatcher } from '../research/providers/searchAdapters.js';
import { ModelRouter } from '../research/providers/modelRouter.js';
import { WebDocumentExtractor } from '../research/extractors/webExtractor.js';
import { generateAndValidateReportPdf } from '../research/publishing/pdfEngine.js';

async function runTestSuite() {
  console.log('--- 1. Testing Search Dispatcher ---');
  const dispatcher = new UnifiedSearchDispatcher();
  const searchResults = await dispatcher.discoverSources(['Next.js 15 Server Components architecture', 'LangChain vs CrewAI orchestration benchmark'], {
    domain: 'software',
    enableGitHub: true,
    enableAcademic: true,
    maxTotalSources: 6
  });
  console.log(`✅ Discovered ${searchResults.length} sources across providers.`);
  searchResults.forEach((s, idx) => console.log(`   [${idx + 1}] (${s.provider}) ${s.title.slice(0, 60)}...`));

  console.log('\n--- 2. Testing Model Router Planner ---');
  const router = new ModelRouter();
  const planRes = await router.createResearchPlan('Production Architecture of Multi-Agent Systems 2026');
  console.log(`✅ Plan formulated: domain=${planRes.plan.domain}, subtopics=${planRes.plan.subtopics.length}`);

  console.log('\n--- 3. Testing Web Extractor ---');
  const extractor = new WebDocumentExtractor();
  const sampleExtract = await extractor.extract('https://en.wikipedia.org/wiki/Artificial_intelligence');
  console.log(`✅ Extracted web page: title="${sampleExtract.title}", words=${sampleExtract.wordCount}`);

  console.log('\n--- 4. Testing Publication-Grade A4 PDF Engine & Verification ---');
  const sampleMarkdown = `
# Production Architecture of Multi-Agent Systems 2026

*A Tier-1 Autonomous Deep Research Investigation by Raghul AI*
**Publication Date:** November 8, 2026  
**Research Domain:** AI & SOFTWARE ENGINEERING | **Sources Inspected:** 12 | **Verified Citations:** 4

---

## Executive Summary & Strategic Takeaways
Multi-agent architectures have evolved from experimental prompt chains into fault-tolerant distributed networks. In-production telemetry indicates that specialized swarms outperform monolithic LLM calls by 34% on complex code verification tasks [1].

| Metric | Monolithic LLM | Multi-Agent Swarm | Performance Delta |
| :--- | :--- | :--- | :--- |
| Reasoning Depth | 4.2 / 10 | 8.9 / 10 | +112% |
| Factual Hallucination Rate | 14.8% | 3.1% | -79% [2] |
| Execution Latency | 1.8s | 8.4s | +366% |

---

## Chapter 1: Foundations and Current State
Autonomous agent orchestration relies on reactive loop patterns [1]. The shift toward decentralized tool dispatching allows subagents to execute sandboxed code without central bottlenecks [3].

> [!NOTE] Implementation Standard:
> Production agent loops must enforce strict token budgets and circuit-breaker timeouts to prevent infinite reflection loops [4].

---

## Chapter 2: Limitations, Controversies & Security Considerations
Adversarial prompt injection and recursive state corruption remain primary attack vectors [2]. Strict input sanitization and credential isolation are non-negotiable [3].

---

## Verified Primary Sources & Bibliography
[1] **Architectural Patterns of Agentic Workflows**  
Publisher: *IEEE Computer Society* (2026)  
Authority Score: 95% • Primary Source  
URL: https://example.com/agentic-patterns

[2] **Empirical Benchmark on LLM Multi-Agent Coordination**  
Publisher: *arXiv.org* (2026)  
Authority Score: 92% • Primary Source  
URL: https://arxiv.org/abs/2401.00000

[3] **GitHub - Agent Swarm Distributed Runtime**  
Publisher: *GitHub* (2026)  
Authority Score: 88% • Primary Source  
URL: https://github.com/example/agent-swarm

[4] **W3C Security Guidelines for Autonomous Web Agents**  
Publisher: *W3C Working Group* (2026)  
Authority Score: 98% • Primary Source  
URL: https://w3.org/TR/agent-security
`;

  const pdfRes = await generateAndValidateReportPdf('test_verification_job', sampleMarkdown, {
    title: 'Production Architecture of Multi-Agent Systems 2026',
    sourcesCount: 12,
    citationsCount: 4
  });

  console.log(`✅ PDF Generation & Validation succeeded!`);
  console.log(`   File: ${pdfRes.fileName}`);
  console.log(`   Pages: ${pdfRes.validation.numPages}`);
  console.log(`   Bytes: ${pdfRes.validation.fileSizeBytes}`);
  console.log(`   Has Exec Summary: ${pdfRes.validation.hasExecutiveSummary}`);
  console.log(`   Has Bibliography: ${pdfRes.validation.hasBibliography}`);
  console.log(`   Has Numbered Citations: ${pdfRes.validation.hasCitations}`);
}

runTestSuite().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});

