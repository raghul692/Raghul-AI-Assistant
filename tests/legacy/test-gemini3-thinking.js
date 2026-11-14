import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
dotenv.config();

const client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const prompt = `You are a conversational follow-up recommendation engine.
User: Redis caching Node.js eppadi implement panradhu?
AI: Redis is an in-memory key-value store commonly used for caching.

Generate exactly 3 short follow-up questions in Tanglish/Tamil.
Output JSON array of 3 strings: ["...", "...", "..."]`;

try {
  const res = await client.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: prompt,
    config: {
      responseMimeType: 'application/json',
      maxOutputTokens: 1000,
      thinkingConfig: { thinkingBudget: 0 }
    }
  });
  console.log('OUTPUT:', res.text);
} catch (err) {
  console.error('Error:', err);
}

