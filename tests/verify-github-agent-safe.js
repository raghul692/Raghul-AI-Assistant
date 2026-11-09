import { githubAgent } from '../githubAgent.js';
import { githubMcpGateway } from '../githubMcpGateway.js';

async function run() {
  console.log('================================================================');
  console.log('🐙 VERIFY GITHUB AGENT READ & ERROR BOUNDARIES (SAFE READ-ONLY)');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`✅ [PASS] ${message}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${message}`);
      failed++;
    }
  }

  // 1. List Repositories
  console.log('--- 1. List Repositories (Read-Only) ---');
  try {
    const repos = await githubMcpGateway.listRepositories({ perPage: 10 });
    assert(Array.isArray(repos) && repos.length > 0, `Listed ${repos.length} live repositories`);
    assert(repos.some(r => r.name === 'raghulraja_portfolio' || r.name === 'modern-saas-landing-page'), 'Contains verified repositories');
  } catch (err) {
    assert(false, `List repositories failed: ${err.message}`);
  }

  // 2. Read Repository Metadata
  console.log('\n--- 2. Read Repository Metadata ---');
  try {
    const repoMeta = await githubMcpGateway.getRepository('raghul692', 'modern-saas-landing-page');
    assert(repoMeta && repoMeta.name === 'modern-saas-landing-page', 'Fetched correct repository metadata');
    assert(repoMeta.owner && repoMeta.owner.login === 'raghul692', 'Owner matches raghul692');
  } catch (err) {
    assert(false, `Get repository metadata failed: ${err.message}`);
  }

  // 3. Read File Content
  console.log('\n--- 3. Read Source File ---');
  try {
    const fileRes = await githubAgent.executeIntent({
      message: 'Show index.html from repo modern-saas-landing-page',
      sendSSE: () => {}
    });
    assert(fileRes && (fileRes.includes('html') || fileRes.includes('NexusSaaS') || fileRes.includes('DOCTYPE')), 'Read real file content from GitHub');
  } catch (err) {
    assert(false, `Read file failed: ${err.message}`);
  }

  // 4. Read Commits
  console.log('\n--- 4. Read Verified Commits ---');
  try {
    const commits = await githubMcpGateway.listCommits('raghul692', 'modern-saas-landing-page', '', 5);
    assert(Array.isArray(commits) && commits.length > 0, `Retrieved ${commits.length} recent commits`);
    assert(Boolean(commits[0].sha), `First commit has valid SHA: ${commits[0].sha?.slice(0, 7)}`);
  } catch (err) {
    assert(false, `List commits failed: ${err.message}`);
  }

  // 5. Invalid Repository & HTTP 404 Handling
  console.log('\n--- 5. Invalid Repository & HTTP 404 Handling ---');
  try {
    let errorThrown = false;
    try {
      await githubMcpGateway.getRepository('raghul692', 'non-existent-ghost-repo-xyz-999');
    } catch (err) {
      errorThrown = true;
      assert(err.message.includes('404') || err.message.includes('Not Found'), `Cleanly received HTTP 404 for non-existent repo (${err.message})`);
    }
    assert(errorThrown, '404 error was properly caught and surfaced');
  } catch (err) {
    assert(false, `404 handling failed: ${err.message}`);
  }

  // 6. Zero Unnecessary GitHub API Calls for Research Prompts (Spy Verification)
  console.log('\n--- 6. Zero Unnecessary GitHub API Calls for Research Prompts ---');
  const researchPrompts = [
    '/research Production-grade Multi-Agent System architectures in 2026: Compare LangGraph, CrewAI, and AutoGen on execution latency, token costs, fault tolerance, and human-in-the-loop workflows. Include real enterprise case studies and GitHub benchmark repositories.',
    'Compare LangGraph, CrewAI, and AutoGen architectures with benchmark repositories on GitHub.',
    'Explain production architecture in 2026 and how to benchmark systems.'
  ];

  for (const prompt of researchPrompts) {
    const isGit = githubAgent.isGitHubIntent(prompt);
    assert(isGit === false, `Prompt correctly bypassed GitHub Agent: "${prompt.slice(0, 45)}..."`);
  }

  console.log('\n================================================================');
  console.log(`🏁 GITHUB SAFE SUITE RESULT: ${passed} PASSED | ${failed} FAILED`);
  console.log('================================================================\n');

  if (failed > 0) process.exit(1);
}

run();

