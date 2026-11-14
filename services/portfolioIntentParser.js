/**
 * PORTFOLIO UNIFIED INTENT & ENTITY PARSER
 * 
 * High-precision intent classifier for English, Tanglish, and hybrid prompts.
 * Solves prompt ambiguity, trailing action verbs ("add pannu", "thooku", "remove pannu"),
 * and prevents cross-intent leakage.
 */

export const ACTIONS = {
  REMOVE: 'REMOVE',
  ADD: 'ADD',
  UPDATE: 'UPDATE',
  QUERY: 'QUERY',
  UNKNOWN: 'UNKNOWN'
};

export const ENTITIES = {
  CERTIFICATE: 'CERTIFICATE',
  PROJECT: 'PROJECT',
  SKILL: 'SKILL',
  PROFILE: 'PROFILE',
  EXPERIENCE: 'EXPERIENCE',
  EDUCATION: 'EDUCATION',
  SYSTEM: 'SYSTEM',
  UNKNOWN: 'UNKNOWN'
};

const ACTION_PATTERNS = {
  REMOVE: [
    /\b(?:remove|delete|drop|erase|clear|kill|theva\s+illa|venam)\b/i,
    /(?:thooku|neekku|eduthuru|ali|neeki|azhi|remove\s*pannu|delete\s*pannu)/i,
  ],
  UPDATE: [
    /\b(?:update|edit|modify|change|replace|rename|move|switch)\b/i,
    /(?:maathu|maathanum|thirutham|change\s*pannu|update\s*pannu|edit\s*pannu)/i,
  ],
  ADD: [
    /\b(?:add|insert|create|register|upload|puthu|new|save|append)\b/i,
    /(?:podu|serka|sethuko|add\s*pannu|create\s*pannu|insert\s*pannu)/i,
  ],
  QUERY: [
    /\b(?:show|list|view|display|check|count|how\s+many|what\s+are|status|health)\b/i,
    /(?:kaattu|sollu|paaru|check\s*pannu)/i,
  ]
};

const ENTITY_PATTERNS = {
  CERTIFICATE: [
    /\b(?:cert|certs|certificate|certificates|certification|licence|credential)\b/i,
    /\b(?:achievement|practitioner|foundations\s+associate|completion\s+letter|webinar|conclave|workshop)\b/i,
  ],
  PROJECT: [
    /\b(?:project|projects|app|application|apps|thittam|feature\s+app|operating\s+system|portfolio\s+os)\b/i,
  ],
  PROFILE: [
    /\b(?:title|designation|headline|role|bio|summary|about|profile|location|email|phone|contact|social|github\s+link|linkedin)\b/i,
  ],
  SKILL: [
    /\b(?:skill|skills|thiran|tech\s+stack|techstack|technologies|technology)\b/i,
    /\b(?:frontend|backend|database|devops|fullstack)\s+(?:skills|tech|technologies)\b/i,
  ],
  SYSTEM: [
    /\b(?:deploy|deployment|vercel|github|backup|audit|integrity|telemetry|analytics|traffic)\b/i,
  ]
};

/**
 * Detect primary action verb in prompt.
 * Prioritizes explicit removal over general addition.
 */
export function detectAction(query) {
  for (const regex of ACTION_PATTERNS.REMOVE) {
    if (regex.test(query)) return ACTIONS.REMOVE;
  }
  for (const regex of ACTION_PATTERNS.UPDATE) {
    if (regex.test(query)) return ACTIONS.UPDATE;
  }
  for (const regex of ACTION_PATTERNS.ADD) {
    if (regex.test(query)) return ACTIONS.ADD;
  }
  for (const regex of ACTION_PATTERNS.QUERY) {
    if (regex.test(query)) return ACTIONS.QUERY;
  }
  return ACTIONS.UNKNOWN;
}

/**
 * Detect targeted entity in prompt.
 */
export function detectEntity(query) {
  for (const regex of ENTITY_PATTERNS.PROFILE) {
    if (regex.test(query)) return ENTITIES.PROFILE;
  }
  for (const regex of ENTITY_PATTERNS.CERTIFICATE) {
    if (regex.test(query)) return ENTITIES.CERTIFICATE;
  }
  for (const regex of ENTITY_PATTERNS.PROJECT) {
    if (regex.test(query)) return ENTITIES.PROJECT;
  }
  for (const regex of ENTITY_PATTERNS.SKILL) {
    if (regex.test(query)) return ENTITIES.SKILL;
  }
  for (const regex of ENTITY_PATTERNS.EXPERIENCE) {
    if (regex.test(query)) return ENTITIES.EXPERIENCE;
  }
  for (const regex of ENTITY_PATTERNS.EDUCATION) {
    if (regex.test(query)) return ENTITIES.EDUCATION;
  }
  for (const regex of ENTITY_PATTERNS.PROFILE) {
    if (regex.test(query)) return ENTITIES.PROFILE;
  }
  for (const regex of ENTITY_PATTERNS.SYSTEM) {
    if (regex.test(query)) return ENTITIES.SYSTEM;
  }
  return ENTITIES.UNKNOWN;
}

