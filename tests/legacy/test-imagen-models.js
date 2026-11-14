import dotenv from 'dotenv';
dotenv.config();
import { GoogleGenAI } from '@google/genai';

const apiKey = process.env.GEMINI_API_KEY;
const client = new GoogleGenAI({ apiKey });

console.log('Testing image generation with generateContent...');

const candidateModels = [
  'imagen-3.0-generate-002',
  'gemini-2.0-flash-exp',
  'gemini-2.0-flash',
  'gemini-3.1-flash-image',
  'gemini-3-pro-image'
];

for (const model of candidateModels) {
  try {
    console.log(`\nTrying model: ${model}...`);
    const res = await client.models.generateContent({
      model,
      contents: [{ role: 'user', parts: [{ text: 'Generate an image of a golden robotic cat' }] }],
      config: {
        responseModalities: ['IMAGE', 'TEXT']
      }
    });

    console.log(`Model ${model} SUCCESS! Candidates:`, res.candidates?.length);
    if (res.candidates?.[0]?.content?.parts) {
      for (const p of res.candidates[0].content.parts) {
        if (p.inlineData) {
          console.log('Got inlineData image!', p.inlineData.mimeType, p.inlineData.data?.slice(0, 50));
        } else if (p.text) {
          console.log('Got text:', p.text.slice(0, 100));
        }
      }
    }
    break;
  } catch (err) {
    console.log(`Model ${model} failed:`, err.message);
  }
}

