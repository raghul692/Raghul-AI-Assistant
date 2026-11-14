import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
dotenv.config();

const client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function generateSmartSuggestions(client, userPrompt = '', assistantSnippet = '') {
  const isTamil = /[\u0B80-\u0BFF]|(epdi|enna|sollu|pannu|nalla|theriyum|kodu|vaanga|puriyala|iruku|irukinga|bro|nanba|eppadi|seivathu|solunga|kaattu|solu)/i.test(userPrompt);

  const stopWords = new Set(['what', 'how', 'why', 'can', 'you', 'please', 'tell', 'about', 'explain', 'enna', 'epdi', 'eppadi', 'sollu', 'pannu', 'kaattu', 'the', 'and', 'for', 'with', 'help', 'code', 'make', 'create', 'write', 'intha', 'oru', 'nanba', 'bro']);
  const words = (userPrompt + ' ' + assistantSnippet)
    .replace(/[^\w\s\u0B80-\u0BFF]/gi, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2 && !stopWords.has(w.toLowerCase()));
  
  const topTopics = [...new Set(words)].slice(0, 3);
  const primaryTopic = topTopics[0] || 'this concept';
  const secondaryTopic = topTopics[1] || primaryTopic;

  const dynamicFallback = isTamil ? [
    `${primaryTopic} real-world implementation kaattu`,
    `${primaryTopic} vs ${secondaryTopic} comparison enna?`,
    `${primaryTopic}-la common mistakes & best practices enna?`
  ] : [
    `Show practical ${primaryTopic} implementation`,
    `Compare ${primaryTopic} vs ${secondaryTopic}`,
    `Common pitfalls and best practices for ${primaryTopic}`
  ];

  if (!client) return dynamicFallback;

  try {
    const prompt = `You are a conversational follow-up recommendation engine for Nexus AI.
The user asked: "${userPrompt.slice(0, 200)}"
The assistant answered about: "${assistantSnippet.slice(0, 250)}"

Generate exactly 3 short, intriguing, context-aware follow-up questions or next prompts the user would naturally ask next.
Language requirement: ${isTamil ? 'Natural Tamil/Tanglish (conversational, e.g., "Ithoda live example kaattu", "Production-la eppadi deploy pannurathu?")' : 'Clear concise English'}.
Rules:
- NEVER generic phrases like "Explain more" or "Pros and cons".
- Each suggestion MUST mention a specific concept from the context.
- Keep each under 7 words.
- Format strictly as a JSON array of 3 strings: ["...", "...", "..."]`;

    const apiPromise = client.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        maxOutputTokens: 120,
        temperature: 0.7
      }
    });

    const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 6000));
    const res = await Promise.race([apiPromise, timeoutPromise]);

    let text = (res.text || '').trim();
    const arrayMatch = text.match(/\[[\s\S]*?\]/);
    if (arrayMatch) {
      const parsed = JSON.parse(arrayMatch[0]);
      if (Array.isArray(parsed) && parsed.length >= 2) {
        return parsed.slice(0, 3).map(s => String(s).trim());
      }
    }
  } catch (err) {
    console.warn('AI suggestions fallback engaged:', err.message);
  }

  return dynamicFallback;
}

// Test with Tamil prompt
const result = await generateSmartSuggestions(client, 'Docker containers kubernetes cluster la eppadi deploy pannurathu?', 'Kubernetes Pods, Deployment manifests, and Services handle container scaling.');
console.log('Generated Contextual Suggestions:', result);
