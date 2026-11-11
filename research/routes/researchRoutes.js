import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { researchOrchestrator } from '../orchestration/researchOrchestrator.js';
import { researchRepository } from '../db/repository.js';
import { generateAndValidateReportPdf } from '../publishing/pdfEngine.js';
import { RESEARCH_CONFIG } from '../config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPORTS_DIR = path.join(__dirname, '..', '..', 'data', 'generated', 'research_reports');

export const researchRouter = express.Router();

// Active SSE client streams: jobId -> Set of response objects
const jobStreams = new Map();

function broadcastJobEvent(jobId, eventData) {
  const streams = jobStreams.get(jobId);
  if (streams && streams.size > 0) {
    const payload = `data: ${JSON.stringify(eventData)}\n\n`;
    for (const res of streams) {
      try {
        res.write(payload);
      } catch (_) {}
    }
  }
}

// 1. Start Autonomous Deep Research Job
researchRouter.post('/start', async (req, res) => {
  const { query, mode = RESEARCH_CONFIG.defaultMode, requirePlanApproval = RESEARCH_CONFIG.requirePlanApproval } = req.body;
  if (!query || !query.trim()) {
    return res.status(400).json({ error: 'Query is required for research.' });
  }

  try {
    const topic = query.trim();

    // If plan approval is requested, formulate plan first and return for review
    if (requirePlanApproval) {
      const jobId = `job_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
      researchRepository.createJob({
        id: jobId,
        title: topic.slice(0, 100),
        originalQuery: topic,
        mode,
        config: JSON.stringify({ requirePlanApproval: true })
      });

      const planResult = await researchOrchestrator.modelRouter.createResearchPlan(topic);
      const planId = `plan_${Date.now()}`;
      researchRepository.savePlan({
        id: planId,
        jobId,
        domain: planResult.plan.domain || 'technology',
        scope: planResult.plan.scope || 'Standard investigation',
        planData: JSON.stringify(planResult.plan),
        status: 'pending_approval'
      });

      return res.json({
        success: true,
        jobId,
        status: 'awaiting_approval',
        plan: planResult.plan
      });
    }

    // Otherwise, immediately execute autonomous research in background
    const jobId = `job_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    researchRepository.createJob({
      id: jobId,
      title: topic.slice(0, 100),
      originalQuery: topic,
      mode,
      config: JSON.stringify({ requirePlanApproval: false })
    });

    res.json({
      success: true,
      jobId,
      status: 'running'
    });

    // Run autonomous research loop in background with progress streaming
    researchOrchestrator.startJob(
      topic,
      { mode },
      (progressEvent) => {
        broadcastJobEvent(jobId, progressEvent);
      }
    ).then(async (result) => {
      try {
        const pdfResult = await generateAndValidateReportPdf(jobId, result.reportMarkdown, {
          title: topic.slice(0, 100),
          sourcesCount: result.sourcesCount || 0,
          citationsCount: result.citations ? result.citations.length : 0
        });
        broadcastJobEvent(jobId, {
          step: 'pdf_ready',
          message: 'A4 PDF report generated and validated.',
          pdfUrl: pdfResult.url,
          validation: pdfResult.validation
        });
      } catch (e) {
        console.warn('[ResearchRouter] PDF build notice:', e.message);
      }
    }).catch((err) => {
      broadcastJobEvent(jobId, {
        step: 'failed',
        error: err.message
      });
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 2. Approve Research Plan & Run Job
researchRouter.post('/plan/approve', async (req, res) => {
  const { jobId, modifiedPlan } = req.body;
  if (!jobId) return res.status(400).json({ error: 'jobId required' });

  const job = researchRepository.getJob(jobId);
  if (!job) return res.status(404).json({ error: 'Job not found' });

  // Respond immediately so user frontend can connect to SSE stream
  res.json({ success: true, jobId, status: 'running' });

  // Run autonomous research loop in background
  researchOrchestrator.startJob(
    job.original_query,
    { mode: job.mode },
    (progressEvent) => {
      broadcastJobEvent(jobId, progressEvent);
    }
  ).then(async (result) => {
    // Auto-generate verified A4 PDF report
    try {
      const pdfResult = await generateAndValidateReportPdf(jobId, result.reportMarkdown, {
        title: job.title,
        sourcesCount: result.sourcesCount,
        citationsCount: result.citations.length
      });
      broadcastJobEvent(jobId, {
        step: 'pdf_ready',
        message: 'A4 PDF report generated and validated.',
        pdfUrl: pdfResult.url,
        validation: pdfResult.validation
      });
    } catch (e) {
      console.warn('[ResearchRouter] PDF build notice:', e.message);
    }
  }).catch((err) => {
    broadcastJobEvent(jobId, {
      step: 'failed',
      error: err.message
    });
  });
});

// 3. SSE Stream for Real-Time Research Execution
researchRouter.get('/jobs/:id/stream', (req, res) => {
  const jobId = req.params.id;

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  if (!jobStreams.has(jobId)) {
    jobStreams.set(jobId, new Set());
  }
  jobStreams.get(jobId).add(res);

  // Send initial ping
  res.write(`data: ${JSON.stringify({ type: 'connected', jobId })}\n\n`);

  req.on('close', () => {
    const streams = jobStreams.get(jobId);
    if (streams) {
      streams.delete(res);
      if (streams.size === 0) jobStreams.delete(jobId);
    }
  });
});

// 4. List Recent Research Jobs
researchRouter.get('/jobs', (req, res) => {
  const jobs = researchRepository.listJobs(30);
  res.json({ success: true, jobs });
});

// 5. Get Research Job Details
researchRouter.get('/jobs/:id', (req, res) => {
  const job = researchRepository.getJob(req.params.id);
  if (!job) return res.status(404).json({ error: 'Job not found' });
  const plan = researchRepository.getPlan(req.params.id);
  const sources = researchRepository.getSources(req.params.id);
  const claims = researchRepository.getClaims(req.params.id);
  const sections = researchRepository.getSections(req.params.id);
  const contradictions = researchRepository.getContradictionsByJobId ? researchRepository.getContradictionsByJobId(req.params.id) : [];
  const qualityCheck = researchRepository.getQualityCheckByJobId ? researchRepository.getQualityCheckByJobId(req.params.id) : null;

  res.json({
    success: true,
    job,
    plan,
    sources,
    claims,
    sections,
    contradictions,
    qualityCheck
  });
});

// 5b. Get Canonical Structured Report Preview
researchRouter.get('/jobs/:id/preview', (req, res) => {
  const jobId = req.params.id;
  const job = researchRepository.getJob(jobId);
  if (!job) return res.status(404).json({ error: 'Job not found' });

  const sources = researchRepository.getSources(jobId);
  const claims = researchRepository.getClaims(jobId);
  const sections = researchRepository.getSections(jobId);
  const contradictions = researchRepository.getContradictionsByJobId(jobId);
  const quality = researchRepository.getQualityCheckByJobId(jobId);

  res.json({
    success: true,
    jobId,
    title: job.title,
    status: job.status,
    finalReportMarkdown: job.final_report_markdown || '',
    sections,
    sourcesCount: sources.length,
    claimsCount: claims.length,
    contradictionsCount: contradictions.length,
    qualityCheck: quality
  });
});

// 6. Generate & Validate PDF Report On-Demand
researchRouter.post('/jobs/:id/export/pdf', async (req, res) => {
  const jobId = req.params.id;
  const job = researchRepository.getJob(jobId);
  if (!job || !job.final_report_markdown) {
    return res.status(404).json({ error: 'Job report markdown not ready yet.' });
  }

  try {
    const sources = researchRepository.getSources(jobId);
    const pdfResult = await generateAndValidateReportPdf(jobId, job.final_report_markdown, {
      title: job.title,
      sourcesCount: sources.length,
      citationsCount: sources.length
    });

    res.json({ success: true, ...pdfResult });
  } catch (err) {
    res.status(500).json({ error: `PDF export error: ${err.message}` });
  }
});

// 7. Serve Generated PDF Files
researchRouter.get('/reports/:fileName', (req, res) => {
  const filePath = path.join(REPORTS_DIR, req.params.fileName);
  if (fs.existsSync(filePath)) {
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${req.params.fileName}"`);
    fs.createReadStream(filePath).pipe(res);
  } else {
    res.status(404).send('PDF report not found.');
  }
});

