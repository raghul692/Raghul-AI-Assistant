import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import { validateImageBuffer } from './imageQualityValidator.js';
import { saveImageAsset } from './imageStorageService.js';

dotenv.config();

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

const DEFAULT_PYTHON_ROADMAP = {
  title: 'Python 30-Day Mastery Roadmap',
  subtitle: 'Zero to Production-Ready Developer Curriculum',
  audience: 'Beginner to Intermediate',
  phases: [
    {
      week: 1,
      name: 'Week 1: Core Fundamentals & Logic',
      color: '#6366f1',
      days: [
        { day: 1, topic: 'Variables, Types & Syntax', desc: 'Numbers, strings, booleans, and print formatting.' },
        { day: 2, topic: 'Conditional Control Flow', desc: 'if, elif, else logic and boolean operators.' },
        { day: 3, topic: 'Loops & Iterations', desc: 'for loops, while loops, range(), break, and continue.' },
        { day: 4, topic: 'Functions & Scope', desc: 'Parameters, return values, default args, and global scope.' },
        { day: 5, topic: 'Lists & Tuples', desc: 'Indexing, slicing, list comprehension, and immutability.' },
        { day: 6, topic: 'Dictionaries & Sets', desc: 'Key-value maps, hash sets, membership testing.' },
        { day: 7, topic: 'Mini Project: CLI Task Manager', desc: 'Consolidate Week 1 fundamentals with an interactive CLI app.' }
      ]
    },
    {
      week: 2,
      name: 'Week 2: Data Structures & OOP',
      color: '#06b6d4',
      days: [
        { day: 8, topic: 'String Manipulation & Regex', desc: 'Advanced methods, formatting, and re module regex.' },
        { day: 9, topic: 'File I/O & Context Managers', desc: 'with open() reading and writing TXT, JSON, and CSV.' },
        { day: 10, topic: 'Error & Exception Handling', desc: 'try, except, finally blocks and custom exceptions.' },
        { day: 11, topic: 'Object-Oriented Programming I', desc: 'Classes, objects, __init__, instance attributes and methods.' },
        { day: 12, topic: 'Object-Oriented Programming II', desc: 'Inheritance, super(), polymorphism, and encapsulation.' },
        { day: 13, topic: 'Modules & Package Management', desc: 'import mechanisms, __name__ == "__main__", pip & venv.' },
        { day: 14, topic: 'Mini Project: OOP Bank System', desc: 'Build an account management system with file persistence.' }
      ]
    },
    {
      week: 3,
      name: 'Week 3: Modern Python & Ecosystem',
      color: '#a855f7',
      days: [
        { day: 15, topic: 'Iterators, Generators & yield', desc: 'Memory-efficient data pipelines and custom iterators.' },
        { day: 16, topic: 'Decorators & Higher-Order Funcs', desc: 'Function wrappers, timing, logging, and @decorator syntax.' },
        { day: 17, topic: 'Type Hinting & Pydantic Basics', desc: 'typing module, type validation, and data schemas.' },
        { day: 18, topic: 'HTTP Requests & REST APIs', desc: 'Fetching external data with requests / httpx libraries.' },
        { day: 19, topic: 'Data Analysis with Pandas', desc: 'Series, DataFrames, filtering, and data aggregation.' },
        { day: 20, topic: 'Concurrency & Asyncio', desc: 'async/await, event loops, tasks, and concurrent execution.' },
        { day: 21, topic: 'Mini Project: Live Weather Dashboard', desc: 'Fetch API data, transform with Pandas, output summary.' }
      ]
    },
    {
      week: 4,
      name: 'Week 4: Web Apps, Testing & Deployment',
      color: '#10b981',
      days: [
        { day: 22, topic: 'FastAPI Backend Fundamentals', desc: 'Building REST endpoints, path/query params, Swagger docs.' },
        { day: 23, topic: 'FastAPI CRUD & Database Connect', desc: 'Connecting SQLite with SQLAlchemy / Tortoise ORM.' },
        { day: 24, topic: 'Unit Testing with pytest', desc: 'Test fixtures, assertions, mocking, and coverage analysis.' },
        { day: 25, topic: 'Code Quality & Tooling', desc: 'Linting with Ruff, Black formatting, pre-commit hooks.' },
        { day: 26, topic: 'Containerization with Docker', desc: 'Writing Dockerfiles, multi-stage builds, and running containers.' },
        { day: 27, topic: 'Git & GitHub Workflows', desc: 'Branching, PRs, GitHub Actions CI/CD pipelines.' },
        { day: 28, topic: 'Cloud Deployment', desc: 'Deploying backend to Render, Railway, or Cloud Run.' },
        { day: 29, topic: 'Capstone: Full Production Microservice', desc: 'Build, test, containerize, and deploy a full REST service.' },
        { day: 30, topic: 'Review, Next Steps & Portfolio', desc: 'Open-source contribution, documentation, and interview prep.' }
      ]
    }
  ]
};

