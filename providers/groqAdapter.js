import { BaseProvider } from './baseProvider.js';

export class GroqProvider extends BaseProvider {
  constructor(config = {}) {
    super({
      id: 'groq',
      name: 'Groq Cloud',
      apiKey: config.apiKey || process.env.GROQ_API_KEY || process.env['groq api key'] || '',
      defaultModel: config.defaultModel || 'qwen/qwen3.8-27b',
      models: [
        { id: 'qwen/qwen3.8-27b', name: 'Qwen 3.8 27B', contextWindow: 32768, isFreeTier: true },
        { id: 'openai/gpt-oss-120b', name: 'GPT OSS 120B', contextWindow: 65536, isFreeTier: true },
        { id: 'allam-2-7b', name: 'ALLaM 2 7B', contextWindow: 8192, isFreeTier: true }
      ],
      timeoutMs: config.timeoutMs || 25000,
      enabled: config.enabled !== false
    });

    this._apiKey = config.apiKey || '';
    this.baseUrl = config.baseUrl || 'https://api.groq.com/openai/v1/chat/completions';
  }

  get apiKey() {
    return this._apiKey || process.env.GROQ_API_KEY || process.env['groq api key'] || '';
  }

  set apiKey(val) {
    this._apiKey = val;
  }

  getCapabilities() {
    return {
      text: true,
      streaming: true,
      code: true,
      math: true,
      complexReasoning: true,
      tools: false,
      vision: false,
      audio: false,
      video: false,
      jsonOutput: true,
      contextWindow: 65536
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
    maxTokens = 4096,
    model = null,
    onToken = () => {},
    onReasoning = () => {},
    signal = null
  }) {
    if (!this.canHandleRequest()) {
      throw new Error(`Groq provider cannot handle request (Status: ${this.getHealthStatus()})`);
    }

    const startTime = Date.now();
    const activeModel = model || this.activeModel || this.defaultModel;
    const formattedMessages = this._formatMessages(messages, systemInstruction);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    if (signal) {
      signal.addEventListener('abort', () => controller.abort());
    }

    try {
      const res = await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: activeModel,
          messages: formattedMessages,
          temperature: Math.max(0, Math.min(1, temperature)),
          max_tokens: maxTokens,
          stream: true
        }),
        signal: controller.signal
      });

      clearTimeout(timeout);

      if (!res.ok) {
        const errorBody = await res.text();
        const err = new Error(`Groq HTTP ${res.status}: ${errorBody}`);
        err.status = res.status;
        err.responseBody = errorBody;
        throw err;
      }

      let fullText = '';
      let fullReasoning = '';
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
              const delta = data.choices?.[0]?.delta;
              if (delta?.content) {
                fullText += delta.content;
                onToken(delta.content);
              } else if (delta?.reasoning) {
                fullReasoning += delta.reasoning;
                onReasoning(delta.reasoning);
              }
            } catch (jsonErr) {
              // Ignore partial chunk parse error
            }
          }
        }
      }

      const latencyMs = Date.now() - startTime;
      const resolvedText = fullText || fullReasoning || '';
      const totalTokens = Math.ceil((resolvedText.length + JSON.stringify(formattedMessages).length) / 4);
      this.recordSuccess(latencyMs, { promptTokens: Math.ceil(JSON.stringify(formattedMessages).length / 4), completionTokens: Math.ceil(resolvedText.length / 4) });

      return {
        text: resolvedText,
        reasoning: fullReasoning,
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
    maxTokens = 4096,
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
    if (!this.isConfigured()) return { healthy: false, error: 'No Groq API Key configured' };
    try {
      const startTime = Date.now();
      const res = await fetch('https://api.groq.com/openai/v1/models', {
        headers: { 'Authorization': `Bearer ${this.apiKey}` },
        signal: AbortSignal.timeout(6000)
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
