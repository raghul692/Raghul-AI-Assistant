import dotenv from 'dotenv';
dotenv.config();
import { GoogleGenAI } from '@google/genai';

const apiKey = process.env.GEMINI_API_KEY;
const client = new GoogleGenAI({ apiKey });

console.log('Testing client.interactions.create with gemini-3.8-flash for image generation...');

try {
  const interaction = await client.interactions.create({
    model: 'gemini-3.8-flash',
    input: 'Generate an image of a red racecar',
    config: {
      response_modalities: ['IMAGE', 'TEXT']
    }
  });

  console.log('Interaction output_text:', interaction.output_text);
  console.log('Interaction output_image:', interaction.output_image);
} catch (err) {
  console.log('Interaction error:', err.message);
}

