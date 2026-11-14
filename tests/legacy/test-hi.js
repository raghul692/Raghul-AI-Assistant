const res = await fetch('http://localhost:3000/api/chat/stream', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    message: 'hi',
    sessionId: 'test-greeting-session',
    personaKey: 'assistant',
    modelChoice: 'gemini-3.5-flash-lite'
  })
});

const reader = res.body.getReader();
const decoder = new TextDecoder();
let text = '';

while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  const chunk = decoder.decode(value);
  const lines = chunk.split('\n\n');
  for (const l of lines) {
    if (l.startsWith('data: ')) {
      try {
        const d = JSON.parse(l.substring(6));
        if (d.type === 'token') text += d.text;
      } catch (e) {}
    }
  }
}

console.log('--- RESPONSE FOR "hi" ---');
console.log(text);

