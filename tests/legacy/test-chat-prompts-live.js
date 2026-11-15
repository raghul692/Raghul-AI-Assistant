import { promptEngine } from './prompts/promptEngine.js';
import { githubAgent } from './githubAgent.js';

console.log('🧪 Verifying Live Chat Prompt Generation & Routing Invariants...\n');

// 1. Verify Code Generation Request
const codeMsg = "Express.js-\u0bb2\u0bcd JWT Auth + Refresh Token + Redis Rate Limiting \u0b89\u0b9f\u0ba9\u0bcd \u0b95\u0bc2\u0b9f\u0bbf\u0baf production-ready middleware \u0b8e\u0bb4\u0bc1\u0ba4\u0bbf \u0b95\u0bbe\u0b9f\u0bcd\u0b9f\u0bc1.";
const isGitForCode = githubAgent.isGitHubIntent(codeMsg);
console.log(`1. Code Request githubAgent.isGitHubIntent: ${isGitForCode} (Expected: false)`);
if (isGitForCode !== false) {
  console.error('❌ Failed: Code request triggered GitHub agent intent!');
  process.exit(1);
}

const codeSystemPrompt = promptEngine.buildSystemInstruction({
  personaKey: 'coder',
  message: codeMsg,
  userName: 'Raghul'
});

const hasDevWorkflow = codeSystemPrompt.includes('DISCIPLINED DEVELOPER WORKFLOW');
const hasNoGithubBloat = !codeSystemPrompt.includes('Authenticated Account: RAGHUL RAJA M');
console.log(`   - Has Developer Workflow: ${hasDevWorkflow}`);
console.log(`   - Has Zero GitHub Bloat: ${hasNoGithubBloat}`);
if (!hasDevWorkflow || !hasNoGithubBloat) {
  console.error('❌ Failed: Code prompt structure invalid');
  process.exit(1);
}

// 2. Verify Casual Chat Request
const casualMsg = "machi epdi iruka";
const isGitForCasual = githubAgent.isGitHubIntent(casualMsg);
const casualPrompt = promptEngine.buildSystemInstruction({
  personaKey: 'assistant',
  message: casualMsg,
  userName: 'Raghul'
});

const hasSoul = casualPrompt.includes('CORE VOICE & CONVERSATIONAL ESSENCE');
const hasNoReasoningBox = !casualPrompt.includes('Unpack your cognitive deliberation');
const hasNoDevWorkflowCasual = !casualPrompt.includes('DISCIPLINED DEVELOPER WORKFLOW');

console.log(`\n2. Casual Chat ("machi epdi iruka"):`);
console.log(`   - Has Soul / Personality v2: ${hasSoul}`);
console.log(`   - No Unnecessary Reasoning Box: ${hasNoReasoningBox}`);
console.log(`   - No Dev Workflow Bloat: ${hasNoDevWorkflowCasual}`);

if (!hasSoul || !hasNoReasoningBox || !hasNoDevWorkflowCasual) {
  console.error('❌ Failed: Casual prompt contains unnecessary bloat');
  process.exit(1);
}

// 3. Verify Real GitHub Operational Intent
const gitMsg = "my github projects list out pannu";
const isGitReal = githubAgent.isGitHubIntent(gitMsg);
console.log(`\n3. GitHub Operational Request ("my github projects list out pannu"):`);
console.log(`   - githubAgent.isGitHubIntent: ${isGitReal} (Expected: true)`);

if (isGitReal !== true) {
  console.error('❌ Failed: GitHub request failed to trigger GitHub agent intent!');
  process.exit(1);
}

console.log('\n🎉 ALL LIVE CHAT ROUTING AND PROMPT INVARIANTS VERIFIED 100%!');

