import dotenv from 'dotenv';
dotenv.config();

export const researchConfig = {
  // Provider API Keys
  geminiApiKey: process.env.GEMINI_API_KEY || '',
  geminiDeepResearchAgent: process.env.GEMINI_DEEP_RESEARCH_AGENT || 'deep-research-preview-04-2026',
  geminiDeepResearchMaxAgent: process.env.GEMINI_DEEP_RESEARCH_MAX_AGENT || 'deep-research-max-preview-04-2026',
  geminiFastModel: process.env.GEMINI_FAST_MODEL || 'gemini-3.5-flash',

  tavilyApiKey: process.env.TAVILY_API_KEY || '',
  exaApiKey: process.env.EXA_API_KEY || '',
  githubToken: process.env.GITHUB_TOKEN || process.env.GITHUB_PERSONAL_ACCESS_TOKEN || '',

  // Optional Review Providers
  openaiApiKey: process.env.OPENAI_API_KEY || '',
  openaiReviewModel: process.env.OPENAI_REVIEW_MODEL || 'gpt-4o',
  anthropicApiKey: process.env.ANTHROPIC_API_KEY || '',
  anthropicReviewModel: process.env.ANTHROPIC_REVIEW_MODEL || 'claude-3-5-sonnet-20241022',

  // Research Defaults
  defaultMode: process.env.RESEARCH_DEFAULT_MODE || 'deep', // 'quick' | 'deep' | 'exhaustive'
  enableCounterResearch: process.env.RESEARCH_ENABLE_COUNTER_RESEARCH !== 'false',
  enableGitHub: process.env.RESEARCH_ENABLE_GITHUB !== 'false',
  enableAcademic: process.env.RESEARCH_ENABLE_ACADEMIC !== 'false',
  requirePlanApproval: process.env.RESEARCH_REQUIRE_PLAN_APPROVAL === 'true',

  // Configurable Bounds & Budgets
  maxConcurrentJobs: parseInt(process.env.RESEARCH_MAX_CONCURRENT_JOBS || '3', 10),
  maxSearchCalls: parseInt(process.env.RESEARCH_MAX_SEARCH_CALLS || '15', 10),
  maxSources: parseInt(process.env.RESEARCH_MAX_SOURCES || '25', 10),
  maxRuntimeMs: parseInt(process.env.RESEARCH_MAX_RUNTIME || '300000', 10), // 5 minutes
  budgetUsd: parseFloat(process.env.RESEARCH_BUDGET_USD || '2.00'),

  // PDF Configuration
  pdfFormat: process.env.RESEARCH_PDF_FORMAT || 'A4',
  pdfValidation: process.env.RESEARCH_PDF_VALIDATION !== 'false',

  // Security Guards
  blockedIpRanges: [
    /^127\./,
    /^10\./,
    /^192\.168\./,
    /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
    /^169\.254\./,
    /^::1$/,
    /^0\./
  ]
};

export const RESEARCH_CONFIG = researchConfig;
