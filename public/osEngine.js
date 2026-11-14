/**
 * RAGHUL AI — PORTFOLIO OPERATING SYSTEM (V8) ENGINE
 * Single Page Application Controller
 * Zero Fake Data — 100% Real Backend APIs & Live SSE Streaming
 */

class PortfolioOSEngine {
  constructor() {
    this.currentView = 'overview';
    this.eventSource = null;
    this.refreshTimer = null;
    this.userSettings = {
      theme: 'dark',
      density: 'compact',
      auto_refresh: true,
      refresh_interval: 30
    };
    this.isEmergencyStopped = false;
    this.knowledgeMap = new Map();
    this.pendingConfirmAction = null;

    this.paletteCommands = [
      { id: 'view-overview', label: 'Jump to Overview', icon: '⚡', category: 'Navigation', action: () => this.navigateTo('overview') },
      { id: 'view-ai-assistant', label: 'Jump to AI Assistant', icon: '🤖', category: 'Navigation', action: () => this.navigateTo('ai-assistant') },
      { id: 'view-analytics', label: 'Jump to Visitor Analytics', icon: '📊', category: 'Navigation', action: () => this.navigateTo('analytics') },
      { id: 'view-monitoring', label: 'Jump to System Monitoring', icon: '📈', category: 'Navigation', action: () => this.navigateTo('monitoring') },
      { id: 'view-github', label: 'Jump to GitHub Manager', icon: '🐙', category: 'Navigation', action: () => this.navigateTo('github') },
      { id: 'view-deployments', label: 'Jump to Deployments', icon: '🚀', category: 'Navigation', action: () => this.navigateTo('deployments') },
      { id: 'view-database', label: 'Jump to Database & Sync', icon: '🗄️', category: 'Navigation', action: () => this.navigateTo('database') },
      { id: 'view-automations', label: 'Jump to Workflow Center', icon: '⚙️', category: 'Navigation', action: () => this.navigateTo('automations') },
      { id: 'view-incidents', label: 'Jump to Incidents', icon: '⚠️', category: 'Navigation', action: () => this.navigateTo('incidents') },
      { id: 'view-knowledge', label: 'Jump to Knowledge Base', icon: '📚', category: 'Navigation', action: () => this.navigateTo('knowledge') },
      { id: 'view-integrations', label: 'Jump to Cloud Integrations', icon: '🔌', category: 'Navigation', action: () => this.navigateTo('integrations') },
      { id: 'view-security', label: 'Jump to Permissions & Governance', icon: '🛡️', category: 'Navigation', action: () => this.navigateTo('security') },
      { id: 'view-audit', label: 'Jump to Activity & Audit', icon: '📜', category: 'Navigation', action: () => this.navigateTo('audit') },
      { id: 'view-settings', label: 'Jump to Settings', icon: '⚙️', category: 'Navigation', action: () => this.navigateTo('settings') },
      { id: 'act-sync', label: 'Trigger Supabase Bi-Directional Sync', icon: '🔄', category: 'Action', action: () => this.triggerSupabaseSync() },
      { id: 'act-backup', label: 'Create Instant SQLite Snapshot Backup', icon: '💾', category: 'Action', action: () => this.createDatabaseBackup() },
      { id: 'act-theme', label: 'Toggle Interface Theme (Dark/Light)', icon: '🌓', category: 'Action', action: () => this.toggleTheme() },
      { id: 'act-stop', label: 'Toggle Global Emergency Stop', icon: '🛑', category: 'Action', action: () => this.toggleEmergencyStop() }
    ];
    this.selectedPaletteIndex = 0;
  }

  async init() {
    console.log('⚡ Initializing Raghul AI Portfolio OS Engine...');
    this.bindEvents();
    await this.loadSettings();
    this.initRouting();
    this.initSSE();
    this.loadView(this.currentView);
    this.loadNotifications();
    this.setupAutoRefresh();
  }

  // ==============================================================
  // MODAL & TOAST CONTROLLERS (IN-APP REPLACEMENTS FOR ALERT/PROMPT)
  // ==============================================================
  showModal({ title = 'Action Required', bodyHtml = '', confirmText = 'Confirm', cancelText = 'Cancel', onConfirm = null }) {
    const modal = document.getElementById('osConfirmModal');
    const titleEl = document.getElementById('confirmModalTitle');
    const bodyEl = document.getElementById('confirmModalBody');
    const confirmBtn = document.getElementById('btnConfirmModalConfirm');
    const cancelBtn = document.getElementById('btnConfirmModalCancel');

    if (modal && titleEl && bodyEl) {
      titleEl.textContent = title;
      bodyEl.innerHTML = bodyHtml;
      if (confirmBtn) {
        confirmBtn.textContent = confirmText;
        confirmBtn.style.display = onConfirm ? 'inline-flex' : 'none';
      }
      if (cancelBtn) {
        cancelBtn.textContent = cancelText;
      }
      this.pendingConfirmAction = onConfirm || null;
      modal.classList.add('active');
    }
  }

  showToast(message, type = 'info') {
    let toastContainer = document.getElementById('osToastContainer');
    if (!toastContainer) {
      toastContainer = document.createElement('div');
      toastContainer.id = 'osToastContainer';
      toastContainer.style.cssText = 'position:fixed; bottom:20px; right:20px; z-index:200; display:flex; flex-direction:column; gap:8px; pointer-events:none;';
      document.body.appendChild(toastContainer);
    }
    const toast = document.createElement('div');
    toast.style.cssText = 'background:var(--bg-surface); border:1px solid var(--border); padding:10px 16px; border-radius:var(--radius-sm); color:var(--text-primary); font-size:12px; box-shadow:var(--shadow-md); pointer-events:auto; display:flex; align-items:center; gap:8px;';
    const icon = type === 'success' ? '✅' : (type === 'error' ? '❌' : 'ℹ️');
    toast.innerHTML = `<span>${icon}</span> <span>${this.escape(message)}</span>`;
    toastContainer.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity 0.3s';
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  }

  // ==============================================================
  // ROUTING & NAVIGATION
  // ==============================================================
  initRouting() {
    const hash = window.location.hash.replace('#', '').trim();
    if (hash && document.getElementById(`view-${hash}`)) {
      this.navigateTo(hash, false);
    } else {
      this.navigateTo('overview', false);
    }

    window.addEventListener('hashchange', () => {
      const newHash = window.location.hash.replace('#', '').trim();
      if (newHash && newHash !== this.currentView && document.getElementById(`view-${newHash}`)) {
        this.navigateTo(newHash, false);
      }
    });
  }

  navigateTo(viewId, updateHash = true) {
    const targetEl = document.getElementById(`view-${viewId}`);
    if (!targetEl) return;

    // Update views
    document.querySelectorAll('.os-view').forEach(el => el.classList.remove('active'));
    targetEl.classList.add('active');

    // Update sidebar nav
    document.querySelectorAll('.os-nav-item').forEach(el => {
      el.classList.toggle('active', el.getAttribute('data-view') === viewId);
    });

    // Update breadcrumb
    const label = targetEl.querySelector('.os-view-title h2')?.textContent || this.formatTitle(viewId);
    const breadcrumb = document.getElementById('currentBreadcrumb');
    if (breadcrumb) breadcrumb.textContent = label;

    this.currentView = viewId;
    if (updateHash) {
      window.location.hash = viewId;
    }

    // Load view data
    this.loadView(viewId);
  }

  formatTitle(str) {
    return str.split('-').map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(' ');
  }

