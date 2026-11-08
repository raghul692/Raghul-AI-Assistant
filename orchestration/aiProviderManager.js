/**
 * Centralized AI Provider Orchestration & Failover Engine
 * 
 * Manages 5 independent AI providers:
 * 1. Google Gemini (Default Primary)
 * 2. Groq Cloud (Fallback 1)
 * 3. OpenRouter (Fallback 2)
 * 4. NVIDIA NIM (Fallback 3)
 * 5. Cloudflare Workers AI (Fallback 4)
 * 
 * Capabilities:
 * - Intelligent Automatic Failover with Error Classification (429, 401, 403, 404, 408, 5xx, Network)
 * - Exponential Backoff with Jitter for transient errors
 * - Circuit Breakers (CLOSED, OPEN, HALF_OPEN)
 * - Automatic Primary Provider Recovery (non-intrusive background prober)
 * - Capability-Aware Model Routing (multimodal, vision, code, reasoning)
 * - Unified Conversation Context preservation across provider switches
 */

import dotenv from 'dotenv';
dotenv.config();

import { db } from '../db.js';
import { GeminiProvider } from '../providers/geminiAdapter.js';
import { GroqProvider } from '../providers/groqAdapter.js';
import { OpenRouterProvider } from '../providers/openrouterAdapter.js';
import { NvidiaProvider } from '../providers/nvidiaAdapter.js';
import { CloudflareProvider } from '../providers/cloudflareAdapter.js';
import { recordAuditLog } from '../governanceAudit.js';

export class AIProviderManager {
  constructor() {
    // 1. Initialize Adapters
    this.providers = new Map();
    this.providers.set('gemini', new GeminiProvider());
    this.providers.set('groq', new GroqProvider());
    this.providers.set('openrouter', new OpenRouterProvider());
    this.providers.set('nvidia', new NvidiaProvider());
    this.providers.set('cloudflare', new CloudflareProvider());

    // 2. Default Configuration & Priorities
    this.defaultPriority = ['gemini', 'groq', 'openrouter', 'nvidia', 'cloudflare'];
    this.priority = [...this.defaultPriority];
    this.primaryProvider = 'gemini';
    this.autoFailover = true;
    this.autoRecovery = true;
    this.fallbackHistory = [];

    // 3. Initialize SQLite Settings Table
    this._initSettingsTable();
    this._loadSettings();

    // 4. Start Background Primary Recovery Timer
    this.recoveryInterval = null;
    this._startRecoveryLoop();
  }

  _initSettingsTable() {
    db.exec(`
      CREATE TABLE IF NOT EXISTS provider_settings (
        id TEXT PRIMARY KEY,
        priority TEXT NOT NULL,
        primary_provider TEXT NOT NULL,
        auto_failover INTEGER NOT NULL DEFAULT 1,
        auto_recovery INTEGER NOT NULL DEFAULT 1,
        updated_at INTEGER NOT NULL
      );
    `);
  }

  _loadSettings() {
    try {
      const row = db.prepare('SELECT * FROM provider_settings WHERE id = ?').get('global');
      if (row) {
        this.priority = JSON.parse(row.priority);
        this.primaryProvider = row.primary_provider;
        this.autoFailover = Boolean(row.auto_failover);
        this.autoRecovery = Boolean(row.auto_recovery);
      } else {
        this._saveSettings();
      }
    } catch (err) {
      console.warn('Failed to load provider settings from DB, using defaults:', err.message);
    }
  }

  _saveSettings() {
    try {
      const stmt = db.prepare(`
        INSERT INTO provider_settings (id, priority, primary_provider, auto_failover, auto_recovery, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          priority = excluded.priority,
          primary_provider = excluded.primary_provider,
          auto_failover = excluded.auto_failover,
          auto_recovery = excluded.auto_recovery,
          updated_at = excluded.updated_at
      `);
      stmt.run('global', JSON.stringify(this.priority), this.primaryProvider, this.autoFailover ? 1 : 0, this.autoRecovery ? 1 : 0, Date.now());
    } catch (err) {
      console.warn('Failed to persist provider settings to DB:', err.message);
    }
  }

