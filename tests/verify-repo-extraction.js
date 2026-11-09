import { githubAgent } from '../githubAgent.js';

export const testFn = async (message) => {
  if (!message || typeof message !== 'string') return null;
  const cleanMsg = message.trim();

  // 1. Explicit GitHub URL extraction (Priority 1)
  const urlMatch = cleanMsg.match(/(?:https?:\/\/)?(?:www\.)?github\.com\/([a-zA-Z0-9_\-\.]+)\/([a-zA-Z0-9_\-\.]+)/i);
  if (urlMatch && urlMatch[2]) {
    const repo = urlMatch[2].replace(/\.git$/i, '').replace(/["'`>)!,;:]+$/, '');
    const reserved = ['repositories', 'stars', 'settings', 'pulls', 'issues', 'notifications', 'orgs'];
    if (!reserved.includes(repo.toLowerCase()) && repo.length >= 2) {
      return repo;
    }
  }

  // 2. Explicit Keyword Pattern (Priority 2)
  const explicitMatch = 
    // 2a. Colon or equals syntax: repo: name, repository: name, repo=name
    cleanMsg.match(/(?:^|[^\w])(?:repo|repository)\s*[:=]\s*["'`]?([a-zA-Z0-9_\-\.]+(?:\/[a-zA-Z0-9_\-\.]+)?)(?:\.git)?["'`]?(?=[^\w\-\/]|$)/i) ||
    // 2b. Named/called syntax: repo named name, repository called name
    cleanMsg.match(/(?:^|[^\w])(?:repo|repository)\s+(?:named|name|called|is|for)\s*[:=\s]+["'`]?([a-zA-Z0-9_\-\.]+(?:\/[a-zA-Z0-9_\-\.]+)?)(?:\.git)?["'`]?(?=[^\w\-\/]|$)/i) ||
    // 2c. Quoted name: repo "name", repository 'name', repo `name`
    cleanMsg.match(/(?:^|[^\w])(?:repo|repository)\s*["'`]+([a-zA-Z0-9_\-\.]+(?:\/[a-zA-Z0-9_\-\.]+)?)(?:\.git)?["'`]+(?=[^\w\-\/]|$)/i) ||
    // 2d. Preposition syntax: in repo name, from repository name, to the repo owner/name
    cleanMsg.match(/(?:in|from|to|on)\s+(?:the\s+)?(?:repo|repository)\s*[:=\s]+["'`]?([a-zA-Z0-9_\-\.]+(?:\/[a-zA-Z0-9_\-\.]+)?)(?:\.git)?["'`]?(?=[^\w\-\/]|$)/i) ||
    // 2e. Short prefix 'repo <ident>'
    cleanMsg.match(/(?:^|[^\w])repo\s+["'`]?([a-zA-Z0-9_\-\.]+(?:\/[a-zA-Z0-9_\-\.]+)?)(?:\.git)?["'`]?(?=[^\w\-\/]|$)/i);

  if (explicitMatch && explicitMatch[1]) {
    let raw = explicitMatch[1].trim().replace(/^["'`]+|["'`]+$/g, '').replace(/[)!,;:]+$/, '');
    if (raw.includes('/')) {
      const parts = raw.split('/');
      raw = parts[parts.length - 1];
    }
    const cand = raw.toLowerCase();
    const genericWords = [
      'the', 'my', 'a', 'an', 'new', 'this', 'that', 'recent', 'latest', 'all', 'any',
      'structures', 'pattern', 'patterns', 'design', 'architecture', 'guidelines'
    ];
    if (!genericWords.includes(cand) && cand.length >= 2) {
      return raw;
    }
  }

  return null;
};

const cases = [
  // Primary Table from User Specification
  { input: 'architectures in 2026', expected: null },
  { input: 'deploy to production', expected: null },
  { input: 'running on AWS', expected: null },
  { input: 'GitHub benchmark repositories', expected: null },
  { input: 'in repo 2026', expected: '2026' },
  { input: 'in repository 2026', expected: '2026' },
  { input: 'read README from repo raghul692/TO_DO_LIST', expected: 'TO_DO_LIST' },
  { input: 'inspect repository: raghul692/TO_DO_LIST', expected: 'TO_DO_LIST' },
  { input: 'https://github.com/raghul692/TO_DO_LIST', expected: 'TO_DO_LIST' },
  { input: 'open repo "TO_DO_LIST"', expected: 'TO_DO_LIST' },

  // External & URL cases
  { input: 'read README from repo vercel/next.js', expected: 'next.js' },
  { input: 'inspect repository: langchain-ai/langchain', expected: 'langchain' },
  { input: 'https://github.com/microsoft/autogen', expected: 'autogen' },
  { input: 'https://github.com/openai/openai-python.git', expected: 'openai-python' },
  { input: 'open repo "new-unlisted-project"', expected: 'new-unlisted-project' },
  { input: "open repo 'quoted-single-repo'", expected: 'quoted-single-repo' },
  { input: "Show me details for repo `special-tool`", expected: 'special-tool' },

  // Punctuation & Formatting
  { input: "Check the commits in repo: my-backend-api!\nThanks!", expected: 'my-backend-api' },
  { input: "Can you inspect (repo: my-backend-api)?", expected: 'my-backend-api' },
  { input: "REPO: UPPERCASE-APP", expected: 'UPPERCASE-APP' },
  { input: "REPOSITORY: MixedCase-App", expected: 'MixedCase-App' },
  { input: "Multi-line message\nwith repo: multi-line-target\nend of query.", expected: 'multi-line-target' },
  { input: "Unicode message ரிபோசிட்டரி repo: tamil-repo-test", expected: 'tamil-repo-test' },

  // Malformed and Negative Guards
  { input: "repo:", expected: null },
  { input: "in repository", expected: null },
  { input: "repo: !!!", expected: null },
  { input: "Just discussing repository structures in general.", expected: null },
  { input: "How to deploy to AWS in 2026 without any downtime?", expected: null },
  { input: "What are the latest AI benchmark repositories on GitHub?", expected: null }
];

async function run() {
  console.log('--- Exhaustive Repository Extraction Verification (29 Scenarios) ---');
  let passCount = 0;
  let failCount = 0;

  for (const c of cases) {
    const res = await githubAgent.extractRepoName(c.input);
    const pass = (res === c.expected);
    if (pass) {
      passCount++;
      console.log(`✅ PASS: ${JSON.stringify(c.input)} => ${JSON.stringify(res)}`);
    } else {
      failCount++;
      console.log(`❌ FAIL: ${JSON.stringify(c.input)} => Expected: ${JSON.stringify(c.expected)}, Got: ${JSON.stringify(res)}`);
    }
  }

  console.log(`\nResults: ${passCount} Passed, ${failCount} Failed out of ${cases.length}`);
  if (failCount > 0) process.exit(1);
}

run();
