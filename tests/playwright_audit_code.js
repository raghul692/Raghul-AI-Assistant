// Forensic Playwright Audit Runner for Raghul AI Portfolio OS v8.0
async (page) => {
  const auditReport = {
    timestamp: new Date().toISOString(),
    viewports: [],
    navigationResults: [],
    buttonResults: [],
    modalResults: [],
    themeResults: [],
    commandPalette: null,
    notificationDrawer: null,
    a11ySummary: {
      overflowChecks: [],
      contrastSampleChecks: [],
      touchTargetViolations: []
    },
    consoleErrors: []
  };

  // Collect console messages
  page.on('console', msg => {
    if (msg.type() === 'error') {
      auditReport.consoleErrors.push(msg.text());
    }
  });

  // 1. Audit Navigation across all 14 modules
  const modules = [
    'overview', 'ai-assistant', 'analytics', 'monitoring', 'github',
    'deployments', 'database', 'automations', 'incidents', 'knowledge',
    'integrations', 'security', 'audit', 'settings'
  ];

  for (const mod of modules) {
    try {
      const navSelector = `.os-nav-item[data-view="${mod}"]`;
      await page.waitForSelector(navSelector, { timeout: 3000 });
      await page.click(navSelector);
      await page.waitForTimeout(150);

      const navState = await page.evaluate((viewId) => {
        const navEl = document.querySelector(`.os-nav-item[data-view="${viewId}"]`);
        const viewEl = document.getElementById(`view-${viewId}`);
        const pageTitle = document.getElementById('osPageTitle')?.textContent?.trim();
        const isActive = navEl?.classList.contains('active');
        const isVisible = viewEl && window.getComputedStyle(viewEl).display !== 'none';
        
        return {
          viewId,
          navFound: !!navEl,
          isActive,
          viewFound: !!viewEl,
          isVisible,
          pageTitle
        };
      }, mod);

      const pass = navState.navFound && navState.isActive && navState.viewFound && navState.isVisible;
      auditReport.navigationResults.push({
        module: mod,
        status: pass ? 'PASS' : 'FAIL',
        ...navState
      });
    } catch (err) {
      auditReport.navigationResults.push({
        module: mod,
        status: 'ERROR',
        error: err.message
      });
    }
  }

  // 2. Test Interactive Buttons in each module
  const buttonTests = [
    // Overview
    { view: 'overview', selector: '#btnSimulatePing', name: 'Overview Simulate Ping' },
    { view: 'overview', selector: '#btnQuickHealthCheck', name: 'Overview Quick Health Check' },
    // Analytics
    { view: 'analytics', selector: '#btnAnalyticsRefresh', name: 'Analytics Refresh' },
    // Monitoring
    { view: 'monitoring', selector: '#btnMonitoringProbe', name: 'Monitoring Probe Services' },
    // GitHub
    { view: 'github', selector: '#btnGithubRefresh', name: 'GitHub Commits Refresh' },
    // Deployments
    { view: 'deployments', selector: '#btnDeploymentsRefresh', name: 'Deployments Refresh' },
    // Database
    { view: 'database', selector: '#btnTriggerDbSync', name: 'Database Supabase Sync' },
    // Automations
    { view: 'automations', selector: '#btnRefreshJobs', name: 'Automations Refresh Jobs' },
    // Incidents
    { view: 'incidents', selector: '#btnIncidentsRefresh', name: 'Incidents Refresh' },
    // Knowledge
    { view: 'knowledge', selector: '#btnKnowledgeSync', name: 'Knowledge Docs Sync' },
    // Integrations
    { view: 'integrations', selector: '#btnIntegrationsProbeAll', name: 'Integrations Probe All' },
    // Security
    { view: 'security', selector: '#btnSecurityRefresh', name: 'Security Refresh' },
    // Audit
    { view: 'audit', selector: '#btnVerifyAuditIntegrity', name: 'Audit Verify Hash Chain' },
    // Settings
    { view: 'settings', selector: '#btnSaveSettings', name: 'Settings Save' }
  ];

  for (const btn of buttonTests) {
    try {
      // Navigate to view first
      await page.click(`.os-nav-item[data-view="${btn.view}"]`);
      await page.waitForTimeout(100);

      const exists = await page.evaluate((sel) => !!document.querySelector(sel), btn.selector);
      if (!exists) {
        auditReport.buttonResults.push({
          name: btn.name,
          selector: btn.selector,
          status: 'FAIL',
          reason: 'Element selector not found in DOM'
        });
        continue;
      }

      await page.click(btn.selector);
      await page.waitForTimeout(200);

      auditReport.buttonResults.push({
        name: btn.name,
        selector: btn.selector,
        status: 'PASS'
      });
    } catch (err) {
      auditReport.buttonResults.push({
        name: btn.name,
        selector: btn.selector,
        status: 'FAIL',
        error: err.message
      });
    }
  }

  // 3. Test Modals (Open, verify rendered, close cleanly)
  try {
    // 3a. GitHub New Branch Modal
    await page.click(`.os-nav-item[data-view="github"]`);
    await page.waitForTimeout(100);
    await page.click('#btnGithubNewBranch');
    await page.waitForTimeout(200);
    
    const branchModalOpen = await page.evaluate(() => {
      const modal = document.getElementById('osConfirmModal');
      return modal && !modal.classList.contains('hidden');
    });

    // Close modal via cancel
    await page.click('#btnConfirmModalCancel');
    await page.waitForTimeout(150);

    const branchModalClosed = await page.evaluate(() => {
      const modal = document.getElementById('osConfirmModal');
      return modal && modal.classList.contains('hidden');
    });

    auditReport.modalResults.push({
      modal: 'GitHub New Branch Modal',
      status: (branchModalOpen && branchModalClosed) ? 'PASS' : 'FAIL',
      details: { branchModalOpen, branchModalClosed }
    });

    // 3b. Log Incident Modal
    await page.click(`.os-nav-item[data-view="incidents"]`);
    await page.waitForTimeout(100);
    await page.click('#btnLogIncident');
    await page.waitForTimeout(200);

    const incidentModalOpen = await page.evaluate(() => {
      const modal = document.getElementById('osConfirmModal');
      return modal && !modal.classList.contains('hidden');
    });

    await page.click('#btnConfirmModalCancel');
    await page.waitForTimeout(150);

    const incidentModalClosed = await page.evaluate(() => {
      const modal = document.getElementById('osConfirmModal');
      return modal && modal.classList.contains('hidden');
    });

    auditReport.modalResults.push({
      modal: 'Log Incident Modal',
      status: (incidentModalOpen && incidentModalClosed) ? 'PASS' : 'FAIL',
      details: { incidentModalOpen, incidentModalClosed }
    });
  } catch (err) {
    auditReport.modalResults.push({
      modal: 'Modal Verification Suite',
      status: 'ERROR',
      error: err.message
    });
  }

  // 4. Test Notification Drawer
  try {
    await page.click('#btnToggleNotifications');
    await page.waitForTimeout(200);

    const drawerOpen = await page.evaluate(() => {
      const drawer = document.getElementById('osNotificationDrawer');
      return drawer && drawer.classList.contains('open');
    });

    await page.click('#btnCloseNotifications');
    await page.waitForTimeout(200);

    const drawerClosed = await page.evaluate(() => {
      const drawer = document.getElementById('osNotificationDrawer');
      return drawer && !drawer.classList.contains('open');
    });

    auditReport.notificationDrawer = {
      status: (drawerOpen && drawerClosed) ? 'PASS' : 'FAIL',
      details: { drawerOpen, drawerClosed }
    };
  } catch (err) {
    auditReport.notificationDrawer = { status: 'ERROR', error: err.message };
  }

  // 5. Test Command Palette
  try {
    // Trigger via Ctrl+K shortcut or search bar
    await page.click('#headerSearchInput');
    await page.waitForTimeout(200);

    const paletteOpen = await page.evaluate(() => {
      const pal = document.getElementById('osCommandPalette');
      return pal && !pal.classList.contains('hidden');
    });

    // Type query
    await page.fill('#paletteSearchInput', 'database');
    await page.waitForTimeout(150);

    const resultCount = await page.evaluate(() => {
      return document.querySelectorAll('#paletteResults .os-palette-item').length;
    });

    // Close with Escape
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);

    const paletteClosed = await page.evaluate(() => {
      const pal = document.getElementById('osCommandPalette');
      return pal && pal.classList.contains('hidden');
    });

    auditReport.commandPalette = {
      status: (paletteOpen && resultCount > 0 && paletteClosed) ? 'PASS' : 'FAIL',
      details: { paletteOpen, resultCount, paletteClosed }
    };
  } catch (err) {
    auditReport.commandPalette = { status: 'ERROR', error: err.message };
  }

  // 6. Test Themes
  const themes = ['dark', 'light', 'cyber', 'emerald', 'sunset'];
  for (const th of themes) {
    try {
      await page.selectOption('#selectTheme', th);
      await page.waitForTimeout(100);

      const activeTheme = await page.evaluate(() => {
        return document.documentElement.getAttribute('data-theme');
      });

      auditReport.themeResults.push({
        theme: th,
        applied: activeTheme === th,
        status: activeTheme === th ? 'PASS' : 'FAIL'
      });
    } catch (err) {
      auditReport.themeResults.push({ theme: th, status: 'ERROR', error: err.message });
    }
  }
  // Reset theme to dark
  await page.selectOption('#selectTheme', 'dark');

  // 7. Responsive Viewport Sweep & Horizontal Overflow Audit
  const testViewports = [
    { name: 'Desktop (1440x900)', width: 1440, height: 900 },
    { name: 'Laptop / Tablet Landscape (1024x768)', width: 1024, height: 768 },
    { name: 'Tablet Portrait (820x1180)', width: 820, height: 1180 },
    { name: 'Mobile Standard (390x844)', width: 390, height: 844 },
    { name: 'Mobile Compact (375x812)', width: 375, height: 812 }
  ];

  for (const vp of testViewports) {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await page.waitForTimeout(200);

    const overflowCheck = await page.evaluate((vpName) => {
      const docWidth = document.documentElement.scrollWidth;
      const winWidth = window.innerWidth;
      const hasOverflow = docWidth > winWidth + 1; // 1px threshold for fractional subpixels
      return {
        viewport: vpName,
        docWidth,
        winWidth,
        hasOverflow,
        status: hasOverflow ? 'FAIL' : 'PASS'
      };
    }, vp.name);

    auditReport.a11ySummary.overflowChecks.push(overflowCheck);
  }

  // Restore 1440x900
  await page.setViewportSize({ width: 1440, height: 900 });

  return auditReport;
}
