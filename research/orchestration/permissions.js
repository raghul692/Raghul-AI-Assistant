/**
 * Strict Role-to-Tool Capability Matrix for Autonomous Deep Research Agents
 * Enforces least-privilege access boundaries server-side.
 */

export const RESEARCH_AGENT_ROLES = {
  SUPERVISOR: 'supervisor',
  PLANNER: 'planner',
  SEARCH_STRATEGIST: 'search_strategist',
  SOURCE_CURATOR: 'source_curator',
  EXTRACTOR: 'extractor',
  CLAIM_ANALYST: 'claim_analyst',
  VERIFIER: 'verifier',
  CONTRADICTION_ANALYST: 'contradiction_analyst',
  WRITER: 'writer',
  CITATION_AUDITOR: 'citation_auditor',
  QUALITY_REVIEWER: 'quality_reviewer'
};

export const ROLE_PERMISSIONS = {
  [RESEARCH_AGENT_ROLES.SUPERVISOR]: new Set([
    'create_plan',
    'delegate_task',
    'update_job_status',
    'record_metrics',
    'evaluate_publication_gate'
  ]),
  [RESEARCH_AGENT_ROLES.PLANNER]: new Set([
    'decompose_topic',
    'formulate_subtopics',
    'define_hypotheses'
  ]),
  [RESEARCH_AGENT_ROLES.SEARCH_STRATEGIST]: new Set([
    'generate_search_matrix',
    'query_web_search',
    'query_academic_search',
    'query_github_search'
  ]),
  [RESEARCH_AGENT_ROLES.SOURCE_CURATOR]: new Set([
    'score_source_authority',
    'detect_syndication',
    'filter_duplicates'
  ]),
  [RESEARCH_AGENT_ROLES.EXTRACTOR]: new Set([
    'fetch_page_content',
    'parse_html_readability',
    'chunk_evidence_passages'
  ]),
  [RESEARCH_AGENT_ROLES.CLAIM_ANALYST]: new Set([
    'extract_atomic_claims',
    'classify_claim_category',
    'extract_exact_quotes'
  ]),
  [RESEARCH_AGENT_ROLES.VERIFIER]: new Set([
    'verify_claim_support',
    'evaluate_corroboration',
    'link_evidence'
  ]),
  [RESEARCH_AGENT_ROLES.CONTRADICTION_ANALYST]: new Set([
    'detect_discrepancies',
    'record_contradiction',
    'evaluate_conflict_scope'
  ]),
  [RESEARCH_AGENT_ROLES.WRITER]: new Set([
    'draft_executive_summary',
    'synthesize_thematic_section',
    'compose_methodology'
  ]),
  [RESEARCH_AGENT_ROLES.CITATION_AUDITOR]: new Set([
    'audit_citations',
    'verify_reference_traceability',
    'format_bibliography'
  ]),
  [RESEARCH_AGENT_ROLES.QUALITY_REVIEWER]: new Set([
    'evaluate_quality_gate',
    'audit_evidence_matrix',
    'certify_publication_readiness'
  ])
};

/**
 * Server-side authorization check for agent action invocation
 * @param {string} role - The agent role invoking the capability
 * @param {string} capability - The capability / tool being requested
 * @throws {Error} if unauthorized
 */
export function authorizeAgentTool(role, capability) {
  if (!role || !ROLE_PERMISSIONS[role]) {
    throw new Error(`[SecurityException] Unknown or unauthorized agent role: "${role}"`);
  }

  const allowedCapabilities = ROLE_PERMISSIONS[role];
  if (!allowedCapabilities.has(capability)) {
    throw new Error(`[AccessDenied] Agent role "${role}" is not authorized to invoke tool/capability "${capability}"`);
  }

  return true;
}

/**
 * Safe boolean permission check without throwing
 */
export function isAgentAuthorized(role, capability) {
  try {
    return authorizeAgentTool(role, capability);
  } catch (_) {
    return false;
  }
}

