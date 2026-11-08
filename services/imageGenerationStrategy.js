/**
 * NEXUS AI — GENERATION STRATEGY SELECTOR (Phase 6)
 * 
 * Selects the optimal generation method based on visual brief, content density, and user objective:
 * - STRATEGY_RASTER: Native AI generation (Gemini / FLUX) for creative & photorealistic art
 * - STRATEGY_VECTOR: Deterministic SVG for roadmaps, technical diagrams, flowcharts, cheat sheets
 * - STRATEGY_HYBRID: AI background asset + deterministic vector text overlay
 * - STRATEGY_EDIT: Conversational edit using parent image asset reference
 */

export const GENERATION_STRATEGIES = {
  STRATEGY_RASTER: 'STRATEGY_RASTER',
  STRATEGY_VECTOR: 'STRATEGY_VECTOR',
  STRATEGY_HYBRID: 'STRATEGY_HYBRID',
  STRATEGY_EDIT: 'STRATEGY_EDIT'
};

export class ImageGenerationStrategySelector {
  /**
   * Selects the appropriate generation strategy based on intent, content plan, and visual plan.
   * 
   * @param {object} params
   * @param {string} params.intentType - GENERATE_NEW_IMAGE, EDIT_EXISTING_IMAGE, GENERATE_INFOGRAPHIC, etc.
   * @param {object} params.contentPlan - Output from ImageContentPlanner
   * @param {object} params.contextBundle - Output from ImageConversationContextService
   * @returns {object} { strategy: string, engineName: string, reason: string }
   */
  static selectStrategy({ intentType, contentPlan, contextBundle }) {
    // 1. Strategy D: Conversational Image Editing
    if (intentType === 'EDIT_EXISTING_IMAGE' || contextBundle?.isEditing) {
      return {
        strategy: GENERATION_STRATEGIES.STRATEGY_EDIT,
        engineName: 'conversational-editing-engine',
        reason: 'User requested modifications to an existing image. Preserves parent asset lineage and applies delta changes.'
      };
    }

    const contentType = contentPlan?.contentType || '';

    // 2. Strategy B: Deterministic Vector Generation
    // Educational roadmaps, architecture diagrams, flowcharts, timetables, and charts require 100% legible text
    // and zero AI text hallucination.
    if (
      intentType === 'GENERATE_INFOGRAPHIC' ||
      intentType === 'GENERATE_DIAGRAM' ||
      intentType === 'GENERATE_CHART' ||
      contentType === 'educational_roadmap' ||
      contentType === 'technical_architecture' ||
      contentType === 'study_timetable' ||
      contentType === 'data_chart'
    ) {
      return {
        strategy: GENERATION_STRATEGIES.STRATEGY_VECTOR,
        engineName: 'hybrid-infographic-engine',
        reason: 'Information-heavy visual requiring 100% readable text, deterministic layout, and guaranteed complete sequential content.'
      };
    }

    // 3. Strategy A: Native AI Raster Generation
    // Pure creative visuals, photorealistic landscapes, portraits, digital art, cyberpunk concepts
    return {
      strategy: GENERATION_STRATEGIES.STRATEGY_RASTER,
      engineName: 'native-multimodal-router',
      reason: 'Artistic or photorealistic visual concept without tabular data or micro-text. Handled by native generative diffusion models.'
    };
  }
}

export default ImageGenerationStrategySelector;

