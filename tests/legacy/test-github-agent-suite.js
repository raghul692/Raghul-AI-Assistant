/**
 * TEST SUITE: Autonomous GitHub AI Agent Live Execution & Verification
 * Tests real API calls to GitHub using raghul692's account.
 */

import { githubAgent } from './githubAgent.js';
import { githubMcpGateway } from './githubMcpGateway.js';

async function runSuite() {
  console.log('================================================================');
  console.log('🚀 NEXUS AUTONOMOUS GITHUB AI AGENT TEST SUITE');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`✅ PASS: ${message}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${message}`);
      failed++;
    }
  }

  // 1. Intent Classification Tests
  console.log('--- 1. Intent Classification Tests ---');
  const test1 = githubAgent.classifyAction('landing page repo la index.html read pannu');
  assert(test1 === 'READ_CODE', `Read code classified correctly (${test1})`);

  const test2 = githubAgent.classifyAction('style.css la accent color purple maathitu commit pannu');
  assert(test2 === 'EDIT_CODE', `Edit code classified correctly (${test2})`);

  const test3 = githubAgent.classifyAction('pudhu repo create panni landing page push pannu');
  assert(test3 === 'CREATE_PROJECT_REPO', `Repo create classified correctly (${test3})`);

  const test4 = githubAgent.classifyAction('feature/v2 branch create panni PR open pannu');
  assert(test4 === 'BRANCH_OR_PR', `Branch/PR classified correctly (${test4})`);

  const test5 = githubAgent.classifyAction('Create an issue "Fix navbar" in repo');
  assert(test5 === 'ISSUE_ACTION', `Issue action classified correctly (${test5})`);

  const test6 = githubAgent.classifyAction('ennudaiya github repo list kaatu');
  assert(test6 === 'LIST_REPOS', `Repo listing classified correctly (${test6})`);

  const test7 = githubAgent.classifyAction('recent commits kaatu');
  assert(test7 === 'LIST_COMMITS', `Commits listing classified correctly (${test7})`);

  // 2. Fuzzy Repo Resolution
  console.log('\n--- 2. Fuzzy Repo Resolution Tests ---');
  const resolvedLanding = await githubMcpGateway.resolveRepoName('landing-page');
  assert(resolvedLanding === 'modern-saas-landing-page', `Resolved "landing-page" to "${resolvedLanding}"`);

  const resolvedPortfolio = await githubMcpGateway.resolveRepoName('portfolio');
  assert(resolvedPortfolio === 'raghulraja_portfolio', `Resolved "portfolio" to "${resolvedPortfolio}"`);

  // 3. Live Remote File Read
  console.log('\n--- 3. Live Remote File Read Test ---');
  const readRes = await githubAgent.executeIntent({
    message: 'modern-saas-landing-page repo-\u0bb2\u0bcd \u0b89\u0bb3\u0bcd\u0bb3 index.html file-\u0b90 \u0b95\u0bbe\u0b9f\u0bcd\u0b9f\u0bc1',
    sendSSE: (e) => console.log(`   [SSE] ${e.type}: ${e.text || e.message || ''}`)
  });
  assert(readRes && readRes.includes('NexusSaaS') || readRes.includes('html') || readRes.includes('DOCTYPE'), 'Real index.html content fetched from GitHub');
  assert(readRes.includes('https://github.com/raghul692/modern-saas-landing-page'), 'Correct GitHub link included in read response');

  // 4. Live Remote Code Edit & Push (Real Commit on GitHub)
  console.log('\n--- 4. Live Remote Code Edit & Commit Test ---');
  const editRes = await githubAgent.executeIntent({
    message: 'modern-saas-landing-page repo-\u0bb2\u0bcd style.css-\u0bb2\u0bcd accent color-\u0b90 purple \u0b86\u0b95 \u0bae\u0bbe\u0bb1\u0bcd\u0bb1\u0bbf commit \u0baa\u0ba3\u0bcd\u0ba3\u0bc1',
    sendSSE: (e) => console.log(`   [SSE] ${e.type}: ${e.text || e.message || ''}`)
  });
  assert(editRes && editRes.includes('Commit Summary'), 'Edit commit summary returned');
  assert(editRes.includes('Commit SHA:'), 'Real commit SHA returned in response');
  assert(editRes.includes('100% Real API Grounded & Verified ✅'), 'Real API grounding confirmed');

  // 5. Live Issue Creation
  console.log('\n--- 5. Live Issue Creation Test ---');
  const issueRes = await githubAgent.executeIntent({
    message: 'Create an issue "Autonomous Agent Verification Pass" in modern-saas-landing-page',
    sendSSE: (e) => console.log(`   [SSE] ${e.type}: ${e.text || e.message || ''}`)
  });
  assert(issueRes && issueRes.includes('GitHub Issue Created Successfully'), 'Issue creation confirmed');
  assert(issueRes.includes('Issue Number:'), 'Issue number returned');
  assert(issueRes.includes('https://github.com/raghul692/modern-saas-landing-page/issues/'), 'Direct issue link returned');

  // 6. Live Commits Listing
  console.log('\n--- 6. Live Commits Listing Test ---');
  const commitsRes = await githubAgent.executeIntent({
    message: 'modern-saas-landing-page repo recent commits kaatu',
    sendSSE: (e) => console.log(`   [SSE] ${e.type}: ${e.text || e.message || ''}`)
  });
  assert(commitsRes && commitsRes.includes('Recent Commits for'), 'Commits heading rendered');
  assert(commitsRes.includes('raghul692'), 'Author raghul692 verified in commits');

  console.log('\n================================================================');
  console.log(`🏁 TEST RESULTS: ${passed} PASSED | ${failed} FAILED`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runSuite().catch(err => {
  console.error('Fatal Suite Error:', err);
  process.exit(1);
});

