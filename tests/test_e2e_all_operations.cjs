const http = require('http');

function callAgent(prompt) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({ prompt, useDeterministic: true });
    const req = http.request('http://localhost:3000/api/portfolio/agent/execute', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      }
    }, res => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(body) });
        } catch (e) {
          resolve({ status: res.statusCode, raw: body });
        }
      });
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

(async () => {
  console.log('--- Running End-to-End Test Suite Across All Operations ---');

  const testPrompts = [
    {
      name: 'Certificate Removal',
      prompt: '"to my portfolio: AWS Certified AI Practitioner and Professional Achievement Certificate " intha cerificate section la itha certificates remove pannu',
      expectedIntent: 'certificate_removal'
    },
    {
      name: 'Project Removal',
      prompt: 'RAGHUL AI — Portfolio Operating System V8.0 intha project remove pannu',
      expectedIntent: 'project_removal'
    },
    {
      name: 'Skills Removal',
      prompt: 'Apache Kafka skills la irunthu thooku',
      expectedIntent: 'skills_removal'
    },
    {
      name: 'Profile Update',
      prompt: 'change my title to Senior Full Stack Engineer',
      expectedIntent: 'profile_update'
    }
  ];

  for (const t of testPrompts) {
    console.log(`\nExecuting: ${t.name}`);
    const res = await callAgent(t.prompt);
    console.log(`HTTP Status: ${res.status}`);
    console.log(`Classified Intent: ${res.data?.intent}`);
    console.log(`Pipeline Status: ${res.data?.status}`);
    console.log(`Reply Preview: ${res.data?.reply?.slice(0, 100)}...`);

    if (res.data?.intent !== t.expectedIntent) {
      console.error(`❌ Mismatch! Expected: ${t.expectedIntent}, Got: ${res.data?.intent}`);
      process.exit(1);
    }
  }

  console.log('\n🎉 ALL END-TO-END PIPELINE SCENARIOS PASSED WITH 100% RELIABILITY!');
})();

