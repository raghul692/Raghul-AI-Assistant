/**
 * RAGHUL AI — INDEPENDENT RENDER BACKGROUND WORKER
 * 
 * Standalone background worker process executing long-running AI workloads:
 * - Autonomous Deep Research loops
 * - Multi-Agent Swarm consensus
 * - Document & PDF publishing pipelines
 * - GitHub autonomous workflows
 * - AST code generation & self-repair loops
 * 
 * Architecture:
 * - Distributed queue consumer with FOR UPDATE SKIP LOCKED
 * - Cross-process real-time event streaming to Web Service SSE
 * - Cloud Object Storage persistence (Supabase Storage)
 * - Automatic crash recovery and graceful SIGTERM shutdown
 */

import dns from 'dns';
import dotenv from 'dotenv';
import crypto from 'crypto';

try {
  dns.setDefaultResultOrder('ipv4first');
} catch (_) {}

dotenv.config();

import { jobQueue } from './queue/jobQueue.js';
import { storageService } from './services/storageService.js';
import { researchOrchestrator } from './research/orchestration/researchOrchestrator.js';
import { generateAndValidateReportPdf } from './research/publishing/pdfEngine.js';
import { runMultiAgentSwarm } from './multiAgentSwarm.js';
import { generateIEEEPdf, generateExecutivePdf, generateDocxDocument } from './documentEngine.js';
import { runSelfRepairLoop } from './codingAgent.js';
import { closePostgresPool } from './database/postgresPool.js';

const WORKER_ID = process.env.WORKER_ID || `worker_${process.pid}_${crypto.randomBytes(3).toString('hex')}`;
const POLL_INTERVAL_MS = parseInt(process.env.WORKER_POLL_INTERVAL_MS || '1500', 10);
const MAX_CONCURRENT_JOBS = parseInt(process.env.WORKER_CONCURRENCY || '2', 10);

let isRunning = true;
let activeJobs = 0;

console.log('================================================================');
console.log(`🤖 RAGHUL AI — BACKGROUND WORKER INITIALIZING [${WORKER_ID}]`);
console.log(`Target Queue: ${jobQueue.isPostgres() ? 'Supabase PostgreSQL (Distributed)' : 'SQLite Local Fallback'}`);
console.log(`Cloud Storage: ${storageService.isCloudConfigured() ? 'Supabase Storage Active' : 'Local Disk Fallback'}`);
console.log(`Max Concurrency: ${MAX_CONCURRENT_JOBS}`);
console.log('================================================================\n');

/**
 * Job Handlers Registry
 */
const HANDLERS = {
  // 1. Autonomous Deep Research Job
  deep_research: async (job, updateProgress) => {
    const { query, mode = 'deep', jobId } = job.payload;
    const effectiveJobId = jobId || job.id;

    updateProgress(10, 'PLANNING', 'Formulating deep research investigation plan...');

    const result = await researchOrchestrator.startJob(
      query,
      { mode },
      (progressEvent) => {
        const pct = Math.min(15 + Math.round((progressEvent.progress || 0) * 0.7), 85);
        updateProgress(pct, progressEvent.stage || 'RESEARCHING', progressEvent.message || '', progressEvent);
      }
    );

    updateProgress(90, 'PUBLISHING', 'Compiling and verifying A4 PDF deliverable...');

    // Generate and validate PDF deliverable
    let pdfUrl = null;
    try {
      const pdfResult = await generateAndValidateReportPdf(effectiveJobId, result.reportMarkdown, {
        title: query.slice(0, 100),
        sourcesCount: result.sourcesCount || 0,
        citationsCount: result.citations ? result.citations.length : 0
      });

      // Upload PDF to Supabase Storage if generated
      if (pdfResult?.path) {
        const uploadRes = await storageService.uploadFileFromDisk({
          bucket: 'raghul-ai-reports',
          fileName: `report_${effectiveJobId}.pdf`,
          localFilePath: pdfResult.path,
          contentType: 'application/pdf',
          isPublic: true
        });
        pdfUrl = uploadRes.publicUrl;
      } else {
        pdfUrl = pdfResult.url;
      }
    } catch (pdfErr) {
      console.warn('[Worker] Notice generating PDF in worker:', pdfErr.message);
    }

    return {
      query,
      summary: result.reportMarkdown?.slice(0, 300) + '...',
      sourcesCount: result.sourcesCount || 0,
      claimsCount: result.claimsCount || 0,
      reportMarkdown: result.reportMarkdown,
      pdfUrl,
      completedAt: Date.now()
    };
  },

  // 2. 10-Agent Swarm Consensus
  multi_agent_swarm: async (job, updateProgress) => {
    const { problem, context = '' } = job.payload;
    updateProgress(15, 'SWARM_CONVENING', 'Assembling multi-agent consensus panel...');

    const result = await runMultiAgentSwarm({
      problem,
      context,
      onAgentEvent: (evt) => {
        updateProgress(evt.progress || 50, evt.stage || 'AGENT_DELIBERATING', evt.message || '', evt);
      }
    });

    return result;
  },

  // 3. Multi-Format Document Generation
  document_generation: async (job, updateProgress) => {
    const { format = 'pdf', title, author, abstract, sections = [], tables = [] } = job.payload;
    updateProgress(20, 'DOC_GENERATION', `Rendering ${format.toUpperCase()} document structure...`);

    let docResult;
    if (format === 'docx') {
      docResult = await generateDocxDocument({ title, author, abstract, sections, tables });
    } else {
      docResult = await generateIEEEPdf({
        title,
        authors: [{ name: author || 'RAGHUL AI Researcher' }],
        abstract,
        sections,
        tables
      });
    }

    updateProgress(75, 'CLOUD_UPLOAD', 'Archiving output deliverable to Supabase Storage...');

    let storageUrl = null;
    if (docResult?.path) {
      const uploadRes = await storageService.uploadFileFromDisk({
        bucket: 'raghul-ai-documents',
        fileName: `${title || 'document'}.${format}`,
        localFilePath: docResult.path,
        contentType: format === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        isPublic: true
      });
      storageUrl = uploadRes.publicUrl;
    }

    return { ...docResult, cloudUrl: storageUrl };
  },

  // 4. Autonomous Code Self-Repair Loop
  code_repair: async (job, updateProgress) => {
    const { filePath, testCommand } = job.payload;
    updateProgress(20, 'CODE_DIAGNOSTICS', `Running diagnostic AST validation on ${filePath}...`);

    const repairResult = await runSelfRepairLoop({
      targetFile: filePath,
      testCmd: testCommand,
      onProgress: (p) => updateProgress(p.progress || 50, p.step || 'REPAIRING', p.message || '')
    });

    return repairResult;
  }
};