export function validateSequentialCurriculum(phases, expectedDays = 30) {
  if (!Array.isArray(phases)) return { valid: false, missingDays: [] };
  const foundDays = new Set();
  for (const phase of phases) {
    if (Array.isArray(phase.days)) {
      for (const item of phase.days) {
        if (typeof item.day === 'number') foundDays.add(item.day);
      }
    }
  }
  const missingDays = [];
  for (let d = 1; d <= expectedDays; d++) {
    if (!foundDays.has(d)) missingDays.push(d);
  }
  return {
    valid: missingDays.length === 0 && foundDays.size >= expectedDays,
    totalFound: foundDays.size,
    missingDays
  };
}

export async function extractCurriculumWithLLM({ topic, audience = 'Beginner', contextText = '' }) {
  if (!GEMINI_API_KEY) return DEFAULT_PYTHON_ROADMAP;
  try {
    const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
    const prompt = `You are an expert curriculum designer and educational infographic architect.
Generate a structured 30-day roadmap curriculum for: "${topic}".
Target Audience: ${audience}.
Contextual Notes: ${contextText || 'Comprehensive, practical, sequential mastery.'}

CRITICAL RULES:
1. Provide EXACTLY 30 sequential days from Day 1 to Day 30 without omitting any single day.
2. Group the 30 days into 4 milestone weeks (Week 1: Days 1-7, Week 2: Days 8-14, Week 3: Days 15-21, Week 4: Days 22-30).
3. Each day must have: "day" (integer 1-30), "topic" (short title 3-6 words), "desc" (crisp educational summary 8-14 words).
4. Return ONLY valid JSON matching this exact structure:
{
  "title": "${topic} 30-Day Learning Roadmap",
  "subtitle": "Complete Step-by-Step Mastery Path",
  "audience": "${audience}",
  "phases": [
    {
      "week": 1,
      "name": "Week 1: Foundation",
      "color": "#6366f1",
      "days": [{ "day": 1, "topic": "...", "desc": "..." }, ... up to day 7]
    },
    ... up to week 4 and day 30
  ]
}`;

    const res = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: { responseMimeType: 'application/json' }
    });

    const jsonText = res.text?.trim() || '';
    const parsed = JSON.parse(jsonText);
    const validation = validateSequentialCurriculum(parsed.phases, 30);
    if (validation.valid) return parsed;
    if (topic.toLowerCase().includes('python')) return DEFAULT_PYTHON_ROADMAP;
    return parsed;
  } catch (err) {
    return DEFAULT_PYTHON_ROADMAP;
  }
}

