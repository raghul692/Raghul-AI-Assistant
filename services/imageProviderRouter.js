import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';
import { validateImageBuffer } from './imageQualityValidator.js';

dotenv.config();

const CF_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
const CF_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

/**
 * Provider 1: Google Gemini Image Generation
 * Primary recommended models: gemini-3.1-flash-image, gemini-3-pro-image
 */
export class GeminiImageProvider {
  constructor(apiKey = GEMINI_API_KEY) {
    this.apiKey = apiKey;
    this.name = 'gemini';
    this.primaryModel = 'gemini-3.1-flash-image';
    this.premiumModel = 'gemini-3-pro-image';
    this.client = apiKey ? new GoogleGenAI({ apiKey }) : null;
  }

  isAvailable() {
    return Boolean(this.apiKey && this.client);
  }

  async generate({ prompt, imageBrief = null, parentAsset = null, model = null }) {
    if (!this.isAvailable()) {
      throw new Error('Gemini API key is not configured.');
    }

    const selectedModel = model || (imageBrief?.modelTier === 'premium' ? this.premiumModel : this.primaryModel);
    const start = Date.now();

    // Prepare contents: support text prompt or image-to-image edit
    let contents = prompt;
    if (parentAsset && parentAsset.buffer) {
      contents = [
        prompt,
        {
          inlineData: {
            mimeType: parentAsset.mime_type || 'image/png',
            data: parentAsset.buffer.toString('base64')
          }
        }
      ];
    }

    const response = await this.client.models.generateContent({
      model: selectedModel,
      contents,
      config: {
        responseModalities: ['IMAGE']
      }
    });

    let imageBuffer = null;
    let mimeType = 'image/png';

    if (response?.candidates?.[0]?.content?.parts) {
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData?.data) {
          imageBuffer = Buffer.from(part.inlineData.data, 'base64');
          if (part.inlineData.mimeType) {
            mimeType = part.inlineData.mimeType;
          }
          break;
        }
      }
    }

    if (!imageBuffer) {
      throw new Error(`Gemini Image Provider returned no image data for model: ${selectedModel}`);
    }

    const validation = validateImageBuffer(imageBuffer);
    if (!validation.valid) {
      throw new Error(`Gemini generated image failed validation: ${validation.error}`);
    }

    return {
      buffer: imageBuffer,
      mimeType: validation.mimeType || mimeType,
      width: 1024,
      height: 1024,
      provider: this.name,
      model: selectedModel,
      latencyMs: Date.now() - start
    };
  }
}

/**
 * Provider 2: Cloudflare Workers AI FLUX.1 Schnell
 * High-speed raster image generator fallback and creative engine
 */
export class CloudflareFluxProvider {
  constructor(accountId = CF_ACCOUNT_ID, apiToken = CF_API_TOKEN) {
    this.accountId = accountId;
    this.apiToken = apiToken;
    this.name = 'cloudflare-flux';
    this.model = '@cf/black-forest-labs/flux-1-schnell';
  }

  isAvailable() {
    return Boolean(this.accountId && this.apiToken);
  }

