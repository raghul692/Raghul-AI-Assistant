/**
 * Base AI Provider Adapter
 * Defines the unified interface for all AI model providers (Gemini, Groq, OpenRouter, NVIDIA NIM, Cloudflare Workers AI).
 */

export class BaseProvider {
  constructor(config = {}) {
    this.id = config.id || 'base';
    this.name = config.name || 'Base Provider';
    this.enabled = config.enabled !== false;
    this.apiKey = config.apiKey || '';
    this.defaultModel = config.defaultModel || '';
    this.activeModel = config.activeModel || this.defaultModel;
    this.models = config.models || [];
    this.timeoutMs = config.timeoutMs || 25000;
    
    // Circuit Breaker State (CLOSED, OPEN, HALF_OPEN)
    this.circuitBreaker = {
      state: 'CLOSED',
      consecutiveFailures: 0,
      failureThreshold: 3,
      lastFailureTime: 0,
      cooldownMs: 60000, // 60s cooldown before testing HALF_OPEN
      quotaResetTime: 0,
      reason: null
    };

    // Real-Time Usage & Health Metrics
    this.metrics = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
      totalLatencyMs: 0,
      avgLatencyMs: 0,
      recentLatencies: [],
      lastSuccessTime: 0,
      lastFailureTime: 0,
      rateLimitHits: 0,
      quotaExhaustedHits: 0,
      requestsInCurrentMinute: 0,
      minuteWindowStart: Date.now()
    };
  }

  // Capability declarations
  getCapabilities() {
    return {
      text: true,
      streaming: true,
      code: true,
      math: true,
      complexReasoning: false,
      tools: false,
      vision: false,
      audio: false,
      video: false,
      jsonOutput: true,
      contextWindow: 32768
    };
  }

  // Check if provider is configured with credentials
  isConfigured() {
    return Boolean(this.apiKey && this.apiKey.trim().length > 0 && this.apiKey !== 'your_api_key_here');
  }

  // Get current operational health status
  getHealthStatus() {
    if (!this.enabled) return 'Disabled';
    if (!this.isConfigured()) return 'Unconfigured';

    const now = Date.now();
    // Check if quota reset time is active
    if (this.circuitBreaker.quotaResetTime > now) {
      return 'Quota Exhausted';
    }

    if (this.circuitBreaker.state === 'OPEN') {
      if (now - this.circuitBreaker.lastFailureTime > this.circuitBreaker.cooldownMs) {
        return 'Recovering (Half-Open)';
      }
      return 'Circuit Open';
    }

    if (this.circuitBreaker.consecutiveFailures > 0) {
      return 'Degraded';
    }

    return 'Healthy';
  }

  // Circuit breaker gate check
  canHandleRequest() {
    if (!this.enabled || !this.isConfigured()) return false;
    const now = Date.now();

    // Still in quota exhaustion cooldown
    if (this.circuitBreaker.quotaResetTime > now) {
      return false;
    }

    // Circuit is OPEN
    if (this.circuitBreaker.state === 'OPEN') {
      if (now - this.circuitBreaker.lastFailureTime > this.circuitBreaker.cooldownMs) {
        this.circuitBreaker.state = 'HALF_OPEN';
        return true; // allow test probe
      }
      return false;
    }

    return true;
  }

  // Record successful response
  recordSuccess(latencyMs = 0, usage = {}) {
    const now = Date.now();
    this.circuitBreaker.consecutiveFailures = 0;
    this.circuitBreaker.state = 'CLOSED';
    this.circuitBreaker.quotaResetTime = 0;
    this.circuitBreaker.reason = null;

    this.metrics.totalRequests++;
    this.metrics.successfulRequests++;
    this.metrics.lastSuccessTime = now;

    const promptTok = Number(usage.promptTokens) || 0;
    const completionTok = Number(usage.completionTokens) || 0;
    this.metrics.promptTokens += promptTok;
    this.metrics.completionTokens += completionTok;
    this.metrics.totalTokens += (promptTok + completionTok);

    if (latencyMs > 0) {
      this.metrics.totalLatencyMs += latencyMs;
      this.metrics.recentLatencies.push(latencyMs);
      if (this.metrics.recentLatencies.length > 20) this.metrics.recentLatencies.shift();
      this.metrics.avgLatencyMs = Math.round(
        this.metrics.recentLatencies.reduce((a, b) => a + b, 0) / this.metrics.recentLatencies.length
      );
    }

    this._updateRpm();
  }

  // Record failure & update circuit breaker
  recordFailure(error, errorType = 'unknown') {
    const now = Date.now();
    this.metrics.totalRequests++;
    this.metrics.failedRequests++;
    this.metrics.lastFailureTime = now;
    this.circuitBreaker.consecutiveFailures++;
    this.circuitBreaker.lastFailureTime = now;
    this.circuitBreaker.reason = error?.message || errorType;

    if (errorType === 'QUOTA_EXHAUSTED') {
      this.metrics.quotaExhaustedHits++;
      // Set quota reset time (default 12 hours or next midnight UTC if unknown)
      const twelveHours = 12 * 60 * 60 * 1000;
      this.circuitBreaker.quotaResetTime = now + (error.retryAfterMs || twelveHours);
      this.circuitBreaker.state = 'OPEN';
    } else if (errorType === 'RATE_LIMIT') {
      this.metrics.rateLimitHits++;
      // Rate limit backoff (30s)
      this.circuitBreaker.lastFailureTime = now;
      this.circuitBreaker.cooldownMs = Math.max(30000, error.retryAfterMs || 30000);
      if (this.circuitBreaker.consecutiveFailures >= 2) {
        this.circuitBreaker.state = 'OPEN';
      }
    } else if (errorType === 'AUTH_FAILED') {
      this.circuitBreaker.state = 'OPEN';
      this.circuitBreaker.cooldownMs = 3600000; // 1 hr
    } else if (this.circuitBreaker.consecutiveFailures >= this.circuitBreaker.failureThreshold) {
      this.circuitBreaker.state = 'OPEN';
      this.circuitBreaker.cooldownMs = 60000; // 60s
    }

    this._updateRpm();
  }

  // RPM tracker
  _updateRpm() {
    const now = Date.now();
    if (now - this.metrics.minuteWindowStart > 60000) {
      this.metrics.requestsInCurrentMinute = 1;
      this.metrics.minuteWindowStart = now;
    } else {
      this.metrics.requestsInCurrentMinute++;
    }
  }

  // Classify standard HTTP and network errors
  classifyError(err) {
    const msg = String(err?.message || '').toLowerCase();
    const status = Number(err?.status || err?.statusCode || 0);

    if (status === 429 || msg.includes('quota exceeded') || msg.includes('resource_exhausted') || msg.includes('insufficient_quota')) {
      if (msg.includes('per day') || msg.includes('daily limit') || msg.includes('free tier limit') || msg.includes('exceeded your current quota')) {
        return { type: 'QUOTA_EXHAUSTED', retryable: false, status: 429 };
      }
      return { type: 'RATE_LIMIT', retryable: true, status: 429 };
    }

    if (status === 401 || msg.includes('unauthorized') || msg.includes('invalid api key') || msg.includes('authentication')) {
      return { type: 'AUTH_FAILED', retryable: false, status: 401 };
    }

    if (status === 403 || msg.includes('forbidden') || msg.includes('access denied')) {
      return { type: 'PERMISSION_DENIED', retryable: false, status: 403 };
    }

    if (status === 404 || msg.includes('model not found') || msg.includes('does not exist') || msg.includes('no longer available') || status === 410) {
      return { type: 'MODEL_UNAVAILABLE', retryable: false, status: status || 404 };
    }

    if (status === 408 || msg.includes('timeout') || msg.includes('timed out')) {
      return { type: 'TIMEOUT', retryable: true, status: 408 };
    }

    if (status >= 500 || msg.includes('internal server error') || msg.includes('service unavailable') || msg.includes('bad gateway') || msg.includes('503')) {
      return { type: 'SERVER_ERROR', retryable: true, status: status || 500 };
    }

    if (msg.includes('fetch failed') || msg.includes('econnreset') || msg.includes('econnrefused') || msg.includes('network')) {
      return { type: 'NETWORK_ERROR', retryable: true, status: 0 };
    }

    return { type: 'UNKNOWN', retryable: false, status };
  }

  // Abstract methods to override
  async generateStream(params) {
    throw new Error('generateStream() must be implemented by adapter subclass');
  }

  async generate(params) {
    throw new Error('generate() must be implemented by adapter subclass');
  }

  async healthCheck() {
    throw new Error('healthCheck() must be implemented by adapter subclass');
  }
}

