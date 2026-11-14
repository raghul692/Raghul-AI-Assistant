import { promptEngine } from './prompts/promptEngine.js';

console.log('🧪 Starting Nexus Prompt Engine Verification Tests...\n');

// 1. Test Casual Intent
const casualPrompt = promptEngine.buildSystemInstruction({
  personaKey: 'assistant',
  message: 'machi epdi iruka',
  userName: 'Raghul',
  githubContext: '26 repositories under @raghul692',
  portfolioContext: 'Live at https://raghulraja.is-a.dev/'
});

console.log('--- Test 1: Casual Intent ("machi epdi iruka") ---');
const hasSoul = casualPrompt.includes('CORE VOICE & CONVERSATIONAL ESSENCE');
const hasNoDevWorkflow = !casualPrompt.includes('DISCIPLINED DEVELOPER WORKFLOW');
const hasNoGithubBloat = !casualPrompt.includes('26 repositories under @raghul692');
const hasNoPortfolioBloat = !casualPrompt.includes('https://raghulraja.is-a.dev/');

console.log(`✅ Core Soul Included: ${hasSoul}`);
console.log(`✅ Zero Dev Workflow Bloat: ${hasNoDevWorkflow}`);
console.log(`✅ Zero GitHub Bloat: ${hasNoGithubBloat}`);
console.log(`✅ Zero Portfolio Bloat: ${hasNoPortfolioBloat}`);
if (!hasSoul || !hasNoDevWorkflow || !hasNoGithubBloat || !hasNoPortfolioBloat) {
  console.error('❌ Test 1 Failed');
  process.exit(1);
}

// 2. Test Code Generation Intent
const codePrompt = promptEngine.buildSystemInstruction({
  personaKey: 'coder',
  message: 'Express.js-ல் JWT Auth + Refresh Token + Redis Rate Limiting உடன் கூடிய production-ready middleware எழுதி காட்டு.',
  userName: 'Raghul',
  githubContext: '26 repositories under @raghul692',
  portfolioContext: 'Live at https://raghulraja.is-a.dev/'
});

console.log('\n--- Test 2: Code Generation ("Express.js middleware எழுதி காட்டு") ---');
const hasDevWorkflow = codePrompt.includes('DISCIPLINED DEVELOPER WORKFLOW');
const hasZeroPlaceholderRule = codePrompt.includes('Strict Zero-Placeholder Invariant');
const hasCanvasConventions = codePrompt.includes('Canvas Studio Multi-File Project Conventions');
const hasNoGithubBloatInCode = !codePrompt.includes('26 repositories under @raghul692');

console.log(`✅ Developer Workflow Included: ${hasDevWorkflow}`);
console.log(`✅ Strict Zero-Placeholder Invariant: ${hasZeroPlaceholderRule}`);
console.log(`✅ Canvas Multi-File Format: ${hasCanvasConventions}`);
console.log(`✅ Clean Isolation (No GitHub Bloat): ${hasNoGithubBloatInCode}`);
if (!hasDevWorkflow || !hasZeroPlaceholderRule || !hasCanvasConventions || !hasNoGithubBloatInCode) {
  console.error('❌ Test 2 Failed');
  process.exit(1);
}

// 3. Test GitHub Operational Intent
const githubPrompt = promptEngine.buildSystemInstruction({
  personaKey: 'assistant',
  message: 'my github projects list out pannu',
  userName: 'Raghul',
  githubContext: '26 repositories under @raghul692'
});

console.log('\n--- Test 3: GitHub Operational Intent ("my github projects list out pannu") ---');
const hasGithubContext = githubPrompt.includes('26 repositories under @raghul692');
console.log(`✅ GitHub Context Targeted Injection: ${hasGithubContext}`);
if (!hasGithubContext) {
  console.error('❌ Test 3 Failed');
  process.exit(1);
}

// 4. Test Persona Catalog
console.log('\n--- Test 4: Persona Catalog ---');
const personas = promptEngine.listPersonas();
const expectedKeys = ['assistant', 'coder', 'researcher', 'coordinator', 'devops', 'security', 'interviewer'];
const allFound = expectedKeys.every(k => personas[k]);
console.log(`✅ All Expected Personas Present (${expectedKeys.join(', ')}): ${allFound}`);
if (!allFound) {
  console.error('❌ Test 4 Failed');
  process.exit(1);
}

console.log('\n🎉 ALL 4 PROMPT ENGINE TESTS PASSED WITH 100% SUCCESS!');

