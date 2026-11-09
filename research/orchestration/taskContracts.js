/**
 * Task Contracts and Runtime Validation for Deep Research Multi-Agent Orchestration
 * Enforces structured handoffs between supervisor and specialist agents.
 */
import crypto from 'crypto';
import { RESEARCH_AGENT_ROLES } from './permissions.js';

/**
 * Factory for creating an execution task contract
 */
export function createTaskContract({
  jobId,
  agentRole,
  stepName,
  inputData = {},
  timeoutMs = 60000,
  maxRetries = 2
}) {
  if (!jobId) throw new Error('[ContractError] jobId is required for task contract');
  if (!agentRole || !Object.values(RESEARCH_AGENT_ROLES).includes(agentRole)) {
    throw new Error(`[ContractError] Invalid agentRole: ${agentRole}`);
  }

  return {
    taskId: `task_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
    jobId,
    agentRole,
    stepName: stepName || agentRole,
    status: 'QUEUED', // 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'RETRYING'
    attempt: 1,
    maxRetries,
    timeoutMs,
    inputData,
    outputData: null,
    error: null,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    usage: {
      provider: null,
      model: null,
      promptTokens: 0,
      completionTokens: 0,
      costUsd: 0.0,
      durationMs: 0
    }
  };
}

/**
 * Validate Specialist Agent Output Schemas
 */
export function validateAgentOutput(agentRole, output) {
  if (!output || typeof output !== 'object') {
    return { valid: false, error: 'Agent output must be a non-null object' };
  }

  switch (agentRole) {
    case RESEARCH_AGENT_ROLES.PLANNER: {
      if (!Array.isArray(output.subtopics) || output.subtopics.length === 0) {
        return { valid: false, error: 'Planner output must contain non-empty subtopics array' };
      }
      return { valid: true };
    }

    case RESEARCH_AGENT_ROLES.SEARCH_STRATEGIST: {
      if (!Array.isArray(output.queries) || output.queries.length === 0) {
        return { valid: false, error: 'Search Strategist output must contain non-empty queries array' };
      }
      return { valid: true };
    }

    case RESEARCH_AGENT_ROLES.SOURCE_CURATOR: {
      if (!Array.isArray(output.sources)) {
        return { valid: false, error: 'Source Curator output must contain sources array' };
      }
      return { valid: true };
    }

    case RESEARCH_AGENT_ROLES.EXTRACTOR: {
      if (!Array.isArray(output.passages)) {
        return { valid: false, error: 'Extractor output must contain passages array' };
      }
      return { valid: true };
    }

    case RESEARCH_AGENT_ROLES.CLAIM_ANALYST: {
      if (!Array.isArray(output.claims)) {
        return { valid: false, error: 'Claim Analyst output must contain claims array' };
      }
      return { valid: true };
    }

    case RESEARCH_AGENT_ROLES.VERIFIER: {
      if (typeof output.verifiedCount !== 'number' || typeof output.verificationRate !== 'number') {
        return { valid: false, error: 'Verifier output must contain verifiedCount and verificationRate' };
      }
      return { valid: true };
    }

    case RESEARCH_AGENT_ROLES.CONTRADICTION_ANALYST: {
      if (!Array.isArray(output.contradictions)) {
        return { valid: false, error: 'Contradiction Analyst output must contain contradictions array' };
      }
      return { valid: true };
    }

    case RESEARCH_AGENT_ROLES.WRITER: {
      if (!output.reportMarkdown || typeof output.reportMarkdown !== 'string' || output.reportMarkdown.length < 100) {
        return { valid: false, error: 'Writer output must contain substantive reportMarkdown (>= 100 chars)' };
      }
      return { valid: true };
    }

    case RESEARCH_AGENT_ROLES.CITATION_AUDITOR: {
      if (!Array.isArray(output.citations) || typeof output.traceabilityScore !== 'number') {
        return { valid: false, error: 'Citation Auditor output must contain citations array and traceabilityScore' };
      }
      return { valid: true };
    }

    case RESEARCH_AGENT_ROLES.QUALITY_REVIEWER: {
      if (typeof output.passed !== 'boolean' || !Array.isArray(output.reasons)) {
        return { valid: false, error: 'Quality Reviewer output must contain boolean passed and reasons array' };
      }
      return { valid: true };
    }

    default:
      return { valid: true };
  }
}

