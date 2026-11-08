/**
 * NEXUS AI — PRE-GENERATION THINKING & PLANNING ENGINE (Phase 2)
 * 
 * The intelligent pre-generation reasoning and planning layer:
 * - Thinks, understands, plans, and validates before generating any visual asset
 * - Coordinates Intent Understanding, Content Architecture, Design Intelligence, and Strategy Selection
 * - Produces a structured, auditable Visual Plan without leaking raw chain-of-thought
 * - Guards with an Approval Gate: halts and prompts for clarification if essential source facts are missing
 */

import { ImageContentPlanner } from './imageContentPlanner.js';
import { ImageDesignPlanner } from './imageDesignPlanner.js';
import { ImageGenerationStrategySelector, GENERATION_STRATEGIES } from './imageGenerationStrategy.js';

export class ImageThinkingEngine {
  /**
   * Evaluates user intent, conversation context, content completeness, and visual design
   * before constructing an image brief or invoking a generator provider.
   * 
   * @param {object} params
   * @param {string} params.message - Current user instruction
   * @param {object} params.contextBundle - Resolved from ImageConversationContextService
   * @param {object} params.intent - From ImageIntentRouter
   * @returns {Promise<object>} Complete auditable ThinkingPlan & Pre-generation Visual Specification
   */
  static async thinkAndPlan({ message, contextBundle, intent }) {
    const start = Date.now();
    const rawMessage = (message || '').trim();

    // 1. INTENT UNDERSTANDING
    const intentType = intent?.intent || contextBundle?.intentType || 'GENERATE_NEW_IMAGE';
    const isEditing = intentType === 'EDIT_EXISTING_IMAGE' || contextBundle?.isEditing;
    const isContextual = Boolean(contextBundle?.isRoadmap || contextBundle?.isArchitecture || contextBundle?.isTimetable || contextBundle?.isChart);

    const intentEvaluation = {
      detectedIntent: intentType,
      isConversationalReference: isContextual,
      referencedTopic: contextBundle?.topic || rawMessage,
      targetAudience: contextBundle?.audience || 'General',
      isVisualExplanation: isContextual || intentType === 'GENERATE_INFOGRAPHIC' || intentType === 'GENERATE_DIAGRAM',
      confidence: intent?.confidence || 0.95
    };

    // 2. CONTENT UNDERSTANDING & VALIDATION
    const contentPlan = ImageContentPlanner.planContent({
      intentType,
      contextBundle
    });

    // 3. APPROVAL GATE: Check if essential source data is missing
    if (contentPlan.needsClarification) {
      return {
        approved: false,
        needsClarification: true,
        clarificationQuestion: contentPlan.clarificationQuestion,
        intentEvaluation,
        contentPlan,
        thinkingSummary: `Halted generation at Approval Gate: essential source data is missing. Clarification requested.`,
        durationMs: Date.now() - start
      };
    }

    // 4. VISUAL DESIGN PLANNING
    const designPlan = ImageDesignPlanner.planDesign({
      format: contentPlan.contentType,
      contentPlan,
      visualPreferences: contextBundle?.visualPreferences
    });

    // 5. GENERATION STRATEGY SELECTION
    const strategySelection = ImageGenerationStrategySelector.selectStrategy({
      intentType,
      contentPlan,
      contextBundle
    });

    // 6. QUALITY & INTEGRITY PLANNING
    const qualityPlan = {
      strategy: strategySelection.strategy,
      engineName: strategySelection.engineName,
      readableTextGuaranteed: strategySelection.strategy !== GENERATION_STRATEGIES.STRATEGY_RASTER,
      requiresVectorSvg: strategySelection.strategy === GENERATION_STRATEGIES.STRATEGY_VECTOR || strategySelection.strategy === GENERATION_STRATEGIES.STRATEGY_HYBRID,
      targetDimensions: designPlan.aspectRatio === '16:9' ? { width: 1600, height: 900 } : (designPlan.aspectRatio === '4:5' ? { width: 1200, height: 1500 } : { width: 1024, height: 1024 }),
      preventExternalScraping: true,
      nonDestructiveStorage: true
    };

    return {
      approved: true,
      needsClarification: false,
      clarificationQuestion: null,
      intentEvaluation,
      contentPlan,
      designPlan,
      strategySelection,
      qualityPlan,
      thinkingSummary: `Pre-generation reasoning complete: Resolved "${intentEvaluation.referencedTopic}" as ${designPlan.format} via ${strategySelection.strategy} (${strategySelection.engineName}).`,
      durationMs: Date.now() - start
    };
  }
}

export function thinkBeforeGenerate(params) {
  return ImageThinkingEngine.thinkAndPlan(params);
}

export default ImageThinkingEngine;

