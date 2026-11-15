/**
 * RAGHUL AI — MODEL CAPABILITY REGISTRY & INTENT ROUTER
 * 
 * Formal capability specifications for frontier AI models across all 5 providers:
 * - Google Gemini
 * - Groq Cloud
 * - OpenRouter
 * - Cloudflare Workers AI
 * - NVIDIA NIM
 * 
 * Provides:
 * 1. Model metadata, max context tokens, max output tokens, supported capabilities
 * 2. Intent classification (code, research, reasoning, creative, general)
 * 3. Dynamic reasoning effort control (low, medium, high)
 * 4. Model selection & routing based on task type, latency requirement, and provider health
 */

export const MODEL_REGISTRY = {
  // --- GROQ MODELS (Ultra-Low Latency Inference) ---
  'groq/qwen-2.5-32b': {
    provider: 'groq',
    modelId: 'qwen/qwen-2.5-32b',
    name: 'Qwen 2.5 32B (Groq)',
    contextWindow: 128000,
    maxOutputTokens: 8192,
    p50LatencyMs: 270,
    capabilities: ['chat', 'streaming', 'code', 'reasoning', 'multilingual', 'json_schema'],
    reasoningSupported: true,
    costTier: 'low',
    tier: 1,
    strengths: ['Ultra-fast interactive chat', 'Tamil / multilingual fluency', 'Code generation']
  },
  'groq/llama-3.3-70b-versatile': {
    provider: 'groq',
    modelId: 'llama-3.3-70b-versatile',
    name: 'Llama 3.3 70B Versatile (Groq)',
    contextWindow: 128000,
    maxOutputTokens: 8192,
    p50LatencyMs: 380,
    capabilities: ['chat', 'streaming', 'code', 'reasoning', 'tool_calling', 'json_schema'],
    reasoningSupported: true,
    costTier: 'low',
    tier: 1,
    strengths: ['Complex reasoning', 'Agent planning', 'Architectural critique']
  },

  // --- CLOUDFLARE WORKERS AI MODELS (Edge Speed & Multimodal) ---
  'cloudflare/llama-3.1-8b-instruct': {
    provider: 'cloudflare',
    modelId: '@cf/meta/llama-3.1-8b-instruct',
    name: 'Llama 3.1 8B Instruct (Cloudflare Edge)',
    contextWindow: 8192,
    maxOutputTokens: 4096,
    p50LatencyMs: 390,
    capabilities: ['chat', 'streaming', 'code', 'json_schema'],
    reasoningSupported: false,
    costTier: 'free',
    tier: 1,
    strengths: ['Zero-cold-start edge inference', 'High concurrency', 'JSON schema output']
  },
  'cloudflare/bge-base-en-v1.5': {
    provider: 'cloudflare',
    modelId: '@cf/baai/bge-base-en-v1.5',
    name: 'BAAI BGE Base (Cloudflare Embeddings)',
    contextWindow: 512,
    maxOutputTokens: 0,
    p50LatencyMs: 210,
    capabilities: ['embeddings'],
    dimensions: 768,
    costTier: 'free',
    tier: 1,
    strengths: ['High-accuracy dense semantic embeddings', 'Fast vector indexing']
  },
  'cloudflare/flux-1-schnell': {
    provider: 'cloudflare',
    modelId: '@cf/black-forest-labs/flux-1-schnell',
    name: 'FLUX.1 Schnell (Cloudflare Text-to-Image)',
    contextWindow: 512,
    maxOutputTokens: 0,
    p50LatencyMs: 4100,
    capabilities: ['image_generation'],
    costTier: 'free',
    tier: 1,
    strengths: ['High-resolution 1024x1024 photorealistic raster generation', 'Ultra-fast diffusion']
  },

  // --- OPENROUTER REASONING MODELS ---
  'openrouter/nemotron-3.5-lightning': {
    provider: 'openrouter',
    modelId: 'nvidia/nemotron-3.5-lightning:free',
    name: 'Nemotron 3.5 Lightning (OpenRouter)',
    contextWindow: 131072,
    maxOutputTokens: 8192,
    p50LatencyMs: 850,
    capabilities: ['chat', 'streaming', 'reasoning', 'deep_analysis'],
    reasoningSupported: true,
    costTier: 'free',
    tier: 2,
    strengths: ['Deep chain-of-thought mathematical and logical deduction', 'Self-critique']
  },

  // --- GOOGLE GEMINI MODELS (Frontier Multimodal & Massive Context) ---
  'gemini/gemini-2.5-flash': {
    provider: 'gemini',
    modelId: 'gemini-2.5-flash',
    name: 'Gemini 2.5 Flash',
    contextWindow: 1048576,
    maxOutputTokens: 8192,
    p50LatencyMs: 650,
    capabilities: ['chat', 'streaming', 'vision', 'audio', 'video', 'tool_calling', 'json_schema', 'reasoning'],
    reasoningSupported: true,
    costTier: 'low',
    tier: 1,
    strengths: ['1M token massive context window', 'Native multimodal vision and audio', 'Function calling']
  },
  'gemini/gemini-embedding-2': {
    provider: 'gemini',
    modelId: 'models/gemini-embedding-2',
    name: 'Gemini Embedding 2',
    contextWindow: 2048,
    maxOutputTokens: 0,
    p50LatencyMs: 600,
    capabilities: ['embeddings'],
    dimensions: 3072,
    costTier: 'low',
    tier: 2,
    strengths: ['High-dimension frontier dense semantic embeddings', 'Multimodal embedding support']
  },

  // --- NVIDIA NIM MODELS (Enterprise Fallback) ---
  'nvidia/minimax-m3.1': {
    provider: 'nvidia',
    modelId: 'minimaxai/minimax-m3.1-flash',
    name: 'MiniMax M3.1 Flash (NVIDIA NIM)',
    contextWindow: 65536,
    maxOutputTokens: 4096,
    p50LatencyMs: 3800,
    capabilities: ['chat', 'code', 'reasoning'],
    reasoningSupported: false,
    costTier: 'free',
    tier: 3,
    strengths: ['Enterprise grade fallback', 'Reliable code completion']
  }
};

