/**
 * RAGHUL AI — INTELLIGENT IMAGE INTENT ROUTER (Phase 1 Upgrade)
 * 
 * Deeply classifies user intent across 7 distinct categories:
 * 1. GENERATE_NEW_IMAGE     - Creative, artistic, or realistic AI image synthesis
 * 2. EDIT_EXISTING_IMAGE    - Conversational image modifications, adjustments & variations
 * 3. GENERATE_INFOGRAPHIC   - Educational roadmaps, guides, timelines, syllabus, study plans
 * 4. GENERATE_DIAGRAM       - Architecture diagrams, flowcharts, system topologies, ER models
 * 5. GENERATE_CHART         - Data visualization, statistical graphs, comparisons, timetables
 * 6. FIND_EXISTING_IMAGE    - Explicit request for an existing real-world photo or historical image
 * 7. NORMAL_CONVERSATION    - Standard text/code dialogue with zero image generation
 * 
 * Accurately filters out normal conversational inquiries containing the word "image"
 * (e.g. "What is an image format?", "How does JPEG compression work?").
 * Supports English, Tamil, Tanglish, and Slash Commands.
 */

export const IMAGE_INTENTS = {
  GENERATE_NEW_IMAGE: 'GENERATE_NEW_IMAGE',
  EDIT_EXISTING_IMAGE: 'EDIT_EXISTING_IMAGE',
  GENERATE_INFOGRAPHIC: 'GENERATE_INFOGRAPHIC',
  GENERATE_DIAGRAM: 'GENERATE_DIAGRAM',
  GENERATE_CHART: 'GENERATE_CHART',
  FIND_EXISTING_IMAGE: 'FIND_EXISTING_IMAGE',
  NORMAL_CONVERSATION: 'NORMAL_CONVERSATION'
};

/**
 * Normal conversational question patterns that contain "image" but are NOT generation requests.
 */
const INFORMATIONAL_IMAGE_QUESTIONS = [
  /^(?:what|how|why|when|where|which|who|can you explain|explain|describe|tell me about|difference between|is it possible to)\b/i,
  /\b(?:how\s+(?:does|do|can|to|would)\s+(?:an?\s+)?(?:image|photo|picture|jpeg|png|svg)\s+(?:compression|processing|format|resolution|codec|sensor|work|differ))\b/i,
  /\b(?:what\s+is\s+(?:an?\s+)?(?:image|raster|vector|bitmap|svg|pixel|resolution|aspect\s*ratio))\b/i,
  /\b(?:how\s+to\s+(?:train|build|code|load|display|compress|resize|crop|process)\s+(?:an?\s+)?(?:image|images)\s+(?:in|using|with)\b)/i,
  /\b(?:image\s+(?:classification|segmentation|processing|recognition|enhancement)\s+(?:model|algorithm|library|pipeline|tutorial))\b/i
];

/**
 * Classify user message intent given conversation context.
 * 
 * @param {string} message - Current user message
 * @param {Array|object} context - Array of history turns or context object
 * @returns {object} { intent: string, confidence: number, subject: string, concept: string, isImageIntent: boolean, category: string }
 */
