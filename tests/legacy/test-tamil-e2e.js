// E2E Test for Tamil Bilingual Streaming & Suggestions
const res = await fetch('http://localhost:3000/api/chat/stream', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    message: 'vanakkam, enaku node.js pathi sollu',
    sessionId: 'test_tamil_' + Date.now(),
    personaKey: 'assistant',
    userName: 'Raghul',
    userRole: 'Full-Stack Software Engineer',
    temperature: 0.7,
    webSearchEnabled: false
  })
});

const reader = res.body.getReader();
const decoder = new TextDecoder();
let buffer = '';
let suggestions = [];

while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  buffer += decoder.decode(value, { stream: true });
  const lines = buffer.split('\n\n');
  buffer = lines.pop();

  for (const line of lines) {
    if (line.startsWith('data: ')) {
      const data = JSON.parse(line.substring(6));
      if (data.type === 'done') {
        suggestions = data.suggestions || [];
        console.log('Tamil Suggestions:', suggestions);
      }
    }
  }
}

if (suggestions.length === 3 && suggestions[0].includes('explain')) {
  console.log('✅ Tamil suggestions verified!');
}