  // Capability-Aware Model Selector
  selectCompatibleModel(provider, taskCategory = 'general_conversation', requestedModel = null) {
    if (requestedModel && provider.models.some(m => m.id === requestedModel)) {
      return requestedModel;
    }

    if (taskCategory === 'coding_debugging') {
      const codeModel = provider.models.find(m => m.id.includes('code') || m.id.includes('27b') || m.id.includes('32b') || m.id.includes('70b') || m.id.includes('flash'));
      if (codeModel) return codeModel.id;
    } else if (taskCategory === 'complex_reasoning') {
      const reasoningModel = provider.models.find(m => m.id.includes('nemotron') || m.id.includes('qwen') || m.id.includes('llama') || m.id.includes('reasoning') || m.id.includes('flash') || m.id.includes('pro'));
      if (reasoningModel) return reasoningModel.id;
    }

    return provider.activeModel || provider.defaultModel;
  }

  // Detect Task Category from Query & Attachments
  detectTaskCategory(message = '', attachments = []) {
    if (attachments && attachments.length > 0) {
      const hasMedia = attachments.some(a => a.mimeType && (a.mimeType.startsWith('image/') || a.mimeType.startsWith('audio/') || a.mimeType.startsWith('video/')));
      if (hasMedia) return 'multimodal_vision';
      return 'document_analysis';
    }

    const msg = message.toLowerCase();
    if (/(code|function|bug|syntax|error|refactor|sql|postgres|database|api|script|python|javascript|const|def\b)/i.test(msg)) {
      return 'coding_debugging';
    }
    if (/(calculate|math|equation|formula|matrix|integral|multiply|sum|average)/i.test(msg)) {
      return 'mathematics';
    }
    if (/(why|proof|reason|analyze|evaluate|step-by-step|logic|compare)/i.test(msg)) {
      return 'complex_reasoning';
    }
    if (/(translate|tamil|english|french|hindi|transcribe)/i.test(msg)) {
      return 'translation';
    }
    if (/(summarize|summary|tldr|brief|shorten)/i.test(msg)) {
      return 'summarization';
    }

    return 'general_conversation';
  }

  // Determine provider execution order based on task requirements & health
  getExecutionPlan(taskCategory = 'general_conversation', preferredProvider = null) {
    // If multimodal, only Gemini currently supports native vision/audio/video in our set
    if (taskCategory === 'multimodal_vision') {
      const gemini = this.providers.get('gemini');
      if (gemini && gemini.canHandleRequest()) {
        return [{ provider: gemini, reason: 'Multimodal input requires Gemini vision/audio engine' }];
      }
      throw new Error('Multimodal vision/media tasks require an active Google Gemini provider.');
    }

    const plan = [];
    const orderedKeys = [];

    // If user specified preferred provider and it's healthy, put it first
    if (preferredProvider && this.providers.has(preferredProvider)) {
      orderedKeys.push(preferredProvider);
    }

    // Add remaining providers in configured priority order
    for (const key of this.priority) {
      if (!orderedKeys.includes(key)) {
        orderedKeys.push(key);
      }
    }

    for (const key of orderedKeys) {
      const provider = this.providers.get(key);
      if (provider && provider.enabled && provider.isConfigured()) {
        if (provider.canHandleRequest()) {
          plan.push({ provider, reason: key === this.primaryProvider ? 'Primary Provider' : 'Failover Candidate' });
        }
      }
    }

    if (plan.length === 0) {
      // Check if providers are configured but rate-limited/in circuit cooldown
      const configured = [...this.providers.values()].filter(p => p.isConfigured());
      if (configured.length === 0) {
        throw new Error('No AI providers configured. Please add API credentials in Settings or .env.');
      }
      throw new Error('All configured AI providers are temporarily rate-limited or in circuit cooldown. Please wait a moment.');
    }

    return plan;
  }

