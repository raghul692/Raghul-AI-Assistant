import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
dotenv.config();

const client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

async function test(userPrompt, responseText) {
  const isTamil = /[\u0B80-\u0BFF]|(epdi|enna|sollu|pannu|nalla|theriyum|kodu|vaanga|puriyala|iruku|irukinga|bro|nanba|eppadi|seivathu|solunga)/i.test(userPrompt);
  const prompt = `You are a follow-up suggestion generator for an AI assistant.
Based on the conversation, output a JSON array of 3 short, relevant follow-up questions the user might ask next.
Topic context: ${userPrompt.slice(0, 150)}
Language: ${isTamil ? 'Tanglish/Tamil' : 'English'}
Rules:
- Strictly relevant to the topic discussed
- Under 6 words each
- Return JSON array only: ["s1", "s2", "s3"]`;

  const startTime = Date.now();
  const res = await client.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: prompt,
    config: {
      responseMimeType: 'application/json',
      maxOutputTokens: 80,
      temperature: 0.7
    }
  });

  console.log(`Time: ${Date.now() - startTime}ms`);
  console.log('Suggestions:', res.text);
}

test('React la state management eppadi pannurathu?', 'React la useState, useReducer, illana Zustand use pannalam.')
  .then(() => process.exit(0))
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
