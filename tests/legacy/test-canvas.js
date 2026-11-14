import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import { executeCanvasAction } from './canvasEngine.js';

dotenv.config();
const client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

console.log('🎨 Testing Canvas AI Action Engine...');

const buggyCode = `
function calculateTotal(items) {
  var total = 0;
  for (var i = 0; i <= items.length; i++) {
    total = total + items[i].price;
  }
  return total;
}
`;

const result = await executeCanvasAction({
  client,
  content: buggyCode,
  language: 'javascript',
  action: 'fix',
  customInstruction: 'Prevent off-by-one index error and use reduce'
});

console.log('Updated Code:\n', result.updatedCode);
console.log('Explanation:\n', result.explanation);

if (result.updatedCode && result.updatedCode.includes('reduce')) {
  console.log('✅ Canvas Engine 100% Operational!');
  process.exit(0);
} else {
  console.error('❌ Canvas Engine check failed');
  process.exit(1);
}

