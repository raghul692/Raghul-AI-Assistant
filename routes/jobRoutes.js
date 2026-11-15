/**
 * RAGHUL AI — DISTRIBUTED BACKGROUND JOBS API & REAL-TIME SSE ROUTER
 * 
 * Manages background asynchronous job submissions, progress tracking, and SSE streaming:
 * - POST /api/jobs: Enqueue background job (Worker consumes independently)
 * - GET /api/jobs/:id: Polling fallback status & results
 * - GET /api/jobs/:id/stream: Real-time SSE event stream with Last-Event-ID support
 * - GET /api/jobs: List recent jobs
 * - POST /api/jobs/:id/cancel: Cancel pending/running job
 */

import express from 'express';
import { jobQueue } from '../queue/jobQueue.js';
import { eventBus } from '../services/eventBus.js';

const router = express.Router();

// 1. Enqueue Background Job
router.post('/', async (req, res) => {
  try {
    const { jobType, payload = {}, priority = 5, idempotencyKey = null, maxAttempts = 3 } = req.body;
    if (!jobType) {
      return res.status(400).json({ error: 'jobType is required' });
    }

    const job = await jobQueue.enqueue({
      jobType,
      payload,
      priority,
      idempotencyKey,
      maxAttempts
    });

    res.status(202).json({
      success: true,
      jobId: job.jobId,
      status: job.status,
      jobType: job.jobType,
      streamUrl: `/api/jobs/${job.jobId}/stream`,
      statusUrl: `/api/jobs/${job.jobId}`
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 2. Get Job Details (Polling Fallback)
router.get('/:id', async (req, res) => {
  try {
    const job = await jobQueue.getJob(req.params.id);
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }
    res.json({ success: true, job });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3. Real-Time SSE Stream for Job Progress & Results
router.get('/:id/stream', async (req, res) => {
  const jobId = req.params.id;

  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders?.();

  // Send initial connection event
  res.write(`data: ${JSON.stringify({ type: 'connected', jobId, timestamp: Date.now() })}\n\n`);

  // Event Replay on Reconnection (Last-Event-ID)
  const lastEventId = req.headers['last-event-id'];
  if (lastEventId) {
    try {
      const backlog = await eventBus.getEventsSince(jobId, lastEventId);
      for (const evt of backlog) {
        res.write(`id: ${evt.id}\ndata: ${JSON.stringify(evt.payload)}\n\n`);
      }
    } catch (_) {}
  }

  // Subscribe to live events
  const unsubscribe = await eventBus.subscribe(jobId, (evt) => {
    try {
      const idPart = evt.id ? `id: ${evt.id}\n` : '';
      res.write(`${idPart}data: ${JSON.stringify(evt.payload || evt)}\n\n`);
      if (evt.event_type === 'completed' || evt.event_type === 'failed') {
        setTimeout(() => {
          try { res.end(); } catch (_) {}
        }, 500);
      }
    } catch (_) {}
  });

  // Heartbeat ping every 15s to keep SSE connection alive through proxies
  const heartbeatTimer = setInterval(() => {
    try {
      res.write(': ping\n\n');
    } catch (_) {
      clearInterval(heartbeatTimer);
    }
  }, 15000);

  req.on('close', () => {
    clearInterval(heartbeatTimer);
    unsubscribe();
  });
});

export default router;
