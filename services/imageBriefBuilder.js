/**
 * NEXUS AI — STRUCTURED VISUAL BRIEF BUILDER (Phase 3 Upgrade)
 * 
 * Transforms pre-generation thinking and validated planning into a complete structured visual brief:
 * - Adheres strictly to the production schema (intent, subject, objective, source_context, content_plan, visual_plan, quality_requirements)
 * - Dynamically compiled from user request and conversation context — never hardcoded
 * - Constructs optimized provider generation prompts for native raster diffusion models
 */

export class ImageBriefBuilder {
  /**
   * Builds the complete structured visual brief.
   * 
   * @param {object} params
   * @param {object} params.thinkingPlan - From ImageThinkingEngine
   * @param {object} params.contextBundle - From ImageConversationContextService
   * @returns {object} Production Visual Brief
   */
  static buildStructuredBrief({ thinkingPlan, contextBundle }) {
    const intentEvaluation = thinkingPlan?.intentEvaluation || {};
    const contentPlan = thinkingPlan?.contentPlan || {};
    const designPlan = thinkingPlan?.designPlan || {};
    const qualityPlan = thinkingPlan?.qualityPlan || {};

    const subject = intentEvaluation.referencedTopic || contextBundle?.topic || contextBundle?.userRequest || 'Visual Artwork';
    const objective = contextBundle?.purpose || (contentPlan.contentType === 'educational_roadmap' 
      ? `Provide a clear, progressive learning curriculum for ${subject}` 
      : `Provide a high-fidelity visual communication of ${subject}`);

    // Dynamic negative constraints tailored to the visual style
    const negativeConstraints = [
      'ugly', 'deformed', 'blurry', 'watermark', 'signature', 'low quality',
      'compression artifacts', 'unrelated stock photo'
    ];
    if (qualityPlan.readableTextGuaranteed) {
      negativeConstraints.push('distorted text', 'scrambled letters', 'missing steps', 'duplicate steps');
    }

    // Construct enriched prompt for native raster diffusion models
    let finalPrompt = '';
    const visualFormat = designPlan.format || 'Visual Artwork';

    if (contentPlan.contentType === 'creative_raster') {
      finalPrompt = `Photorealistic 8K render of ${subject}. Cinematic composition, natural volumetric lighting, 35mm lens, sharp focus, hyper-detailed textures, breathtaking realism, no text overlay.`;
    } else if (contentPlan.contentType === 'technical_architecture') {
      finalPrompt = `Clean high-contrast technical architecture diagram of ${subject}. Layered components: ${(contentPlan.mandatory_topics || []).slice(0, 6).join(', ')}. Professional engineering blueprint.`;
    } else {
      finalPrompt = `${visualFormat} for ${subject}. Target audience: ${intentEvaluation.targetAudience || 'General'}. Clear visual hierarchy, high contrast, clean typography.`;
    }

    const brief = {
      intent: intentEvaluation.detectedIntent || contextBundle?.intentType || 'GENERATE_NEW_IMAGE',
      subject,
      objective,
      source_context: {
        topic: contextBundle?.domain || subject,
        skill_level: intentEvaluation.targetAudience || 'Beginner to Intermediate',
        source: contextBundle?.isConversationalReference ? 'Current conversation context' : 'Direct user prompt',
        context_references: contextBundle?.rawSourceText ? [contextBundle.rawSourceText.slice(0, 200)] : []
      },
      content_plan: {
        required_sections: contentPlan.required_sections || [],
        mandatory_topics: contentPlan.mandatory_topics || [],
        sequence: contentPlan.sequence || [],
        key_information: contentPlan.key_information || [],
        excluded_content: contentPlan.excluded_content || negativeConstraints
      },
      visual_plan: {
        format: visualFormat,
        layout: designPlan.layout || 'Balanced visual composition',
        grid_system: designPlan.gridSystem || 'Adaptive layout',
        hierarchy: designPlan.hierarchy || [],
        typography: designPlan.typography || {},
        color_palette: designPlan.colorPalette || [],
        contrast: designPlan.contrast || 'Standard High Contrast',
        aspect_ratio: designPlan.aspectRatio || '1:1',
        density: designPlan.density || 'Standard',
        background: designPlan.background || 'Neutral',
        illustration_style: designPlan.illustrationStyle || 'Modern clean vector'
      },
      quality_requirements: {
        readable_text: qualityPlan.readableTextGuaranteed !== false,
        complete_content: true,
        no_missing_sections: true,
        no_unrelated_visuals: true,
        dimensions: qualityPlan.targetDimensions || { width: 1024, height: 1024 }
      },
      strategy: qualityPlan.strategy || 'STRATEGY_RASTER',
      engineName: qualityPlan.engineName || 'native-multimodal-router',
      finalPrompt,
      category: visualFormat,
      imageCategory: visualFormat,
      aspectRatio: designPlan.aspectRatio || '1:1',
      negativeConstraints
    };

    return brief;
  }

  /**
   * Compatibility wrapper for existing consumers.
   */
  static buildBrief(contextBundle) {
    const mockThinking = {
      intentEvaluation: {
        detectedIntent: contextBundle.intentType || 'GENERATE_NEW_IMAGE',
        referencedTopic: contextBundle.topic || contextBundle.userRequest
      },
      contentPlan: {
        contentType: contextBundle.isRoadmap ? 'educational_roadmap' : (contextBundle.isArchitecture ? 'technical_architecture' : 'creative_raster')
      },
      designPlan: {
        format: contextBundle.isRoadmap ? 'Structured Editorial Infographic' : (contextBundle.isArchitecture ? 'Engineering Architecture Topology' : 'Visual Artwork'),
        aspectRatio: contextBundle.visualPreferences?.aspectRatio || '1:1'
      },
      qualityPlan: {
        strategy: contextBundle.isRoadmap ? 'STRATEGY_VECTOR' : 'STRATEGY_RASTER'
      }
    };
    return ImageBriefBuilder.buildStructuredBrief({ thinkingPlan: mockThinking, contextBundle });
  }
}

export function buildImageBrief(input = {}) {
  if (input.thinkingPlan && input.contextBundle) {
    return ImageBriefBuilder.buildStructuredBrief(input);
  }
  const contextBundle = input.contextBundle || input;
  if (!contextBundle.topic && input.prompt) contextBundle.topic = input.prompt;
  if (!contextBundle.userRequest && input.prompt) contextBundle.userRequest = input.prompt;
  return ImageBriefBuilder.buildBrief(contextBundle);
}

export default ImageBriefBuilder;