/**
 * Classify user prompt intent into functional task categories
 */
export function classifyPromptIntent(prompt) {
  if (!prompt || typeof prompt !== 'string') return 'general_chat';
  const p = prompt.trim().toLowerCase();

  // 1. Image Generation Intent
  if (/^\/(image|draw|art|img)\b/i.test(p) ||
      /\b(generate|create|draw|render|make)\s+(an?\s+)?(image|photo|picture|artwork|illustration)\b/i.test(p) ||
      /\b(image|img|photo|picture)\s+(generate|create|draw)\s+pannu\b/i.test(p)) {
    return 'image_gen';
  }

  // 2. Deep Research Intent
  if (/^\/(research|deep-research)\b/i.test(p) ||
      /\b(deep\s+research|comprehensive\s+report|investigate|exhaustive\s+literature|market\s+analysis)\b/i.test(p)) {
    return 'deep_research';
  }

  // 3. Coding & Software Architecture Intent
  if (/^\/(code|debug|refactor)\b/i.test(p) ||
      /\b(function|class|const|import|def|return|git|sql|sqlite|api|endpoint|bug|syntaxerror|typescript|javascript|python)\b/i.test(p) ||
      /```[\s\S]*```/.test(prompt)) {
    return 'code';
  }

  // 4. Mathematical & Logical Reasoning Intent
  if (/^\/(math|calc)\b/i.test(p) ||
      /\b(calculate|solve|derive|integral|derivative|matrix|probability|algorithm|proof)\b/i.test(p) ||
      /[\d+\-*/^()=]{5,}/.test(p)) {
    return 'reasoning';
  }

  // 5. Autonomous Multi-Agent Plan Intent
  if (/^\/(plan|agent|swarm|autonomous)\b/i.test(p) ||
      /\b(plan\s+and\s+execute|autonomous\s+task|multi-agent|workflow\s+orchestration)\b/i.test(p)) {
    return 'agent_plan';
  }

  return 'general_chat';
}

/**
 * Select the optimal model based on intent and provider availability
 */
export function selectModelForIntent(intent, availableProviders = ['gemini', 'groq', 'openrouter', 'cloudflare', 'nvidia']) {
  const hasProvider = (p) => availableProviders.includes(p);

  switch (intent) {
    case 'image_gen':
      if (hasProvider('cloudflare')) return MODEL_REGISTRY['cloudflare/flux-1-schnell'];
      return MODEL_REGISTRY['cloudflare/flux-1-schnell'];

    case 'code':
      if (hasProvider('groq')) return MODEL_REGISTRY['groq/qwen-2.5-32b'];
      if (hasProvider('gemini')) return MODEL_REGISTRY['gemini/gemini-2.5-flash'];
      if (hasProvider('cloudflare')) return MODEL_REGISTRY['cloudflare/llama-3.1-8b-instruct'];
      return MODEL_REGISTRY['nvidia/minimax-m3.1'];

    case 'reasoning':
      if (hasProvider('openrouter')) return MODEL_REGISTRY['openrouter/nemotron-3.5-lightning'];
      if (hasProvider('groq')) return MODEL_REGISTRY['groq/llama-3.3-70b-versatile'];
      return MODEL_REGISTRY['gemini/gemini-2.5-flash'];

    case 'deep_research':
      if (hasProvider('groq')) return MODEL_REGISTRY['groq/llama-3.3-70b-versatile'];
      if (hasProvider('gemini')) return MODEL_REGISTRY['gemini/gemini-2.5-flash'];
      return MODEL_REGISTRY['openrouter/nemotron-3.5-lightning'];

    case 'agent_plan':
      if (hasProvider('groq')) return MODEL_REGISTRY['groq/llama-3.3-70b-versatile'];
      if (hasProvider('gemini')) return MODEL_REGISTRY['gemini/gemini-2.5-flash'];
      return MODEL_REGISTRY['openrouter/nemotron-3.5-lightning'];

    case 'general_chat':
    default:
      if (hasProvider('gemini')) return MODEL_REGISTRY['gemini/gemini-2.5-flash'];
      if (hasProvider('groq')) return MODEL_REGISTRY['groq/qwen-2.5-32b'];
      if (hasProvider('cloudflare')) return MODEL_REGISTRY['cloudflare/llama-3.1-8b-instruct'];
      return MODEL_REGISTRY['openrouter/nemotron-3.5-lightning'];
  }
}

/**
 * Map reasoning effort level to token budget / thinking parameters
 */
export function getReasoningBudget(effort = 'medium') {
  switch (effort) {
    case 'low':
      return { thinkingBudget: 1024, maxTokens: 2048, temperature: 0.2 };
    case 'high':
      return { thinkingBudget: 8192, maxTokens: 16384, temperature: 0.4 };
    case 'medium':
    default:
      return { thinkingBudget: 4096, maxTokens: 8192, temperature: 0.3 };
  }
}