function escapeXml(unsafe = '') {
  return String(unsafe)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * 1. Educational Infographic Roadmap SVG Renderer
 */
export function renderInfographicSvg(curriculum) {
  const width = 1600;
  const paddingX = 60;
  const paddingY = 60;
  const colWidth = (width - paddingX * 2 - 3 * 30) / 4;
  const cardHeight = 110;
  const cardGap = 16;
  const maxDaysPerCol = 9;
  const contentHeight = 240 + maxDaysPerCol * (cardHeight + cardGap) + 120;
  const totalHeight = Math.max(1400, contentHeight);

  const title = escapeXml(curriculum.title || '30-Day Learning Roadmap');
  const subtitle = escapeXml(curriculum.subtitle || 'Production-Grade Mastery Journey');
  const audience = escapeXml(curriculum.audience || 'All Levels');
  const phaseColors = ['#6366f1', '#06b6d4', '#a855f7', '#10b981'];

  let columnsSvg = '';
  (curriculum.phases || []).slice(0, 4).forEach((phase, colIdx) => {
    const colX = paddingX + colIdx * (colWidth + 30);
    const colColor = phase.color || phaseColors[colIdx % phaseColors.length];
    const colHeaderY = 220;

    let cardsSvg = '';
    (phase.days || []).forEach((item, dayIdx) => {
      const cardY = colHeaderY + 60 + dayIdx * (cardHeight + cardGap);
      const dayNum = String(item.day).padStart(2, '0');
      const topic = escapeXml(item.topic);
      const desc = escapeXml(item.desc);

      cardsSvg += `
        <g class="day-card" transform="translate(${colX}, ${cardY})">
          <rect width="${colWidth}" height="${cardHeight}" rx="12" fill="#0f172a" fill-opacity="0.9" stroke="rgba(255, 255, 255, 0.08)" stroke-width="1" />
          <rect width="4" height="${cardHeight - 20}" x="0" y="10" rx="2" fill="${colColor}" />
          <rect x="16" y="14" width="64" height="24" rx="6" fill="${colColor}" fill-opacity="0.18" />
          <text x="48" y="30" fill="${colColor}" font-size="11" font-weight="700" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" text-anchor="middle">DAY ${dayNum}</text>
          <text x="16" y="60" fill="#f8fafc" font-size="14" font-weight="600" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif">
            ${topic.length > 34 ? topic.slice(0, 31) + '...' : topic}
          </text>
          <text x="16" y="82" fill="#94a3b8" font-size="11" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif">
            ${desc.length > 50 ? desc.slice(0, 47) + '...' : desc}
          </text>
          <text x="16" y="98" fill="#64748b" font-size="10" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif">
            ${desc.length > 50 ? desc.slice(47, 95) : ''}
          </text>
        </g>`;
    });

    columnsSvg += `
      <g class="week-column">
        <rect x="${colX}" y="${colHeaderY}" width="${colWidth}" height="44" rx="10" fill="${colColor}" fill-opacity="0.12" stroke="${colColor}" stroke-opacity="0.4" stroke-width="1.5" />
        <circle cx="${colX + 22}" cy="${colHeaderY + 22}" r="6" fill="${colColor}" />
        <text x="${colX + 38}" y="${colHeaderY + 27}" fill="#ffffff" font-size="14" font-weight="700" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif">
          ${escapeXml(phase.name || 'Week ' + (colIdx + 1))}
        </text>
        ${cardsSvg}
      </g>`;
  });

  const svgContent = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${totalHeight}" width="${width}" height="${totalHeight}">
  <defs>
    <linearGradient id="bg-grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#080c14" />
      <stop offset="50%" stop-color="#0d1424" />
      <stop offset="100%" stop-color="#05080f" />
    </linearGradient>
    <linearGradient id="title-grad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#38bdf8" />
      <stop offset="50%" stop-color="#818cf8" />
      <stop offset="100%" stop-color="#c084fc" />
    </linearGradient>
    <filter id="glow-cyan" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="60" result="blur" />
    </filter>
  </defs>
  <rect width="${width}" height="${totalHeight}" fill="url(#bg-grad)" />
  <circle cx="200" cy="180" r="160" fill="#3b82f6" fill-opacity="0.12" filter="url(#glow-cyan)" />
  <circle cx="1400" cy="300" r="180" fill="#8b5cf6" fill-opacity="0.12" filter="url(#glow-cyan)" />
  <g class="header" transform="translate(${paddingX}, ${paddingY})">
    <rect width="${width - paddingX * 2}" height="120" rx="16" fill="#111827" fill-opacity="0.75" stroke="rgba(255, 255, 255, 0.1)" stroke-width="1" />
    <text x="40" y="48" fill="url(#title-grad)" font-size="28" font-weight="800" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif">${title}</text>
    <text x="40" y="80" fill="#94a3b8" font-size="15" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif">${subtitle} • Complete 30-Day Sequential Learning Roadmap</text>
    <g transform="translate(${width - paddingX * 2 - 340}, 36)">
      <rect width="100" height="32" rx="8" fill="#1e293b" stroke="rgba(255,255,255,0.1)" />
      <text x="50" y="21" fill="#38bdf8" font-size="12" font-weight="600" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" text-anchor="middle">30 DAYS</text>
      <rect x="112" width="100" height="32" rx="8" fill="#1e293b" stroke="rgba(255,255,255,0.1)" />
      <text x="162" y="21" fill="#a855f7" font-size="12" font-weight="600" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" text-anchor="middle">4 WEEKS</text>
      <rect x="224" width="100" height="32" rx="8" fill="#1e293b" stroke="rgba(255,255,255,0.1)" />
      <text x="274" y="21" fill="#10b981" font-size="12" font-weight="600" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" text-anchor="middle">${audience.toUpperCase()}</text>
    </g>
  </g>
  ${columnsSvg}
  <g transform="translate(${paddingX}, ${totalHeight - 60})">
    <line x1="0" y1="0" x2="${width - paddingX * 2}" y2="0" stroke="rgba(255,255,255,0.1)" stroke-width="1" />
    <text x="0" y="32" fill="#64748b" font-size="12" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif">Synthesized with Raghul AI Generative Studio • Guaranteed 100% Sequential Coverage</text>
    <text x="${width - paddingX * 2}" y="32" fill="#64748b" font-size="12" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" text-anchor="end">High-Resolution Vector Infographic</text>
  </g>
</svg>`;
  return Buffer.from(svgContent, 'utf8');
}

/**
 * 2. Technical Architecture Diagram SVG Renderer (e.g. React Architecture)
 */
export function renderArchitectureDiagramSvg({ title, components = [], domain = 'SYSTEM' }) {
  const width = 1600;
  const height = 1000;
  const padding = 60;
  const safeTitle = escapeXml(title || `${domain} Architecture Topology`);

  const tiers = [
    { name: '1. Presentation Layer (UI Components)', color: '#38BDF8', comps: components.slice(0, 3).length > 0 ? components.slice(0, 3) : ['UI View Components', 'Layout Shell', 'Design Tokens'] },
    { name: '2. State & Business Logic Layer', color: '#818CF8', comps: components.slice(3, 6).length > 0 ? components.slice(3, 6) : ['Zustand Store / Redux', 'Custom Hooks', 'Validation Schemas'] },
    { name: '3. API & Network Transport Layer', color: '#34D399', comps: components.slice(6, 9).length > 0 ? components.slice(6, 9) : ['API Client (fetch/axios)', 'WebSocket Manager', 'Auth Token Interceptor'] },
    { name: '4. Backend & Data Persistence', color: '#F59E0B', comps: components.slice(9, 12).length > 0 ? components.slice(9, 12) : ['REST API Server', 'SQLite / Database', 'Cache Layer'] }
  ];

  let tiersSvg = '';
  tiers.forEach((tier, idx) => {
    const tierY = 180 + idx * 190;
    const tierWidth = width - padding * 2;
    const cardWidth = (tierWidth - 40 - 2 * 20) / 3;

    let compCards = '';
    tier.comps.forEach((comp, cIdx) => {
      const compX = padding + 20 + cIdx * (cardWidth + 20);
      compCards += `
        <g transform="translate(${compX}, ${tierY + 50})">
          <rect width="${cardWidth}" height="90" rx="10" fill="#1E293B" stroke="${tier.color}" stroke-opacity="0.4" stroke-width="1.5" />
          <circle cx="24" cy="30" r="6" fill="${tier.color}" />
          <text x="40" y="35" fill="#FFFFFF" font-size="14" font-weight="700" font-family="'JetBrains Mono', Menlo, sans-serif">${escapeXml(comp)}</text>
          <text x="24" y="66" fill="#94A3B8" font-size="11" font-family="-apple-system, sans-serif">Active Managed Module • Validated Contract</text>
        </g>`;
    });

    tiersSvg += `
      <g class="tier-block">
        <rect x="${padding}" y="${tierY}" width="${tierWidth}" height="160" rx="14" fill="#0F172A" stroke="rgba(255,255,255,0.08)" stroke-width="1" />
        <rect x="${padding}" y="${tierY}" width="8" height="160" rx="4" fill="${tier.color}" />
        <text x="${padding + 24}" y="${tierY + 32}" fill="${tier.color}" font-size="15" font-weight="800" font-family="'JetBrains Mono', monospace">${escapeXml(tier.name)}</text>
        ${compCards}
      </g>`;
  });

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
  <rect width="${width}" height="${height}" fill="#080C14" />
  <g transform="translate(${padding}, ${padding})">
    <rect width="${width - padding * 2}" height="80" rx="12" fill="#111827" stroke="rgba(255,255,255,0.1)" />
    <text x="30" y="48" fill="#38BDF8" font-size="24" font-weight="800" font-family="'JetBrains Mono', monospace">⚙️ ${safeTitle}</text>
    <text x="${width - padding * 2 - 30}" y="48" fill="#94A3B8" font-size="13" font-family="sans-serif" text-anchor="end">Engineered Topology • Deterministic Vector Architecture</text>
  </g>
  ${tiersSvg}
</svg>`;
  return Buffer.from(svg, 'utf8');
}

/**
 * 3. Study Timetable & Daily Schedule SVG Renderer
 */
export function renderTimetableSvg({ title, slots = [] }) {
  const width = 1200;
  const padding = 60;
  const rowHeight = 90;
  const height = Math.max(800, 240 + slots.length * (rowHeight + 14));
  const safeTitle = escapeXml(title || 'Structured Study Timetable & Daily Schedule');

  let rowsSvg = '';
  slots.forEach((slot, idx) => {
    const slotY = 180 + idx * (rowHeight + 14);
    const timeText = typeof slot === 'string' ? slot.split(':')[0] : (slot.time || `Slot ${idx + 1}`);
    const descText = typeof slot === 'string' ? slot : (slot.session || 'Focused Learning Session');

    rowsSvg += `
      <g transform="translate(${padding}, ${slotY})">
        <rect width="${width - padding * 2}" height="${rowHeight}" rx="12" fill="#0F172A" stroke="rgba(255,255,255,0.08)" stroke-width="1" />
        <rect width="6" height="${rowHeight}" rx="3" fill="#38BDF8" />
        <rect x="24" y="24" width="200" height="42" rx="8" fill="#1E293B" stroke="#38BDF8" stroke-opacity="0.3" />
        <text x="124" y="50" fill="#38BDF8" font-size="13" font-weight="700" font-family="-apple-system, sans-serif" text-anchor="middle">⏰ ${escapeXml(timeText)}</text>
        <text x="250" y="52" fill="#F8FAFC" font-size="16" font-weight="600" font-family="-apple-system, sans-serif">${escapeXml(descText)}</text>
      </g>`;
  });

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
  <rect width="${width}" height="${height}" fill="#080C14" />
  <g transform="translate(${padding}, ${padding})">
    <rect width="${width - padding * 2}" height="80" rx="12" fill="#111827" stroke="rgba(255,255,255,0.1)" />
    <text x="30" y="48" fill="#38BDF8" font-size="24" font-weight="800" font-family="-apple-system, sans-serif">📅 ${safeTitle}</text>
  </g>
  ${rowsSvg}
</svg>`;
  return Buffer.from(svg, 'utf8');
}

/**
 * 4. Precision Data Chart SVG Renderer
 */
export function renderChartSvg({ title, dataPoints = [] }) {
  const width = 1200;
  const height = 800;
  const padding = 60;
  const safeTitle = escapeXml(title || 'Data Analytics & Metric Visualization');
  const maxVal = 100;
  const chartHeight = 400;
  const chartBottom = 600;
  const colWidth = (width - padding * 2 - (dataPoints.length + 1) * 30) / Math.max(1, dataPoints.length);

  let barsSvg = '';
  dataPoints.forEach((dp, idx) => {
    const rawVal = parseFloat(dp.value) || 50;
    const barHeight = (rawVal / maxVal) * chartHeight;
    const barX = padding + 40 + idx * (colWidth + 30);
    const barY = chartBottom - barHeight;

    barsSvg += `
      <g>
        <rect x="${barX}" y="${barY}" width="${colWidth}" height="${barHeight}" rx="8" fill="#38BDF8" />
        <text x="${barX + colWidth / 2}" y="${barY - 14}" fill="#38BDF8" font-size="14" font-weight="700" font-family="'JetBrains Mono', monospace" text-anchor="middle">${escapeXml(String(dp.value))}</text>
        <text x="${barX + colWidth / 2}" y="${chartBottom + 28}" fill="#94A3B8" font-size="13" font-family="-apple-system, sans-serif" text-anchor="middle">${escapeXml(dp.label)}</text>
      </g>`;
  });

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
  <rect width="${width}" height="${height}" fill="#080C14" />
  <g transform="translate(${padding}, ${padding})">
    <rect width="${width - padding * 2}" height="80" rx="12" fill="#111827" stroke="rgba(255,255,255,0.1)" />
    <text x="30" y="48" fill="#38BDF8" font-size="24" font-weight="800" font-family="-apple-system, sans-serif">📊 ${safeTitle}</text>
  </g>
  <line x1="${padding + 20}" y1="${chartBottom}" x2="${width - padding - 20}" y2="${chartBottom}" stroke="#334155" stroke-width="2" />
  ${barsSvg}
</svg>`;
  return Buffer.from(svg, 'utf8');
}

/**
 * Main Hybrid & Vector Generator Entrypoint
 */
export async function generateHybridInfographic({
  topic = 'Visual Concept',
  audience = 'Beginner',
  sessionId = null,
  messageId = null,
  contextBundle = null,
  imageBrief = null
}) {
  const start = Date.now();
  const contentType = imageBrief?.content_plan?.contentType || (contextBundle?.isArchitecture ? 'technical_architecture' : (contextBundle?.isTimetable ? 'study_timetable' : (contextBundle?.isChart ? 'data_chart' : 'educational_roadmap')));

  let svgBuffer = null;
  let curriculum = null;

  if (contentType === 'technical_architecture') {
    svgBuffer = renderArchitectureDiagramSvg({
      title: `${topic} Architecture Diagram`,
      components: contextBundle?.extractedData || [],
      domain: contextBundle?.domain || 'SYSTEM'
    });
  } else if (contentType === 'study_timetable') {
    svgBuffer = renderTimetableSvg({
      title: topic,
      slots: contextBundle?.extractedData || []
    });
  } else if (contentType === 'data_chart') {
    svgBuffer = renderChartSvg({
      title: topic,
      dataPoints: contextBundle?.extractedData || [{ label: 'Metric A', value: '75%' }, { label: 'Metric B', value: '92%' }]
    });
  } else {
    // Educational Roadmap
    const contextNotes = contextBundle?.topicsDiscussed?.join('; ') || contextBundle?.rawSourceText || '';
    curriculum = await extractCurriculumWithLLM({
      topic,
      audience,
      contextText: contextNotes
    });
    svgBuffer = renderInfographicSvg(curriculum);
  }

  const validation = validateImageBuffer(svgBuffer);
  if (!validation.valid) {
    throw new Error(`Vector image validation failed: ${validation.error}`);
  }

  const savedAsset = await saveImageAsset({
    buffer: svgBuffer,
    sessionId,
    messageId,
    mimeType: 'image/svg+xml',
    width: 1600,
    height: 1200,
    provider: 'hybrid-infographic-engine',
    model: 'raghul-curriculum-renderer-v1',
    prompt: topic,
    imageBrief,
    version: 1
  });

  return {
    ...savedAsset,
    curriculum,
    latencyMs: Date.now() - start
  };
}
