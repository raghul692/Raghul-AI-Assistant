/**
 * NEXUS AI — PORTFOLIO INTELLIGENCE & AUTONOMOUS MANAGEMENT API ROUTES
 */

import express from 'express';
import { portfolioMcpGateway } from './portfolioMcpGateway.js';
import { portfolioKnowledgeEngine } from './portfolioKnowledgeEngine.js';
import { portfolioAutomationEngine } from './portfolioAutomationEngine.js';
import {
  getPortfolioConfig,
  updatePortfolioConfig,
  listContentDrafts,
  getContentDraft,
  createContentDraft,
  updateContentDraftStatus,
  listPortfolioDeployments,
  getPortfolioAnalytics,
  listPortfolioContacts,
  createApprovalRequest,
  logGitHubAudit
} from './db.js';

const router = express.Router();

// 1. Overview & Health
router.get('/overview', async (req, res) => {
  try {
    const data = await portfolioMcpGateway.callTool('portfolio_get_overview', {});
    res.json({ overview: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/status', async (req, res) => {
  try {
    const status = await portfolioMcpGateway.callTool('portfolio_get_status', {});
    res.json({ status });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/pages', async (req, res) => {
  try {
    const pages = await portfolioMcpGateway.callTool('portfolio_get_pages', {});
    res.json(pages);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/health', async (req, res) => {
  try {
    const health = await portfolioMcpGateway.callTool('portfolio_health_check', {});
    res.json({ health });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 2. Content & Project Drafts
router.get('/content/drafts', (req, res) => {
  try {
    const section = req.query.section || null;
    const drafts = listContentDrafts(section);
    res.json({ drafts });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Alias for /api/portfolio/drafts
router.get('/drafts', (req, res) => {
  try {
    const section = req.query.section || null;
    const drafts = listContentDrafts(section);
    res.json({ drafts });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/content/drafts', (req, res) => {
  try {
    const { section, title, content } = req.body;
    if (!section || !title || !content) {
      return res.status(400).json({ error: 'section, title, and content are required.' });
    }
    const draft = createContentDraft({ section, title, content, status: 'draft' });
    res.json({ success: true, draft });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Alias for POST /api/portfolio/drafts
router.post('/drafts', (req, res) => {
  try {
    const { section, title, content } = req.body;
    if (!section || !title || !content) {
      return res.status(400).json({ error: 'section, title, and content are required.' });
    }
    const draft = createContentDraft({ section, title, content, status: 'draft' });
    res.json({ success: true, draft });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/content/analyze-project', async (req, res) => {
  try {
    const repoFullName = req.body.repoFullName || req.body.repoName;
    if (!repoFullName) return res.status(400).json({ error: 'repoFullName required.' });
    const result = await portfolioMcpGateway.callTool('project_analyze_github_repo', { repoFullName, featured: req.body.featured });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Alias for /api/portfolio/analyze-project
router.post('/analyze-project', async (req, res) => {
  try {
    const repoFullName = req.body.repoFullName || req.body.repoName;
    if (!repoFullName) return res.status(400).json({ error: 'repoFullName required.' });
    const result = await portfolioMcpGateway.callTool('project_analyze_github_repo', { repoFullName, featured: req.body.featured });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/content/publish', async (req, res) => {
  try {
    const { draftId } = req.body;
    if (!draftId) return res.status(400).json({ error: 'draftId required.' });
    const result = await portfolioMcpGateway.callTool('content_publish', { draftId }, { approved: req.body.approved === true });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Alias for /api/portfolio/drafts/publish
router.post('/drafts/publish', async (req, res) => {
  try {
    const { draftId } = req.body;
    if (!draftId) return res.status(400).json({ error: 'draftId required.' });
    const result = await portfolioMcpGateway.callTool('content_publish', { draftId }, { approved: req.body.approved === true });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3. Deployments
router.get('/deployments', (req, res) => {
  try {
    const deployments = listPortfolioDeployments(20);
    res.json({ deployments });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/deployments/trigger', async (req, res) => {
  try {
    const { target, reason, approved } = req.body;
    if (!target) return res.status(400).json({ error: 'target (vercel or render) required.' });
    const result = await portfolioMcpGateway.callTool('deployment_trigger', { target, reason }, { approved: approved === true });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 4. Analytics & Contacts
router.get('/analytics', (req, res) => {
  try {
    const analytics = getPortfolioAnalytics();
    res.json({ analytics });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/contacts', (req, res) => {
  try {
    const contacts = listPortfolioContacts(30);
    res.json({ contacts });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 5. SEO & Website Quality
router.get('/seo/audit', async (req, res) => {
  try {
    const audit = await portfolioMcpGateway.callTool('seo_audit', {});
    const brokenLinks = await portfolioMcpGateway.callTool('seo_check_broken_links', {});
    res.json({ audit, brokenLinks });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/seo/audit', async (req, res) => {
  try {
    const audit = await portfolioMcpGateway.callTool('seo_audit', {});
    const brokenLinks = await portfolioMcpGateway.callTool('seo_check_broken_links', {});
    res.json({ audit, brokenLinks });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 6. Knowledge Engine
router.post('/knowledge/ask', async (req, res) => {
  try {
    const { question } = req.body;
    if (!question) return res.status(400).json({ error: 'question required.' });
    const answer = await portfolioKnowledgeEngine.askPortfolioKnowledge(question);
    res.json(answer);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/knowledge/sync', async (req, res) => {
  try {
    const result = await portfolioKnowledgeEngine.syncAndIndexPortfolio();
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 7. Automations
router.get('/automations', (req, res) => {
  try {
    const workflows = portfolioAutomationEngine.listWorkflows();
    const history = portfolioAutomationEngine.getExecutionHistory();
    res.json({ workflows, history });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/automations/trigger', async (req, res) => {
  try {
    const { workflowId } = req.body;
    if (!workflowId) return res.status(400).json({ error: 'workflowId required.' });
    const run = await portfolioAutomationEngine.executeWorkflow(workflowId);
    res.json({ success: true, run });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Alias for /api/portfolio/automations/run
router.post('/automations/run', async (req, res) => {
  try {
    const { workflowId } = req.body;
    if (!workflowId) return res.status(400).json({ error: 'workflowId required.' });
    const run = await portfolioAutomationEngine.executeWorkflow(workflowId);
    res.json({ success: true, run });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 8. Tools Catalog
router.get('/tools', (req, res) => {
  try {
    const tools = portfolioMcpGateway.listTools();
    res.json({ toolsCount: tools.length, tools });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
