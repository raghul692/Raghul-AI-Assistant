import { BaseProvider } from './baseProvider.js';

export class CloudflareProvider extends BaseProvider {
  constructor(config = {}) {
    super({
      id: 'cloudflare',
      name: 'Cloudflare Workers AI',
      apiKey: config.apiKey || process.env.CLOUDFLARE_API_TOKEN || '',
      defaultModel: config.defaultModel || process.env.CLOUDFLARE_MODEL || '@cf/meta/llama-3.1-8b-instruct',
      models: [
        { id: '@cf/meta/llama-3.1-8b-instruct', name: 'Llama 3.1 8B Instruct', contextWindow: 8192, isFreeTier: true },
        { id: '@cf/meta/llama-3-8b-instruct', name: 'Llama 3 8B Instruct', contextWindow: 8192, isFreeTier: true },
        { id: '@cf/mistral/mistral-7b-instruct-v0.1', name: 'Mistral 7B Instruct', contextWindow: 8192, isFreeTier: true }
      ],
      timeoutMs: config.timeoutMs || 25000,
      enabled: config.enabled !== false
    });

    this._apiKey = config.apiKey || '';
    this._accountId = config.accountId || '';
  }

  get apiKey() {
    return this._apiKey || process.env.CLOUDFLARE_API_TOKEN || '';
  }

  set apiKey(val) {
    this._apiKey = val;
  }

  get accountId() {
    return this._accountId || process.env.CLOUDFLARE_ACCOUNT_ID || '';
  }

  set accountId(val) {
    this._accountId = val;
  }

  isConfigured() {
    return Boolean(this.apiKey && this.accountId && this.apiKey !== 'your_cloudflare_api_token_here');
  }

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
      contextWindow: 8192
    };
  }

  _formatMessages(messages, systemInstruction = '') {
    const formatted = [];
    if (systemInstruction && systemInstruction.trim()) {
      formatted.push({ role: 'system', content: systemInstruction.trim() });
    }

    for (const msg of messages) {
      const role = (msg.role === 'model' || msg.role === 'assistant') ? 'assistant' : 'user';
      let content = msg.content || msg.text || '';
      if (!content && Array.isArray(msg.parts)) {
        content = msg.parts.map(p => p.text || '').join('\n');
      }
      if (content && content.trim()) {
        formatted.push({ role, content });
      }
    }

    return formatted;
  }

  async generateStream({
    messages = [],
    systemInstruction = '',
    temperature = 0.7,
    maxTokens = 2048,
    model = null,
    onToken = () => {},
    signal = null
  }) {
    if (!this.canHandleRequest()) {
      throw new Error(`Cloudflare provider cannot handle request (Status: ${this.getHealthStatus()})`);
    }

    const startTime = Date.now();
    const activeModel = model || this.activeModel || this.defaultModel;
    const formattedMessages = this._formatMessages(messages, systemInstruction);
    const endpoint = `https://api.cloudflare.com/client/v4/accounts/${this.accountId}/ai/run/${activeModel}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    if (signal) {
      signal.addEventListener('abort', () => controller.abort());
    }

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          messages: formattedMessages,
          max_tokens: Math.min(2048, maxTokens),
          stream: true
        }),
        signal: controller.signal
      });

      clearTimeout(timeout);

      if (!res.ok) {
        const errorBody = await res.text();
        const err = new Error(`Cloudflare HTTP ${res.status}: ${errorBody}`);
        err.status = res.status;
        err.responseBody = errorBody;
        throw err;
      }

      let fullText = '';
      const reader = res.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed === 'data: [DONE]') continue;
          if (trimmed.startsWith('data: ')) {
            try {
              const data = JSON.parse(trimmed.slice(6));
              const token = data.response;
              if (token) {
                fullText += token;
                onToken(token);
              }
            } catch (jsonErr) {
              // Ignore partial chunk parse error
            }
          }
        }
      }

      // If streaming didn't output tokens (e.g. non-SSE response format), handle buffered JSON
      if (!fullText && buffer.trim()) {
        try {
          const raw = JSON.parse(buffer.trim());
          const text = raw.result?.response || raw.response || '';
          if (text) {
            fullText = text;
            onToken(text);
          }
        } catch (e) {}
      }

      const latencyMs = Date.now() - startTime;
      const totalTokens = Math.ceil((fullText.length + JSON.stringify(formattedMessages).length) / 4);
      this.recordSuccess(latencyMs, { promptTokens: Math.ceil(JSON.stringify(formattedMessages).length / 4), completionTokens: Math.ceil(fullText.length / 4) });

      return {
        text: fullText,
        model: activeModel,
        provider: this.id,
        latencyMs,
        usage: { totalTokens }
      };
    } catch (err) {
      clearTimeout(timeout);
      const classified = this.classifyError(err);
      this.recordFailure(err, classified.type);
      err.classified = classified;
      throw err;
    }
  }

  async generate({
    messages = [],
    systemInstruction = '',
    temperature = 0.7,
    maxTokens = 2048,
    model = null
  }) {
    let fullText = '';
    return this.generateStream({
      messages,
      systemInstruction,
      temperature,
      maxTokens,
      model,
      onToken: (tok) => { fullText += tok; }
    });
  }

  async healthCheck() {
    if (!this.isConfigured()) return { healthy: false, error: 'No Cloudflare credentials configured' };
    try {
      const startTime = Date.now();
      const endpoint = `https://api.cloudflare.com/client/v4/accounts/${this.accountId}/ai/run/${this.activeModel || this.defaultModel}`;
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'Ping' }],
          max_tokens: 5
        }),
        signal: AbortSignal.timeout(7000)
      });
      const latencyMs = Date.now() - startTime;
      if (res.ok) {
        return { healthy: true, latencyMs, model: this.activeModel };
      }
      return { healthy: false, error: `HTTP ${res.status}: ${await res.text()}` };
    } catch (err) {
      return { healthy: false, error: err.message, classified: this.classifyError(err) };
    }
  }
}
