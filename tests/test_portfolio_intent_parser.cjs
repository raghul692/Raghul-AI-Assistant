(async () => {
  const parser = await import('../services/portfolioIntentParser.js');

  const testCases = [
    {
      prompt: '"to my portfolio: AWS Certified AI Practitioner and Professional Achievement Certificate " intha cerificate section la itha certificates remove pannu',
      expectedIntent: 'certificate_removal',
      expectedAction: 'REMOVE',
      expectedEntity: 'CERTIFICATE'
    },
    {
      prompt: 'skills add panna sonna: Redis and Apache Kafka backend la podu',
      expectedIntent: 'skills_update',
      expectedAction: 'ADD',
      expectedEntity: 'SKILL'
    },
    {
      prompt: 'RAGHUL AI — Portfolio Operating System V8.0 and Autonomous Feature App intha two projects remove pannidu',
      expectedIntent: 'project_removal',
      expectedAction: 'REMOVE',
      expectedEntity: 'PROJECT'
    },
    {
      prompt: 'Apache Kafka skills la irunthu thooku',
      expectedIntent: 'skills_removal',
      expectedAction: 'REMOVE',
      expectedEntity: 'SKILL'
    },
    {
      prompt: 'project Autonomous Vision Agent description ah update pannu',
      expectedIntent: 'project_update',
      expectedAction: 'UPDATE',
      expectedEntity: 'PROJECT'
    },
    {
      prompt: 'change my title to Senior Full Stack Engineer',
      expectedIntent: 'profile_update',
      expectedAction: 'UPDATE',
      expectedEntity: 'PROFILE'
    }
  ];

  console.log('--- Testing portfolioIntentParser ---');
  let allPass = true;

  for (const tc of testCases) {
    const res = parser.resolveIntent(tc.prompt);
    const pass = res.intent === tc.expectedIntent && res.action === tc.expectedAction && res.entity === tc.expectedEntity;
    console.log(`\nPrompt: "${tc.prompt.slice(0, 70)}..."`);
    console.log(`Action: ${res.action} (Expected: ${tc.expectedAction})`);
    console.log(`Entity: ${res.entity} (Expected: ${tc.expectedEntity})`);
    console.log(`Intent: ${res.intent} (Expected: ${tc.expectedIntent})`);
    console.log(`Targets:`, res.targets);
    console.log(`Result: ${pass ? '✅ PASS' : '❌ FAIL'}`);
    if (!pass) allPass = false;
  }

  if (!allPass) {
    console.error('\n❌ Some test cases failed!');
    process.exit(1);
  } else {
    console.log('\n🎉 ALL INTENT PARSER TEST CASES PASSED PERFECTLY!');
  }
})();