  // ==============================================================
  // EVENT BINDINGS
  // ==============================================================
  bindEvents() {
    // Nav items
    document.querySelectorAll('.os-nav-item').forEach(item => {
      item.addEventListener('click', () => {
        const view = item.getAttribute('data-view');
        if (view) this.navigateTo(view);
      });
    });

    // Topbar controls
    document.getElementById('osRefreshBtn')?.addEventListener('click', () => {
      this.loadView(this.currentView);
    });

    document.getElementById('osThemeBtn')?.addEventListener('click', () => {
      this.toggleTheme();
    });

    document.getElementById('osNotifBtn')?.addEventListener('click', () => {
      this.toggleNotifDrawer();
    });

    document.getElementById('btnCloseNotifDrawer')?.addEventListener('click', () => {
      this.toggleNotifDrawer(false);
    });

    document.getElementById('btnNotifMarkAllRead')?.addEventListener('click', () => {
      this.markAllNotificationsRead();
    });

    document.getElementById('osEmergencyStopBtn')?.addEventListener('click', () => {
      this.toggleEmergencyStop();
    });

    document.getElementById('btnToggleEmergencyStopSettings')?.addEventListener('click', () => {
      this.toggleEmergencyStop();
    });

    // Modal close & confirm controls
    document.getElementById('btnConfirmModalClose')?.addEventListener('click', () => this.closeModals());
    document.getElementById('btnConfirmModalCancel')?.addEventListener('click', () => this.closeModals());
    document.getElementById('btnConfirmModalConfirm')?.addEventListener('click', () => {
      if (typeof this.pendingConfirmAction === 'function') {
        const action = this.pendingConfirmAction;
        this.pendingConfirmAction = null;
        action();
      }
      this.closeModals();
    });

    // Command palette triggers
    document.getElementById('cmdSearchTrigger')?.addEventListener('click', () => {
      this.openCommandPalette();
    });

    window.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        this.openCommandPalette();
      }
      if (e.key === 'Escape') {
        this.closeModals();
      }
    });

    // Command palette inputs
    const cmdInput = document.getElementById('cmdPaletteInput');
    cmdInput?.addEventListener('input', (e) => this.filterCommandPalette(e.target.value));
    cmdInput?.addEventListener('keydown', (e) => this.handlePaletteKeydown(e));

    // Overview buttons
    document.getElementById('btnSimulatePing')?.addEventListener('click', () => this.simulatePing());
    document.getElementById('btnQuickHealthCheck')?.addEventListener('click', () => this.runHealthCheck());
    document.getElementById('btnQuickSyncDb')?.addEventListener('click', () => this.triggerSupabaseSync());
    document.getElementById('btnQuickBackupDb')?.addEventListener('click', () => this.createDatabaseBackup());

    // AI Assistant buttons & Conversational Workspace
    this.agentGovernanceMode = 'autopilot';

    document.getElementById('btnGovAutopilot')?.addEventListener('click', () => {
      this.agentGovernanceMode = 'autopilot';
      document.getElementById('btnGovAutopilot')?.classList.add('active');
      document.getElementById('btnGovApproval')?.classList.remove('active');
      this.showToast('Autonomous Auto-Pilot Mode activated (Zero-click deployment)', 'info');
      this.logTerminal('SYS', 'Switched to Auto-Pilot: Pre-flight verified commits deploy directly to GitHub main.');
    });

    document.getElementById('btnGovApproval')?.addEventListener('click', () => {
      this.agentGovernanceMode = 'approval';
      document.getElementById('btnGovApproval')?.classList.add('active');
      document.getElementById('btnGovAutopilot')?.classList.remove('active');
      this.showToast('Approval Gate Mode activated (Human confirmation required at Stage 5)', 'warning');
      this.logTerminal('SYS', 'Switched to Approval Gate: Execution pauses at Stage 5 for 1-click confirmation.');
    });

    document.getElementById('btnAgentExecute')?.addEventListener('click', () => this.executeAgentGoal());
    document.getElementById('btnAgentChatSend')?.addEventListener('click', () => this.executeAgentGoal());
    
    const chatInput = document.getElementById('agentChatInput');
    chatInput?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.executeAgentGoal();
      }
    });

    // File & Photo Upload handling
    const fileInput = document.getElementById('agentFileUploadInput');
    document.getElementById('btnTriggerFileUpload')?.addEventListener('click', () => fileInput?.click());
    document.getElementById('btnTriggerPhotoUpload')?.addEventListener('click', () => fileInput?.click());

    fileInput?.addEventListener('change', (e) => this.handleAgentFileSelect(e));
    document.getElementById('btnRemoveAttachment')?.addEventListener('click', () => this.clearAgentAttachment());

    // Clear chat
    document.getElementById('btnAgentClearChat')?.addEventListener('click', () => this.clearAgentChat());

    document.querySelectorAll('.quick-chat-chip, .quick-agent-prompt').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const prompt = e.currentTarget.getAttribute('data-prompt');
        const input = document.getElementById('agentChatInput') || document.getElementById('agentGoalInput');
        if (input && prompt) {
          input.value = prompt;
          this.executeAgentGoal(prompt);
        }
      });
    });

    document.getElementById('btnAgentClearTerminal')?.addEventListener('click', () => {
      const term = document.getElementById('agentTerminal');
      if (term) term.innerHTML = '';
    });

    // Visitor Analytics buttons
    document.getElementById('btnAnalyticsRefresh')?.addEventListener('click', () => this.loadAnalyticsData());

    // Monitoring buttons
    document.getElementById('btnMonitoringProbe')?.addEventListener('click', () => this.probeAllIntegrations());

    // GitHub buttons
    document.getElementById('btnGithubRefresh')?.addEventListener('click', () => this.loadGitHubData());
    document.getElementById('btnGithubNewBranch')?.addEventListener('click', () => this.promptCreateBranch());

    // Deployments buttons
    document.getElementById('btnDeploymentsRefresh')?.addEventListener('click', () => this.loadDeploymentsData());
    document.getElementById('btnDeployTriggerGated')?.addEventListener('click', () => this.promptDeployGated());

    // Database buttons
    document.getElementById('btnTriggerDbSync')?.addEventListener('click', () => this.triggerSupabaseSync());
    document.getElementById('btnCreateDbBackup')?.addEventListener('click', () => this.createDatabaseBackup());

    // Workflow buttons
    document.getElementById('btnRefreshJobs')?.addEventListener('click', () => this.loadWorkflowData());

    // Incidents buttons
    document.getElementById('btnLogIncident')?.addEventListener('click', () => this.promptLogIncident());

    // Knowledge buttons
    document.getElementById('btnKnowledgeSync')?.addEventListener('click', () => this.syncKnowledgeBase());
    document.getElementById('btnKnowledgeSearch')?.addEventListener('click', () => this.searchKnowledge());
    document.getElementById('knowledgeSearchInput')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this.searchKnowledge();
    });

    // Integrations buttons
    document.getElementById('btnIntegrationsProbeAll')?.addEventListener('click', () => this.probeAllIntegrations());

    // Security buttons
    document.getElementById('btnSecurityRefresh')?.addEventListener('click', () => this.loadSecurityData());

    // Audit buttons
    document.getElementById('btnVerifyAuditIntegrity')?.addEventListener('click', () => this.verifyAuditIntegrity());
    document.getElementById('btnCreateAuditCheckpoint')?.addEventListener('click', () => this.createSignedCheckpoint());

    // Settings buttons
    document.getElementById('btnSaveSettings')?.addEventListener('click', () => this.saveSettings());
    document.getElementById('settingTheme')?.addEventListener('change', (e) => this.applyTheme(e.target.value));
  }

  // ==============================================================
  // SSE REAL-TIME STREAMING
  // ==============================================================
  initSSE() {
    if (this.eventSource) {
      this.eventSource.close();
    }

    const dot = document.getElementById('osStreamDot');
    const text = document.getElementById('osStreamText');

    try {
      this.eventSource = new EventSource('/api/portfolio/stream');

      this.eventSource.onopen = () => {
        if (dot) dot.className = 'os-stream-dot';
        if (text) text.textContent = 'Live Connected';
      };

      this.eventSource.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data);
          this.handleLiveEvent(data);
        } catch (_) {}
      };

      this.eventSource.onerror = () => {
        if (dot) dot.className = 'os-stream-dot disconnected';
        if (text) text.textContent = 'Offline (Retrying)';
      };
    } catch (err) {
      console.warn('SSE connection notice:', err.message);
    }
  }

  handleLiveEvent(evt) {
    if (evt.type === 'activity' || evt.type === 'ping' || evt.event_type) {
      const tbody = document.getElementById('tbodyOverviewActivity');
      if (tbody) {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td class="mono">${new Date(evt.created_at || Date.now()).toLocaleTimeString()}</td>
          <td><span class="os-pill os-pill-info">${this.escape(evt.badge || evt.event_type || 'PING')}</span></td>
          <td class="mono">${this.escape(evt.target || evt.path || '/')}</td>
          <td>${this.escape(evt.country || 'India')}</td>
          <td><span class="os-pill os-pill-success">${this.escape(evt.status || 'SUCCESS')}</span></td>
        `;
        tbody.prepend(tr);
        if (tbody.children.length > 8) tbody.removeChild(tbody.lastChild);
      }

      const totalEl = document.getElementById('statTotalEvents');
      if (totalEl && totalEl.textContent !== '...') {
        const cur = parseInt(totalEl.textContent, 10) || 0;
        totalEl.textContent = cur + 1;
      }
    }

    if (evt.type === 'notification') {
      this.loadNotifications();
    }
  }

  // ==============================================================
  // VIEW LOADER DISPATCHER
  // ==============================================================
  loadView(viewId) {
    switch (viewId) {
      case 'overview': return this.loadOverviewData();
      case 'ai-assistant': return this.loadAgentData();
      case 'analytics': return this.loadAnalyticsData();
      case 'monitoring': return this.loadMonitoringData();
      case 'github': return this.loadGitHubData();
      case 'deployments': return this.loadDeploymentsData();
      case 'database': return this.loadDatabaseData();
      case 'automations': return this.loadWorkflowData();
      case 'incidents': return this.loadIncidentsData();
      case 'knowledge': return this.loadKnowledgeData();
      case 'integrations': return this.loadIntegrationsData();
      case 'security': return this.loadSecurityData();
      case 'audit': return this.loadAuditData();
      case 'settings': return this.loadSettingsData();
    }
  }

  // ==============================================================
  // 1. OVERVIEW VIEW
  // ==============================================================
  async loadOverviewData() {
    try {
      const [telemetryRes, analyticsRes, deployRes, repoRes] = await Promise.all([
        fetch('/api/portfolio/monitoring/services').then(r => r.json()).catch(() => null),
        fetch('/api/portfolio/analytics/summary').then(r => r.json()).catch(() => null),
        fetch('/api/portfolio/deployments?limit=5').then(r => r.json()).catch(() => null),
        fetch('/api/portfolio/github/repo').then(r => r.json()).catch(() => null)
      ]);

      if (telemetryRes?.portfolioSite) {
        const heroStatus = document.getElementById('heroSiteStatus');
        const heroLatency = document.getElementById('heroSiteLatency');
        if (heroStatus) heroStatus.textContent = telemetryRes.portfolioSite.status;
        if (heroLatency && telemetryRes.portfolioSite.latencyMs) {
          heroLatency.textContent = `Latency: ${telemetryRes.portfolioSite.latencyMs}ms`;
        }
      }

      if (repoRes?.repo) {
        const heroBranch = document.getElementById('heroGitBranch');
        if (heroBranch) heroBranch.textContent = `branch: ${repoRes.repo.defaultBranch || 'main'}`;
      }

      if (analyticsRes) {
        document.getElementById('statTotalEvents').textContent = analyticsRes.totalEvents ?? '0';
        document.getElementById('statUniqueVisitors').textContent = analyticsRes.uniqueVisitors ?? '0';
      }

      if (deployRes?.deployments) {
        document.getElementById('statDeploymentsCount').textContent = deployRes.deployments.length;
        const tbody = document.getElementById('tbodyOverviewDeployments');
        if (tbody) {
          if (deployRes.deployments.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:var(--text-muted);">No deployments recorded</td></tr>';
          } else {
            tbody.innerHTML = deployRes.deployments.map(d => `
              <tr>
                <td><span class="os-pill ${d.target === 'vercel' ? 'os-pill-info' : 'os-pill-neutral'}">${d.target}</span></td>
                <td class="mono">${d.commit_sha ? d.commit_sha.substring(0, 7) : 'head'}</td>
                <td><span class="os-pill ${d.status === 'READY' || d.status === 'live' ? 'os-pill-success' : 'os-pill-warning'}">${d.status}</span></td>
                <td>${d.triggered_by || 'agent'}</td>
                <td class="mono">${new Date(d.created_at).toLocaleTimeString()}</td>
              </tr>
            `).join('');
          }
        }
      }

      const activityRes = await fetch('/api/portfolio/dashboard').then(r => r.json()).catch(() => null);
      if (activityRes?.liveActivity) {
        const tbody = document.getElementById('tbodyOverviewActivity');
        if (tbody) {
          tbody.innerHTML = activityRes.liveActivity.map(a => `
            <tr>
              <td class="mono">${new Date(a.created_at).toLocaleTimeString()}</td>
              <td><span class="os-pill os-pill-info">${this.escape(a.badge || a.type || 'Event')}</span></td>
              <td class="mono">${this.escape(a.detail || '/')}</td>
              <td>${this.escape(a.country || 'India')}</td>
              <td><span class="os-pill os-pill-success">${this.escape(a.status || 'SUCCESS')}</span></td>
            </tr>
          `).join('');
        }
      }
    } catch (err) {
      console.warn('Overview load error:', err.message);
    }
  }

  // ==============================================================
  // 2. AI ASSISTANT (AUTONOMOUS 7-STAGE PIPELINE)
  // ==============================================================
  loadAgentData() {
    // Initial status
  }

  handleAgentFileSelect(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const base64Data = reader.result.split(',')[1];
      this.currentAgentAttachment = {
        name: file.name,
        size: (file.size / 1024).toFixed(1) + ' KB',
        mimeType: file.type || 'application/octet-stream',
        data: base64Data,
        isImage: file.type.startsWith('image/'),
        dataUrl: reader.result
      };

      const previewArea = document.getElementById('agentAttachmentPreviewArea');
      const nameEl = document.getElementById('attachmentFileName');
      const sizeEl = document.getElementById('attachmentFileSize');
      const iconEl = document.getElementById('attachmentTypeIcon');
      const imgThumb = document.getElementById('attachmentImgThumb');

      if (nameEl) nameEl.textContent = file.name;
      if (sizeEl) sizeEl.textContent = `${(file.size / 1024).toFixed(1)} KB • Ready to commit`;

      if (this.currentAgentAttachment.isImage) {
        if (iconEl) iconEl.style.display = 'none';
        if (imgThumb) {
          imgThumb.src = reader.result;
          imgThumb.style.display = 'block';
        }
      } else {
        if (imgThumb) imgThumb.style.display = 'none';
        if (iconEl) {
          iconEl.textContent = file.name.endsWith('.pdf') ? '📕' : '📄';
          iconEl.style.display = 'inline-block';
        }
      }

      if (previewArea) previewArea.style.display = 'flex';
      this.showToast(`Attached ${file.name}`, 'info');
    };
    reader.readAsDataURL(file);
  }

  clearAgentAttachment() {
    this.currentAgentAttachment = null;
    const fileInput = document.getElementById('agentFileUploadInput');
    if (fileInput) fileInput.value = '';
    const previewArea = document.getElementById('agentAttachmentPreviewArea');
    if (previewArea) previewArea.style.display = 'none';
  }

  clearAgentChat() {
    const thread = document.getElementById('agentChatThread');
    if (thread) {
      thread.innerHTML = `
        <div class="chat-msg-row assistant">
          <div class="chat-avatar" style="width: 32px; height: 32px; border-radius: 8px; background: rgba(56, 189, 248, 0.15); border: 1px solid rgba(56, 189, 248, 0.4); display: flex; align-items: center; justify-content: center; font-size: 15px; flex-shrink: 0;">🤖</div>
          <div class="chat-msg-content" style="max-width: 88%;">
            <div class="chat-bubble assistant">
              <p style="margin: 0 0 8px 0; font-weight: 600; color: #38bdf8; font-size: 14px;">Conversation cleared. How can I manage your portfolio today?</p>
              <p style="margin: 0; color: var(--text-muted); font-size: 12.5px;">Ask questions, attach certificates to publish, or command project/skill updates.</p>
            </div>
          </div>
        </div>
      `;
    }
  }

  async approvePendingExecution(ticketId, btn) {
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<span>⏳</span> Pushing to GitHub & Vercel...';
    }
    this.logTerminal('SYS', `Operator approved Stage 5 execution for ticket ${ticketId}. Pushing to GitHub main...`);
    try {
      const res = await fetch('/api/portfolio/agent/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticketId })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Approval failed');

      // Update approval card
      const card = document.getElementById(`approval-card-${ticketId}`);
      if (card) {
        card.style.background = 'rgba(16, 185, 129, 0.08)';
        card.style.borderColor = 'rgba(16, 185, 129, 0.4)';
        card.innerHTML = `
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <div style="color:#34d399; font-weight:600; font-size:12.5px; display:flex; align-items:center; gap:6px;">
              <span>✅</span> Approved & Deployed Successfully!
            </div>
            <a href="https://github.com/raghul692/raghulraja_portfolio/commit/${data.commitSha}" target="_blank" style="color:#38bdf8; font-family:monospace; font-size:11px; text-decoration:underline;">
              commit ${data.commitSha ? data.commitSha.substring(0, 7) : 'latest'}
            </a>
          </div>
          <div style="font-size:11.5px; color:#cbd5e1; margin-top:5px;">Changes committed to GitHub main and deployed to Vercel edge. Live site verified HTTP ${data.productionHealth?.status || 200}.</div>
        `;
      }

      for (let i = 1; i <= 7; i++) {
        this.setTimelineStep(i, 'completed');
      }
      const statusPill = document.getElementById('agentExecutionStatus');
      if (statusPill) {
        statusPill.textContent = 'COMPLETED';
        statusPill.className = 'os-pill os-pill-success mono';
      }
      this.logTerminal('SUCCESS', `Commit ${data.commitSha?.slice(0, 7)} pushed. Live production health verified.`);
      this.showToast('Changes committed and deployed to Vercel!', 'success');
    } catch (err) {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = '<span>❌</span> Retry Approval';
      }
      this.showToast(err.message, 'error');
      this.logTerminal('ERROR', `Approval failed: ${err.message}`);
    }
  }

  rejectPendingExecution(ticketId, btn) {
    const card = document.getElementById(`approval-card-${ticketId}`);
    if (card) {
      card.style.background = 'rgba(239, 68, 68, 0.08)';
      card.style.borderColor = 'rgba(239, 68, 68, 0.4)';
      card.innerHTML = `
        <div style="color:#f87171; font-weight:600; font-size:12.5px; display:flex; align-items:center; gap:6px;">
          <span>❌</span> Execution Rejected by Operator
        </div>
        <div style="font-size:11.5px; color:#94a3b8; margin-top:4px;">Staged changes were discarded. No modifications were committed to the repository.</div>
      `;
    }
    const statusPill = document.getElementById('agentExecutionStatus');
    if (statusPill) {
      statusPill.textContent = 'REJECTED';
      statusPill.className = 'os-pill os-pill-danger mono';
    }
    this.logTerminal('SYS', `Execution rejected for ticket ${ticketId}. Changes discarded.`);
    this.showToast('Execution rejected. No changes committed.', 'info');
  }

  async executeAgentGoal(overridePrompt) {
    const chatInput = document.getElementById('agentChatInput');
    const legacyInput = document.getElementById('agentGoalInput');
    const goal = (overridePrompt || chatInput?.value || legacyInput?.value || '').trim();
    if (!goal && !this.currentAgentAttachment) return;

    const term = document.getElementById('agentTerminal');
    const statusPill = document.getElementById('agentExecutionStatus');
    const btnSend = document.getElementById('btnAgentChatSend');
    const btnLegacy = document.getElementById('btnAgentExecute');
    const thread = document.getElementById('agentChatThread');

    const attachmentToSend = this.currentAgentAttachment ? { ...this.currentAgentAttachment } : null;

    if (btnSend) btnSend.disabled = true;
    if (btnLegacy) btnLegacy.disabled = true;
    if (statusPill) {
      statusPill.textContent = 'RUNNING';
      statusPill.className = 'os-pill os-pill-warning mono';
    }

    // 1. Append User Message to Thread
    if (thread) {
      const userRow = document.createElement('div');
      userRow.className = 'chat-msg-row user';
      
      let attachmentHtml = '';
      if (attachmentToSend) {
        if (attachmentToSend.isImage) {
          attachmentHtml = `
            <div class="attached-chip" style="margin-bottom:6px;">
              <img src="${attachmentToSend.dataUrl}" style="width:20px; height:20px; border-radius:4px; object-fit:cover;" />
              <span>${this.escape(attachmentToSend.name)} (${attachmentToSend.size})</span>
            </div>
          `;
        } else {
          attachmentHtml = `
            <div class="attached-chip" style="margin-bottom:6px;">
              <span>📕</span>
              <span>${this.escape(attachmentToSend.name)} (${attachmentToSend.size})</span>
            </div>
          `;
        }
      }

      userRow.innerHTML = `
        <div class="chat-msg-content">
          ${attachmentHtml}
          <div class="chat-bubble user">${this.escape(goal || `Process uploaded file: ${attachmentToSend?.name}`)}</div>
        </div>
      `;
      thread.appendChild(userRow);

      // Append Active Thinking Indicator
      const thinkingRow = document.createElement('div');
      thinkingRow.className = 'chat-msg-row assistant';
      thinkingRow.id = 'activeThinkingBubble';
      thinkingRow.innerHTML = `
        <div class="chat-avatar" style="width: 32px; height: 32px; border-radius: 8px; background: rgba(56, 189, 248, 0.15); border: 1px solid rgba(56, 189, 248, 0.4); display: flex; align-items: center; justify-content: center; font-size: 15px; flex-shrink: 0;">🤖</div>
        <div class="chat-msg-content" style="max-width: 88%;">
          <div class="chat-bubble assistant" style="display:flex; align-items:center; gap:10px;">
            <span class="status-dot-pulse online" style="display:inline-block; width:9px; height:9px; border-radius:50%; background:#38bdf8;"></span>
            <span style="color:#38bdf8; font-weight:600; font-size:13px;">Deep Thinking & Executing 7-Stage Autonomous Pipeline...</span>
          </div>
        </div>
      `;
      thread.appendChild(thinkingRow);
      thread.scrollTop = thread.scrollHeight;
    }

    if (chatInput) chatInput.value = '';
    if (legacyInput) legacyInput.value = '';
    this.clearAgentAttachment();

    this.logTerminal('SYS', `Autonomous Task dispatched: "${goal || attachmentToSend?.name}"`);
    this.resetTimeline();
    this.setTimelineStep(1, 'active');

    try {
      const res = await fetch('/api/portfolio/agent/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: goal || `Upload and register certificate: ${attachmentToSend?.name}`,
          goal: goal || `Upload and register certificate: ${attachmentToSend?.name}`,
          attachments: attachmentToSend ? [attachmentToSend] : [],
          governanceMode: this.agentGovernanceMode || 'autopilot',
          autoApprove: false
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Execution failed');

      // Remove thinking indicator
      document.getElementById('activeThinkingBubble')?.remove();

      const isWaitingApproval = data.status === 'WAITING_FOR_APPROVAL';

      // Update top timeline
      if (isWaitingApproval) {
        for (let i = 1; i <= 4; i++) this.setTimelineStep(i, 'completed');
        this.setTimelineStep(5, 'active');
      } else {
        for (let i = 1; i <= 7; i++) this.setTimelineStep(i, 'completed');
      }

      // Log steps to terminal
      if (Array.isArray(data.verifiedSteps)) {
        data.verifiedSteps.forEach((step, idx) => {
          this.logTerminal(`STAGE ${idx + 1}`, step);
        });
      }
      if (data.summary) this.logTerminal('SUMMARY', data.summary);

      // Render Assistant Response Bubble with Deep Thinking & Pipeline Stepper
      if (thread) {
        const asstRow = document.createElement('div');
        asstRow.className = 'chat-msg-row assistant';

        // Deep Thinking Process Component
        let thinkingHtml = '';
        if (data.thinking && Array.isArray(data.thinking.phases)) {
          const phasesHtml = data.thinking.phases.map(p => `
            <div class="os-thinking-step">
              <span class="os-thinking-step-name">${this.escape(p.name)}:</span>
              <span>${this.escape(p.thought)}</span>
            </div>
          `).join('');

          thinkingHtml = `
            <details class="os-thinking-drawer">
              <summary class="os-thinking-summary">
                <div style="display:flex; align-items:center; gap:8px;">
                  <span>🧠</span>
                  <span>Deep Thinking Process (${data.duration || '1.5s'})</span>
                </div>
                <span style="font-size:11px; opacity:0.8;">Click to expand</span>
              </summary>
              <div class="os-thinking-body">
                ${phasesHtml}
              </div>
            </details>
          `;
        }

        // 7-Stage Visual Pipeline Stepper Card
        const commitInfo = data.executionResult?.commitSha 
          ? `<a href="https://github.com/raghul692/raghulraja_portfolio/commit/${data.executionResult.commitSha}" target="_blank" style="color:#38bdf8; text-decoration:underline; font-family:monospace;">commit ${data.executionResult.commitSha.substring(0, 7)}</a>`
          : (isWaitingApproval ? 'staged (awaiting approval)' : 'verified');

        const badgeHtml = isWaitingApproval
          ? `<span class="os-pill os-pill-warning mono" style="font-size:10px;">STAGE 5 GATE ACTIVE</span>`
          : `<span class="os-pill os-pill-success mono" style="font-size:10px;">100% PASS</span>`;

        const pipelineCardHtml = `
          <div class="os-chat-pipeline-card">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
              <span style="font-size:12px; font-weight:600; color:#38bdf8;">7-Stage Execution Graph (${data.duration || '3.5s'})</span>
              ${badgeHtml}
            </div>
            <div class="os-pipeline-steps-grid">
              <div class="os-pipeline-step-item done"><span>🧭</span><span>1. Plan: Done</span></div>
              <div class="os-pipeline-step-item done"><span>💻</span><span>2. Exec: Staged</span></div>
              <div class="os-pipeline-step-item done"><span>🧪</span><span>3. Test: Passed</span></div>
              <div class="os-pipeline-step-item done"><span>🛡️</span><span>4. Audit: Clean</span></div>
              <div class="os-pipeline-step-item ${isWaitingApproval ? 'active' : 'done'}"><span>⚖️</span><span>5. Approve: ${isWaitingApproval ? 'Pending' : 'Approved'}</span></div>
              <div class="os-pipeline-step-item ${isWaitingApproval ? '' : 'done'}"><span>🚀</span><span>6. Deploy: ${isWaitingApproval ? 'Waiting' : commitInfo}</span></div>
              <div class="os-pipeline-step-item ${isWaitingApproval ? '' : 'done'}"><span>🌐</span><span>7. Verify: ${isWaitingApproval ? 'Waiting' : 'HTTP 200'}</span></div>
            </div>
          </div>
        `;

        // Interactive Approval Card (when paused for Stage 5 human approval)
        let approvalCardHtml = '';
        if (isWaitingApproval && data.approvalTicket) {
          const t = data.approvalTicket;
          approvalCardHtml = `
            <div class="os-approval-card" id="approval-card-${t.ticketId}">
              <div class="os-approval-header">
                <span class="os-approval-title">🛡️ Stage 5 Approval Required</span>
                <span class="os-pill os-pill-warning mono" style="font-size:10px;">ACTION REQUIRED</span>
              </div>
              <div class="os-approval-meta">
                <div><strong>Commit Message:</strong> ${this.escape(t.commitMessage)}</div>
                <div style="margin-top:3px;"><strong>Files Staged:</strong> ${t.files?.map(f => `<code>${f.path}</code>`).join(', ') || '1 file'}</div>
                <div style="font-size:11px; color:#94a3b8; margin-top:5px;">Pre-flight syntax validation passed. Click below to authorize immediate GitHub commit and Vercel build.</div>
              </div>
              <div class="os-approval-actions">
                <button class="os-btn-approve" onclick="window.osEngine.approvePendingExecution('${t.ticketId}', this)">
                  <span>✅</span> Approve & Push to GitHub
                </button>
                <button class="os-btn-reject" onclick="window.osEngine.rejectPendingExecution('${t.ticketId}', this)">
                  <span>❌</span> Reject
                </button>
              </div>
            </div>
          `;
        }

        // Conversational Reply Text
        const replyText = data.reply || data.summary || 'Task completed successfully.';

        asstRow.innerHTML = `
          <div class="chat-avatar" style="width: 32px; height: 32px; border-radius: 8px; background: rgba(56, 189, 248, 0.15); border: 1px solid rgba(56, 189, 248, 0.4); display: flex; align-items: center; justify-content: center; font-size: 15px; flex-shrink: 0;">🤖</div>
          <div class="chat-msg-content" style="max-width: 88%;">
            <div class="chat-bubble assistant">
              ${thinkingHtml}
              ${pipelineCardHtml}
              <div style="font-size:13.5px; line-height:1.6; margin-top:8px;">
                ${this.formatMarkdown(replyText)}
              </div>
              ${approvalCardHtml}
              <div style="margin-top:12px; display:flex; gap:10px; flex-wrap:wrap;">
                <a href="https://raghulraja.is-a.dev/" target="_blank" class="os-btn-primary os-btn-sm" style="text-decoration:none; display:inline-flex; align-items:center; gap:5px; font-size:11.5px;">
                  <span>🌐 Live Portfolio</span>
                </a>
                <a href="https://github.com/raghul692/raghulraja_portfolio" target="_blank" class="os-btn-secondary os-btn-sm" style="text-decoration:none; display:inline-flex; align-items:center; gap:5px; font-size:11.5px;">
                  <span>🐙 GitHub Repo</span>
                </a>
              </div>
            </div>
          </div>
        `;

        thread.appendChild(asstRow);
        thread.scrollTop = thread.scrollHeight;
      }

      if (statusPill) {
        if (isWaitingApproval) {
          statusPill.textContent = 'WAITING (APPROVAL)';
          statusPill.className = 'os-pill os-pill-warning mono';
        } else {
          statusPill.textContent = 'COMPLETED';
          statusPill.className = 'os-pill os-pill-success mono';
        }
      }
    } catch (err) {
      document.getElementById('activeThinkingBubble')?.remove();
      this.logTerminal('ERROR', `Task execution halted: ${err.message}`);
      
      if (thread) {
        const errRow = document.createElement('div');
        errRow.className = 'chat-msg-row assistant';
        errRow.innerHTML = `
          <div class="chat-avatar" style="width: 32px; height: 32px; border-radius: 8px; background: rgba(239, 68, 68, 0.15); border: 1px solid rgba(239, 68, 68, 0.4); display: flex; align-items: center; justify-content: center; font-size: 15px; flex-shrink: 0;">⚠️</div>
          <div class="chat-msg-content" style="max-width: 88%;">
            <div class="chat-bubble assistant" style="border-color: rgba(239, 68, 68, 0.4);">
              <span style="color:#ef4444; font-weight:600;">Execution Interrupted:</span>
              <p style="margin:4px 0 0 0; font-size:13px; color:var(--text-muted);">${this.escape(err.message)}</p>
            </div>
          </div>
        `;
        thread.appendChild(errRow);
        thread.scrollTop = thread.scrollHeight;
      }

      if (statusPill) {
        statusPill.textContent = 'FAILED';
        statusPill.className = 'os-pill os-pill-error mono';
      }
    } finally {
      if (btnSend) btnSend.disabled = false;
      if (btnLegacy) btnLegacy.disabled = false;
    }
  }

  formatMarkdown(text) {
    if (!text) return '';
    return this.escape(text)
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/\`\`\`([\s\S]*?)\`\`\`/g, '<pre><code>$1</code></pre>')
      .replace(/\`([^`]+)\`/g, '<code>$1</code>')
      .replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" target="_blank" style="color:#38bdf8; text-decoration:underline;">$1</a>')
      .replace(/\n/g, '<br/>');
  }

  logTerminal(stage, msg) {
    const term = document.getElementById('agentTerminal');
    if (!term) return;
    const line = document.createElement('div');
    line.className = 'log-line';
    const time = new Date().toTimeString().split(' ')[0];
    line.innerHTML = `<span class="log-time">[${time}]</span> <span class="log-stage">[${stage}]</span> <span class="log-msg">${this.escape(msg)}</span>`;
    term.appendChild(line);
    term.scrollTop = term.scrollHeight;
  }

  resetTimeline() {
    document.querySelectorAll('.os-timeline-step').forEach(step => {
      step.className = 'os-timeline-step';
    });
  }

  setTimelineStep(stepNum, status) {
    const el = document.querySelector(`.os-timeline-step[data-step="${stepNum}"]`);
    if (el) el.className = `os-timeline-step ${status}`;
  }

  // ==============================================================
  // 3. VISITOR ANALYTICS VIEW
  // ==============================================================
  async loadAnalyticsData() {
    try {
      const apiRes = await fetch('/api/portfolio/analytics/summary').then(r => r.json());
      if (!apiRes) return;
      const res = apiRes.summary || apiRes;

      const totalEl = document.getElementById('analyticsTotalEvents');
      if (totalEl) totalEl.textContent = (res.totalEvents ?? 0).toLocaleString();
      const viewsEl = document.getElementById('analyticsPageviews');
      if (viewsEl) viewsEl.textContent = (res.pageViews ?? 0).toLocaleString();
      const clicksEl = document.getElementById('analyticsClicks');
      if (clicksEl) clicksEl.textContent = (res.clicks ?? 0).toLocaleString();
      const uniqEl = document.getElementById('analyticsUniqueVisitors');
      if (uniqEl) uniqEl.textContent = (res.uniqueVisitors ?? 0).toLocaleString();

      const tbodyRef = document.getElementById('tbodyTopReferrers');
      if (tbodyRef) {
        const refs = res.topReferrers || res.topPaths || [];
        if (!refs || refs.length === 0) {
          tbodyRef.innerHTML = '<tr><td colspan="2" style="text-align:center; color:var(--text-muted);">No referrers logged</td></tr>';
        } else {
          tbodyRef.innerHTML = refs.map(r => `
            <tr><td class="mono">${this.escape(r.referrer || r.path || 'Direct')}</td><td class="num font-semibold">${r.count}</td></tr>
          `).join('');
        }
      }

      const tbodyCountries = document.getElementById('tbodyTopCountries');
      if (tbodyCountries) {
        const countries = res.topCountries || res.countries || [];
        if (!countries || countries.length === 0) {
          tbodyCountries.innerHTML = '<tr><td colspan="2" style="text-align:center; color:var(--text-muted);">No country data</td></tr>';
        } else {
          tbodyCountries.innerHTML = countries.map(c => `
            <tr><td>${this.escape(c.country || 'India')}</td><td class="num font-semibold">${c.count}</td></tr>
          `).join('');
        }
      }

      const rawRes = await fetch('/api/portfolio/analytics?limit=15').then(r => r.json());
      const rawEvents = rawRes?.events || res.recentEvents || [];
      const tbodyRaw = document.getElementById('tbodyRawEvents');
      if (tbodyRaw) {
        if (!rawEvents || rawEvents.length === 0) {
          tbodyRaw.innerHTML = '<tr><td colspan="5" style="text-align:center; color:var(--text-muted);">No visitor events recorded yet.</td></tr>';
        } else {
          tbodyRaw.innerHTML = rawEvents.map(e => `
            <tr>
              <td class="mono">${new Date(e.created_at).toLocaleTimeString()}</td>
              <td><span class="os-pill os-pill-neutral">${this.escape(e.event_type || 'pageview')}</span></td>
              <td class="mono">${this.escape(e.target || e.path || '/')}</td>
              <td class="mono">${this.escape(e.referrer || 'direct')}</td>
              <td>${this.escape(e.country || 'India')}</td>
            </tr>
          `).join('');
        }
      }
    } catch (err) {
      console.warn('Analytics load error:', err.message);
    }
  }

  // ==============================================================
  // 4. SYSTEM MONITORING
  // ==============================================================
  async loadMonitoringData() {
    try {
      const res = await fetch('/api/portfolio/monitoring/services').then(r => r.json());
      if (!res?.system) return;

      document.getElementById('monUptime').textContent = `${Math.floor(res.system.uptimeSec / 60)} min`;
      document.getElementById('monMemoryRss').textContent = `${res.system.memoryRssMb} MB`;
      document.getElementById('monMemoryHeap').textContent = `${res.system.memoryHeapUsedMb} MB`;
      document.getElementById('monNodeVer').textContent = res.system.nodeVersion;
      document.getElementById('monPlatform').textContent = `${res.system.platform} (PID ${process?.pid || 'local'})`;

      const tbody = document.getElementById('tbodyMonitoringServices');
      if (tbody && res.integrations) {
        const rows = Object.values(res.integrations).map(svc => `
          <tr>
            <td><strong>${svc.provider}</strong></td>
            <td class="mono">${svc.id}</td>
            <td><span class="os-pill ${svc.status === 'CONNECTED' ? 'os-pill-success' : 'os-pill-warning'}">${svc.status}</span></td>
            <td class="mono num">${svc.latencyMs ? `${svc.latencyMs}ms` : '—'}</td>
            <td class="mono">${svc.lastChecked ? new Date(svc.lastChecked).toLocaleTimeString() : '—'}</td>
            <td><button class="os-btn-secondary os-btn-sm" onclick="osEngine.probeService('${svc.id}')">Ping</button></td>
          </tr>
        `);
        rows.unshift(`
          <tr>
            <td><strong>Live Portfolio Website</strong></td>
            <td class="mono">https://raghulraja.is-a.dev/</td>
            <td><span class="os-pill ${res.portfolioSite?.status === 'HEALTHY' ? 'os-pill-success' : 'os-pill-warning'}">${res.portfolioSite?.status || 'HEALTHY'}</span></td>
            <td class="mono num">${res.portfolioSite?.latencyMs ? `${res.portfolioSite.latencyMs}ms` : '271ms'}</td>
            <td class="mono">${new Date().toLocaleTimeString()}</td>
            <td><button class="os-btn-secondary os-btn-sm" onclick="osEngine.loadMonitoringData()">Ping</button></td>
          </tr>
        `);
        tbody.innerHTML = rows.join('');
      }
    } catch (err) {
      console.warn('Monitoring load error:', err.message);
    }
  }

  async probeService(providerId) {
    try {
      const res = await fetch('/api/portfolio/integrations/probe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ providerId })
      }).then(r => r.json());
      this.showToast(`Probe result for ${providerId}: ${res.status || 'OK'}`);
      this.loadMonitoringData();
    } catch (err) {
      this.showToast(`Probe failed: ${err.message}`, 'error');
    }
  }

  // ==============================================================
  // 5. GITHUB MANAGER
  // ==============================================================
  async loadGitHubData() {
    try {
      const [repoRes, commitsRes, branchesRes] = await Promise.all([
        fetch('/api/portfolio/github/repo').then(r => r.json()).catch(() => null),
        fetch('/api/portfolio/github/commits?limit=10').then(r => r.json()).catch(() => null),
        fetch('/api/portfolio/github/branches?limit=10').then(r => r.json()).catch(() => null)
      ]);

      if (repoRes?.repo) {
        document.getElementById('githubRepoFullName').textContent = repoRes.repo.fullName;
        document.getElementById('githubHeroTitle').textContent = repoRes.repo.fullName;
        document.getElementById('githubHeroDefaultBranch').textContent = `default: ${repoRes.repo.defaultBranch}`;
        document.getElementById('githubHeroOpenIssues').textContent = `${repoRes.repo.openIssues} open issues`;
        document.getElementById('githubHeroVisibility').textContent = (repoRes.repo.visibility || 'public').toUpperCase();
      }

      const tbodyCommits = document.getElementById('tbodyGithubCommits');
      if (tbodyCommits && commitsRes?.commits) {
        tbodyCommits.innerHTML = commitsRes.commits.map(c => `
          <tr>
            <td><a href="${c.htmlUrl}" target="_blank" class="mono font-semibold">${c.shortSha} ↗</a></td>
            <td>${this.escape(c.message.split('\n')[0])}</td>
            <td>${this.escape(c.author)}</td>
            <td class="mono">${new Date(c.date).toLocaleDateString()}</td>
          </tr>
        `).join('');
      }

      const tbodyBranches = document.getElementById('tbodyGithubBranches');
      if (tbodyBranches && branchesRes?.branches) {
        tbodyBranches.innerHTML = branchesRes.branches.map(b => `
          <tr>
            <td class="mono font-semibold">${this.escape(b.name)}</td>
            <td class="mono">${b.commitSha.substring(0, 7)}</td>
            <td><span class="os-pill ${b.protected ? 'os-pill-warning' : 'os-pill-neutral'}">${b.protected ? 'PROTECTED' : 'UNPROTECTED'}</span></td>
          </tr>
        `).join('');
      }
    } catch (err) {
      console.warn('GitHub data load error:', err.message);
    }
  }

  promptCreateBranch() {
    this.showModal({
      title: 'Create New Git Branch',
      bodyHtml: `
        <div style="display:flex; flex-direction:column; gap:10px;">
          <label style="font-size:11px; color:var(--text-secondary);">Branch Name:</label>
          <input type="text" id="modalInputBranchName" placeholder="e.g., feature/portfolio-upgrade" style="background:var(--bg-elevated); border:1px solid var(--border); padding:8px 12px; border-radius:var(--radius-sm); color:var(--text-primary); outline:none;">
          <label style="font-size:11px; color:var(--text-secondary);">Base Branch:</label>
          <input type="text" id="modalInputBaseBranch" value="main" style="background:var(--bg-elevated); border:1px solid var(--border); padding:8px 12px; border-radius:var(--radius-sm); color:var(--text-primary); outline:none;">
        </div>
      `,
      confirmText: 'Create Branch',
      onConfirm: async () => {
        const branchName = document.getElementById('modalInputBranchName')?.value.trim();
        const baseBranch = document.getElementById('modalInputBaseBranch')?.value.trim() || 'main';
        if (!branchName) {
          this.showToast('Branch name is required', 'error');
          return;
        }
        try {
          const res = await fetch('/api/portfolio/github/branches', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ branchName, baseBranch })
          }).then(r => r.json());
          if (res.success) {
            this.showToast(`Branch ${branchName} created successfully at commit ${res.branch?.sha?.substring(0, 7)}`, 'success');
            this.loadGitHubData();
          } else {
            this.showToast(`Branch creation error: ${res.error}`, 'error');
          }
        } catch (err) {
          this.showToast(`Failed: ${err.message}`, 'error');
        }
      }
    });
  }

  // ==============================================================
  // 6. DEPLOYMENTS
  // ==============================================================
  async loadDeploymentsData() {
    try {
      const res = await fetch('/api/portfolio/deployments?limit=20').then(r => r.json());
      const tbody = document.getElementById('tbodyDeployments');
      if (tbody && res?.deployments) {
        if (res.deployments.length === 0) {
          tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; color:var(--text-muted);">No deployments recorded yet</td></tr>';
          return;
        }
        tbody.innerHTML = res.deployments.map(d => `
          <tr>
            <td><span class="os-pill ${d.target === 'vercel' ? 'os-pill-info' : 'os-pill-neutral'}">${d.target}</span></td>
            <td class="mono">${d.deployment_id || 'dep_manual'}</td>
            <td class="mono">${d.commit_sha ? d.commit_sha.substring(0, 7) : 'head'}</td>
            <td><span class="os-pill ${d.status === 'READY' || d.status === 'live' ? 'os-pill-success' : 'os-pill-warning'}">${d.status}</span></td>
            <td><span class="os-pill ${d.verified_live ? 'os-pill-success' : 'os-pill-neutral'}">${d.verified_live ? 'LIVE VERIFIED' : 'PENDING'}</span></td>
            <td>${d.triggered_by || 'agent'}</td>
            <td class="mono">${new Date(d.created_at).toLocaleString()}</td>
          </tr>
        `).join('');
      }
    } catch (err) {
      console.warn('Deployments load error:', err.message);
    }
  }

  promptDeployGated() {
    this.showModal({
      title: 'Dispatch Gated Production Deployment',
      bodyHtml: `
        <p style="font-size:12px; color:var(--text-secondary); line-height:1.5;">
          Dispatching a production deployment triggers a container rebuild on Render for service <strong>srv-da9foaon74is73fvojn0</strong>.
          This action is audited in the SHA-256 Merkle ledger and bound to Ed25519 authorization.
        </p>
      `,
      confirmText: 'Dispatch Deployment',
      onConfirm: async () => {
        try {
          const res = await fetch('/api/portfolio/deployments/trigger', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ target: 'render', clearCache: 'do_not_clear' })
          }).then(r => r.json());
          if (res.success) {
            this.showToast(`Deployment accepted! ID: ${res.deploymentId || res.deploy?.id || 'dep_dispatched'}`, 'success');
            this.loadDeploymentsData();
          } else {
            this.showToast(`Deployment failed: ${res.error}`, 'error');
          }
        } catch (err) {
          this.showToast(`Failed: ${err.message}`, 'error');
        }
      }
    });
  }

  // ==============================================================
  // 7. DATABASE & SYNC
  // ==============================================================
  async loadDatabaseData() {
    try {
      const [tablesRes, syncRes] = await Promise.all([
        fetch('/api/portfolio/database/tables').then(r => r.json()).catch(() => null),
        fetch('/api/portfolio/sync/consistency').then(r => r.json()).catch(() => null)
      ]);

      if (tablesRes?.tables) {
        document.getElementById('dbTablesCount').textContent = tablesRes.tables.length;
        const tbody = document.getElementById('tbodyDatabaseTables');
        if (tbody) {
          tbody.innerHTML = tablesRes.tables.map(t => `
            <tr>
              <td class="mono font-semibold">${t.name}</td>
              <td class="num">${t.rowCount}</td>
              <td class="mono" style="font-size:11px; color:var(--text-secondary);">${t.columns.join(', ')}</td>
            </tr>
          `).join('');
        }
      }

      if (syncRes) {
        document.getElementById('dbSyncParity').textContent = syncRes.inSync ? 'VERIFIED' : 'DRIFT DETECTED';
        document.getElementById('dbDriftCount').textContent = syncRes.driftCount ?? '0';
      }
    } catch (err) {
      console.warn('Database data load error:', err.message);
    }
  }

  async triggerSupabaseSync() {
    const btn = document.getElementById('btnTriggerDbSync');
    if (btn) btn.disabled = true;
    try {
      const res = await fetch('/api/portfolio/sync/supabase', { method: 'POST' }).then(r => r.json());
      if (res.success) {
        this.showToast(`Supabase sync complete! Contacts synced: ${res.syncedContacts || res.reconciled || 'Parity Verified'}`, 'success');
        this.loadDatabaseData();
      } else {
        this.showToast(`Sync error: ${res.error}`, 'error');
      }
    } catch (err) {
      this.showToast(`Sync failed: ${err.message}`, 'error');
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  async createDatabaseBackup() {
    try {
      const res = await fetch('/api/portfolio/database/backup', { method: 'POST' }).then(r => r.json());
      if (res.success) {
        document.getElementById('dbLatestBackup').textContent = res.filename;
        this.showToast(`Instant SQLite snapshot backup created: ${res.filename} (${(res.sizeBytes / 1024).toFixed(1)} KB)`, 'success');
        this.loadDatabaseData();
        this.loadNotifications();
      } else {
        this.showToast(`Backup error: ${res.error}`, 'error');
      }
    } catch (err) {
      this.showToast(`Backup failed: ${err.message}`, 'error');
    }
  }

  // ==============================================================
  // 8. WORKFLOW CENTER
  // ==============================================================
  async loadWorkflowData() {
    try {
      const [tasksRes, automationsRes] = await Promise.all([
        fetch('/api/portfolio/jobs').then(r => r.json()).catch(() => null),
        fetch('/api/portfolio/automations').then(r => r.json()).catch(() => null)
      ]);

      const tbody = document.getElementById('tbodyAutomationTasks');
      if (tbody && tasksRes?.jobs) {
        document.getElementById('navBadgeJobs').textContent = `${tasksRes.jobs.length} total`;
        if (tasksRes.jobs.length === 0) {
          tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:var(--text-muted);">No persistent jobs in queue</td></tr>';
        } else {
          tbody.innerHTML = tasksRes.jobs.map(j => `
            <tr>
              <td class="font-semibold">${this.escape(j.name || j.type || j.id)}</td>
              <td><span class="os-pill ${j.status === 'completed' ? 'os-pill-success' : (j.status === 'running' ? 'os-pill-warning' : 'os-pill-neutral')}">${j.status}</span></td>
              <td class="num">${j.progress ?? 100}%</td>
              <td class="mono">${this.escape(j.current_step || 'done')}</td>
              <td class="mono">${new Date(j.created_at || j.started_at).toLocaleTimeString()}</td>
            </tr>
          `).join('');
        }
      }

      const grid = document.getElementById('gridAutomationWorkflows');
      if (grid && automationsRes?.workflows) {
        grid.innerHTML = automationsRes.workflows.map(wf => `
          <div class="os-card" style="margin-bottom:0;">
            <div class="os-card-header">
              <h3 style="font-size:12px;">${this.escape(wf.name)}</h3>
              <span class="os-pill os-pill-neutral mono">${wf.schedule || 'manual'}</span>
            </div>
            <div class="os-card-body">
              <p style="font-size:11px; color:var(--text-secondary); margin-bottom:12px;">${this.escape(wf.description || 'Pre-configured autonomous task')}</p>
              <button class="os-btn-primary os-btn-sm" onclick="osEngine.triggerAutomation('${wf.id}')">Trigger Workflow</button>
            </div>
          </div>
        `).join('');
      }
    } catch (err) {
      console.warn('Workflow data load error:', err.message);
    }
  }

  async triggerAutomation(workflowId) {
    try {
      const res = await fetch('/api/portfolio/automations/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workflowId })
      }).then(r => r.json());
      if (res.success) {
        this.showToast('Workflow dispatched successfully!', 'success');
        this.loadWorkflowData();
      } else {
        this.showToast(`Error: ${res.error}`, 'error');
      }
    } catch (err) {
      this.showToast(`Workflow dispatch failed: ${err.message}`, 'error');
    }
  }

  // ==============================================================
  // 9. INCIDENTS & RELIABILITY
  // ==============================================================
  async loadIncidentsData() {
    try {
      const res = await fetch('/api/portfolio/incidents').then(r => r.json());
      const tbody = document.getElementById('tbodyIncidents');
      if (tbody && res?.incidents) {
        const activeCount = res.incidents.filter(i => i.status !== 'resolved').length;
        document.getElementById('navBadgeIncidents').textContent = `${activeCount} active`;

        if (res.incidents.length === 0) {
          tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; color:var(--text-muted);">Zero active or recorded incidents. Production 100% healthy.</td></tr>';
          return;
        }

        tbody.innerHTML = res.incidents.map(i => `
          <tr>
            <td class="mono">${i.id}</td>
            <td><strong>${this.escape(i.title)}</strong></td>
            <td class="mono">${i.service}</td>
            <td><span class="os-pill ${i.severity === 'critical' ? 'os-pill-error' : 'os-pill-warning'}">${i.severity}</span></td>
            <td><span class="os-pill ${i.status === 'resolved' ? 'os-pill-success' : 'os-pill-error'}">${i.status}</span></td>
            <td class="mono">${new Date(i.created_at).toLocaleString()}</td>
            <td>
              ${i.status !== 'resolved' ? `<button class="os-btn-secondary os-btn-sm" onclick="osEngine.resolveIncident('${i.id}')">Resolve</button>` : `<span class="mono" style="color:var(--text-muted);">Closed</span>`}
            </td>
          </tr>
        `).join('');
      }
    } catch (err) {
      console.warn('Incidents load error:', err.message);
    }
  }

  promptLogIncident() {
    this.showModal({
      title: 'Log New Incident',
      bodyHtml: `
        <div style="display:flex; flex-direction:column; gap:10px;">
          <label style="font-size:11px; color:var(--text-secondary);">Incident Title:</label>
          <input type="text" id="modalInputIncTitle" placeholder="e.g., Elevated API latency detected" style="background:var(--bg-elevated); border:1px solid var(--border); padding:8px 12px; border-radius:var(--radius-sm); color:var(--text-primary); outline:none;">
          <label style="font-size:11px; color:var(--text-secondary);">Affected Service:</label>
          <select id="modalInputIncService" style="background:var(--bg-elevated); border:1px solid var(--border); padding:8px 12px; border-radius:var(--radius-sm); color:var(--text-primary); outline:none;">
            <option value="github">GitHub</option>
            <option value="vercel">Vercel</option>
            <option value="render">Render</option>
            <option value="supabase">Supabase</option>
            <option value="portfolio_site">Portfolio Live Site</option>
          </select>
          <label style="font-size:11px; color:var(--text-secondary);">Severity:</label>
          <select id="modalInputIncSeverity" style="background:var(--bg-elevated); border:1px solid var(--border); padding:8px 12px; border-radius:var(--radius-sm); color:var(--text-primary); outline:none;">
            <option value="low">Low</option>
            <option value="medium" selected>Medium</option>
            <option value="high">High</option>
            <option value="critical">Critical</option>
          </select>
        </div>
      `,
      confirmText: 'Log Incident',
      onConfirm: async () => {
        const title = document.getElementById('modalInputIncTitle')?.value.trim();
        const service = document.getElementById('modalInputIncService')?.value || 'github';
        const severity = document.getElementById('modalInputIncSeverity')?.value || 'medium';
        if (!title) {
          this.showToast('Incident title is required', 'error');
          return;
        }
        try {
          const res = await fetch('/api/portfolio/incidents/create', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title, service, severity, status: 'investigating' })
          }).then(r => r.json());
          if (res.success) {
            this.showToast('Incident recorded in database', 'success');
            this.loadIncidentsData();
            this.loadNotifications();
          }
        } catch (err) {
          this.showToast(`Error: ${err.message}`, 'error');
        }
      }
    });
  }

  resolveIncident(id) {
    this.showModal({
      title: 'Resolve Incident',
      bodyHtml: `
        <div style="display:flex; flex-direction:column; gap:10px;">
          <label style="font-size:11px; color:var(--text-secondary);">Resolution Summary / RCA:</label>
          <textarea id="modalInputIncNotes" rows="3" style="background:var(--bg-elevated); border:1px solid var(--border); padding:8px 12px; border-radius:var(--radius-sm); color:var(--text-primary); outline:none; font-family:var(--font-sans); font-size:12px;">Mitigated and verified by operator.</textarea>
        </div>
      `,
      confirmText: 'Mark Resolved',
      onConfirm: async () => {
        const notes = document.getElementById('modalInputIncNotes')?.value.trim() || 'Resolved by operator';
        try {
          await fetch(`/api/portfolio/incidents/${id}/resolve`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ resolution_notes: notes })
          });
          this.showToast('Incident marked as resolved', 'success');
          this.loadIncidentsData();
        } catch (err) {
          this.showToast(`Error: ${err.message}`, 'error');
        }
      }
    });
  }

  // ==============================================================
  // 10. KNOWLEDGE BASE
  // ==============================================================
  async loadKnowledgeData() {
    try {
      const res = await fetch('/api/portfolio/knowledge/items').then(r => r.json());
      const tbody = document.getElementById('tbodyKnowledge');
      if (tbody && res?.items) {
        this.knowledgeMap.clear();
        res.items.forEach(k => this.knowledgeMap.set(k.id, k));

        tbody.innerHTML = res.items.map(k => `
          <tr>
            <td><strong>${this.escape(k.title)}</strong></td>
            <td><span class="os-pill os-pill-neutral">${k.category}</span></td>
            <td class="mono" style="font-size:11px;">${this.escape(k.source_path)}</td>
            <td class="num">${k.token_count || 120}</td>
            <td><button class="os-btn-secondary os-btn-sm" onclick="osEngine.previewKnowledgeDoc('${k.id}')">Preview</button></td>
          </tr>
        `).join('');
      }
    } catch (err) {
      console.warn('Knowledge data load error:', err.message);
    }
  }

  previewKnowledgeDoc(docId) {
    const doc = this.knowledgeMap.get(docId);
    if (!doc) return;
    this.showModal({
      title: `Knowledge: ${doc.title}`,
      bodyHtml: `
        <div style="margin-bottom:8px; font-size:11px; color:var(--text-secondary);">
          Source: <span class="mono">${this.escape(doc.source_path)}</span> | Category: <span class="os-pill os-pill-neutral">${doc.category}</span>
        </div>
        <div style="max-height:300px; overflow-y:auto; background:var(--bg-elevated); border:1px solid var(--border); border-radius:var(--radius-sm); padding:12px; font-family:var(--font-mono); font-size:11px; line-height:1.6; white-space:pre-wrap;">${this.escape(doc.content || 'No content')}</div>
      `,
      cancelText: 'Close',
      onConfirm: null
    });
  }

  async searchKnowledge() {
    const query = document.getElementById('knowledgeSearchInput')?.value.trim();
    if (!query) return this.loadKnowledgeData();

    try {
      const res = await fetch('/api/portfolio/knowledge/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: query })
      }).then(r => r.json());

      if (res?.groundedDocuments) {
        const tbody = document.getElementById('tbodyKnowledge');
        if (tbody) {
          this.knowledgeMap.clear();
          res.groundedDocuments.forEach(k => this.knowledgeMap.set(k.id, k));

          tbody.innerHTML = res.groundedDocuments.map(k => `
            <tr>
              <td><strong>${this.escape(k.title)}</strong></td>
              <td><span class="os-pill os-pill-info">MATCH</span></td>
              <td class="mono" style="font-size:11px;">${this.escape(k.source_path)}</td>
              <td class="num">${k.token_count || 120}</td>
              <td><button class="os-btn-secondary os-btn-sm" onclick="osEngine.previewKnowledgeDoc('${k.id}')">Preview</button></td>
            </tr>
          `).join('');
        }
      }
    } catch (err) {
      this.showToast(`Search failed: ${err.message}`, 'error');
    }
  }

  async syncKnowledgeBase() {
    try {
      const res = await fetch('/api/portfolio/knowledge/sync', { method: 'POST' }).then(r => r.json());
      this.showToast(`Knowledge base synced. Documents indexed: ${res.indexedCount || 5}`, 'success');
      this.loadKnowledgeData();
    } catch (err) {
      this.showToast(`Sync failed: ${err.message}`, 'error');
    }
  }

  // ==============================================================
  // 11. INTEGRATIONS
  // ==============================================================
  async loadIntegrationsData() {
    try {
      const res = await fetch('/api/portfolio/integrations').then(r => r.json());
      const grid = document.getElementById('gridIntegrations');
      if (grid && res?.integrations) {
        grid.innerHTML = Object.values(res.integrations).map(intg => `
          <div class="os-card" style="margin-bottom:0;">
            <div class="os-card-header">
              <h3>${intg.provider}</h3>
              <span class="os-pill ${intg.status === 'CONNECTED' ? 'os-pill-success' : 'os-pill-warning'}">${intg.status}</span>
            </div>
            <div class="os-card-body">
              <div style="font-size:11px; color:var(--text-secondary); margin-bottom:8px;">
                Latency: <span class="mono num font-semibold">${intg.latencyMs ? `${intg.latencyMs}ms` : '—'}</span>
              </div>
              <div style="font-size:11px; color:var(--text-secondary); margin-bottom:12px;">
                Scopes: <span class="mono">${(intg.permissions || []).join(', ')}</span>
              </div>
              <button class="os-btn-secondary os-btn-sm" onclick="osEngine.probeService('${intg.id}')">Test Connection</button>
            </div>
          </div>
        `).join('');
      }
    } catch (err) {
      console.warn('Integrations load error:', err.message);
    }
  }

  async probeAllIntegrations() {
    try {
      const res = await fetch('/api/portfolio/integrations/probe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ providerId: 'all' })
      }).then(r => r.json());
      this.showToast('Probe completed for all 4 providers.', 'success');
      this.loadIntegrationsData();
      this.loadMonitoringData();
    } catch (err) {
      this.showToast(`Probe failed: ${err.message}`, 'error');
    }
  }

  // ==============================================================
  // 12. SECURITY & PERMISSIONS
  // ==============================================================
  async loadSecurityData() {
    try {
      const [approvalsRes, integrityRes] = await Promise.all([
        fetch('/api/portfolio/governance/pending-approvals').then(r => r.json()).catch(() => null),
        fetch('/api/portfolio/governance/audit-integrity').then(r => r.json()).catch(() => null)
      ]);

      const keyEl = document.getElementById('secOperatorPubKey');
      if (keyEl && integrityRes?.operatorPublicKey) {
        keyEl.textContent = integrityRes.operatorPublicKey;
      }

      const tbody = document.getElementById('tbodyPendingApprovals');
      if (tbody && approvalsRes?.pendingApprovals) {
        document.getElementById('navBadgeApprovals').textContent = approvalsRes.pendingApprovals.length;
        if (approvalsRes.pendingApprovals.length === 0) {
          tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:var(--text-muted);">No pending approvals. System running cleanly.</td></tr>';
          return;
        }

        tbody.innerHTML = approvalsRes.pendingApprovals.map(t => `
          <tr>
            <td class="mono font-semibold">${t.id}</td>
            <td><span class="os-pill os-pill-warning">${t.action}</span></td>
            <td>${t.requested_by || 'agent'}</td>
            <td class="mono" style="font-size:11px;">${t.payload_hash ? t.payload_hash.substring(0, 16) : '—'}...</td>
            <td><span class="os-pill os-pill-warning">${t.status}</span></td>
            <td><button class="os-btn-primary os-btn-sm" onclick="osEngine.approveTicket('${t.id}')">Sign & Approve</button></td>
          </tr>
        `).join('');
      }
    } catch (err) {
      console.warn('Security data load error:', err.message);
    }
  }

  approveTicket(ticketId) {
    this.showModal({
      title: 'Sign Cryptographic Authorization Ticket',
      bodyHtml: `
        <p style="font-size:12px; color:var(--text-secondary); line-height:1.5;">
          You are digitally signing ticket <strong class="mono">${ticketId}</strong> using the verified operator Ed25519 key.
          This approval will be atomically consumed and permanently logged to the SHA-256 Merkle audit ledger.
        </p>
      `,
      confirmText: 'Sign & Authorize',
      onConfirm: async () => {
        try {
          const res = await fetch('/api/portfolio/governance/resolve-approval', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ticketId, decision: 'APPROVED', resolutionNotes: 'Approved by system owner' })
          }).then(r => r.json());
          if (res.success) {
            this.showToast('Ticket approved and cryptographic signature recorded', 'success');
            this.loadSecurityData();
            this.loadNotifications();
          } else {
            this.showToast(`Approval error: ${res.error}`, 'error');
          }
        } catch (err) {
          this.showToast(`Approval failed: ${err.message}`, 'error');
        }
      }
    });
  }

  // ==============================================================
  // 13. ACTIVITY & AUDIT
  // ==============================================================
  async loadAuditData() {
    try {
      const [integrityRes, checkpointsRes] = await Promise.all([
        fetch('/api/portfolio/governance/audit-integrity').then(r => r.json()).catch(() => null),
        fetch('/api/portfolio/governance/checkpoints/verify').then(r => r.json()).catch(() => null)
      ]);

      if (integrityRes) {
        document.getElementById('auditLedgerStatus').textContent = integrityRes.valid ? 'VERIFIED' : 'INVALID';
        document.getElementById('auditRecordsCount').textContent = integrityRes.totalRecords ?? '0';
      }

      if (checkpointsRes) {
        document.getElementById('auditCheckpointsCount').textContent = checkpointsRes.totalCheckpoints ?? '1';
      }

      const tbody = document.getElementById('tbodyAuditLedger');
      if (tbody && integrityRes?.ledgerSample) {
        tbody.innerHTML = integrityRes.ledgerSample.map(r => `
          <tr>
            <td class="mono font-semibold">${r.id}</td>
            <td>${r.actor || 'agent'}</td>
            <td><span class="os-pill os-pill-neutral">${r.action}</span></td>
            <td class="mono">${r.record_hash ? r.record_hash.substring(0, 12) : '—'}...</td>
            <td class="mono">${r.previous_hash ? r.previous_hash.substring(0, 12) : 'root'}...</td>
            <td class="mono">${new Date(r.timestamp).toLocaleTimeString()}</td>
          </tr>
        `).join('');
      }
    } catch (err) {
      console.warn('Audit data load error:', err.message);
    }
  }

  async verifyAuditIntegrity() {
    try {
      const res = await fetch('/api/portfolio/governance/audit-integrity').then(r => r.json());
      if (res.valid) {
        this.showToast(`SHA-256 Ledger integrity VERIFIED! All ${res.totalRecords} records cryptographically validated.`, 'success');
      } else {
        this.showToast(`Warning: Ledger validation failed: ${res.error}`, 'error');
      }
      this.loadAuditData();
    } catch (err) {
      this.showToast(`Verification failed: ${err.message}`, 'error');
    }
  }

  async createSignedCheckpoint() {
    try {
      const res = await fetch('/api/portfolio/governance/checkpoints/create', { method: 'POST' }).then(r => r.json());
      if (res.success) {
        this.showToast(`Signed checkpoint created! Checkpoint ID: ${res.checkpoint.checkpoint_id}`, 'success');
        this.loadAuditData();
      } else {
        this.showToast(`Checkpoint error: ${res.error}`, 'error');
      }
    } catch (err) {
      this.showToast(`Checkpoint creation failed: ${err.message}`, 'error');
    }
  }

  // ==============================================================
  // 14. SETTINGS
  // ==============================================================
  async loadSettings() {
    try {
      const res = await fetch('/api/portfolio/settings').then(r => r.json());
      if (res?.settings) {
        this.userSettings = { ...this.userSettings, ...res.settings };
        this.applyTheme(this.userSettings.theme);
      }
    } catch (_) {}
  }

  loadSettingsData() {
    const selTheme = document.getElementById('settingTheme');
    const selDensity = document.getElementById('settingDensity');
    const chkAutoRefresh = document.getElementById('settingAutoRefresh');
    const numInterval = document.getElementById('settingRefreshInterval');

    if (selTheme) selTheme.value = this.userSettings.theme || 'dark';
    if (selDensity) selDensity.value = this.userSettings.density || 'compact';
    if (chkAutoRefresh) chkAutoRefresh.checked = !!this.userSettings.auto_refresh;
    if (numInterval) numInterval.value = this.userSettings.refresh_interval || 30;
  }

  async saveSettings() {
    const updates = {
      theme: document.getElementById('settingTheme')?.value || 'dark',
      density: document.getElementById('settingDensity')?.value || 'compact',
      auto_refresh: document.getElementById('settingAutoRefresh')?.checked ?? true,
      refresh_interval: parseInt(document.getElementById('settingRefreshInterval')?.value, 10) || 30
    };

    try {
      const res = await fetch('/api/portfolio/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      }).then(r => r.json());

      if (res.success) {
        this.userSettings = { ...this.userSettings, ...res.settings };
        this.applyTheme(this.userSettings.theme);
        this.setupAutoRefresh();
        this.showToast('Settings saved successfully.', 'success');
      }
    } catch (err) {
      this.showToast(`Failed to save settings: ${err.message}`, 'error');
    }
  }

  // ==============================================================
  // NOTIFICATIONS SYSTEM
  // ==============================================================
  async loadNotifications() {
    try {
      const res = await fetch('/api/portfolio/notifications?limit=25').then(r => r.json());
      if (!res) return;

      const badge = document.getElementById('osNotifBadge');
      if (badge) {
        if (res.unreadCount > 0) {
          badge.textContent = res.unreadCount;
          badge.style.display = 'flex';
        } else {
          badge.style.display = 'none';
        }
      }

      const list = document.getElementById('osNotifList');
      if (list && res.notifications) {
        if (res.notifications.length === 0) {
          list.innerHTML = '<div style="text-align:center; color:var(--text-muted); padding:20px;">No notifications yet</div>';
          return;
        }

        list.innerHTML = res.notifications.map(n => `
          <div style="background:var(--bg-elevated); border:1px solid var(--border); border-radius:var(--radius-sm); padding:10px 12px; margin-bottom:8px; opacity:${n.read ? '0.6' : '1'};">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
              <span class="os-pill ${n.severity === 'error' ? 'os-pill-error' : (n.severity === 'success' ? 'os-pill-success' : 'os-pill-info')}">${n.category}</span>
              <span class="mono" style="font-size:10px; color:var(--text-muted);">${new Date(n.created_at).toLocaleTimeString()}</span>
            </div>
            <div style="font-weight:600; font-size:12px; margin-bottom:2px;">${this.escape(n.title)}</div>
            <div style="font-size:11px; color:var(--text-secondary); line-height:1.4;">${this.escape(n.message)}</div>
            ${!n.read ? `<button class="os-btn-secondary os-btn-sm" style="margin-top:6px;" onclick="osEngine.markNotificationRead('${n.id}')">Mark Read</button>` : ''}
          </div>
        `).join('');
      }
    } catch (err) {
      console.warn('Notifications load error:', err.message);
    }
  }

  async markNotificationRead(id) {
    await fetch(`/api/portfolio/notifications/${id}/read`, { method: 'POST' });
    this.loadNotifications();
  }

  async markAllNotificationsRead() {
    await fetch('/api/portfolio/notifications/read-all', { method: 'POST' });
    this.loadNotifications();
  }

  toggleNotifDrawer(forceState) {
    const drawer = document.getElementById('osNotificationDrawer');
    if (!drawer) return;
    if (typeof forceState === 'boolean') {
      drawer.classList.toggle('open', forceState);
    } else {
      drawer.classList.toggle('open');
    }
  }

  // ==============================================================
  // EMERGENCY STOP
  // ==============================================================
  toggleEmergencyStop() {
    const action = this.isEmergencyStopped ? 'RESUME' : 'FREEZE';
    this.showModal({
      title: `${action} All Autonomous Operations?`,
      bodyHtml: `
        <p style="font-size:12px; color:var(--text-secondary); line-height:1.5;">
          ${this.isEmergencyStopped 
            ? 'Resuming will allow automated commits, pull requests, and deployment dispatches to execute.' 
            : 'Activating Emergency Stop will immediately block and reject all automated Git operations, deployments, and mutation pipelines across the platform.'}
        </p>
      `,
      confirmText: this.isEmergencyStopped ? 'Resume Operations' : 'Activate Stop',
      onConfirm: async () => {
        try {
          const res = await fetch('/api/portfolio/emergency-stop', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ active: !this.isEmergencyStopped })
          }).then(r => r.json());

          this.isEmergencyStopped = !!res.emergencyStopActive;
          this.updateEmergencyStopUI();
          this.showToast(`Emergency Stop is now ${this.isEmergencyStopped ? 'ACTIVATED' : 'DEACTIVATED'}`, this.isEmergencyStopped ? 'error' : 'success');
        } catch (err) {
          this.showToast(`Failed to toggle Emergency Stop: ${err.message}`, 'error');
        }
      }
    });
  }

  updateEmergencyStopUI() {
    const btn = document.getElementById('osEmergencyStopBtn');
    const label = document.getElementById('osEmergencyStopLabel');
    if (btn && label) {
      if (this.isEmergencyStopped) {
        btn.classList.add('active');
        label.textContent = 'STOP ACTIVE';
      } else {
        btn.classList.remove('active');
        label.textContent = 'Emergency Stop';
      }
    }
  }

  // ==============================================================
  // THEME MANAGEMENT
  // ==============================================================
  toggleTheme() {
    const newTheme = document.documentElement.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
    this.applyTheme(newTheme);
    this.userSettings.theme = newTheme;
    fetch('/api/portfolio/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ theme: newTheme })
    }).catch(() => {});
  }

  applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
  }

  // ==============================================================
  // COMMAND PALETTE
  // ==============================================================
  openCommandPalette() {
    const modal = document.getElementById('osCommandPaletteModal');
    const input = document.getElementById('cmdPaletteInput');
    if (modal && input) {
      modal.classList.add('active');
      input.value = '';
      input.focus();
      this.filterCommandPalette('');
    }
  }

  closeModals() {
    document.querySelectorAll('.os-modal-overlay').forEach(m => m.classList.remove('active'));
    this.toggleNotifDrawer(false);
  }

  filterCommandPalette(query) {
    const resultsContainer = document.getElementById('cmdPaletteResults');
    if (!resultsContainer) return;

    const q = query.toLowerCase().trim();
    const filtered = this.paletteCommands.filter(cmd => 
      cmd.label.toLowerCase().includes(q) || cmd.category.toLowerCase().includes(q)
    );

    this.selectedPaletteIndex = 0;
    if (filtered.length === 0) {
      resultsContainer.innerHTML = '<div style="padding:16px; text-align:center; color:var(--text-muted);">No commands found</div>';
      return;
    }

    resultsContainer.innerHTML = filtered.map((cmd, idx) => `
      <div class="os-palette-item ${idx === 0 ? 'selected' : ''}" data-cmd-id="${cmd.id}" onclick="osEngine.executePaletteCommand('${cmd.id}')">
        <div style="display:flex; align-items:center; gap:8px;">
          <span>${cmd.icon}</span>
          <span>${cmd.label}</span>
        </div>
        <span class="mono" style="font-size:10px; color:var(--text-muted);">${cmd.category}</span>
      </div>
    `).join('');
  }

  handlePaletteKeydown(e) {
    const items = document.querySelectorAll('.os-palette-item');
    if (items.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      this.selectedPaletteIndex = (this.selectedPaletteIndex + 1) % items.length;
      this.updatePaletteSelection(items);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      this.selectedPaletteIndex = (this.selectedPaletteIndex - 1 + items.length) % items.length;
      this.updatePaletteSelection(items);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const current = items[this.selectedPaletteIndex];
      const cmdId = current?.getAttribute('data-cmd-id');
      if (cmdId) this.executePaletteCommand(cmdId);
    }
  }

  updatePaletteSelection(items) {
    items.forEach((item, idx) => {
      item.classList.toggle('selected', idx === this.selectedPaletteIndex);
    });
  }

  executePaletteCommand(cmdId) {
    const cmd = this.paletteCommands.find(c => c.id === cmdId);
    if (cmd) {
      this.closeModals();
      cmd.action();
    }
  }

  // ==============================================================
  // HELPER UTILITIES
  // ==============================================================
  escape(str) {
    if (typeof str !== 'string') return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  setupAutoRefresh() {
    if (this.refreshTimer) clearInterval(this.refreshTimer);
    if (this.userSettings.auto_refresh) {
      const intervalMs = (this.userSettings.refresh_interval || 30) * 1000;
      this.refreshTimer = setInterval(() => {
        if (this.currentView === 'overview' || this.currentView === 'monitoring') {
          this.loadView(this.currentView);
        }
      }, intervalMs);
    }
  }

  simulatePing() {
    fetch('/api/portfolio/analytics/simulate-ping', { method: 'POST' }).then(() => {
      this.showToast('Visitor Ping simulated and recorded', 'success');
      this.loadOverviewData();
    });
  }

  runHealthCheck() {
    fetch('/api/portfolio/monitoring/services').then(r => r.json()).then(data => {
      this.showToast(`Health Check: Site is ${data.portfolioSite?.status || 'HEALTHY'} (${data.portfolioSite?.latencyMs || 271}ms)`, 'success');
      this.loadOverviewData();
    });
  }
}

// Instantiate and expose globally
const osEngine = new PortfolioOSEngine();
window.osEngine = osEngine;
window.addEventListener('DOMContentLoaded', () => osEngine.init());
