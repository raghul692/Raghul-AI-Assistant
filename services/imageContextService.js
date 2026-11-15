/**
 * RAGHUL AI — CONVERSATION CONTEXT INTELLIGENCE SERVICE (Phase 1 & 2 Upgrade)
 * 
 * Deeply resolves conversational deictic references and extracts complete source facts:
 * - Resolves "this", "ithuku", "itha", "the previous roadmap", "above architecture"
 * - Handles topic switching: searches back to the referenced topic even if intervening topics exist
 * - Extracts structured data from chat: 30-day curricula, architecture components, timetables, chart numbers
 * - Detects whether sufficient source information exists or if essential data is missing
 * - Builds an auditable context bundle without leaking internal chain-of-thought
 */

import { getImageAssetBySession } from './imageStorageService.js';

export class ImageConversationContextService {
  /**
   * Deeply resolves conversation context from chat history and user message.
   * 
   * @param {object} params
   * @param {string} params.conversationId - Active session ID
   * @param {string} params.userMessage - Current instruction from user
   * @param {Array} params.history - Array of { role: 'user'|'model', text: string }
   * @param {object} params.intent - Intent classification object from IntentRouter
   * @returns {Promise<object>} Structured context bundle
   */
  static async buildContextBundle({ conversationId, userMessage, history = [], intent = {} }) {
    const rawMessage = (userMessage || '').trim();
    const lowerMessage = rawMessage.toLowerCase();

    // 1. Locate previous generated image in session (for editing or versioning)
    let previousAsset = null;
    try {
      previousAsset = getImageAssetBySession(conversationId);
    } catch (e) {
      // Non-blocking fallback
    }

    const turns = (history || []).slice(-20); // inspect up to 20 recent turns
    const combinedHistoryText = turns.map(t => `${t.role}: ${t.text || ''}`).join('\n');

    // 2. Detect Specific Referenced Concept (Roadmap, Architecture, Timetable, Chart)
    const refersToRoadmap = /\b(roadmap|curriculum|30-day|30\s*days|learning\s*path|syllabus|study\s*plan)\b/i.test(rawMessage) ||
      (/\b(ithuku|itha|this|that|above|previous)\b/i.test(rawMessage) && /\b(roadmap|curriculum|30-day|30\s*days|learning\s*path)\b/i.test(combinedHistoryText));

    const refersToArchitecture = /\b(architecture|component|components|system\s*design|topology|diagram)\b/i.test(rawMessage) ||
      (/\b(ithuku|itha|this|that|above|previous)\b/i.test(rawMessage) && /\b(architecture|components|zustand|redux|fastapi|backend|frontend|api\s*gateway|microservice)\b/i.test(combinedHistoryText));

    const refersToTimetable = /\b(timetable|routine|schedule|time\s*slots?|hours)\b/i.test(rawMessage) ||
      (/\b(ithuku|itha|this|that|above|previous)\b/i.test(rawMessage) && /\b(timetable|schedule|routine|am|pm|monday|tuesday)\b/i.test(combinedHistoryText));

    const refersToChart = /\b(chart|graph|plot|metrics|dataviz|comparison)\b/i.test(rawMessage) ||
      (/\b(ithuku|itha|this|that|above|previous)\b/i.test(rawMessage) && /\b(\d+%\s*|\b\d+\s*(?:users|sales|revenue|requests|growth)\b)/i.test(combinedHistoryText));

    // 3. Deictic Historical Search: If user specifically asks for "the previous roadmap" or "the architecture",
    // search backward through history to find the relevant turn, even if the user switched topics in between!
    let targetSourceText = '';
    let resolvedDomain = '';
    let extractedTopic = '';
    let extractedData = [];
    let hasSufficientSource = true;
    let missingInfoReason = null;

    if (refersToRoadmap) {
      // Find the turn where the roadmap was discussed
      for (let i = turns.length - 1; i >= 0; i--) {
        const turn = turns[i];
        const text = turn.text || '';
        if (/\b(roadmap|curriculum|day\s*\d+|week\s*\d+|30-day|30\s*days)\b/i.test(text)) {
          targetSourceText = text;
          // Extract programming language or domain
          const langMatch = text.match(/\b(python|javascript|typescript|react|nodejs|golang|rust|sql|ai|machine\s*learning|dsa)\b/i);
          if (langMatch) {
            resolvedDomain = langMatch[1].toUpperCase();
          }
          break;
        }
      }

      if (!resolvedDomain) {
        const m = (rawMessage + ' ' + combinedHistoryText).match(/\b(python|javascript|typescript|react|nodejs|golang|rust|sql|ai|machine\s*learning|dsa)\b/i);
        resolvedDomain = m ? m[1].toUpperCase() : 'PROGRAMMING';
      }

      extractedTopic = `${resolvedDomain} 30-Day Comprehensive Learning Roadmap`;

      // Extract day lines if present
      if (targetSourceText) {
        const lines = targetSourceText.split('\n');
        const dayMatches = lines.filter(l => /^(?:day\s*\d+|week\s*\d+|\d+\.|\-|\*)\s+/i.test(l.trim()));
        if (dayMatches.length > 0) {
          extractedData = dayMatches.map(m => m.replace(/^[-*#\s]+/, '').trim());
        }
      }
    } else if (refersToArchitecture) {
      // Find the turn discussing system architecture / components
      for (let i = turns.length - 1; i >= 0; i--) {
        const turn = turns[i];
        const text = turn.text || '';
        if (/\b(architecture|component|components|frontend|backend|api|database|state)\b/i.test(text)) {
          targetSourceText = text;
          const techMatch = text.match(/\b(react|next\.?js|vue|angular|fastapi|node|express|django|microservices?)\b/i);
          if (techMatch) {
            resolvedDomain = techMatch[1].toUpperCase();
          }
          break;
        }
      }

      if (!resolvedDomain) {
        const m = (rawMessage + ' ' + combinedHistoryText).match(/\b(react|next\.?js|fastapi|node|django|microservices?)\b/i);
        resolvedDomain = m ? m[1].toUpperCase() : 'SYSTEM';
      }

      extractedTopic = `${resolvedDomain} System Architecture`;

      // Extract identified components
      if (targetSourceText) {
        const componentMatches = targetSourceText.match(/\b([A-Z][a-zA-Z0-9]+(?:\s+(?:Component|Store|Layer|Service|API|Gateway|Database|Hook|Model|Router))?)\b/g);
        if (componentMatches) {
          extractedData = Array.from(new Set(componentMatches)).slice(0, 12);
        }
      }
    } else if (refersToTimetable) {
      // Find the timetable or schedule turn
      for (let i = turns.length - 1; i >= 0; i--) {
        const turn = turns[i];
        const text = turn.text || '';
        if (/\b(timetable|schedule|routine|am|pm|monday|hours)\b/i.test(text)) {
          targetSourceText = text;
          break;
        }
      }

      extractedTopic = 'Structured Study Timetable & Daily Schedule';

      if (targetSourceText) {
        const lines = targetSourceText.split('\n');
        const slotMatches = lines.filter(l => /\b(\d{1,2}(?::\d{2})?\s*(?:am|pm)?\s*[-–to]+\s*\d{1,2}(?::\d{2})?\s*(?:am|pm)?|morning|afternoon|evening|night)\b/i.test(l));
        if (slotMatches.length > 0) {
          extractedData = slotMatches.map(s => s.trim());
        }
      }

      if (extractedData.length === 0 && !targetSourceText) {
        hasSufficientSource = false;
        missingInfoReason = 'No timetable slots or study hours were provided in the conversation.';
      }
    } else if (refersToChart) {
      // Find numerical data points in conversation
      for (let i = turns.length - 1; i >= 0; i--) {
        const turn = turns[i];
        const text = turn.text || '';
        if (/\b(\d+%\s*|\b\d+\s*(?:users|sales|revenue|latency|growth)\b)/i.test(text)) {
          targetSourceText = text;
          break;
        }
      }

      extractedTopic = 'Data Analytics & Metrics Visualization';

      // Parse numerical key-values (e.g. Q1: 100, Q2: 250)
      if (targetSourceText) {
        const matches = targetSourceText.matchAll(/([A-Za-z0-9_\s]{2,20})\s*[:=-]\s*(\d+(?:\.\d+)?%?)/g);
        for (const m of matches) {
          extractedData.push({ label: m[1].trim(), value: m[2].trim() });
        }
      }

      // Check if user requested a chart but gave NO numbers
      if (extractedData.length === 0 && !/\b\d+\b/.test(rawMessage + ' ' + targetSourceText)) {
        hasSufficientSource = false;
        missingInfoReason = 'Please provide the specific numerical data points or values you would like to plot in this chart.';
      }
    } else {
      // General Visual Request
      extractedTopic = intent.subject || intent.concept || rawMessage;
      // Check if user asked for an infographic of something completely unspecified
      if (intent.intent === 'GENERATE_INFOGRAPHIC' && !targetSourceText && rawMessage.length < 15) {
        hasSufficientSource = false;
        missingInfoReason = 'Please specify the topic or content you would like in this infographic.';
      }
    }

    // 4. Determine Target Audience and Skill Level
    let audience = 'Beginner to Intermediate';
    if (/\b(beginner|from zero|starting out|basics|novice|scratch|junior|freshman)\b/i.test(combinedHistoryText + ' ' + rawMessage)) {
      audience = 'Beginner (Foundation to Practical Mastery)';
    } else if (/\b(senior|staff|architect|advanced|production-grade|expert)\b/i.test(combinedHistoryText + ' ' + rawMessage)) {
      audience = 'Advanced / Production Engineer';
    }

    // 5. Visual Preferences & Color Palette Selection
    const visualPreferences = {
      theme: 'adaptive_dark',
      colorPalette: 'Deep slate, crisp white typography, primary vibrant accent',
      aspectRatio: '1:1',
      layout: refersToRoadmap ? 'Four-week milestone grid' : (refersToArchitecture ? 'Layered component diagram' : 'Balanced focal hierarchy')
    };

    if (/\b(light\s*theme|white\s*background|light\s*mode|clean\s*white)\b/i.test(rawMessage)) {
      visualPreferences.theme = 'editorial_light';
      visualPreferences.colorPalette = 'Clean off-white (#FFFFFF), slate charcoal text, subtle gray borders';
    } else if (/\b(blue|navy|electric\s*cyan|cyan)\b/i.test(rawMessage)) {
      visualPreferences.theme = 'ocean_cyan';
      visualPreferences.colorPalette = 'Deep midnight blue (#0A1128), electric cyan (#06B6D4), crisp white text';
    } else if (/\b(cyberpunk|neon|purple|violet)\b/i.test(rawMessage)) {
      visualPreferences.theme = 'cyberpunk_neon';
      visualPreferences.colorPalette = 'Dark obsidian (#090D16), neon violet (#A855F7), electric magenta';
    }

    if (/\b(16:9|widescreen|horizontal|landscape)\b/i.test(rawMessage)) {
      visualPreferences.aspectRatio = '16:9';
    } else if (/\b(9:16|portrait|vertical|story)\b/i.test(rawMessage)) {
      visualPreferences.aspectRatio = '9:16';
    } else if (/\b(4:5|social|poster)\b/i.test(rawMessage)) {
      visualPreferences.aspectRatio = '4:5';
    }

    return {
      conversationId,
      userRequest: rawMessage,
      intentType: intent.intent || 'GENERATE_NEW_IMAGE',
      topic: extractedTopic || rawMessage,
      domain: resolvedDomain || 'GENERAL',
      audience,
      purpose: refersToRoadmap ? 'Educational Infographic Roadmap' : (refersToArchitecture ? 'System Architecture Diagram' : (refersToTimetable ? 'Study Timetable' : 'Visual Artwork')),
      isRoadmap: refersToRoadmap,
      isArchitecture: refersToArchitecture,
      isTimetable: refersToTimetable,
      isChart: refersToChart,
      isEditing: intent.intent === 'EDIT_EXISTING_IMAGE' && Boolean(previousAsset),
      hasSufficientSource,
      missingInfoReason,
      rawSourceText: targetSourceText || rawMessage,
      extractedData,
      visualPreferences,
      previousImageAssetId: previousAsset ? previousAsset.id : null,
      previousImageUrl: previousAsset ? previousAsset.url : null,
      contextSummary: `User requested ${refersToRoadmap ? 'Roadmap' : (refersToArchitecture ? 'Architecture' : 'Visual')} for "${extractedTopic || rawMessage}". Context resolved.`
    };
  }
}

export function buildConversationContextBundle({ currentMessage, conversationHistory = [], sessionId = null, intent = {} }) {
  return ImageConversationContextService.buildContextBundle({
    conversationId: sessionId,
    userMessage: currentMessage,
    history: conversationHistory,
    intent
  });
}

export default ImageConversationContextService;