  // Non-intrusive Background Recovery Loop
  _startRecoveryLoop() {
    if (this.recoveryInterval) clearInterval(this.recoveryInterval);

    this.recoveryInterval = setInterval(async () => {
      if (!this.autoRecovery) return;

      const primary = this.providers.get(this.primaryProvider);
      if (primary && primary.enabled && primary.isConfigured()) {
        const status = primary.getHealthStatus();
        const now = Date.now();

        // If primary was rate limited or in circuit open and cooldown has passed
        if (primary.circuitBreaker.state === 'OPEN' || primary.circuitBreaker.state === 'HALF_OPEN') {
          // If quota reset time has arrived or cooldown elapsed
          const quotaPassed = primary.circuitBreaker.quotaResetTime > 0 && now >= primary.circuitBreaker.quotaResetTime;
          const cooldownPassed = now - primary.circuitBreaker.lastFailureTime > primary.circuitBreaker.cooldownMs;

          if (quotaPassed || cooldownPassed) {
            console.log(`🔄 Probing primary provider (${primary.name}) for automatic recovery...`);
            try {
              const check = await primary.healthCheck();
              if (check.healthy) {
                primary.recordSuccess(check.latencyMs);
                console.log(`✅ Primary provider ${primary.name} has recovered and is now HEALTHY!`);
                recordAuditLog({
                  actor: 'system_orchestrator',
                  action: 'PROVIDER_RECOVERY',
                  riskRating: 'READ',
                  justification: `Primary provider ${primary.name} passed health check and returned to CLOSED circuit status.`
                });
              }
            } catch (err) {
              console.warn(`Primary recovery check notice: ${err.message}`);
            }
          }
        }
      }
    }, 60000); // Check once every 60s
    if (this.recoveryInterval.unref) {
      this.recoveryInterval.unref();
    }
  }

  /**
   * Main Orchestrated Streaming Generator
   * Handles transparent failovers, unified context streaming, and metrics logging.
   */
  async orchestrateStream({
    messages = [],
    systemInstruction = '',
    temperature = 0.7,
    maxTokens = 4096,
    preferredProvider = null,
    preferredModel = null,
    attachments = [],
    onToken = () => {},
    onReasoning = () => {},
    onStatus = () => {},
    onProviderSwitch = () => {},
    signal = null
  }) {
    const taskCategory = this.detectTaskCategory(
      messages[messages.length - 1]?.content || messages[messages.length - 1]?.text || '',
      attachments
    );

    const plan = this.getExecutionPlan(taskCategory, preferredProvider);
    let lastError = null;
    let tokensEmitted = 0;
    let successfulProvider = null;

    for (let i = 0; i < plan.length; i++) {
      const { provider } = plan[i];
      const modelToUse = this.selectCompatibleModel(provider, taskCategory, preferredModel);

      // If we are falling back after another provider failed
      if (i > 0) {
        const prevProvider = plan[i - 1].provider;
        const switchEvent = {
          from: prevProvider.name,
          to: provider.name,
          reason: lastError?.message || 'Automatic Failover',
          timestamp: Date.now()
        };
        this.fallbackHistory.push(switchEvent);
        if (this.fallbackHistory.length > 50) this.fallbackHistory.shift();

        onProviderSwitch(switchEvent);
        onStatus({
          type: 'status',
          text: `⚡ Automatic Failover: Switched from ${prevProvider.name} to ${provider.name} (${modelToUse})`
        });

        recordAuditLog({
          actor: 'system_orchestrator',
          action: 'PROVIDER_FAILOVER',
          riskRating: 'COMPUTE',
          justification: `Switched from ${prevProvider.name} to ${provider.name}. Error: ${lastError?.message?.slice(0, 100)}`
        });
      }

      try {
        onStatus({
          type: 'provider_active',
          providerId: provider.id,
          providerName: provider.name,
          model: modelToUse
        });

        // Bounded retry with exponential backoff for transient errors
        let result = null;
        let retries = 0;
        const maxRetries = 1; // 1 retry before falling back

        while (retries <= maxRetries) {
          try {
            result = await provider.generateStream({
              messages,
              systemInstruction,
              temperature,
              maxTokens,
              model: modelToUse,
              attachments,
              onToken: (tok) => {
                tokensEmitted++;
                onToken(tok);
              },
              onReasoning,
              signal
            });
            break; // Success!
          } catch (streamErr) {
            retries++;
            const classified = streamErr.classified || provider.classifyError(streamErr);
            // If tokens were already sent to client, we cannot cleanly switch without informing client
            if (tokensEmitted > 0) {
              throw new Error(`Stream interrupted mid-generation on ${provider.name}: ${streamErr.message}`);
            }

            // Only retry if transient and retries remain
            if (classified.retryable && retries <= maxRetries) {
              const backoffMs = (Math.pow(2, retries) * 500) + Math.random() * 300;
              console.log(`Transient error on ${provider.name}. Retrying in ${Math.round(backoffMs)}ms...`);
              await new Promise(r => setTimeout(r, backoffMs));
              continue;
            }
            throw streamErr;
          }
        }

        successfulProvider = provider;
        return {
          ...result,
          failoverCount: i,
          taskCategory
        };
      } catch (err) {
        lastError = err;
        console.warn(`Provider ${provider.name} failed: ${err.message}`);

        // If client aborted, do not fallback
        if (signal?.aborted) throw err;

        // If tokens were already emitted, do not append a new provider's answer to partial text
        if (tokensEmitted > 0) {
          throw err;
        }

        // If auto-failover is disabled by user, stop immediately
        if (!this.autoFailover) {
          throw err;
        }
      }
    }

    throw lastError || new Error('All AI providers in execution plan failed to return a response.');
  }