/**
 * Process a single job item
 */
async function processJob(job) {
  const handler = HANDLERS[job.job_type];
  if (!handler) {
    console.error(`[Worker] Unknown job_type "${job.job_type}" for job ${job.id}`);
    await jobQueue.fail(job.id, new Error(`Unsupported job_type: ${job.job_type}`), { shouldRetry: false });
    return;
  }

  console.log(`▶️ [Worker ${WORKER_ID}] Processing job ${job.id} (type: ${job.job_type}, attempt: ${job.attempts})...`);
  const startTime = Date.now();

  const updateProgress = (progress, stage, message, data = {}) => {
    jobQueue.updateProgress(job.id, { progress, stage, message, data }).catch(() => {});
  };

  // Periodic heartbeat every 10s to prove worker is alive and prevent stalled job recovery
  const heartbeatTimer = setInterval(() => {
    jobQueue.heartbeat(job.id).catch(() => {});
  }, 10000);

  try {
    const result = await handler(job, updateProgress);
    await jobQueue.complete(job.id, result);
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`✅ [Worker ${WORKER_ID}] Completed job ${job.id} in ${duration}s.`);
  } catch (err) {
    console.error(`❌ [Worker ${WORKER_ID}] Job ${job.id} failed:`, err.message);
    await jobQueue.fail(job.id, err);
  } finally {
    clearInterval(heartbeatTimer);
  }
}

/**
 * Main polling loop
 */
async function startWorkerLoop() {
  // Crash recovery check
  try {
    const recovered = await jobQueue.recoverOrphanedJobs(WORKER_ID);
    if (recovered > 0) {
      console.log(`[Worker] Recovered ${recovered} orphaned jobs from previous run.`);
    }
  } catch (recErr) {
    console.warn('[Worker] Crash recovery notice:', recErr.message);
  }

  let lastStalledCheck = Date.now();

  while (isRunning) {
    try {
      // Periodic check for stalled jobs from failed/crashed workers
      if (Date.now() - lastStalledCheck > 60000) {
        lastStalledCheck = Date.now();
        const stalledCount = await jobQueue.recoverStalledJobs(60000);
        if (stalledCount > 0) {
          console.log(`[Worker] Recovered ${stalledCount} stalled jobs whose heartbeats expired.`);
        }
      }

      if (activeJobs < MAX_CONCURRENT_JOBS) {
        const job = await jobQueue.dequeue(WORKER_ID);
        if (job) {
          activeJobs++;
          processJob(job).finally(() => {
            activeJobs--;
          });
        }
      }
    } catch (pollErr) {
      console.warn('[Worker] Polling notice:', pollErr.message);
    }

    await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS));
  }

  console.log('[Worker] Worker loop stopped.');
}

/**
 * Graceful Shutdown Handler
 */
async function shutdown(signal) {
  console.log(`\n🛑 [Worker] Received ${signal}. Commencing graceful shutdown...`);
  isRunning = false;

  const shutdownGraceMs = 15000;
  const startWait = Date.now();

  while (activeJobs > 0 && Date.now() - startWait < shutdownGraceMs) {
    console.log(`[Worker] Waiting for ${activeJobs} in-flight jobs to conclude...`);
    await new Promise(r => setTimeout(r, 1000));
  }

  if (activeJobs > 0) {
    console.warn(`[Worker] ${activeJobs} jobs still in-flight at shutdown deadline. Exiting.`);
  } else {
    console.log('[Worker] All jobs drained cleanly.');
  }

  try {
    await closePostgresPool();
  } catch (_) {}

  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

startWorkerLoop().catch((err) => {
  console.error('[Worker] Fatal worker error:', err);
  process.exit(1);
});
