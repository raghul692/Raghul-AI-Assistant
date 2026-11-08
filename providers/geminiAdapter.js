import { BaseProvider } from './baseProvider.js';
import { GoogleGenAI } from '@google/genai';

export class GeminiProvider extends BaseProvider {
  constructor(config = {}) {
    super({
      id: 'gemini',
      name: 'Google Gemini',
      apiKey: config.apiKey || process.env.GEMINI_API_KEY || '',
      defaultModel: config.defaultModel || 'gemini-3-flash-preview',
      models: [
        { id: 'gemini-3-flash-preview', name: 'Gemini 3 Flash Preview', contextWindow: 1048576, isFreeTier: true },
        { id: 'gemini-3.5-flash', name: 'Gemini 3.5 Flash', contextWindow: 1048576, isFreeTier: true },
        { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', contextWindow: 1048576, isFreeTier: true },
        { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', contextWindow: 2097152, isFreeTier: false }
      ],
      timeoutMs: config.timeoutMs || 25000,
      enabled: config.enabled !== false
    });

    this._apiKey = config.apiKey || '';
    this.client = null;
    this._initClient();
  }

  get apiKey() {
    return this._apiKey || process.env.GEMINI_API_KEY || '';
  }

  set apiKey(val) {
    this._apiKey = val;
    this._initClient();
  }

  _initClient() {
    const key = this.apiKey;
    if (key && key.trim().length > 0 && key !== 'your_gemini_api_key_here') {
      try {
        this.client = new GoogleGenAI({ apiKey: key });
      } catch (err) {
        console.warn('Gemini client init notice:', err.message);
      }
    }
  }

  setApiKey(key) {
    this.apiKey = key;
    this._initClient();
  }

  getCapabilities() {
    return {
      text: true,
      streaming: true,
      code: true,
      math: true,
      complexReasoning: true,
      tools: true,
      vision: true,
      audio: true,
      video: true,
      jsonOutput: true,
      contextWindow: 1048576
    };
  }

  // Convert normalized messages to Gemini contents format
  _formatContents(messages, attachments = []) {
    const contents = [];
    
    for (const msg of messages) {
      const role = (msg.role === 'assistant' || msg.role === 'model') ? 'model' : 'user';
      const parts = [];

      if (msg.parts && Array.isArray(msg.parts)) {
        parts.push(...msg.parts);
      } else if (msg.content || msg.text) {
        parts.push({ text: String(msg.content || msg.text) });
      }

      if (parts.length > 0) {
        contents.push({ role, parts });
      }
    }

    // Append any multimodal attachments to latest user message
    if (attachments && attachments.length > 0 && contents.length > 0) {
      const lastMsg = contents[contents.length - 1];
      if (lastMsg.role === 'user') {
        for (const att of attachments) {
          if (att.data && att.mimeType) {
            lastMsg.parts.push({
              inlineData: {
                data: att.data,
                mimeType: att.mimeType
              }
            });
          }
        }
      }
    }

    return contents;
  }

  async generateStream({
    messages = [],
    systemInstruction = '',
    temperature = 0.7,
    maxTokens = 4096,
    model = null,
    attachments = [],
    onToken = () => {},
    onReasoning = () => {},
    signal = null
  }) {
    if (!this.canHandleRequest()) {
      throw new Error(`Gemini provider cannot handle request (Status: ${this.getHealthStatus()})`);
    }

    const startTime = Date.now();
    const activeModel = model || this.activeModel || this.defaultModel;
    const contents = this._formatContents(messages, attachments);

    const config = {
      temperature: Math.max(0, Math.min(1, temperature)),
      maxOutputTokens: maxTokens
    };

    if (systemInstruction && systemInstruction.trim()) {
      config.systemInstruction = systemInstruction;
    }

    // Disable thinking budget on flash preview for instant latency if not explicitly requested
    if (activeModel.includes('flash') && !activeModel.includes('thinking')) {
      config.thinkingConfig = { thinkingBudget: 0 };
    }

    try {
      const stream = await Promise.race([
        this.client.models.generateContentStream({
          model: activeModel,
          contents,
          config
        }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Gemini request timeout (25s)')), this.timeoutMs))
      ]);

      let fullText = '';
      for await (const chunk of stream) {
        if (signal?.aborted) throw new Error('Stream aborted by client');
        const text = chunk.text || '';
        if (text) {
          fullText += text;
          onToken(text);
        }
      }

      const latencyMs = Date.now() - startTime;
      const estimatedTokens = Math.ceil((fullText.length + JSON.stringify(contents).length) / 4);
      this.recordSuccess(latencyMs, { promptTokens: Math.ceil(JSON.stringify(contents).length / 4), completionTokens: Math.ceil(fullText.length / 4) });

      return {
        text: fullText,
        model: activeModel,
        provider: this.id,
        latencyMs,
        usage: { totalTokens: estimatedTokens }
      };
    } catch (err) {
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
    model = null,
    attachments = []
  }) {
    let fullText = '';
    return this.generateStream({
      messages,
      systemInstruction,
      temperature,
      maxTokens,
      model,
      attachments,
      onToken: (tok) => { fullText += tok; }
    });
  }

  async healthCheck() {
    if (!this.isConfigured()) return { healthy: false, error: 'No API Key configured' };
    this._initClient();
    try {
      const startTime = Date.now();
      const res = await Promise.race([
        this.client.models.generateContent({
          model: this.activeModel || this.defaultModel,
          contents: 'Ping',
          config: { maxOutputTokens: 10, thinkingConfig: { thinkingBudget: 0 } }
        }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Gemini ping timeout')), 12000))
      ]);
      const latencyMs = Date.now() - startTime;
      return { healthy: true, latencyMs, model: this.activeModel, text: res.text?.trim() };
    } catch (err) {
      return { healthy: false, error: err.message, classified: this.classifyError(err) };
    }
  }
}
