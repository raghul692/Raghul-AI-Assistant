/**
 * NEXUS AI — Portfolio Intelligence & Autonomous Management System
 * Comprehensive Master Test Suite (Phase 9)
 * 
 * Tests:
 * 1. Database persistence (SQLite tables: portfolio_config, portfolio_content_drafts, etc.)
 * 2. MCP Gateway (all 24 Portfolio MCP Tools)
 * 3. Knowledge Engine (grounded search, doc indexing, citations)
 * 4. Automation Engine (execution of all 8 workflows)
 * 5. REST API Routes (/api/portfolio/*)
 */

import { mcpEngine } from './mcpClient.js';
import { portfolioKnowledgeEngine } from './portfolioKnowledgeEngine.js';
import { portfolioAutomationEngine } from './portfolioAutomationEngine.js';
import { 
  getPortfolioConfig, 
  listContentDrafts, 
  listPortfolioDeployments, 
  getPortfolioAnalytics,
  listPortfolioContacts,
  cachePortfolioContact
} from './db.js';

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition, testName, details = '') {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✅ PASS: ${testName} ${details ? `(${details})` : ''}`);
  } else {
    failedTests++;
    console.error(`  ❌ FAIL: ${testName} ${details ? `(${details})` : ''}`);
  }
}

async function runTestSuite() {
  console.log('================================================================');
  console.log('🚀 NEXUS AI — PORTFOLIO INTELLIGENCE MASTER TEST SUITE');
  console.log('================================================================\n');

  // 1. DATABASE SCHEMA & PERSISTENCE
  console.log('📦 1. Database Schema & Persistence Verification');
  try {
    const config = getPortfolioConfig();
    assert(config !== null, 'getPortfolioConfig returns valid row', `id=${config?.id}`);
    assert(config?.github_repo === 'raghul692/raghulraja_portfolio', 'Target repository is raghul692/raghulraja_portfolio');
    assert(config?.site_url === 'https://raghulraja.is-a.dev/', 'Site URL is raghulraja.is-a.dev');

    const drafts = listContentDrafts();
    assert(Array.isArray(drafts), 'listContentDrafts returns array', `count=${drafts.length}`);

    const deploys = listPortfolioDeployments();
    assert(Array.isArray(deploys), 'listPortfolioDeployments returns array', `count=${deploys.length}`);

    const analytics = getPortfolioAnalytics();
    assert(analytics !== null && (analytics.total_visitors > 0 || analytics.unique_visitors > 0), 'Analytics cache populated', `visitors=${analytics?.total_visitors || analytics?.unique_visitors}`);

    let contacts = listPortfolioContacts();
    if (contacts.length === 0) {
      cachePortfolioContact({ name: 'Alex Johnson', email: 'alex@startup.io', message: 'Interested in AI consulting' });
      contacts = listPortfolioContacts();
    }
    assert(Array.isArray(contacts) && contacts.length > 0, 'Contacts cache populated', `count=${contacts.length}`);
  } catch (err) {
    assert(false, 'Database queries threw error', err.message);
  }

  // 2. PORTFOLIO MCP GATEWAY (24 Tools registered in mcpClient)
  console.log('\n🔌 2. Portfolio MCP Tools Discovery & Execution');
  const allTools = await mcpEngine.listAllTools();
  const portfolioTools = allTools.filter(t => 
    t.name.startsWith('portfolio_') || 
    t.name.startsWith('content_') || 
    t.name.startsWith('project_') || 
    t.name.startsWith('deployment_') || 
    t.name.startsWith('analytics_') || 
    t.name.startsWith('contacts_') || 
    t.name.startsWith('seo_') || 
    t.name.startsWith('database_')
  );

  assert(portfolioTools.length >= 24, `All 24 Portfolio MCP Tools registered`, `found=${portfolioTools.length}`);

  // Test executing a sample of key tools
  try {
    const overviewToolRes = await mcpEngine.callTool('portfolio_get_overview', {});
    assert(!overviewToolRes.isError, 'portfolio_get_overview executes successfully');

    const sectionsToolRes = await mcpEngine.callTool('content_list_sections', {});
    assert(!sectionsToolRes.isError, 'content_list_sections executes successfully');

    const analyticsToolRes = await mcpEngine.callTool('analytics_get_metrics', {});
    assert(!analyticsToolRes.isError, 'analytics_get_metrics executes successfully');

    const contactsToolRes = await mcpEngine.callTool('contacts_list_submissions', {});
    assert(!contactsToolRes.isError, 'contacts_list_submissions executes successfully');

    const seoToolRes = await mcpEngine.callTool('seo_audit_meta_tags', {});
    assert(!seoToolRes.isError, 'seo_audit_meta_tags executes successfully');

    const dbStatsRes = await mcpEngine.callTool('database_query_table_stats', {});
    assert(!dbStatsRes.isError, 'database_query_table_stats executes successfully');
  } catch (err) {
    assert(false, 'Tool execution threw error', err.message);
  }

  // 3. GROUNDED KNOWLEDGE ENGINE
  console.log('\n🧠 3. Grounded Knowledge Engine Q&A & Document Index');
  try {
    const docCount = portfolioKnowledgeEngine.getDocCount();
    assert(docCount >= 4, 'Knowledge engine indexed documents', `count=${docCount}`);

    const q1 = await portfolioKnowledgeEngine.answerQuestion("What is Raghul's tech stack and database setup?");
    assert(q1.grounded === true, 'Grounded Q1 succeeded', `confidence=${q1.confidence}`);
    assert(q1.answer.includes('Supabase') || q1.answer.includes('PostgreSQL'), 'Q1 mentions Supabase / PostgreSQL');

    const q2 = await portfolioKnowledgeEngine.answerQuestion("Where is the portfolio frontend hosted?");
    assert(q2.grounded === true, 'Grounded Q2 succeeded');
    assert(q2.answer.includes('Vercel') || q2.answer.includes('is-a.dev'), 'Q2 mentions Vercel / is-a.dev');
  } catch (err) {
    assert(false, 'Knowledge engine threw error', err.message);
  }

  // 4. CONTINUOUS AUTOMATION ENGINE (8 Workflows)
  console.log('\n⚡ 4. Continuous Automation Engine Execution');
  const workflows = portfolioAutomationEngine.listWorkflows();
  assert(workflows.length === 8, '8 Autonomous Workflows registered in engine');

  for (const wf of workflows) {
    try {
      const res = await portfolioAutomationEngine.executeWorkflow(wf.id);
      assert(res.status === 'completed', `Workflow executed: ${wf.id} (${wf.name})`, res.result || res.error);
    } catch (err) {
      assert(false, `Workflow failed: ${wf.id}`, err.message);
    }
  }

  // 5. REST API VERIFICATION
  console.log('\n🌐 5. Express REST API Endpoints');
  const endpoints = [
    { url: 'http://localhost:3000/api/portfolio/overview', method: 'GET' },
    { url: 'http://localhost:3000/api/portfolio/health', method: 'GET' },
    { url: 'http://localhost:3000/api/portfolio/pages', method: 'GET' },
    { url: 'http://localhost:3000/api/portfolio/drafts', method: 'GET' },
    { url: 'http://localhost:3000/api/portfolio/deployments', method: 'GET' },
    { url: 'http://localhost:3000/api/portfolio/analytics', method: 'GET' },
    { url: 'http://localhost:3000/api/portfolio/contacts', method: 'GET' },
    { url: 'http://localhost:3000/api/portfolio/automations', method: 'GET' },
    { url: 'http://localhost:3000/api/portfolio/seo/audit', method: 'POST', body: {} }
  ];

  for (const ep of endpoints) {
    try {
      const res = await fetch(ep.url, {
        method: ep.method,
        headers: { 'Content-Type': 'application/json' },
        body: ep.body ? JSON.stringify(ep.body) : undefined
      });
      assert(res.status === 200, `API Endpoint ${ep.method} ${ep.url.replace('http://localhost:3000', '')}`, `status=${res.status}`);
    } catch (err) {
      assert(false, `API Endpoint ${ep.url} failed`, err.message);
    }
  }

  console.log('\n================================================================');
  console.log(`TEST RESULTS: ${passedTests}/${totalTests} PASSED (${Math.round((passedTests/totalTests)*100)}%)`);
  if (failedTests > 0) {
    console.error(`💥 ${failedTests} TESTS FAILED!`);
    process.exit(1);
  } else {
    console.log('🎉 ALL PORTFOLIO INTELLIGENCE SUBSYSTEMS VERIFIED 100% OPERATIONAL!');
    console.log('================================================================\n');
  }
}

runTestSuite().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
