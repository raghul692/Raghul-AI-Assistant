/**
 * tests/test-portfolio-intelligence.js
 * Comprehensive Verification Suite for Portfolio OS v3.0 / v4.0 (ESM)
 * Verifies Endpoints, DOM Assets, Anti-Slop Visual Hierarchy & Telemetry
 */

import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BASE_URL = 'http://localhost:3000';

async function runPortfolioTests() {
  console.log('\n================================================================');
  console.log('🚀 PORTFOLIO OS — COMPREHENSIVE INTELLIGENCE & GOVERNANCE SUITE');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  function test(name, fn) {
    try {
      fn();
      console.log(`  ✓ ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ✗ ${name}`);
      console.error(`    ${err.message}`);
      failed++;
    }
  }

  async function testAsync(name, fn) {
    try {
      await fn();
      console.log(`  ✓ ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ✗ ${name}`);
      console.error(`    ${err.message}`);
      failed++;
    }
  }

  // 1. Backend API & Live Telemetry Verification
  console.log('1. Backend API & Real Telemetry Endpoints');

  await testAsync('GET /api/portfolio/dashboard returns complete live payload', async () => {
    const res = await fetch(`${BASE_URL}/api/portfolio/dashboard`);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.ok(data.stats, 'stats object missing');
    assert.ok(data.systemMetrics, 'systemMetrics object missing');
    const cpuPct = data.systemMetrics.cpu?.percent ?? data.systemMetrics.cpu?.usagePercent;
    assert.ok(typeof cpuPct === 'number', 'CPU percent not a number');
    const memPct = data.systemMetrics.memory?.percent ?? data.systemMetrics.memory?.usagePercent;
    assert.ok(typeof memPct === 'number', 'Memory percent not a number');
    const diskPct = data.systemMetrics.disk?.percent ?? data.systemMetrics.disk?.usagePercent;
    assert.ok(typeof diskPct === 'number', 'Disk percent not a number');
    assert.ok(Array.isArray(data.liveActivity), 'liveActivity not an array');
    assert.ok(Array.isArray(data.deployments), 'deployments not an array');
  });

  await testAsync('GET /api/portfolio/telemetry returns real host metrics', async () => {
    const res = await fetch(`${BASE_URL}/api/portfolio/telemetry`);
    assert.strictEqual(res.status, 200);
    const telem = await res.json();
    assert.strictEqual(telem.success, true);
    assert.ok(telem.metrics, 'telemetry metrics missing');
    assert.ok(typeof telem.metrics.cpu?.percent === 'number', 'CPU percent not reported');
    assert.ok(typeof telem.metrics.memory?.percent === 'number', 'RAM percent not reported');
    assert.ok(typeof telem.metrics.disk?.percent === 'number', 'Disk percent not reported');
    assert.ok(Array.isArray(telem.metrics.cpu?.history), 'telemetry history buffer missing');
  });

  await testAsync('POST /api/portfolio/track records visitor session', async () => {
    const res = await fetch(`${BASE_URL}/api/portfolio/track`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event_type: 'page_view',
        path: '/projects',
        country: 'India',
        ip: '127.0.0.1'
      })
    });
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.success, true);
  });

  await testAsync('POST /api/portfolio/control/action dispatches quick actions with audit log', async () => {
    const actions = ['health_check', 'tests', 'backup'];
    for (const action of actions) {
      const res = await fetch(`${BASE_URL}/api/portfolio/control/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action })
      });
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.success, true);
      assert.ok(data.message, `Missing message for action: ${action}`);
    }
  });

  await testAsync('POST /api/portfolio/agent/execute processes multi-step verified action', async () => {
    const res = await fetch(`${BASE_URL}/api/portfolio/agent/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: 'Update my ALIDAXIS project details, fix the contact form and deploy the latest version'
      })
    });
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.ok(Array.isArray(data.verifiedSteps), 'verifiedSteps missing');
    assert.strictEqual(data.verifiedSteps.length, 6, 'Must contain 6 verified steps');
    assert.ok(Array.isArray(data.pipelineNodes), 'pipelineNodes missing');
  });

  // 2. DOM Architecture & Anti-Slop Visual Hierarchy Verification
  console.log('\n2. DOM Architecture & Visual Hierarchy (Reference 1, 2, 3)');

  const indexHtml = fs.readFileSync(path.join(__dirname, '../public/index.html'), 'utf8');

  test('Persistent left sidebar structure exists in index.html', () => {
    assert.ok(indexHtml.includes('class="port-sidebar"'), 'port-sidebar class missing');
    assert.ok(indexHtml.includes('port-brand-logo">RR</div>'), 'RR brand logo missing');
    assert.ok(indexHtml.includes('Portfolio OS v3.0'), 'Portfolio OS v3.0 title missing');
    assert.ok(indexHtml.includes('port-sidebar-health-card'), 'Sidebar health card missing');
    assert.ok(indexHtml.includes('port-sidebar-quote-card'), 'Sidebar quote card missing');
    assert.ok(indexHtml.includes('Build. Innovate. Grow. Forever.'), 'Sidebar quote text missing');
  });

  test('Top bar controls (⌘K search, Global AI Mode, Notifications, Avatar) exist', () => {
    assert.ok(indexHtml.includes('port-topbar'), 'port-topbar class missing');
    assert.ok(indexHtml.includes('portGlobalSearchInput'), 'Search input missing');
    assert.ok(indexHtml.includes('⌘ + K'), 'Search keyboard shortcut missing');
    assert.ok(indexHtml.includes('portGlobalAiModeBtn'), 'Global AI mode button missing');
    assert.ok(indexHtml.includes('portNotificationsBtn'), 'Notifications button missing');
    assert.ok(indexHtml.includes('port-user-avatar'), 'User avatar missing');
  });

  test('Reference 1 (Master Overview Dashboard) elements exist', () => {
    assert.ok(indexHtml.includes('port-overview-hero'), 'Hero greeting banner missing');
    assert.ok(indexHtml.includes('Good Evening, Raghul! 👋'), 'Hero greeting text missing');
    assert.ok(indexHtml.includes('portLiveClock'), 'Live ticking clock missing');
    assert.ok(indexHtml.includes('valStatVisitors'), 'Total Visitors card missing');
    assert.ok(indexHtml.includes('valStatLiveUsers'), 'Live Users card missing');
    assert.ok(indexHtml.includes('valStatClicks'), 'Clicks Today card missing');
    assert.ok(indexHtml.includes('valStatProjects'), 'Projects Viewed card missing');
    assert.ok(indexHtml.includes('valStatSuccessRate'), 'Success Rate card missing');
    assert.ok(indexHtml.includes('portLiveActivityFeed'), 'Live Activity Feed missing');
    assert.ok(indexHtml.includes('Automation Flow'), 'Automation Flow missing');
    assert.ok(indexHtml.includes('monCpuVal'), 'System Monitor CPU telemetry missing');
    assert.ok(indexHtml.includes('monMemVal'), 'System Monitor Memory telemetry missing');
    assert.ok(indexHtml.includes('Raghul AI Assistant'), 'Raghul AI Assistant dock missing');
    assert.ok(indexHtml.includes('chartGradVisitors'), 'Analytics Overview area chart SVG missing');
    assert.ok(indexHtml.includes('port-deploy-card-preview'), 'Deployments live preview card missing');
  });

  test('Reference 2 (Portfolio Automation Control) elements exist', () => {
    assert.ok(indexHtml.includes('port-auto-hero'), 'Automation hero banner missing');
    assert.ok(indexHtml.includes('Auto Mode is Active'), 'Master Auto Mode card missing');
    assert.ok(indexHtml.includes('portAutoModeToggle'), 'Auto Mode master toggle switch missing');
    assert.ok(indexHtml.includes('btnActionHealthCheck'), 'Run Health Check tile missing');
    assert.ok(indexHtml.includes('btnActionDeployNow'), 'Deploy Now tile missing');
    assert.ok(indexHtml.includes('btnActionRunTests'), 'Run Tests tile missing');
    assert.ok(indexHtml.includes('btnActionBackupDb'), 'Backup DB tile missing');
    assert.ok(indexHtml.includes('btnActionClearCache'), 'Clear Cache tile missing');
    assert.ok(indexHtml.includes('btnActionRollback'), 'Rollback tile missing');
    assert.ok(indexHtml.includes('Top Locations'), 'Top Locations card missing');
  });

  test('Reference 3 (Raghul AI Assistant Console) elements exist', () => {
    assert.ok(indexHtml.includes('port-ai-console-hero'), 'Raghul AI Assistant hero banner missing');
    assert.ok(indexHtml.includes('port-ai-subtabs'), 'AI assistant sub-tabs missing');
    assert.ok(indexHtml.includes('Working on your request...'), 'Verified execution progress card missing');
    assert.ok(indexHtml.includes('port-execution-pipeline'), '5-stage pipeline timeline missing');
    assert.ok(indexHtml.includes('All tasks completed successfully! 🎉'), 'Success alert missing');
    assert.ok(indexHtml.includes('port-dials-grid-4'), '4 circular resource dials missing');
    assert.ok(indexHtml.includes('Live Control Center'), 'Live Control Center missing');
    assert.ok(indexHtml.includes('portAiConsoleInput'), 'AI console input missing');
  });

  test('Operational footer bar with live status and integration logos exists', () => {
    assert.ok(indexHtml.includes('class="port-footer"'), 'port-footer class missing');
    assert.ok(indexHtml.includes('All systems operational'), 'Operational status indicator missing');
    assert.ok(indexHtml.includes('Portfolio OS v3.0 🚀'), 'Portfolio OS v3.0 footer badge missing');
  });

  // 3. CSS Design System Verification
  console.log('\n3. CSS Design System & Anti-Slop Rules');
  const styleCss = fs.readFileSync(path.join(__dirname, '../public/style.css'), 'utf8');

  test('Full viewport IDE container layout defined in style.css', () => {
    assert.ok(styleCss.includes('.portfolio-hub-dialog'), 'dialog class missing');
    assert.ok(styleCss.includes('max-width: 1720px'), '1720px max-width missing');
    assert.ok(styleCss.includes('flex-direction: row'), 'flex-direction: row missing for sidebar layout');
    assert.ok(styleCss.includes('.port-sidebar'), 'port-sidebar styles missing');
    assert.ok(styleCss.includes('.port-main-wrapper'), 'port-main-wrapper styles missing');
    assert.ok(styleCss.includes('.port-overview-hero'), 'hero banner styles missing');
    assert.ok(styleCss.includes('.port-stat-cards-5'), '5 stat cards layout missing');
  });

  // 4. Client-side Logic Verification
  console.log('\n4. Client Logic Verification (app.js)');
  const appJs = fs.readFileSync(path.join(__dirname, '../public/app.js'), 'utf8');

  test('startPortfolioClock and connectPortfolioStream implemented in app.js', () => {
    assert.ok(appJs.includes('function startPortfolioClock'), 'startPortfolioClock function missing');
    assert.ok(appJs.includes('function connectPortfolioStream'), 'connectPortfolioStream function missing');
    assert.ok(appJs.includes('function executePortfolioQuickAction'), 'executePortfolioQuickAction function missing');
    assert.ok(appJs.includes('function executePortfolioAiAgent'), 'executePortfolioAiAgent function missing');
    assert.ok(appJs.includes('switchPortfolioTab'), 'switchPortfolioTab missing');
  });

  console.log('\n================================================================');
  console.log(`TOTAL TESTS: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runPortfolioTests().catch(err => {
  console.error('Test runner fatal error:', err);
  process.exit(1);
});