  async generate({ prompt, imageBrief = null, aspectRatio = '1:1', steps = 4 }) {
    if (!this.isAvailable()) {
      throw new Error('Cloudflare Workers AI credentials missing in environment.');
    }

    const start = Date.now();
    let enrichedPrompt = prompt.trim();

    // Enrich prompt with aspect ratio and quality guidance if specified
    const targetAspect = imageBrief?.aspectRatio || aspectRatio;
    if (targetAspect === '16:9' && !enrichedPrompt.toLowerCase().includes('16:9')) {
      enrichedPrompt += ', cinematic widescreen 16:9 composition';
    } else if (targetAspect === '9:16' && !enrichedPrompt.toLowerCase().includes('9:16')) {
      enrichedPrompt += ', vertical portrait 9:16 composition';
    }

    if (imageBrief?.lighting && !enrichedPrompt.toLowerCase().includes('lighting')) {
      enrichedPrompt += `, ${imageBrief.lighting}`;
    }

    const endpoint = `https://api.cloudflare.com/client/v4/accounts/${this.accountId}/ai/run/${this.model}`;
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        prompt: enrichedPrompt
      }),
      signal: AbortSignal.timeout(35000)
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`Cloudflare FLUX API HTTP ${res.status}: ${errorText}`);
    }

    const contentType = res.headers.get('content-type') || '';
    let buffer;

    if (contentType.includes('application/json')) {
      const data = await res.json();
      if (data.result?.image) {
        buffer = Buffer.from(data.result.image, 'base64');
      } else {
        throw new Error('Cloudflare FLUX returned JSON without image property');
      }
    } else {
      const arrayBuffer = await res.arrayBuffer();
      buffer = Buffer.from(arrayBuffer);
    }

    const validation = validateImageBuffer(buffer);
    if (!validation.valid) {
      throw new Error(`Cloudflare FLUX image buffer validation failed: ${validation.error}`);
    }

    return {
      buffer,
      mimeType: validation.mimeType || 'image/png',
      width: 1024,
      height: 1024,
      provider: this.name,
      model: this.model,
      latencyMs: Date.now() - start
    };
  }
}

/**
 * Image Provider Router with automatic circuit-breaking and fallback.
 * Strictly guarantees ZERO external web image scraping.
 */
export class ImageProviderRouter {
  constructor(geminiKey = null) {
    this.gemini = new GeminiImageProvider(geminiKey || GEMINI_API_KEY);
    this.flux = new CloudflareFluxProvider();
  }

  async generateImage({
    prompt,
    imageBrief = null,
    context = null,
    parentAsset = null,
    preferredProvider = null,
    preferredModel = null
  }) {
    const errors = [];

    // Strategy 1: Attempt Gemini Image Provider first if available and not explicitly disabled
    if (preferredProvider === 'gemini' || !preferredProvider) {
      if (this.gemini.isAvailable()) {
        try {
          console.log(`[ImageProviderRouter] Attempting primary Gemini image model...`);
          const result = await this.gemini.generate({
            prompt,
            imageBrief,
            parentAsset,
            model: preferredModel
          });
          console.log(`[ImageProviderRouter] Gemini generation succeeded in ${result.latencyMs}ms`);
          return result;
        } catch (geminiErr) {
          const errMsg = geminiErr.status ? `HTTP ${geminiErr.status}: ${geminiErr.message}` : geminiErr.message;
          console.warn(`[ImageProviderRouter] Gemini primary failed (${errMsg}), falling over to Cloudflare FLUX.`);
          errors.push({ provider: 'gemini', error: errMsg });
        }
      }
    }

    // Strategy 2: Automatic Fallback to Cloudflare FLUX.1 Schnell
    if (this.flux.isAvailable()) {
      try {
        console.log(`[ImageProviderRouter] Invoking Cloudflare Workers AI FLUX.1 Schnell...`);
        const result = await this.flux.generate({
          prompt,
          imageBrief,
          aspectRatio: imageBrief?.aspectRatio || '1:1'
        });
        console.log(`[ImageProviderRouter] Cloudflare FLUX succeeded in ${result.latencyMs}ms (${result.buffer.length} bytes)`);
        return result;
      } catch (fluxErr) {
        console.warn(`[ImageProviderRouter] Cloudflare FLUX failed: ${fluxErr.message}`);
        errors.push({ provider: 'cloudflare-flux', error: fluxErr.message });
      }
    }

    // If both native AI providers failed, strictly fail with descriptive error.
    // NEVER scrape external websites or return stock photo URLs.
    const failureSummary = errors.map(e => `${e.provider}: ${e.error}`).join(' | ');
    throw new Error(`All native image generation providers failed (${failureSummary}). External web scraping is disabled.`);
  }
}

export const imageProviderRouter = new ImageProviderRouter();
