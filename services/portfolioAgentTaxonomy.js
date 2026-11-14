/**
 * RAGHUL AI — PORTFOLIO OS V7 AGENT TAXONOMY & ROLE DEFINITIONS
 * 
 * Formal Architectural Resolution:
 * The Portfolio Operating System consists of:
 * - EXACTLY 6 Autonomous Machine Agent Roles (Specialized AI Execution Agents)
 * - EXACTLY 1 Human Governance Gate (Cryptographic Authorization Boundary)
 * - Orchestrated across a 7-Stage Autonomous Pipeline
 */

export const AUTONOMOUS_AGENT_ROLES = {
  PLANNER: {
    id: 'ROLE_PLANNER_AGENT',
    name: 'Planner Agent',
    stageIndex: 1,
    stageName: 'PLAN',
    tier: 1,
    capabilities: ['intent_parsing', 'rag_retrieval', 'risk_tiering', 'task_decomposition'],
    description: 'Decomposes user prompts into structured dependency graphs and assigns risk tiers (Tier 1-4).'
  },
  DEVELOPER: {
    id: 'ROLE_DEVELOPER_AGENT',
    name: 'Developer Agent',
    stageIndex: 2,
    stageName: 'EXECUTE',
    tier: 2,
    capabilities: ['code_synthesis', 'database_sync', 'git_branching', 'commit_generation'],
    description: 'Executes approved changes, database operations, and code modifications in isolated environments.'
  },
  TESTER: {
    id: 'ROLE_TESTER_AGENT',
    name: 'Tester Agent',
    stageIndex: 3,
    stageName: 'TEST',
    tier: 1,
    capabilities: ['assertion_validation', 'contract_testing', 'regression_detection', 'schema_audit'],
    description: 'Executes automated test suites, validates payloads, and verifies schema conformity.'
  },
  SECURITY_REVIEWER: {
    id: 'ROLE_SECURITY_REVIEWER_AGENT',
    name: 'Security Reviewer Agent',
    stageIndex: 4,
    stageName: 'REVIEW',
    tier: 1,
    capabilities: ['secret_redaction', 'sast_analysis', 'hash_chain_logging', 'tamper_detection'],
    description: 'Performs SAST analysis, redacts credentials, and anchors execution in the SHA-256 audit ledger.'
  },
  DEVOPS: {
    id: 'ROLE_DEVOPS_AGENT',
    name: 'DevOps Agent',
    stageIndex: 6,
    stageName: 'DEPLOY',
    tier: 4,
    capabilities: ['container_verification', 'deployment_dispatch', 'cloud_status_sync', 'rollback_control'],
    description: 'Dispatches and monitors container deployments across Vercel and Render infrastructure.'
  },
  PRODUCTION_VERIFIER: {
    id: 'ROLE_PRODUCTION_VERIFIER_AGENT',
    name: 'Production Verifier Agent',
    stageIndex: 7,
    stageName: 'VERIFY',
    tier: 1,
    capabilities: ['http_probe', 'ssl_verification', 'latency_benchmarking', 'live_telemetry'],
    description: 'Probes live production URLs, validates SSL handshakes, and records response latency.'
  }
};

export const GOVERNANCE_GATE = {
  id: 'GATE_HUMAN_GOVERNANCE',
  name: 'Human Governance Gate',
  stageIndex: 5,
  stageName: 'APPROVAL',
  type: 'CRYPTOGRAPHIC_HUMAN_IN_THE_LOOP',
  description: 'Enforces cryptographic authorization tickets signed with asymmetric operator keypairs before allowing Tier 4 actions.'
};

export const PIPELINE_STAGES = [
  { index: 1, name: 'PLAN', role: AUTONOMOUS_AGENT_ROLES.PLANNER },
  { index: 2, name: 'EXECUTE', role: AUTONOMOUS_AGENT_ROLES.DEVELOPER },
  { index: 3, name: 'TEST', role: AUTONOMOUS_AGENT_ROLES.TESTER },
  { index: 4, name: 'REVIEW', role: AUTONOMOUS_AGENT_ROLES.SECURITY_REVIEWER },
  { index: 5, name: 'APPROVAL', gate: GOVERNANCE_GATE },
  { index: 6, name: 'DEPLOY', role: AUTONOMOUS_AGENT_ROLES.DEVOPS },
  { index: 7, name: 'VERIFY', role: AUTONOMOUS_AGENT_ROLES.PRODUCTION_VERIFIER }
];

export function getAgentRoleByStage(stageIndex) {
  const stage = PIPELINE_STAGES.find(s => s.index === stageIndex);
  return stage?.role || stage?.gate || null;
}

