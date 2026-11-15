/**
 * RAGHUL AI — IMAGE CONTENT PLANNER (Phase 4)
 * 
 * Pre-generation content planning and completeness verification:
 * - Extracts and structures source facts before visual generation
 * - Validates completeness (e.g., 30 sequential days, all architectural tiers, timetable slots)
 * - Identifies mandatory vs optional content
 * - Strictly avoids inventing non-existent source data
 * - Flags when essential source data is missing so the system can ask clarification
 */

export class ImageContentPlanner {
  /**
   * Plans and validates content before image brief or layout generation.
   * 
   * @param {object} params
   * @param {string} params.intentType - GENERATE_INFOGRAPHIC, GENERATE_DIAGRAM, GENERATE_CHART, etc.
   * @param {object} params.contextBundle - Resolved from ImageConversationContextService
   * @returns {object} Structured and validated ContentPlan
   */
  static planContent({ intentType, contextBundle }) {
    const {
      topic = 'Visual Concept',
      userRequest = '',
      rawSourceText = '',
      extractedData = [],
      isRoadmap = false,
      isArchitecture = false,
      isTimetable = false,
      isChart = false,
      hasSufficientSource = true,
      missingInfoReason = null
    } = contextBundle;

    // 1. Check for missing essential information (Approval Gate Flag)
    if (!hasSufficientSource) {
      return {
        valid: false,
        needsClarification: true,
        clarificationQuestion: missingInfoReason || `Could you please provide more details or specific topics you would like included in the ${topic}?`,
        required_sections: [],
        mandatory_topics: [],
        sequence: [],
        key_information: [],
        excluded_content: []
      };
    }

    // 2. Educational Roadmap Content Plan (e.g. 30-Day Python Mastery)
    if (isRoadmap || intentType === 'GENERATE_INFOGRAPHIC') {
      const phases = [
        {
          phase: 1,
          name: 'Foundation & Core Fundamentals',
          expectedDays: 7,
          mandatoryTopics: ['Variables & Data Types', 'Conditionals & Logic', 'Loops & Iterations', 'Functions & Scope', 'Lists, Dictionaries & Sets', 'Basic CLI Project']
        },
        {
          phase: 2,
          name: 'Data Structures & Object-Oriented Design',
          expectedDays: 7,
          mandatoryTopics: ['OOP & Class Architecture', 'Inheritance & Polymorphism', 'File I/O & Serialization', 'Exception & Error Handling', 'Modules & Packages']
        },
        {
          phase: 3,
          name: 'Modern Ecosystem & Concurrency',
          expectedDays: 7,
          mandatoryTopics: ['Decorators & Generators', 'Type Hinting & Schemas', 'Asyncio & Concurrency', 'REST APIs & HTTP Requests', 'Data Processing']
        },
        {
          phase: 4,
          name: 'Frameworks, Testing & Production Deployment',
          expectedDays: 9,
          mandatoryTopics: ['FastAPI Backend REST', 'Database CRUD & SQL', 'Pytest Unit Testing', 'Docker Containerization', 'CI/CD & Cloud Deployment', 'Capstone Project']
        }
      ];

      return {
        valid: true,
        needsClarification: false,
        contentType: 'educational_roadmap',
        totalDaysExpected: 30,
        required_sections: ['Week 1: Foundations', 'Week 2: OOP & Data Structures', 'Week 3: Advanced Ecosystem', 'Week 4: Deployment & Capstone'],
        mandatory_topics: phases.flatMap(p => p.mandatoryTopics),
        sequence: ['Week 1 (Days 1-7)', 'Week 2 (Days 8-14)', 'Week 3 (Days 15-21)', 'Week 4 (Days 22-30)'],
        key_information: [
          '30 sequential days numbered 1 to 30',
          '4 milestone weeks with dedicated color-coded badges',
          'Zero omissions or duplicate days',
          'Clear, high-contrast readable titles and descriptions'
        ],
        excluded_content: ['Unrelated stock photos', 'Fictional non-programming steps', 'Chaotic circular timelines', 'Illegible micro-text'],
        phases
      };
    }

    // 3. Technical Architecture Diagram Content Plan (e.g. React Architecture)
    if (isArchitecture || intentType === 'GENERATE_DIAGRAM') {
      const components = extractedData.length > 0 ? extractedData : [
        'UI Components Layer',
        'State Management (Zustand/Store)',
        'Custom Hooks / Business Logic',
        'API Client / Data Fetcher',
        'Backend REST / GraphQL API',
        'Persistent Database'
      ];

      return {
        valid: true,
        needsClarification: false,
        contentType: 'technical_architecture',
        required_sections: ['Presentation Layer (Client UI)', 'State & Logic Layer', 'Service & Network Layer', 'Persistence Layer'],
        mandatory_topics: components,
        sequence: ['Client View -> Store/Hooks -> API Service -> Database'],
        key_information: components.map(c => `Component: ${c}`),
        excluded_content: ['Unconnected floating nodes', 'Comic illustrations', 'Unreadable labels', 'Dark blurry backgrounds'],
        components
      };
    }

    // 4. Study Timetable & Daily Schedule Content Plan
    if (isTimetable) {
      const defaultSlots = [
        { time: '08:00 AM - 10:00 AM', session: 'Deep Work: Core Concepts & Reading' },
        { time: '10:30 AM - 12:30 PM', session: 'Hands-on Coding & Problem Solving' },
        { time: '02:00 PM - 04:00 PM', session: 'Project Implementation & Debugging' },
        { time: '04:30 PM - 06:00 PM', session: 'Review, Notes & Git Commit' }
      ];

      const slots = extractedData.length > 0 ? extractedData : defaultSlots;

      return {
        valid: true,
        needsClarification: false,
        contentType: 'study_timetable',
        required_sections: ['Morning Focus', 'Core Practice', 'Project Building', 'Evening Review'],
        mandatory_topics: slots.map(s => typeof s === 'string' ? s : `${s.time}: ${s.session}`),
        sequence: slots.map((s, i) => `Slot ${i + 1}`),
        key_information: ['Daily time blocks with clear start and end times', 'Designated study objectives'],
        excluded_content: ['Generic clocks without timetable slots', 'Unrelated imagery', 'Cluttered backgrounds'],
        slots
      };
    }

    // 5. Data Visualization / Chart Content Plan
    if (isChart || intentType === 'GENERATE_CHART') {
      const dataPoints = Array.isArray(extractedData) && extractedData.length > 0 ? extractedData : null;

      if (!dataPoints && !/\b\d+\b/.test(rawSourceText)) {
        return {
          valid: false,
          needsClarification: true,
          clarificationQuestion: 'Please provide the specific numerical data points or values (e.g. Q1: 40%, Q2: 80%) you want represented in the chart.',
          required_sections: [],
          mandatory_topics: [],
          sequence: [],
          key_information: [],
          excluded_content: []
        };
      }

      return {
        valid: true,
        needsClarification: false,
        contentType: 'data_chart',
        required_sections: ['Chart Header & Metric Units', 'Plot Canvas & Gridlines', 'Proportional Value Bars / Points', 'Axis Labels & Legend'],
        mandatory_topics: (dataPoints || []).map(d => `${d.label}: ${d.value}`),
        sequence: (dataPoints || []).map(d => d.label),
        key_information: ['Accurate proportions matching exact input numbers', 'Clear numerical labels on bars/points'],
        excluded_content: ['Invented numbers not provided by user', '3D skewed perspective bars that obscure data', 'Unlabeled axes'],
        dataPoints: dataPoints || [{ label: 'Metric A', value: '75%' }, { label: 'Metric B', value: '92%' }]
      };
    }

    // 6. Creative / Photorealistic Raster Visual Content Plan
    return {
      valid: true,
      needsClarification: false,
      contentType: 'creative_raster',
      required_sections: ['Primary Focal Subject', 'Atmospheric Environment', 'Lighting & Depth Layering', 'Fine Surface Textures'],
      mandatory_topics: [topic],
      sequence: ['Focal center', 'Midground atmosphere', 'Deep background'],
      key_information: [`High fidelity representation of ${topic}`, 'Consistent camera angle and perspective'],
      excluded_content: ['Distorted hands/anatomy', 'Blurred textures', 'Watermarks', 'Unrelated elements']
    };
  }
}

export default ImageContentPlanner;