export function classifyImageIntent(message, context = {}) {
  if (!message || typeof message !== 'string') {
    return {
      intent: IMAGE_INTENTS.NORMAL_CONVERSATION,
      confidence: 1.0,
      subject: '',
      concept: '',
      isImageIntent: false,
      category: 'chat'
    };
  }

  const raw = message.trim();
  const lower = raw.toLowerCase();

  // Normalize history context if passed as an array
  const historyTurns = Array.isArray(context) ? context : (context.history || []);
  const hasPreviousImage = Boolean(context.previousImageAssetId || context.lastImage || context.hasGeneratedImageInSession);

  // Analyze history for educational / architectural / tabular content
  const historyCombined = historyTurns.slice(-8).map(t => t.text || '').join(' ').toLowerCase();
  const isHistoryRoadmap = /\b(roadmap|curriculum|30-day|30\s*days|learning\s*path|syllabus|milestones)\b/i.test(historyCombined);
  const isHistoryArchitecture = /\b(architecture|component|components|zustand|redux|microservices|fastapi|backend|frontend|api\s*gateway|database|docker)\b/i.test(historyCombined);
  const isHistoryTimetable = /\b(timetable|schedule|time\s*slot|routine|study\s*plan|hours)\b/i.test(historyCombined);
  const isHistoryChartData = /\b(\d+%\s*|\b\d+\s*(?:users|sales|revenue|requests|ms|latency|growth)\b)/i.test(historyCombined);

  // 1. RULE OUT INFORMATIONAL / CONCEPTUAL QUESTIONS ABOUT IMAGES
  // If user is asking an educational or technical question about images (not commanding a generation),
  // it must stay as NORMAL_CONVERSATION.
  const hasExplicitGenerationCommand = /\b(generate|create|draw|make|render|produce|paint|illustrate|synthesize|pannu|pottu\s*kudu)\b/i.test(lower);
  
  if (!hasExplicitGenerationCommand) {
    for (const infoPat of INFORMATIONAL_IMAGE_QUESTIONS) {
      if (infoPat.test(lower)) {
        return {
          intent: IMAGE_INTENTS.NORMAL_CONVERSATION,
          confidence: 0.98,
          subject: '',
          concept: '',
          isImageIntent: false,
          category: 'chat'
        };
      }
    }
  }

  // 2. EXPLICIT SLASH COMMANDS
  if (lower.startsWith('/edit-image ') || lower.startsWith('/editimg ')) {
    const sub = raw.replace(/^\/(edit-image|editimg)\s+/i, '').trim();
    return {
      intent: IMAGE_INTENTS.EDIT_EXISTING_IMAGE,
      confidence: 1.0,
      subject: sub,
      concept: sub,
      isImageIntent: true,
      category: 'editing'
    };
  }

  if (lower.startsWith('/infographic ') || lower.startsWith('/roadmap-image ')) {
    const sub = raw.replace(/^\/(infographic|roadmap-image)\s+/i, '').trim();
    return {
      intent: IMAGE_INTENTS.GENERATE_INFOGRAPHIC,
      confidence: 1.0,
      subject: sub,
      concept: sub,
      isImageIntent: true,
      category: 'infographic'
    };
  }

  if (lower.startsWith('/diagram ') || lower.startsWith('/flowchart ') || lower.startsWith('/architecture ')) {
    const sub = raw.replace(/^\/(diagram|flowchart|architecture)\s+/i, '').trim();
    return {
      intent: IMAGE_INTENTS.GENERATE_DIAGRAM,
      confidence: 1.0,
      subject: sub,
      concept: sub,
      isImageIntent: true,
      category: 'diagram'
    };
  }

  if (lower.startsWith('/chart ') || lower.startsWith('/dataviz ') || lower.startsWith('/timetable ')) {
    const sub = raw.replace(/^\/(chart|dataviz|timetable)\s+/i, '').trim();
    return {
      intent: IMAGE_INTENTS.GENERATE_CHART,
      confidence: 1.0,
      subject: sub,
      concept: sub,
      isImageIntent: true,
      category: 'chart'
    };
  }

  if (lower.startsWith('/image ') || lower.startsWith('/draw ') || lower.startsWith('/art ') || lower.startsWith('/img ')) {
    const sub = raw.replace(/^\/(image|draw|art|img)\s+/i, '').trim();
    if (/\b(roadmap|infographic|timeline|curriculum|30-day|30 days|guide|cheat\s*sheet)\b/i.test(sub)) {
      return {
        intent: IMAGE_INTENTS.GENERATE_INFOGRAPHIC,
        confidence: 0.95,
        subject: sub,
        concept: sub,
        isImageIntent: true,
        category: 'infographic'
      };
    }
    if (/\b(diagram|architecture|flowchart|topology|uml|component)\b/i.test(sub)) {
      return {
        intent: IMAGE_INTENTS.GENERATE_DIAGRAM,
        confidence: 0.95,
        subject: sub,
        concept: sub,
        isImageIntent: true,
        category: 'diagram'
      };
    }
    return {
      intent: IMAGE_INTENTS.GENERATE_NEW_IMAGE,
      confidence: 1.0,
      subject: sub,
      concept: sub,
      isImageIntent: true,
      category: 'raster'
    };
  }

  // 3. FIND_EXISTING_IMAGE — Explicit request for a real-world photo or external picture citation
  const findMatch = lower.match(/^(?:find|search|lookup|get|fetch|show\s+me)\s+(?:an?\s+)?(?:actual|real|existing)?\s*(?:photo|photograph|stock\s+photo|picture|image)\s+(?:of|for)\s+(.+)$/i);
  if (findMatch && !/\b(generate|create|draw|make|synthesize|design|pannu)\b/i.test(lower)) {
    const sub = findMatch[1].trim();
    return {
      intent: IMAGE_INTENTS.FIND_EXISTING_IMAGE,
      confidence: 0.92,
      subject: sub,
      concept: sub,
      isImageIntent: false, // Routed to grounded search
      category: 'search'
    };
  }

  // 4. EDIT_EXISTING_IMAGE — Conversational Image Modification
  const editPatterns = [
    /\b(?:in\s+this\s+image|in\s+the\s+image|to\s+this\s+image|modify\s+this\s+image|edit\s+this\s+image|intha\s+image\s+la)\b/i,
    /^(?:please\s+)?(?:change|modify|edit|update|alter|adjust|tweak|replace|swap|remove|add\s+to)\s+(?:the|this|that|previous)?\s*(?:image|photo|background|text|color|colors|contrast|lighting|layout)/i,
    /^(?:make|turn)\s+(?:the|this|previous)?\s*(?:background|text|image|colors?)\s+(?:darker|lighter|blue|red|green|cyan|bigger|smaller|cleaner)/i,
    /(?:intha\s+image|antha\s+image|intha\s+picture|image\s+la)\s+(?:background|text|color|layout).*(?:mathu|change\s+pannu|modify\s+pannu|add\s+pannu)/i,
    /(?:background|text|color).*(?:change\s+pannu|mathu|blue\s+ah\s+aaku|dark\s+ah\s+aaku)/i
  ];

  for (const pat of editPatterns) {
    if (pat.test(lower)) {
      return {
        intent: IMAGE_INTENTS.EDIT_EXISTING_IMAGE,
        confidence: hasPreviousImage ? 0.95 : 0.88,
        subject: raw,
        concept: raw,
        isImageIntent: true,
        category: 'editing'
      };
    }
  }

  // 5. CONVERSATIONAL DEICTIC REFERENCES ("Create an image for this", "Ippo ithuku oru image create pannu", "Itha visual diagram ah create pannu")
  const isDeicticReference = /\b(for\s+this|of\s+this|from\s+this|for\s+that|of\s+that|this\s+roadmap|previous\s+roadmap|above\s+roadmap|the\s+timetable|ithuku|itha|ithula|athuku)\b/i.test(lower) ||
    /^(?:ippo\s+)?(?:ithuku|itha)\s+(?:oru\s+)?(?:image|img|diagram|visual|chart|flowchart|poster)\s+(?:create|generate|draw|make|pottu)\s+(?:pannu|kudu)/i.test(lower) ||
    /^(?:generate|create|draw|make)\s+(?:an?\s+)?(?:image|visual|diagram|chart|infographic)\s+(?:for|of|from)\s+(?:this|that|above|it|our\s+chat|the\s+above|the\s+previous\s+\w+)$/i.test(lower);

  if (isDeicticReference) {
    // 1. If user explicitly requested a diagram or architecture
    if (/\b(diagram|flowchart|architecture|system\s+design|topology)\b/i.test(lower)) {
      return {
        intent: IMAGE_INTENTS.GENERATE_DIAGRAM,
        confidence: 0.95,
        subject: raw,
        concept: raw,
        isImageIntent: true,
        category: 'diagram',
        isContextualReference: true
      };
    }

    // 2. If user explicitly requested a chart or timetable
    if (/\b(chart|graph|plot|dataviz|timetable|schedule)\b/i.test(lower)) {
      return {
        intent: IMAGE_INTENTS.GENERATE_CHART,
        confidence: 0.95,
        subject: raw,
        concept: raw,
        isImageIntent: true,
        category: 'chart',
        isContextualReference: true
      };
    }

    // 3. If history is an educational roadmap / curriculum
    if (isHistoryRoadmap || /\b(roadmap|guide|study\s*plan|curriculum|30-day|30\s*days)\b/i.test(lower)) {
      return {
        intent: IMAGE_INTENTS.GENERATE_INFOGRAPHIC,
        confidence: 0.95,
        subject: raw,
        concept: raw,
        isImageIntent: true,
        category: 'infographic',
        isContextualReference: true
      };
    }

    // 4. If history is architecture/components
    if (isHistoryArchitecture) {
      return {
        intent: IMAGE_INTENTS.GENERATE_DIAGRAM,
        confidence: 0.95,
        subject: raw,
        concept: raw,
        isImageIntent: true,
        category: 'diagram',
        isContextualReference: true
      };
    }

    // 5. If history is timetable/schedule
    if (isHistoryTimetable) {
      return {
        intent: IMAGE_INTENTS.GENERATE_CHART,
        confidence: 0.95,
        subject: raw,
        concept: raw,
        isImageIntent: true,
        category: 'chart',
        isContextualReference: true
      };
    }

    // General contextual visual request
    return {
      intent: IMAGE_INTENTS.GENERATE_NEW_IMAGE,
      confidence: 0.9,
      subject: raw,
      concept: raw,
      isImageIntent: true,
      category: 'raster',
      isContextualReference: true
    };
  }

  // 6. GENERATE_INFOGRAPHIC — Educational roadmaps, timelines, 30-day schedules, guides
  const infographicPatterns = [
    /\b(roadmap|learning\s*path|infographic|curriculum|syllabus|study\s*plan|step-by-step\s*guide|timeline)\b.*\b(image|img|poster|diagram|visual|graphic|photo)\b/i,
    /\b(image|img|poster|visual|infographic)\b.*\b(roadmap|30-day|30\s*days|60-day|curriculum|learning\s*path|timeline)\b/i,
    /(?:create|generate|make|draw|design)\s+(?:an?\s+)?(?:educational\s+)?(?:infographic|roadmap|cheat\s*sheet|guide\s*poster)/i,
    /(?:roadmap|infographic|study\s*plan).*(?:image|img|poster).*(?:generate|create|pannu)/i,
    /(?:image|img|poster).*(?:generate|create|make).*(?:roadmap|infographic|syllabus|30\s*days?)/i
  ];

  for (const pat of infographicPatterns) {
    if (pat.test(lower)) {
      return {
        intent: IMAGE_INTENTS.GENERATE_INFOGRAPHIC,
        confidence: 0.95,
        subject: raw,
        concept: raw,
        isImageIntent: true,
        category: 'infographic'
      };
    }
  }

  // 7. GENERATE_DIAGRAM & FLOWCHART
  const diagramPatterns = [
    /\b(architecture|system|network|database|er|flowchart|sequence|uml)\s+(?:diagram|chart|graph)\s+(?:image|visual|drawing|illustration)/i,
    /\b(generate|create|draw|make)\s+(?:an?\s+)?(?:architecture\s+diagram|flowchart|system\s+topology|uml\s+diagram)/i,
    /(?:flowchart|diagram|architecture).*(?:image|drawing|visual).*(?:generate|create|pannu)/i,
    /(?:itha|ithuku)\s+(?:visual\s+)?diagram\s*(?:ah)?\s*(?:create|generate|draw)\s*pannu/i
  ];

  for (const pat of diagramPatterns) {
    if (pat.test(lower)) {
      return {
        intent: IMAGE_INTENTS.GENERATE_DIAGRAM,
        confidence: 0.94,
        subject: raw,
        concept: raw,
        isImageIntent: true,
        category: 'diagram'
      };
    }
  }

  // 8. GENERATE_CHART, TIMETABLE & DATA VISUALIZATION
  const chartPatterns = [
    /\b(bar\s*chart|pie\s*chart|line\s*graph|data\s*visualization|infographic\s*chart|timetable|study\s*schedule)\s+(?:image|graphic|visual)/i,
    /\b(generate|create|render)\s+(?:an?\s+)?(?:comparison\s*chart|statistical\s*chart|metrics\s*graph|timetable|schedule)\s+image/i,
    /(?:chart|timetable|schedule).*(?:image|visual).*(?:generate|create|draw|pannu)/i
  ];

  for (const pat of chartPatterns) {
    if (pat.test(lower)) {
      return {
        intent: IMAGE_INTENTS.GENERATE_CHART,
        confidence: 0.92,
        subject: raw,
        concept: raw,
        isImageIntent: true,
        category: 'chart'
      };
    }
  }

  // 9. GENERATE_NEW_IMAGE — General Native Creative / Realistic / Artistic Raster
  const genImagePatterns = [
    /^(?:please\s+)?(?:generate|create|draw|make|render|produce|synthesize|paint|illustrate)\s+(?:an?\s+)?(?:image|photo|picture|artwork|illustration|graphic|portrait|drawing|art|visual|scenery|wallpaper)\s+(?:of|showing|about|for|depicting|with)\s+(.+)$/i,
    /^(?:please\s+)?(?:generate|create|draw|make|render|paint|illustrate)\s+(?:an?\s+)?(?:realistic|cinematic|cyberpunk|photorealistic|isometric|3d|vintage|fantasy|anime|digital)?\s*(?:mountain|landscape|sunset|sunrise|portrait|city|cyberpunk|robot|nature|scenery|forest|galaxy|cosmos|dragon|car|space|animal|wildlife|artwork|illustration|painting|wallpaper|scene)(.*)$/i,
    /^(?:please\s+)?(?:generate|create|draw|make|render|paint)\s+(?:an?\s+)?(?:realistic|cinematic|cyberpunk|anime|vintage|surreal|hyperrealistic)\s+(.+)$/i,
    /\b(?:generate|create|draw|make)\s+(?:an?\s+)?(?:image|photo|picture|artwork|illustration|art)\b/i,
    /^(?:an?\s+)?(?:image|photo|picture|artwork|illustration)\s+(?:of|showing|depicting)\s+(.+)$/i
  ];

  for (const pat of genImagePatterns) {
    const m = raw.match(pat);
    if (m) {
      const subject = m[1] ? m[1].trim() : raw;
      return {
        intent: IMAGE_INTENTS.GENERATE_NEW_IMAGE,
        confidence: 0.9,
        subject,
        concept: subject,
        isImageIntent: true,
        category: 'raster'
      };
    }
  }

  // Tamil / Tanglish generation commands:
  const tamGenPatterns = [
    /(.+?)\s+(?:image|img|photo|picture|drawing|art|artwork)\s+(?:generate|create|draw|make|build)\s+pannu/i,
    /^(?:oru\s+)?(?:image|img|photo|picture|drawing|art)\s+(?:generate|create|draw|make|build)\s+pannu\s+(?:for\s+|about\s+)?(.+)$/i,
    /(?:image|img|photo)\s+(?:onnu|oru\s+image)\s+(?:create|generate|pottu)\s+(?:kudu|pannu)/i,
    /(?:image|photo)\s+(?:theva|venum).*(?:generate|create)/i
  ];

  for (const pat of tamGenPatterns) {
    const m = raw.match(pat);
    if (m) {
      const subject = m[1] ? m[1].trim() : raw;
      return {
        intent: IMAGE_INTENTS.GENERATE_NEW_IMAGE,
        confidence: 0.9,
        subject,
        concept: subject,
        isImageIntent: true,
        category: 'raster'
      };
    }
  }

  // Default: Normal conversation
  return {
    intent: IMAGE_INTENTS.NORMAL_CONVERSATION,
    confidence: 0.99,
    subject: '',
    concept: '',
    isImageIntent: false,
    category: 'chat'
  };
}

export default classifyImageIntent;
