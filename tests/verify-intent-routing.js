import { githubAgent } from '../githubAgent.js';

// Replicate the exact dispatcher decision logic from server.js
function classifyDispatcher(message, reqBody = {}, chat = {}) {
  const sanitizedMessage = message || '';
  const personaKey = reqBody.personaKey || chat.persona || 'assistant';
  
  const isExplicitDeepResearch = Boolean(reqBody.isDeepResearch) || /^\/(?:research|deepresearch)\b/i.test(sanitizedMessage);
  const isPersonaDeepResearcher = (personaKey === 'researcher' || chat.persona === 'researcher');
  const hasResearchKeywords = /(?:\bdeep\s*research\b|\bexhaustive\s*research\b|\bcomprehensive\s*research\b|\bieee\s*(?:pdf|report|paper)\b|\bresearch\s*(?:report|paper|dossier|investigation)\b|\bpdf\s*(?:research\s*)?report\b)/i.test(sanitizedMessage);

  const isDeepResearch = isExplicitDeepResearch || isPersonaDeepResearcher || hasResearchKeywords;
  const isGitHub = githubAgent.isGitHubIntent(sanitizedMessage);

  let selectedHandler = 'STANDARD_CHAT_STREAM';

  if (isDeepResearch) {
    selectedHandler = 'DEEP_RESEARCH_ENGINE';
  } else if (isGitHub) {
    selectedHandler = 'GITHUB_AUTONOMOUS_AGENT';
  }

  return {
    sanitizedMessage,
    isDeepResearch,
    isGitHub,
    selectedHandler
  };
}

async function run() {
  console.log('================================================================');
  console.log('🧪 VERIFY INTENT ROUTING & MUTUAL EXCLUSION (SECTION 3)');
  console.log('================================================================\n');

  const testMatrix = [
    {
      caseId: 'A. Explicit Research Command',
      prompt: '/research Production-grade Multi-Agent System architectures in 2026: Compare LangGraph, CrewAI, and AutoGen on execution latency, token costs, fault tolerance, and human-in-the-loop workflows. Include enterprise case studies and GitHub benchmark repositories.',
      expectedHandler: 'DEEP_RESEARCH_ENGINE',
      expectGitHubApiCall: false
    },
    {
      caseId: 'B. Natural-Language Query (General Comparison)',
      prompt: 'Compare LangGraph, CrewAI, and AutoGen architectures, with evidence, sources, benchmarks, and enterprise case studies.',
      expectedHandler: 'STANDARD_CHAT_STREAM', // Standard fast assistant with web search, NOT hijacking to GitHub or unrequested heavy 5min deep research
      expectGitHubApiCall: false
    },
    {
      caseId: 'B2. Natural-Language Deep Research Explicit Request',
      prompt: 'Please conduct a deep research report on Multi-Agent System architectures in 2026.',
      expectedHandler: 'DEEP_RESEARCH_ENGINE',
      expectGitHubApiCall: false
    },
    {
      caseId: 'C. Genuine GitHub Request',
      prompt: 'List my repositories on GitHub.',
      expectedHandler: 'GITHUB_AUTONOMOUS_AGENT',
      expectGitHubApiCall: true
    },
    {
      caseId: 'D. Explicit Repository Request',
      prompt: 'Read the README from repo raghul692/TO_DO_LIST.',
      expectedHandler: 'GITHUB_AUTONOMOUS_AGENT',
      expectGitHubApiCall: true
    },
    {
      caseId: 'E. Ordinary Conversation',
      prompt: 'Explain production architecture in 2026.',
      expectedHandler: 'STANDARD_CHAT_STREAM',
      expectGitHubApiCall: false
    },
    {
      caseId: 'F1. Research query with repository & GitHub',
      prompt: 'What are the top GitHub benchmark repositories for evaluating agent latency in production in 2026?',
      expectedHandler: 'STANDARD_CHAT_STREAM',
      expectGitHubApiCall: false
    },
    {
      caseId: 'F2. Deep Research command with deploy & AWS',
      prompt: '/research Zero-downtime deployment strategies on AWS EKS with canary rollouts in 2026',
      expectedHandler: 'DEEP_RESEARCH_ENGINE',
      expectGitHubApiCall: false
    },
    {
      caseId: 'F3. Question about GitHub concepts',
      prompt: 'What is the difference between git merge and git rebase in production repository workflows?',
      expectedHandler: 'STANDARD_CHAT_STREAM', // Educational git query - standard chat
      expectGitHubApiCall: false
    }
  ];

  let passed = 0;
  let failed = 0;

  for (const t of testMatrix) {
    const classification = classifyDispatcher(t.prompt);
    const repoExtracted = await githubAgent.extractRepoName(t.prompt);
    
    const handlerMatches = classification.selectedHandler === t.expectedHandler;
    const noUnwantedGitCall = !t.expectGitHubApiCall ? classification.selectedHandler !== 'GITHUB_AUTONOMOUS_AGENT' : true;
    const ok = handlerMatches && noUnwantedGitCall;

    if (ok) {
      passed++;
      console.log(`✅ [PASS] ${t.caseId}`);
    } else {
      failed++;
      console.log(`❌ [FAIL] ${t.caseId}`);
      console.log(`   Expected Handler: ${t.expectedHandler}, Got: ${classification.selectedHandler}`);
    }

    console.log(`   - Input: "${t.prompt.slice(0, 70)}..."`);
    console.log(`   - Deep Research Intent: ${classification.isDeepResearch}`);
    console.log(`   - GitHub Intent: ${classification.isGitHub}`);
    console.log(`   - Selected Dispatcher: ${classification.selectedHandler}`);
    console.log(`   - Repo Extracted: ${repoExtracted}`);
    console.log(`   - GitHub API Action Required: ${t.expectGitHubApiCall}\n`);
  }

  console.log(`\nFinal Intent Routing Result: ${passed} Passed, ${failed} Failed out of ${testMatrix.length}`);
  if (failed > 0) process.exit(1);
}

run();

