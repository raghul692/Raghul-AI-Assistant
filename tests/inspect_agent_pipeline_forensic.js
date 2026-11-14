/**
 * Forensic Inspection of Autonomous 7-Stage Agent Pipeline
 */

import { portfolioAgentEngine } from '../services/portfolioAgentEngine.js';
import fs from 'fs';
import path from 'path';

async function verifyAgentPipelineStages() {
  console.log('🤖 Disagreeing with assumptions: Running live non-destructive 7-stage pipeline...');
  const startTime = Date.now();
  
  const execution = await portfolioAgentEngine.executePipeline(
    'Forensic Live Stage Verification: Reconcile telemetry and parity without mutation',
    {
      autoApprove: true,
      target: 'render:srv-da9foaon74is73fvojn0'
    }
  );

  const durationMs = Date.now() - startTime;
  console.log(`Execution completed in ${durationMs}ms with status: ${execution.status}`);

  console.log(`Run ID: ${execution.runId}`);
  console.log(`Stages Count: ${execution.pipelineNodes.length}`);

  for (const node of execution.pipelineNodes) {
    console.log(`\n--- STAGE: ${node.stage} (${node.role}) ---`);
    console.log(`   Status: ${node.status}`);
    console.log(`   Duration: ${node.durationMs}ms`);
    console.log(`   Artifact: ${node.artifactPath}`);
    if (fs.existsSync(node.artifactPath)) {
      const content = JSON.parse(fs.readFileSync(node.artifactPath, 'utf8'));
      console.log(`   Artifact Verified On Disk: size=${fs.statSync(node.artifactPath).size} bytes`);
      console.log(`   Preview:`, JSON.stringify(content).slice(0, 120) + '...');
    } else {
      console.log(`   ❌ Artifact missing on disk: ${node.artifactPath}`);
    }
  }

  // Check manifest
  const runDir = path.dirname(execution.pipelineNodes[0].artifactPath);
  const manifestPath = path.join(runDir, 'manifest.json');
  if (fs.existsSync(manifestPath)) {
    console.log(`\n✅ Run Manifest Exists: ${manifestPath}`);
  }

  return { execution, durationMs };
}

verifyAgentPipelineStages().then(() => process.exit(0)).catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
