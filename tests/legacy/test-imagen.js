import dotenv from 'dotenv';
dotenv.config();
import { GoogleGenAI } from '@google/genai';

const apiKey = process.env.GEMINI_API_KEY;
const client = new GoogleGenAI({ apiKey });

console.log('Testing client.models.generateImages with imagen-3.0-generate-002...');

try {
  const res = await client.models.generateImages({
    model: 'imagen-3.0-generate-002',
    prompt: 'A cute futuristic golden robotic cat, digital art, 8k',
    config: {
      numberOfImages: 1,
      outputMimeType: 'image/jpeg',
      aspectRatio: '1:1'
    }
  });

  console.log('generateImages response keys:', Object.keys(res));
  if (res.generatedImages && res.generatedImages.length > 0) {
    const first = res.generatedImages[0];
    console.log('Generated image info:', {
      hasImage: Boolean(first.image),
      hasBytes: Boolean(first.image && first.image.imageBytes),
      byteLength: first.image?.imageBytes ? first.image.imageBytes.length : 0
    });
  } else {
    console.log('No images returned:', res);
  }
} catch (err) {
  console.error('generateImages error:', err);
}

