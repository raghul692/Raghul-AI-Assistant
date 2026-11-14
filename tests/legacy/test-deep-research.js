import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import { runDeepResearch } from './deepResearchEngine.js';

dotenv.config();
const client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

console.log('🔬 Testing Autonomous Deep Research Engine...');

let progressSteps = [];
let receivedChars = 0;

const result = await runDeepResearch({
  client,
  query: 'Vector databases vs Graph databases for RAG',
  isTamil: false,
  onProgress: (p) => {
    progressSteps.push(p.badge);
    console.log(`[Research Event] ${p.badge}: ${p.message || ''}`);
  },
  sendToken: (tok) => {
    receivedChars += tok.length;
  }
});

console.log('\n--- Research Verification Result ---');
console.log('Vectors count:', result.vectors.length);
console.log('Total characters streamed:', receivedChars);
console.log('Duration:', result.durationMs, 'ms');

if (result.success && result.vectors.length >= 2 && receivedChars > 300) {
  console.log('✅ Deep Research Engine 100% Verified!');
  process.exit(0);
} else {
  console.error('❌ Verification failed');
  process.exit(1);
}