  // Non-streaming convenience helper
  async generateText({
    prompt = '',
    messages = [],
    systemInstruction = '',
    temperature = 0.7,
    maxTokens = 2048,
    preferredProvider = null,
    taskCategory = 'general_conversation'
  }) {
    const msgs = messages.length > 0 ? messages : [{ role: 'user', content: prompt }];
    let fullText = '';
    return this.orchestrateStream({
      messages: msgs,
      systemInstruction,
      temperature,
      maxTokens,
      preferredProvider,
      onToken: (tok) => { fullText += tok; }
    });
  }

  // Provider Status & Monitoring API
  getProviderStatus() {
    const statusList = [];
    for (const key of this.priority) {
      const p = this.providers.get(key);
      if (p) {
        statusList.push({
          id: p.id,
          name: p.name,
          enabled: p.enabled,
          isConfigured: p.isConfigured(),
          status: p.getHealthStatus(),
          isPrimary: p.id === this.primaryProvider,
          activeModel: p.activeModel,
          defaultModel: p.defaultModel,
          models: p.models,
          circuitState: p.circuitBreaker.state,
          consecutiveFailures: p.circuitBreaker.consecutiveFailures,
          metrics: {
            totalRequests: p.metrics.totalRequests,
            successfulRequests: p.metrics.successfulRequests,
            failedRequests: p.metrics.failedRequests,
            totalTokens: p.metrics.totalTokens,
            avgLatencyMs: p.metrics.avgLatencyMs,
            rateLimitHits: p.metrics.rateLimitHits,
            quotaExhaustedHits: p.metrics.quotaExhaustedHits,
            rpm: p.metrics.requestsInCurrentMinute
          },
          capabilities: p.getCapabilities()
        });
      }
    }

    return {
      primaryProvider: this.primaryProvider,
      autoFailover: this.autoFailover,
      autoRecovery: this.autoRecovery,
      priority: this.priority,
      providers: statusList,
      fallbackHistory: this.fallbackHistory.slice(-10)
    };
  }

  // Update Provider Configuration
  updateConfig({ priority, primaryProvider, autoFailover, autoRecovery, enabledProviders = {} }) {
    if (Array.isArray(priority) && priority.length > 0) {
      this.priority = priority.filter(p => this.providers.has(p));
    }
    if (primaryProvider && this.providers.has(primaryProvider)) {
      this.primaryProvider = primaryProvider;
    }
    if (typeof autoFailover === 'boolean') {
      this.autoFailover = autoFailover;
    }
    if (typeof autoRecovery === 'boolean') {
      this.autoRecovery = autoRecovery;
    }

    for (const [id, enabled] of Object.entries(enabledProviders)) {
      const p = this.providers.get(id);
      if (p) p.enabled = Boolean(enabled);
    }

    this._saveSettings();
    return this.getProviderStatus();
  }

  // Test Provider Connection
  async testConnection(providerId, modelId = null) {
    const p = this.providers.get(providerId);
    if (!p) return { success: false, error: 'Unknown provider ID' };
    if (!p.isConfigured()) return { success: false, error: `${p.name} has no API credentials configured.` };

    const originalModel = p.activeModel;
    if (modelId) p.activeModel = modelId;

    try {
      const check = await p.healthCheck();
      p.activeModel = originalModel;
      return {
        success: check.healthy,
        provider: p.name,
        model: modelId || p.activeModel,
        latencyMs: check.latencyMs || 0,
        error: check.error || null
      };
    } catch (err) {
      p.activeModel = originalModel;
      return {
        success: false,
        provider: p.name,
        error: err.message
      };
    }
  }
}

// Export Singleton Instance
export const aiProviderManager = new AIProviderManager();
