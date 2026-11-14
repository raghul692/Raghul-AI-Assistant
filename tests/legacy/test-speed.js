import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
dotenv.config();

const client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const models = ['gemini-3.8-flash', 'gemini-2.5-flash'];

for (const model of models) {
  const start = Date.now();
  try {
    const res = await client.models.generateContent({
      model,
      contents: 'Output exactly 3 short follow up questions about React hooks as JSON array: ["q1","q2","q3"]',
      config: {
        responseMimeType: 'application/json',
        maxOutputTokens: 60
      }
    });
    console.log(`[${model}] succeeded in ${Date.now() - start}ms:`, res.text.trim());
  } catch (err) {
    console.log(`[${model}] failed in ${Date.now() - start}ms:`, err.message);
  }
}
