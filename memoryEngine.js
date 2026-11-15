import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { saveUserMemory, deleteUserMemory, extractAndSaveFacts } from './memory/persistentMemoryEngine.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const MEMORY_FILE = path.join(__dirname, 'data', 'memories.json');

const DEFAULT_MEMORIES = [
  {
    id: 'mem_1',
    category: 'profile',
    key: 'user_name',
    value: 'Raghul (Raghul raja)',
    createdAt: Date.now()
  },
  {
    id: 'mem_2',
    category: 'profile',
    key: 'user_role',
    value: 'Full-Stack Software Engineer & AI System Architect',
    createdAt: Date.now()
  },
  {
    id: 'mem_3',
    category: 'preference',
    key: 'tech_stack',
    value: 'Node.js, Express, React 19, Tailwind CSS, Google Gemini 3.5/3.8 Flash models',
    createdAt: Date.now()
  },
  {
    id: 'mem_4',
    category: 'preference',
    key: 'communication_style',
    value: 'Warm, direct, friendly Tamil & Tanglish conversational tone with production-grade engineering rigor',
    createdAt: Date.now()
  }
];

function ensureMemoryFile() {
  const dir = path.dirname(MEMORY_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(MEMORY_FILE)) {
    fs.writeFileSync(MEMORY_FILE, JSON.stringify(DEFAULT_MEMORIES, null, 2), 'utf8');
  }
}

export function loadMemories() {
  ensureMemoryFile();
  try {
    const raw = fs.readFileSync(MEMORY_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : DEFAULT_MEMORIES;
  } catch (e) {
    console.warn('Memory load notice:', e.message);
    return DEFAULT_MEMORIES;
  }
}

export function saveMemories(memories) {
  ensureMemoryFile();
  try {
    fs.writeFileSync(MEMORY_FILE, JSON.stringify(memories, null, 2), 'utf8');
    return true;
  } catch (e) {
    console.error('Memory save error:', e.message);
    return false;
  }
}

export function addMemory(category, key, value) {
  if (!key || !value) return null;
  const memories = loadMemories();
  const existingIdx = memories.findIndex(m => m.key.toLowerCase() === key.toLowerCase());
  const entry = {
    id: 'mem_' + Date.now() + '_' + Math.random().toString(36).substring(2, 5),
    category: category || 'general',
    key: key.trim(),
    value: value.trim(),
    updatedAt: Date.now()
  };

  if (existingIdx !== -1) {
    memories[existingIdx] = { ...memories[existingIdx], ...entry };
  } else {
    memories.push(entry);
  }
  saveMemories(memories);

  // Sync to SQLite persistent memory store
  try {
    saveUserMemory({
      id: entry.id,
      category: category === 'profile' ? 'preference' : (category || 'fact'),
      content: `${entry.key}: ${entry.value}`,
      importance: category === 'profile' ? 0.95 : 0.8
    });
  } catch (err) {
    // Non-blocking sync notice
  }

  return entry;
}

export function deleteMemory(id) {
  const memories = loadMemories();
  const filtered = memories.filter(m => m.id !== id);
  saveMemories(filtered);
  try {
    deleteUserMemory(id);
  } catch (err) {}
  return filtered.length < memories.length;
}

/**
 * Recall relevant long-term memories matching the user prompt
 */
export function recallRelevantMemories(userMessage = '') {
  const memories = loadMemories();
  if (memories.length === 0) return '';

  const words = userMessage.toLowerCase().split(/\s+/).filter(w => w.length > 2);
  const scored = memories.map(m => {
    let score = 0;
    const text = (m.key + ' ' + m.value).toLowerCase();
    for (const w of words) {
      if (text.includes(w)) score += 2;
    }
    // Boost core profile memories
    if (m.category === 'profile') score += 1;
    return { memory: m, score };
  });

  // Sort by score
  scored.sort((a, b) => b.score - a.score);
  const topMemories = scored.slice(0, 4).map(s => s.memory);

  if (topMemories.length === 0) return '';

  return `\n\n### LONG-TERM PERSISTENT MEMORY RECALL (Known User Context):\n` +
    topMemories.map(m => `- **${m.key}** (${m.category}): ${m.value}`).join('\n') +
    `\nMandate: Seamlessly align responses with these recalled user preferences and identity facts without redundantly repeating them.`;
}

/**
 * Auto-extract facts if user expresses personal preference in conversation
 */
export function autoExtractFact(userMessage = '') {
  if (!userMessage || typeof userMessage !== 'string') return null;

  // Name patterns
  const nameMatch = userMessage.match(/(?:my name is|en(?:noda| peyar) name(?: is)?)\s+([A-Za-z\s]{2,25})/i);
  if (nameMatch) {
    addMemory('profile', 'user_name', nameMatch[1].trim());
  }

  // Tech stack patterns
  const techMatch = userMessage.match(/(?:i (?:usually )?use|working with|developing in|stack is)\s+([A-Za-z0-9,.\s]{3,40})/i);
  if (techMatch) {
    addMemory('preference', 'tech_stack', techMatch[1].trim());
  }

  // Run comprehensive fact extraction
  try {
    extractAndSaveFacts(userMessage);
  } catch (err) {}
}

