/**
 * TEST SUITE: DISTRIBUTED BACKGROUND JOB QUEUE & WORKER LIFECYCLE
 */

import assert from 'assert';
import { jobQueue } from '../queue/jobQueue.js';
import { eventBus } from '../services/eventBus.js';

async function runTest() {
  console.log('================================================================');
  console.log('🧪 VERIFY DISTRIBUTED BACKGROUND JOB QUEUE & WORKER');
  console.log('================================================================\n');

  // Clean up any lingering pending test jobs from previous runs
  if (jobQueue.isPostgres()) {
    const { pgQuery } = await import('../database/postgresPool.js');
    await pgQuery("UPDATE job_queue SET status = 'cancelled' WHERE status = 'pending' AND (job_type LIKE 'test_%' OR job_type IN ('document_generation', 'code_repair'))");
  }

  // Test 1: Job Enqueue with Priority & Idempotency
  console.log('--- Test 1: Enqueue Job with Priority ---');
  const idempotencyKey = `idemp_${Date.now()}`;
  const enq1 = await jobQueue.enqueue({
    jobType: 'test_document_generation',
    payload: { title: 'Benchmark Research Paper', format: 'pdf' },
    priority: 2,
    idempotencyKey,
    maxAttempts: 2,
    delayMs: 60000
  });

  assert(enq1.jobId, 'Should receive generated jobId');
  assert.strictEqual(enq1.status, 'pending', 'Initial status should be pending');
  console.log(`✅ [PASS] Job enqueued: ID=${enq1.jobId}, Type=${enq1.jobType}\n`);

  // Test 2: Idempotency Protection
  console.log('--- Test 2: Idempotency Collision Protection ---');
  const enq2 = await jobQueue.enqueue({
    jobType: 'test_document_generation',
    payload: { title: 'Duplicate Paper' },
    idempotencyKey,
    delayMs: 60000
  });
  assert(enq2.isDuplicate, 'Second enqueue with same idempotency key must be flagged duplicate');
  assert.strictEqual(enq2.jobId, enq1.jobId, 'Duplicate submission must return original jobId');
  console.log('✅ [PASS] Idempotency collision prevention verified.\n');

  // Test 3: Dequeue Job with Atomic Lock
  console.log('--- Test 3: Atomic Dequeue (FOR UPDATE SKIP LOCKED) ---');
  const workerId = `test_worker_${Date.now()}`;
  const dequeued = await jobQueue.dequeue(workerId, { targetJobId: enq1.jobId });
  assert(dequeued, 'Worker should acquire next pending job');
  assert.strictEqual(dequeued.id, enq1.jobId, 'Dequeued job must match enqueued ID');
  assert.strictEqual(dequeued.status, 'running', 'Dequeued status must be running');
  assert.strictEqual(dequeued.worker_id, workerId, 'Worker ID must be recorded on job');
  console.log(`✅ [PASS] Job successfully acquired by worker ${workerId}.\n`);

  // Test 4: Real-time Progress Tracking
  console.log('--- Test 4: Real-time Progress Broadcast ---');
  let progressReceived = false;
  const unsubscribe = await eventBus.subscribe(dequeued.id, (evt) => {
    if (evt.event_type === 'progress' && evt.payload.progress === 45) {
      progressReceived = true;
    }
  });

  await jobQueue.updateProgress(dequeued.id, {
    progress: 45,
    stage: 'GENERATING_SECTIONS',
    message: 'Compiling methodology and results...'
  });

  // Short delay to allow event propagation
  await new Promise(r => setTimeout(r, 200));
  unsubscribe();
  assert(progressReceived, 'Event bus must dispatch real-time progress update');
  console.log('✅ [PASS] Progress event dispatch verified.\n');

  // Test 5: Successful Job Completion
  console.log('--- Test 5: Job Completion & Status Transition ---');
  await jobQueue.complete(dequeued.id, {
    url: 'https://storage.supabase.co/reports/benchmark.pdf',
    pageCount: 14
  });

  const completedJob = await jobQueue.getJob(dequeued.id);
  assert.strictEqual(completedJob.status, 'completed', 'Final status must be completed');
  assert(completedJob.finished_at, 'Completion timestamp must be set');
  assert(completedJob.result && completedJob.result.pageCount === 14, 'Result payload must match');
  console.log('✅ [PASS] Job completion and result persistence verified.\n');

  // Test 6: Exponential Backoff & DLQ on Failure
  console.log('--- Test 6: Failure Handling, Exponential Backoff & DLQ ---');
  const failJobEnq = await jobQueue.enqueue({
    jobType: 'test_code_repair',
    payload: { target: 'non_existent.js' },
    priority: 1,
    maxAttempts: 1,
    delayMs: 60000
  });

  const workerFailId = `test_worker_fail_${Date.now()}`;
  const jobToFail = await jobQueue.dequeue(workerFailId, { targetJobId: failJobEnq.jobId });
  assert(jobToFail && jobToFail.id === failJobEnq.jobId);

  // Since maxAttempts is 1, this attempt (1 >= 1) should move directly to DLQ
  await jobQueue.fail(jobToFail.id, new Error('SYNTAX_REPAIR_FATAL_ERROR'), { shouldRetry: true });
  const dlqJob = await jobQueue.getJob(jobToFail.id);
  assert.strictEqual(dlqJob.status, 'dlq', 'Job reaching max attempts must transition to DLQ');
  assert(dlqJob.error_message.includes('SYNTAX_REPAIR_FATAL_ERROR'), 'Error message must be preserved');
  console.log('✅ [PASS] Failure threshold and DLQ routing verified.\n');

  // Test 7: Burst Concurrent Idempotency Stress Test
  console.log('--- Test 7: Burst Concurrent Idempotency (20 Concurrent Requests) ---');
  const burstKey = `burst_key_${Date.now()}`;
  const burstResults = await Promise.all(
    Array.from({ length: 20 }).map(() => jobQueue.enqueue({
      jobType: 'test_burst_job',
      idempotencyKey: burstKey,
      payload: { burst: true }
    }))
  );
  const primaryJob = burstResults.find(r => !r.isDuplicate);
  const duplicateJobs = burstResults.filter(r => r.isDuplicate);
  assert(primaryJob, 'Exactly one job must succeed as primary');
  assert.strictEqual(duplicateJobs.length, 19, '19 concurrent requests must be identified as duplicates');
  for (const d of duplicateJobs) {
    assert.strictEqual(d.jobId, primaryJob.jobId, 'Duplicate jobs must reference the primary jobId');
  }
  console.log('✅ [PASS] Burst concurrent idempotency (20 concurrent requests) verified with 0 collisions.\n');

  // Test 8: Heartbeat Signal & Stalled Job Recovery
  console.log('--- Test 8: Heartbeat Signal & Stalled Job Recovery ---');
  const stalledEnq = await jobQueue.enqueue({
    jobType: 'test_stalled_job',
    payload: { task: 'stalled_test' },
    priority: 1,
    maxAttempts: 3,
    delayMs: 60000
  });
  const stalledWorkerId = `crashed_worker_${Date.now()}`;
  const stalledJob = await jobQueue.dequeue(stalledWorkerId, { targetJobId: stalledEnq.jobId });
  assert(stalledJob && stalledJob.id === stalledEnq.jobId);

  // Heartbeat signal
  await jobQueue.heartbeat(stalledJob.id);
  console.log('   Heartbeat recorded successfully.');

  // Force stalled state by backdating locked_at to 2 minutes ago
  if (jobQueue.isPostgres()) {
    const { pgQuery } = await import('../database/postgresPool.js');
    await pgQuery('UPDATE job_queue SET locked_at = $1 WHERE id = $2', [Date.now() - 120000, stalledJob.id]);
  }

  // Run recovery with threshold 30s
  const recoveredCount = await jobQueue.recoverStalledJobs(30000);
  assert(recoveredCount >= 1, 'Should recover at least 1 stalled job');
  const recoveredJob = await jobQueue.getJob(stalledJob.id);
  assert.strictEqual(recoveredJob.status, 'pending', 'Stalled job must be restored to pending state for retry');
  console.log('✅ [PASS] Stalled job recovery after heartbeat expiration verified.\n');

  // Test 9: Job Cancellation API
  console.log('--- Test 9: Job Cancellation ---');
  const cancelJobEnq = await jobQueue.enqueue({
    jobType: 'test_cancellation_job',
    payload: { task: 'to_be_cancelled' },
    delayMs: 60000
  });
  const cancelRes = await jobQueue.cancel(cancelJobEnq.jobId, 'test_user_cancellation');
  assert.strictEqual(cancelRes.status, 'cancelled');
  const cancelledJob = await jobQueue.getJob(cancelJobEnq.jobId);
  assert.strictEqual(cancelledJob.status, 'cancelled', 'Job must be marked cancelled');
  console.log('✅ [PASS] Job cancellation verified.\n');

  // Test 10: In-Flight Job Release on Worker Shutdown
  console.log('--- Test 10: Safe In-Flight Job Release ---');
  const releaseJobEnq = await jobQueue.enqueue({
    jobType: 'test_release_job',
    payload: { task: 'to_be_released' },
    delayMs: 60000
  });
  const workerReleaseId = `temp_worker_${Date.now()}`;
  const acquiredJob = await jobQueue.dequeue(workerReleaseId, { targetJobId: releaseJobEnq.jobId });
  assert(acquiredJob && acquiredJob.id === releaseJobEnq.jobId, 'Worker must acquire an active in-flight job');
  await jobQueue.releaseJob(acquiredJob.id, 'worker_shutdown');
  const releasedJob = await jobQueue.getJob(acquiredJob.id);
  assert.strictEqual(releasedJob.status, 'pending', 'Released job must return to pending status');
  console.log('✅ [PASS] Safe in-flight job release verified.\n');

  // Test 11: List Recent Jobs
  console.log('--- Test 11: List Recent Jobs ---');
  const recentJobs = await jobQueue.listRecentJobs(5);
  assert(Array.isArray(recentJobs) && recentJobs.length > 0, 'Must return array of recent jobs');
  console.log(`✅ [PASS] List recent jobs verified (${recentJobs.length} retrieved).\n`);

  console.log('🎉 Background Job Queue & Worker lifecycle verified successfully!');
  try {
    const { closePostgresPool } = await import('../database/postgresPool.js');
    await closePostgresPool();
  } catch (_) {}
  process.exit(0);
}

runTest().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
