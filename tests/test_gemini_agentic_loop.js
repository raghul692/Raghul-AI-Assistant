/**
 * Forensic Verification Test: Gemini Agentic Engine Loop & Dual Governance
 */

import dotenv from 'dotenv';
dotenv.config();

import { geminiPortfolioAgent } from '../services/geminiPortfolioAgent.js';

async function runVerification() {
  console.log('=== TEST 1: Gemini Agent Initialization ===');
  console.log('API Key present:', !!geminiPortfolioAgent.apiKey);
  console.log('Model Name:', geminiPortfolioAgent.modelName);
  console.log('Tools count:', geminiPortfolioAgent.getToolDeclarations().length);

  if (!geminiPortfolioAgent.apiKey) {
    throw new Error('GEMINI_PORTFOLIO_API_KEY is not configured in .env');
  }

  console.log('\n=== TEST 2: Autonomous Turn in Approval Gate Mode ===');
  const approvalPrompt = 'portfolio la backend skills la Apache Kafka add pannu';
  const approvalResult = await geminiPortfolioAgent.runAutonomousAgentTurn({
    prompt: approvalPrompt,
    governanceMode: 'approval',
    runId: `test_appr_${Date.now()}`
  });

  console.log('Status:', approvalResult.status);
  console.log('Thinking summary:', approvalResult.thinking?.summary);
  console.log('Thinking phases count:', approvalResult.thinking?.phases?.length);
  console.log('Approval Ticket ID:', approvalResult.approvalTicket?.ticketId);
  console.log('Commit Message:', approvalResult.approvalTicket?.commitMessage);
  console.log('Verified Steps Count:', approvalResult.verifiedSteps?.length);

  if (approvalResult.status !== 'WAITING_FOR_APPROVAL') {
    throw new Error(`Expected status WAITING_FOR_APPROVAL, got ${approvalResult.status}`);
  }
  if (!approvalResult.approvalTicket?.ticketId) {
    throw new Error('Approval ticket was not generated at Stage 5');
  }

  console.log('\n=== TEST 3: Approve Staged Execution (Stage 5 -> Stage 6 -> Stage 7) ===');
  const ticketId = approvalResult.approvalTicket.ticketId;
  const executionApproval = await geminiPortfolioAgent.approvePendingExecution(ticketId);
  console.log('Approval success:', executionApproval.success);
  console.log('Commit SHA:', executionApproval.commitSha);
  console.log('Committed Files:', executionApproval.filesCommitted);
  console.log('Production Health HTTP:', executionApproval.productionHealth?.status);

  if (!executionApproval.success || !executionApproval.commitSha) {
    throw new Error('Approval execution failed to commit to GitHub');
  }

  console.log('\n=== ALL TESTS PASSED SUCCESSFULLY! ===');
}

runVerification().catch(err => {
  console.error('\nFATAL TEST FAILURE:', err);
  process.exit(1);
});