/**
 * Clean extract target strings/entities from user prompt.
 * Strips out boilerplate prefixes, quotes, and Tanglish wrappers.
 */
export function extractTargetEntities(query) {
  const targets = [];

  // 1. Quoted phrases
  const quotes = query.match(/"([^"]+)"|'([^']+)'/g);
  if (quotes) {
    for (const q of quotes) {
      const clean = q.slice(1, -1)
        .replace(/to my portfolio:?/gi, '')
        .trim();
      const parts = clean.split(/\band\b|,|\+/i);
      for (const p of parts) {
        const item = p.trim();
        if (item.length > 1) targets.push(item);
      }
    }
  }

  // 2. Comma or "and" separated lists following common prepositions
  const listMatch = query.match(/(?:named|titled|called|for|intha|section\s+la)\s+([^\.\;\n]+?)(?=\s+(?:remove|delete|thooku|add|update|from|la|$))/i);
  if (listMatch && listMatch[1]) {
    const raw = listMatch[1].replace(/['":]/g, '').trim();
    const parts = raw.split(/\band\b|,|\+/i);
    for (const p of parts) {
      const item = p.trim().replace(/^(?:the|a|intha|antha|my)\s+/i, '');
      if (item.length > 2 && !targets.includes(item)) targets.push(item);
    }
  }

  // 3. Known signature keywords
  const knownKeywords = [
    'AWS Certified AI Practitioner',
    'Professional Achievement Certificate',
    'Oracle Cloud Infrastructure',
    'EBPL - Internship on Generative AI',
    'UI/UX Design Certificate',
    'Data Science Fundamentals',
    'App Penetration Testing',
    'AWS Cloud Club Certification',
    'Management Conclave',
    'Workshop',
    'EBPL Certificate in NM',
    'Appreciation Certificate',
    'RAGHUL AI — Portfolio Operating System V8.0',
    'Autonomous Feature App',
    'Apache Kafka',
    'GraphQL',
    'Svelte',
    'Redis',
    'Docker',
    'Kubernetes'
  ];

  const lower = query.toLowerCase();
  for (const kw of knownKeywords) {
    if (lower.includes(kw.toLowerCase()) && !targets.some(t => t.toLowerCase() === kw.toLowerCase())) {
      targets.push(kw);
    }
  }

  return targets;
}

/**
 * Main resolution function: maps (Action, Entity) to canonical 7-stage pipeline intent.
 */
export function resolveIntent(query) {
  const action = detectAction(query);
  const entity = detectEntity(query);
  const targets = extractTargetEntities(query);

  let intent = 'conversational_query';
  let securityTier = 1;

  if (action === ACTIONS.REMOVE) {
    if (entity === ENTITIES.CERTIFICATE) intent = 'certificate_removal';
    else if (entity === ENTITIES.PROJECT) intent = 'project_removal';
    else if (entity === ENTITIES.SKILL) intent = 'skills_removal';
    else if (entity === ENTITIES.EXPERIENCE) intent = 'experience_removal';
    else if (entity === ENTITIES.EDUCATION) intent = 'education_removal';
    else intent = 'certificate_removal'; // fallback to certificate if ambiguous removal with cert keywords
    securityTier = 3;
  } else if (action === ACTIONS.UPDATE) {
    if (entity === ENTITIES.CERTIFICATE) intent = 'certificate_update';
    else if (entity === ENTITIES.PROJECT) intent = 'project_update';
    else if (entity === ENTITIES.SKILL) intent = 'skills_edit';
    else if (entity === ENTITIES.EXPERIENCE) intent = 'experience_update';
    else if (entity === ENTITIES.EDUCATION) intent = 'education_update';
    else intent = 'profile_update';
    securityTier = 3;
  } else if (action === ACTIONS.ADD) {
    if (entity === ENTITIES.CERTIFICATE) intent = 'certificate_registration';
    else if (entity === ENTITIES.PROJECT) intent = 'project_registration';
    else if (entity === ENTITIES.SKILL) intent = 'skills_update';
    else if (entity === ENTITIES.EXPERIENCE) intent = 'experience_add';
    else if (entity === ENTITIES.EDUCATION) intent = 'education_add';
    else intent = 'skills_update';
    securityTier = 3;
  } else if (action === ACTIONS.QUERY) {
    if (entity === ENTITIES.SYSTEM) intent = 'system_audit';
    else intent = 'visitor_analytics';
    securityTier = 1;
  } else {
    // Action unknown - check entity presence
    if (entity === ENTITIES.PROFILE) {
      intent = 'profile_update';
      securityTier = 3;
    } else if (entity === ENTITIES.CERTIFICATE) {
      intent = 'certificate_registration';
      securityTier = 3;
    } else if (entity === ENTITIES.PROJECT) {
      intent = 'project_registration';
      securityTier = 3;
    } else if (entity === ENTITIES.SKILL) {
      intent = 'skills_update';
      securityTier = 3;
    } else {
      intent = 'conversational_query';
      securityTier = 1;
    }
  }

  return {
    action,
    entity,
    intent,
    securityTier,
    targets
  };
}
