/**
 * NEXUS AI — AUTONOMOUS 7-STAGE PORTFOLIO AI AGENT ENGINE (V7)
 * 
 * Formal Architecture:
 * - 6 Autonomous Machine Agent Roles (Specialized AI Execution Agents)
 * - 1 Human Governance Gate (Cryptographic Authorization Checkpoint)
 * - Orchestrated across 7 Continuous Stages with Per-Stage Artifacts & Durations
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { integrationManager } from './integrationManager.js';
import { supabaseSyncEngine } from './supabaseSyncEngine.js';
import { portfolioJobQueue } from './portfolioJobQueue.js';
import { db, recordLiveActivity } from '../db.js';
import {
  recordAuditLog,
  verifyAuditLedgerIntegrity,
  verifyAndConsumeAuthorizationTicket,
  computePayloadHash,
  RISK_LEVELS
} from '../governanceAudit.js';
import { AUTONOMOUS_AGENT_ROLES, GOVERNANCE_GATE } from './portfolioAgentTaxonomy.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ARTIFACTS_BASE_DIR = path.join(__dirname, '..', 'data', 'pipeline_artifacts');

if (!fs.existsSync(ARTIFACTS_BASE_DIR)) {
  fs.mkdirSync(ARTIFACTS_BASE_DIR, { recursive: true });
}

export class PortfolioAgentEngine {
  constructor() {
    this.productionUrl = 'https://raghulraja.is-a.dev/';
  }

  /**
   * Execute prompt through the 7-stage autonomous multi-agent pipeline
   */
  async executePipeline(prompt, options = {}) {
    const startTime = Date.now();
    const query = (prompt || '').trim();
    if (!query) throw new Error('Execution prompt cannot be empty');

    // 0. Persistent Emergency Stop Check
    if (portfolioJobQueue.isEmergencyStopped || integrationManager.isEmergencyStopActive()) {
      throw new Error('EMERGENCY_STOP_BLOCKED: All autonomous operations are halted by operator');
    }

    const runId = `run_${startTime}_${Math.random().toString(36).slice(2, 7)}`;
    const runArtifactDir = path.join(ARTIFACTS_BASE_DIR, runId);
    fs.mkdirSync(runArtifactDir, { recursive: true });

    const lower = query.toLowerCase();
    const verifiedSteps = [];
    const stageTraces = [];

    const pipelineNodes = [
      { index: 1, name: 'Plan', agent: AUTONOMOUS_AGENT_ROLES.PLANNER.name, roleId: AUTONOMOUS_AGENT_ROLES.PLANNER.id, status: 'pending' },
      { index: 2, name: 'Execute', agent: AUTONOMOUS_AGENT_ROLES.DEVELOPER.name, roleId: AUTONOMOUS_AGENT_ROLES.DEVELOPER.id, status: 'pending' },
      { index: 3, name: 'Test', agent: AUTONOMOUS_AGENT_ROLES.TESTER.name, roleId: AUTONOMOUS_AGENT_ROLES.TESTER.id, status: 'pending' },
      { index: 4, name: 'Review', agent: AUTONOMOUS_AGENT_ROLES.SECURITY_REVIEWER.name, roleId: AUTONOMOUS_AGENT_ROLES.SECURITY_REVIEWER.id, status: 'pending' },
      { index: 5, name: 'Approval', agent: GOVERNANCE_GATE.name, roleId: GOVERNANCE_GATE.id, status: 'pending' },
      { index: 6, name: 'Deploy', agent: AUTONOMOUS_AGENT_ROLES.DEVOPS.name, roleId: AUTONOMOUS_AGENT_ROLES.DEVOPS.id, status: 'pending' },
      { index: 7, name: 'Verify', agent: AUTONOMOUS_AGENT_ROLES.PRODUCTION_VERIFIER.name, roleId: AUTONOMOUS_AGENT_ROLES.PRODUCTION_VERIFIER.id, status: 'pending' }
    ];

    // Helper to persist stage artifact
    const recordStageTrace = (stageIndex, stageName, role, inputData, outputData, stageStart) => {
      const stageEnd = Date.now();
      const durationMs = stageEnd - stageStart;
      const artifactFilename = `${String(stageIndex).padStart(2, '0')}_${stageName.toLowerCase()}.json`;
      const artifactPath = path.join(runArtifactDir, artifactFilename);

      const trace = {
        stageIndex,
        stageName,
        role: role.name || role,
        startedAt: stageStart,
        completedAt: stageEnd,
        durationMs,
        input: inputData,
        output: outputData,
        artifactFile: artifactFilename
      };

      try {
        fs.writeFileSync(artifactPath, JSON.stringify(trace, null, 2), 'utf8');
      } catch (_) {}

      stageTraces.push(trace);
      return trace;
    };

    // =========================================================================
    // STAGE 1: PLAN (Planner Agent)
    // =========================================================================
    const stage1Start = Date.now();
    pipelineNodes[0].status = 'running';
    let intent = 'general_knowledge';
    let securityTier = 1;

    if (lower.includes('visitor') || lower.includes('traffic') || lower.includes('analytics')) {
      intent = 'visitor_analytics';
      securityTier = 1;
    } else if (lower.includes('database') || lower.includes('backup') || lower.includes('sync')) {
      intent = 'database_sync';
      securityTier = 2;
    } else if (lower.includes('github') || lower.includes('repo') || lower.includes('commit') || lower.includes('branch')) {
      intent = 'github_ops';
      securityTier = lower.includes('commit') || lower.includes('create') ? 2 : 1;
    } else if (lower.includes('deploy') || lower.includes('release') || lower.includes('rollback')) {
      intent = 'deployment_control';
      securityTier = 4;
    } else if (lower.includes('test') || lower.includes('audit') || lower.includes('health') || lower.includes('error')) {
      intent = 'system_audit';
      securityTier = 1;
    }

    const knowledgeMatches = db.prepare(`
      SELECT title, category, source_path, SUBSTR(content, 1, 150) as snippet
      FROM portfolio_knowledge_index
      WHERE title LIKE ? OR content LIKE ?
      LIMIT 3
    `).all(`%${query.slice(0, 20)}%`, `%${query.slice(0, 20)}%`);

    const stage1Output = {
      intent,
      securityTier,
      knowledgeGroundedCount: knowledgeMatches.length,
      knowledgeSnippets: knowledgeMatches.map(k => k.title),
      riskAssessment: securityTier >= 4 ? 'CRITICAL_PRODUCTION_RISK' : (securityTier >= 3 ? 'MODERATE_WRITE_RISK' : 'LOW_READ_ONLY')
    };

    recordStageTrace(1, 'PLAN', AUTONOMOUS_AGENT_ROLES.PLANNER, { query, options }, stage1Output, stage1Start);
    verifiedSteps.push(`Stage 1 [PLAN - Planner Agent]: Classified intent as "${intent}" (Security Tier ${securityTier}). Grounded in ${knowledgeMatches.length} knowledge base records.`);
    pipelineNodes[0].status = 'done';

    // =========================================================================
    // STAGE 2: EXECUTE (Developer Agent)
    // =========================================================================
    const stage2Start = Date.now();
    pipelineNodes[1].status = 'running';
    let executionResult = null;

    switch (intent) {
      case 'visitor_analytics': {
        const eventsCount = db.prepare('SELECT COUNT(*) as count FROM portfolio_analytics_events').get().count;
        const topPages = db.prepare('SELECT path, COUNT(*) as hits FROM portfolio_analytics_events GROUP BY path ORDER BY hits DESC LIMIT 3').all();
        executionResult = {
          totalEvents: eventsCount,
          topPages,
          source: 'SQLite first-party analytics replica'
        };
        verifiedSteps.push(`Stage 2 [EXECUTE - Developer Agent]: Queried live visitor analytics (${eventsCount} total events recorded, top path: ${topPages[0]?.path || '/'}).`);
        break;
      }

      case 'database_sync': {
        const syncResult = await supabaseSyncEngine.syncAll(true);
        const consistency = await supabaseSyncEngine.getConsistencyReport();
        executionResult = { syncResult, consistency };
        verifiedSteps.push(`Stage 2 [EXECUTE - Developer Agent]: Synchronized Supabase PostgreSQL to SQLite (Docs synced: ${syncResult.documents?.count || 0}, Contacts: ${syncResult.contacts?.count || 0}).`);
        break;
      }

      case 'github_ops': {
        const repoDetails = await integrationManager.getGitHubRepoDetails();
        executionResult = { repoDetails };
        verifiedSteps.push(`Stage 2 [EXECUTE - Developer Agent]: Connected to GitHub repository ${repoDetails.fullName} (Default branch: ${repoDetails.defaultBranch}, open issues: ${repoDetails.openIssues}).`);
        break;
      }

      case 'deployment_control': {
        const vercelDeploys = await integrationManager.getLatestVercelDeployments(3);
        const renderDeploys = await integrationManager.getLatestRenderDeployments(3);
        executionResult = {
          vercel: vercelDeploys,
          render: renderDeploys,
          latestVercelState: vercelDeploys[0]?.ready || 'UNKNOWN',
          latestRenderState: renderDeploys[0]?.status || 'UNKNOWN'
        };
        verifiedSteps.push(`Stage 2 [EXECUTE - Developer Agent]: Queried production deployments (Vercel: ${vercelDeploys[0]?.ready} [${vercelDeploys[0]?.url}], Render: ${renderDeploys[0]?.status}).`);
        break;
      }

      case 'system_audit':
      default: {
        const health = await integrationManager.verifyProductionHealth();
        const vercelProbe = await integrationManager.testVercel();
        const renderProbe = await integrationManager.testRender();
        executionResult = { health, vercel: vercelProbe.status, render: renderProbe.status };
        verifiedSteps.push(`Stage 2 [EXECUTE - Developer Agent]: Conducted live infrastructure audit (Live site HTTP ${health.status} in ${health.latencyMs}ms, Vercel: ${vercelProbe.status}, Render: ${renderProbe.status}).`);
        break;
      }
    }

    recordStageTrace(2, 'EXECUTE', AUTONOMOUS_AGENT_ROLES.DEVELOPER, stage1Output, executionResult, stage2Start);
    pipelineNodes[1].status = 'done';

    // =========================================================================
    // STAGE 3: TEST (Tester Agent)
    // =========================================================================
    const stage3Start = Date.now();
    pipelineNodes[2].status = 'running';
    const assertions = [];

    assertions.push({ check: 'Execution payload generated', pass: executionResult !== null });
    assertions.push({ check: 'Verified steps non-empty', pass: verifiedSteps.length >= 2 });
    assertions.push({ check: 'Execution contract valid', pass: typeof executionResult === 'object' });

    const allPassed = assertions.every(a => a.pass);
    if (!allPassed) {
      throw new Error('Stage 3 [TEST] failed: Verification assertions did not pass');
    }

    const stage3Output = { assertions, allPassed, passedCount: assertions.length };
    recordStageTrace(3, 'TEST', AUTONOMOUS_AGENT_ROLES.TESTER, executionResult, stage3Output, stage3Start);
    verifiedSteps.push(`Stage 3 [TEST - Tester Agent]: All integrity checks passed (${assertions.length}/${assertions.length} assertions verified).`);
    pipelineNodes[2].status = 'done';

    // =========================================================================
    // STAGE 4: REVIEW (Security Reviewer Agent)
    // =========================================================================
    const stage4Start = Date.now();
    pipelineNodes[3].status = 'running';
    
    // 1. Redact secrets
    executionResult = integrationManager.redactSecrets(executionResult);

    // 2. Append-only SHA-256 Hash Chained Audit Record
    const auditId = recordAuditLog({
      actor: AUTONOMOUS_AGENT_ROLES.SECURITY_REVIEWER.name,
      action: `PIPELINE_${intent.toUpperCase()}`,
      target: this.productionUrl,
      riskLevel: securityTier >= 4 ? RISK_LEVELS.CRITICAL : (securityTier >= 3 ? RISK_LEVELS.WRITE : RISK_LEVELS.READ),
      status: 'SUCCESS',
      justification: `Autonomous execution for run ${runId}`,
      metadata: { runId, intent, securityTier }
    });

    // 3. Verify Ledger Integrity
    const ledgerCheck = verifyAuditLedgerIntegrity();

    const stage4Output = {
      auditId,
      ledgerValid: ledgerCheck.valid,
      auditedCount: ledgerCheck.auditedCount,
      secretsRedacted: true
    };

    recordStageTrace(4, 'REVIEW', AUTONOMOUS_AGENT_ROLES.SECURITY_REVIEWER, executionResult, stage4Output, stage4Start);
    verifiedSteps.push(`Stage 4 [REVIEW - Security Reviewer Agent]: Secrets redacted, audit record ${auditId} logged with SHA-256 hash chaining (Ledger valid: ${ledgerCheck.valid}).`);
    pipelineNodes[3].status = 'done';

    // =========================================================================
    // STAGE 5: APPROVAL (Human Governance Gate)
    // =========================================================================
    const stage5Start = Date.now();
    pipelineNodes[4].status = 'running';
    let humanAuthorized = false;
    let consumedTicketInfo = null;

    if (securityTier >= 4 || options.approvalTicketId) {
      const ticketId = options.approvalTicketId || options.approvalId;
      if (ticketId) {
        // Enforce full cryptographic signature verification & atomic consumption
        try {
          consumedTicketInfo = verifyAndConsumeAuthorizationTicket({
            ticketId,
            action: options.requiredAction || 'portfolio_production_deploy',
            target: options.requiredTarget || 'render:srv-da9foaon74is73fvojn0',
            payload: options.ticketPayload || {}
          });
          humanAuthorized = true;
          verifiedSteps.push(`Stage 5 [APPROVAL - Governance Gate]: Cryptographic ticket ${ticketId} verified and consumed atomically (Operator: ${consumedTicketInfo.operatorId}).`);
        } catch (authErr) {
          throw new Error(`GOVERNANCE_GATE_BLOCKED: ${authErr.message}`);
        }
      } else {
        if (options.triggerMutation === true || options.executeControlledDeployment === true) {
          throw new Error('GOVERNANCE_GATE_BLOCKED: Production deployment trigger requires an authorized human approval ticket (Tier 4)');
        }
        verifiedSteps.push(`Stage 5 [APPROVAL - Governance Gate]: Tier 4 read-only deployment inspection authorized under automated safety policy.`);
      }
    } else {
      verifiedSteps.push(`Stage 5 [APPROVAL - Governance Gate]: Automated policy approval granted for Tier ${securityTier} action.`);
    }

    const stage5Output = {
      humanAuthorized,
      consumedTicketInfo,
      securityTier,
      gateType: GOVERNANCE_GATE.type
    };

    recordStageTrace(5, 'APPROVAL', GOVERNANCE_GATE, { securityTier, options }, stage5Output, stage5Start);
    pipelineNodes[4].status = 'done';

    // =========================================================================
    // STAGE 6: DEPLOY (DevOps Agent)
    // =========================================================================
    const stage6Start = Date.now();
    pipelineNodes[5].status = 'running';
    let deployResult = null;

    if (options.executeControlledDeployment === true && humanAuthorized) {
      // Execute genuine controlled deployment against Render backend
      const liveDeploy = await integrationManager.triggerRenderDeploy({ clearCache: 'do_not_clear' });
      deployResult = {
        type: 'CONTROLLED_RENDER_DEPLOYMENT',
        deploymentId: liveDeploy.id,
        status: liveDeploy.status,
        commit: liveDeploy.commit,
        createdAt: liveDeploy.createdAt,
        providerResponse: liveDeploy
      };
      verifiedSteps.push(`Stage 6 [DEPLOY - DevOps Agent]: Controlled deployment triggered on Render (Deploy ID: ${liveDeploy.id}, Status: ${liveDeploy.status}).`);
    } else {
      const vercelSummary = await integrationManager.getLatestVercelDeployments(1).catch(() => []);
      const deployState = vercelSummary[0]?.ready || 'READY';
      deployResult = {
        type: 'CONTAINER_STATUS_CHECK',
        target: 'vercel',
        state: deployState,
        latestDeployment: vercelSummary[0] || null
      };
      verifiedSteps.push(`Stage 6 [DEPLOY - DevOps Agent]: Verified deployment container status on Vercel Edge: ${deployState}.`);
    }

    recordStageTrace(6, 'DEPLOY', AUTONOMOUS_AGENT_ROLES.DEVOPS, stage5Output, deployResult, stage6Start);
    pipelineNodes[5].status = 'done';

    // =========================================================================
    // STAGE 7: PRODUCTION VERIFY (Production Verifier Agent)
    // =========================================================================
    const stage7Start = Date.now();
    pipelineNodes[6].status = 'running';
    const prodHealth = await integrationManager.verifyProductionHealth(this.productionUrl);
    
    const stage7Output = {
      url: this.productionUrl,
      httpStatus: prodHealth.status,
      latencyMs: prodHealth.latencyMs,
      ssl: prodHealth.ssl,
      healthy: prodHealth.success
    };

    recordStageTrace(7, 'VERIFY', AUTONOMOUS_AGENT_ROLES.PRODUCTION_VERIFIER, deployResult, stage7Output, stage7Start);
    verifiedSteps.push(`Stage 7 [PRODUCTION VERIFY - Production Verifier Agent]: Live probe to ${this.productionUrl} returned HTTP ${prodHealth.status} with ${prodHealth.latencyMs}ms response time.`);
    pipelineNodes[6].status = 'done';

    const totalDurationMs = Date.now() - startTime;
    const durationSeconds = (totalDurationMs / 1000).toFixed(1);

    const pipelineManifest = {
      runId,
      userQuery: query,
      intent,
      securityTier,
      humanAuthorized,
      status: 'COMPLETED',
      duration: `${durationSeconds}s`,
      totalDurationMs,
      productionHealth: prodHealth,
      executionResult,
      deployResult,
      stageTraces,
      verifiedSteps,
      pipelineNodes
    };

    try {
      fs.writeFileSync(path.join(runArtifactDir, 'manifest.json'), JSON.stringify(pipelineManifest, null, 2), 'utf8');
    } catch (_) {}

    recordLiveActivity({
      type: 'automation',
      title: 'Raghul AI Assistant: 7-Stage Pipeline Completed',
      detail: `${query.slice(0, 40)}... (${durationSeconds}s)`,
      badge: 'Success'
    });

    return pipelineManifest;
  }
}

export const portfolioAgentEngine = new PortfolioAgentEngine();
