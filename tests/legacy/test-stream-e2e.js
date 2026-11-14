// E2E Test for Streaming, RAG & Suggested Follow-Ups
import dotenv from 'dotenv';
dotenv.config();

console.log('🧪 Testing SSE Streaming, Follow-Up Suggestions & Grounding...');

const apiKey = process.env.GEMINI_API_KEY;
console.log('API Key available:', Boolean(apiKey && apiKey !== 'your_gemini_api_key_here'));

const res = await fetch('http://localhost:3000/api/chat/stream', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    message: 'hi, can you give me 2 quick tips on building scalable node.js microservices?',
    sessionId: 'test_stream_' + Date.now(),
    personaKey: 'coder',
    userName: 'Raghul',
    userRole: 'Full-Stack Software Engineer',
    temperature: 0.7,
    webSearchEnabled: false
  })
});

console.log('Stream HTTP status:', res.status);
if (!res.ok) {
  console.error('Stream request failed with status', res.status);
  process.exit(1);
}

const reader = res.body.getReader();
const decoder = new TextDecoder();
let buffer = '';
let tokenCount = 0;
let doneReceived = false;
let suggestionsReceived = [];

while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  buffer += decoder.decode(value, { stream: true });
  const lines = buffer.split('\n\n');
  buffer = lines.pop();

  for (const line of lines) {
    if (line.startsWith('data: ')) {
      const data = JSON.parse(line.substring(6));
      if (data.type === 'token') {
        tokenCount++;
      } else if (data.type === 'done') {
        doneReceived = true;
        suggestionsReceived = data.suggestions || [];
        console.log('SSE Done Event:', {
          model: data.model,
          memoryTurns: data.memoryTurns,
          suggestionsCount: suggestionsReceived.length,
          suggestions: suggestionsReceived
        });
      }
    }
  }
}

console.log(`Stream complete. Received ${tokenCount} tokens.`);
console.log(`Done received: ${doneReceived}`);
console.log(`Follow-up suggestions count: ${suggestionsReceived.length}`);

if (tokenCount > 0 && doneReceived && suggestionsReceived.length > 0) {
  console.log('🎉 E2E Streaming & Suggestions Verified Successfully!');
  process.exit(0);
} else {
  console.error('⚠️ Verification failed: missing tokens or suggestions');
  process.exit(1);
}

