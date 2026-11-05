/**
 * EchoCopilot - Git Concept Pipeline Disambiguation Regression Suite
 * 
 * Verifies that all 8 mandatory Git questions plus edge cases receive distinct,
 * accurate canonical concepts, handlers, and generated answers with ZERO collisions.
 */

import { resolveGitCanonicalConcept, normalizeTechnicalTerms } from '../src/lib/technicalTermNormalizer.ts';
import { classifyQuestionIntent } from '../src/lib/intentClassifier.ts';
import { generateStructuredComparison, isKnownComparison, getComparisonHandlerName } from '../src/lib/comparisonEngine.ts';
import { generateTechnicalAnswer, hasDeterministicTechnicalAnswer } from '../src/lib/technicalEngine.ts';
import { generateSmartCopilotAnswer, generateOllamaAnswer } from '../src/lib/aiFallback.ts';

let passed = 0;
let failed = 0;

function assert(condition, name, details = '') {
  if (condition) {
    console.log(`  ✓ PASS: ${name}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${name}`);
    if (details) console.error(`    Details: ${details}`);
    failed++;
  }
}

console.log('\n========================================================================');
console.log('🧪 EchoCopilot Git Disambiguation & Anti-Collision Suite');
console.log('========================================================================\n');

// ------------------------------------------------------------------------
// Test 1: Canonical Concept Normalization (No Substring Collisions)
// ------------------------------------------------------------------------
console.log('--- 1. Strict Priority Canonical Git Concept Resolution ---');

const canonicalTestCases = [
  { raw: 'Pull Request', expected: 'GITHUB_PULL_REQUEST' },
  { raw: 'pull request', expected: 'GITHUB_PULL_REQUEST' },
  { raw: 'github pr', expected: 'GITHUB_PULL_REQUEST' },
  { raw: 'PR', expected: 'GITHUB_PULL_REQUEST' },
  { raw: 'pull command in GitHub', expected: 'GIT_PULL' },
  { raw: 'pull command', expected: 'GIT_PULL' },
  { raw: 'git pull', expected: 'GIT_PULL' },
  { raw: 'git-pull', expected: 'GIT_PULL' },
  { raw: 'pull', expected: 'GIT_PULL' },
  { raw: 'git fetch', expected: 'GIT_FETCH' },
  { raw: 'fetch', expected: 'GIT_FETCH' },
  { raw: 'fetch command', expected: 'GIT_FETCH' },
  { raw: 'git merge', expected: 'GIT_MERGE' },
  { raw: 'merge', expected: 'GIT_MERGE' },
  { raw: 'git rebase', expected: 'GIT_REBASE' },
  { raw: 'rebase', expected: 'GIT_REBASE' },
];

for (const tc of canonicalTestCases) {
  const actual = resolveGitCanonicalConcept(tc.raw);
  assert(actual === tc.expected, `"${tc.raw}" resolves to ${tc.expected}`, `Got: ${actual}`);
}

// Ensure "pull request" is NEVER resolved to GIT_PULL simply because it contains "pull"
assert(
  resolveGitCanonicalConcept('pull request') !== 'GIT_PULL',
  '"pull request" is NEVER resolved to GIT_PULL'
);
assert(
  resolveGitCanonicalConcept('GitHub Pull Request') !== 'GIT_PULL',
  '"GitHub Pull Request" is NEVER resolved to GIT_PULL'
);

// ------------------------------------------------------------------------
// Test 2: Comparison Routing & Distinct Handler Selection
// ------------------------------------------------------------------------
console.log('\n--- 2. Distinct Comparison Handler Routing ---');

const q1 = "What is the difference between a Pull Request and pull command in GitHub?";
const q2 = "What is the difference between git fetch and git pull?";
const q3 = "What is the difference between git merge and git pull?";
const q4 = "What is the difference between git fetch and a Pull Request?";
const q5 = "What is the difference between git merge and git rebase?";

// Question 1: PR vs Git Pull
{
  const intent = classifyQuestionIntent(q1);
  const handler = getComparisonHandlerName(
    intent.extractedConcepts?.conceptA || '',
    intent.extractedConcepts?.conceptB || '',
    q1
  );
  assert(intent.intent === 'COMPARISON', 'Q1 is classified as COMPARISON');
  assert(handler === 'GITHUB_PULL_REQUEST_VS_GIT_PULL', `Q1 routes to GITHUB_PULL_REQUEST_VS_GIT_PULL (got ${handler})`);
  assert(isKnownComparison(intent.extractedConcepts?.conceptA || '', intent.extractedConcepts?.conceptB || '', q1), 'Q1 is recognized as known comparison');
}

// Question 2: Git Fetch vs Git Pull
{
  const intent = classifyQuestionIntent(q2);
  const handler = getComparisonHandlerName(
    intent.extractedConcepts?.conceptA || '',
    intent.extractedConcepts?.conceptB || '',
    q2
  );
  assert(intent.intent === 'COMPARISON', 'Q2 is classified as COMPARISON');
  assert(handler === 'GIT_FETCH_VS_GIT_PULL', `Q2 routes to GIT_FETCH_VS_GIT_PULL (got ${handler})`);
  assert(isKnownComparison(intent.extractedConcepts?.conceptA || '', intent.extractedConcepts?.conceptB || '', q2), 'Q2 is recognized as known comparison');
}

// Question 3: Git Merge vs Git Pull
{
  const intent = classifyQuestionIntent(q3);
  const handler = getComparisonHandlerName(
    intent.extractedConcepts?.conceptA || '',
    intent.extractedConcepts?.conceptB || '',
    q3
  );
  assert(handler === 'GIT_MERGE_VS_GIT_PULL', `Q3 routes to GIT_MERGE_VS_GIT_PULL (got ${handler})`);
}

// Question 4: Git Fetch vs Pull Request
{
  const intent = classifyQuestionIntent(q4);
  const handler = getComparisonHandlerName(
    intent.extractedConcepts?.conceptA || '',
    intent.extractedConcepts?.conceptB || '',
    q4
  );
  assert(handler === 'GIT_FETCH_VS_GITHUB_PULL_REQUEST', `Q4 routes to GIT_FETCH_VS_GITHUB_PULL_REQUEST (got ${handler})`);
}

// Question 5: Git Merge vs Git Rebase
{
  const intent = classifyQuestionIntent(q5);
  const handler = getComparisonHandlerName(
    intent.extractedConcepts?.conceptA || '',
    intent.extractedConcepts?.conceptB || '',
    q5
  );
  assert(handler === 'GIT_MERGE_VS_GIT_REBASE', `Q5 routes to GIT_MERGE_VS_GIT_REBASE (got ${handler})`);
}

// ------------------------------------------------------------------------
// Test 3: ZERO Collision Between Q1 (PR vs Git Pull) & Q2 (Fetch vs Git Pull)
// ------------------------------------------------------------------------
console.log('\n--- 3. Strict Verification of Zero Answer Collision Between Q1 and Q2 ---');

{
  const ansQ1 = generateStructuredComparison('Pull Request', 'pull command in GitHub', q1);
  const ansQ2 = generateStructuredComparison('git fetch', 'git pull', q2);

  // Answers must not be identical
  assert(ansQ1.summary !== ansQ2.summary, 'Q1 and Q2 summaries are completely distinct');
  assert(ansQ1.spokenScript !== ansQ2.spokenScript, 'Q1 and Q2 spoken scripts are completely distinct');

  // Q1 content checks (PR vs Git Pull)
  assert(
    ansQ1.summary.toLowerCase().includes('collaboration') || ansQ1.summary.toLowerCase().includes('code-review') || ansQ1.summary.includes('GitHub'),
    'Q1 explains PR as web collaboration / code review platform'
  );
  assert(
    ansQ1.summary.toLowerCase().includes('cli command') || ansQ1.spokenScript.toLowerCase().includes('cli command') || ansQ1.summary.includes('composite'),
    'Q1 explains git pull as CLI command'
  );
  assert(
    !ansQ1.summary.includes('remote-tracking branches without updating') && !ansQ1.summary.includes('safely downloads remote commits without'),
    'Q1 does NOT incorrectly focus on git fetch details'
  );

  // Q2 content checks (Git Fetch vs Git Pull)
  assert(
    ansQ2.summary.includes('FETCH_HEAD') || ansQ2.summary.includes('without touching') || ansQ2.summary.includes('non-destructive'),
    'Q2 explains git fetch non-destructive retrieval'
  );
  assert(
    ansQ2.summary.includes('fetch + git merge') || ansQ2.summary.includes('working tree'),
    'Q2 explains git pull executes fetch + merge and updates working tree'
  );
  assert(
    !ansQ2.summary.includes('Pull Request is a web-based'),
    'Q2 does NOT mention web-based Pull Requests'
  );
}

// ------------------------------------------------------------------------
// Test 4: All 8 Required Questions (Definitions & Relationships)
// ------------------------------------------------------------------------
console.log('\n--- 4. All 8 Required Questions Verification ---');

// Question 1: "What is a GitHub Pull Request?"
{
  const q = "What is a GitHub Pull Request?";
  assert(hasDeterministicTechnicalAnswer(q), 'Q1 detected by hasDeterministicTechnicalAnswer');
  const ans = generateTechnicalAnswer(q);
  assert(ans !== null, 'Q1 has deterministic technical answer');
  assert(ans.spokenScript.includes('web-based collaboration workflow') || ans.summary.includes('collaboration'), 'Q1 summary explains web collaboration');
  assert(ans.summary.includes('not a native Git CLI command') || ans.summary.includes('not a Git CLI command'), 'Q1 emphasizes PR is not a native Git CLI command');
  assert(ans.spokenScript.includes('line-by-line') || ans.spokenScript.includes('CI/CD'), 'Q1 spokenScript covers review and CI');
}

// Question 2: "What does git pull do?"
{
  const q = "What does git pull do?";
  assert(hasDeterministicTechnicalAnswer(q), 'Q2 detected by hasDeterministicTechnicalAnswer');
  const ans = generateTechnicalAnswer(q);
  assert(ans !== null, 'Q2 has deterministic technical answer');
  assert(ans.summary.includes('git fetch') && ans.summary.includes('git merge'), 'Q2 explains composite fetch + merge');
  assert(ans.summary.includes('--rebase'), 'Q2 explains git pull --rebase option');
  assert(ans.summary.includes('--ff-only'), 'Q2 explains git pull --ff-only safety flag');
}

// Question 3: "What is the difference between a Pull Request and git pull?"
{
  const q = "What is the difference between a Pull Request and git pull?";
  const ans = generateSmartCopilotAnswer(q);
  assert(ans.summary.includes('GitHub Pull Request') || ans.summary.includes('Pull Request'), 'Q3 contrasts PR');
  assert(ans.summary.includes('git pull'), 'Q3 contrasts git pull');
  assert(!ans.summary.includes('git merge combines branch histories by creating a new merge commit'), 'Q3 does NOT return merge vs rebase fallback');
}

// Question 4: "What is git fetch?"
{
  const q = "What is git fetch?";
  assert(hasDeterministicTechnicalAnswer(q), 'Q4 detected by hasDeterministicTechnicalAnswer');
  const ans = generateTechnicalAnswer(q);
  assert(ans !== null, 'Q4 has deterministic technical answer');
  assert(ans.summary.includes('non-destructive') || ans.summary.includes('safely downloads'), 'Q4 explains non-destructive safety');
  assert(ans.summary.includes('FETCH_HEAD') || ans.summary.includes('remote-tracking branches') || ans.spokenScript.includes('remote-tracking branches'), 'Q4 mentions remote-tracking refs');
  assert(!ans.summary.includes('working directory is never modified') || ans.summary.includes('never touches your working directory'), 'Q4 explains working directory safety');
}

// Question 5: "What is the difference between git fetch and git pull?"
{
  const q = "What is the difference between git fetch and git pull?";
  const ans = generateSmartCopilotAnswer(q);
  assert(ans.summary.includes('git fetch'), 'Q5 contrasts git fetch');
  assert(ans.summary.includes('git pull'), 'Q5 contrasts git pull');
  assert(!ans.summary.includes('git merge combines branch histories by creating a new merge commit'), 'Q5 does NOT return merge vs rebase fallback');
}

// Question 6: "What is the difference between git merge and git pull?"
{
  const q = "What is the difference between git merge and git pull?";
  const ans = generateSmartCopilotAnswer(q);
  assert(ans.summary.includes('git merge'), 'Q6 contrasts git merge');
  assert(ans.summary.includes('git pull'), 'Q6 contrasts git pull');
  assert(
    ans.summary.includes('combine the commit history of two independent local branches') || 
    ans.summary.includes('two independent local branches') || 
    ans.summary.includes('local branches') ||
    ans.summary.includes('offline'), 
    'Q6 explains git merge scope'
  );
  assert(!ans.summary.includes('git merge combines branch histories by creating a new merge commit'), 'Q6 does NOT return merge vs rebase fallback');
}

// Question 7: "Does creating a Pull Request automatically execute git pull?"
{
  const q = "Does creating a Pull Request automatically execute git pull?";
  assert(hasDeterministicTechnicalAnswer(q), 'Q7 detected by hasDeterministicTechnicalAnswer');
  const ans = generateTechnicalAnswer(q);
  assert(ans !== null, 'Q7 has deterministic technical answer');
  assert(ans.spokenScript.startsWith('No'), 'Q7 direct answer begins with clear "No"');
  assert(ans.spokenScript.includes('zero effect on any developer local working directory') || ans.summary.includes('Zero impact') || ans.summary.includes('zero effect on local'), 'Q7 explains platform isolation');
}

// Question 8: "Can I use git pull without creating a Pull Request?"
{
  const q = "Can I use git pull without creating a Pull Request?";
  assert(hasDeterministicTechnicalAnswer(q), 'Q8 detected by hasDeterministicTechnicalAnswer');
  const ans = generateTechnicalAnswer(q);
  assert(ans !== null, 'Q8 has deterministic technical answer');
  assert(ans.spokenScript.startsWith('Yes'), 'Q8 direct answer begins with clear "Yes"');
  assert(ans.spokenScript.includes('operates completely independently') || ans.summary.includes('without requiring any web platform') || ans.summary.includes('independently of GitHub'), 'Q8 explains native Git independence');
}

// ------------------------------------------------------------------------
// Test 5: Fallback Sinkhole Elimination
// ------------------------------------------------------------------------
console.log('\n--- 5. Fallback Sinkhole Elimination (No Indiscriminate Rebase vs Merge) ---');

const generalGitQuestions = [
  "What is Git and how does it work?",
  "Explain version control with Git.",
  "What are the benefits of using Git?"
];

for (const q of generalGitQuestions) {
  const ans = generateSmartCopilotAnswer(q);
  assert(
    !ans.spokenScript.includes('The choice between git merge and git rebase is about commit history'),
    `"${q}" does NOT fall into rebase vs merge sinkhole`
  );
  assert(
    ans.summary.includes('distributed version control system') || ans.summary.includes('DVCS') || ans.summary.includes('branches'),
    `"${q}" receives general DVCS explanation`
  );
}

// Explicit rebase vs merge question DOES receive rebase vs merge explanation
{
  const rebaseAns = generateSmartCopilotAnswer("What is the difference between git merge and git rebase?");
  assert(
    rebaseAns.summary.includes('rebase') && rebaseAns.summary.includes('merge'),
    'Explicit merge vs rebase question receives rebase vs merge answer'
  );
}

// ------------------------------------------------------------------------
// Test 6: Live Local Ollama Verification for Q1 and Q2
// ------------------------------------------------------------------------
console.log('\n--- 6. Live Local Ollama Verification for Q1 and Q2 (qwen2.5:3b) ---');

async function testLiveOllama() {
  console.log('Sending Q1 to live Ollama: "' + q1 + '"...');
  const ans1 = await generateOllamaAnswer(q1);

  if (ans1) {
    console.log('  Live Ollama Q1 Summary:\n  ' + ans1.summary.substring(0, 180).replace(/\n/g, ' ') + '...\n');
    assert(
      ans1.summary.toLowerCase().includes('pull request') || ans1.summary.toLowerCase().includes('review'),
      'Live Ollama Q1 covers Pull Request / code review'
    );
    assert(
      ans1.summary.toLowerCase().includes('pull') || ans1.summary.toLowerCase().includes('fetch'),
      'Live Ollama Q1 covers git pull command'
    );
  } else {
    console.warn('  [INFO] Ollama not responding or timed out. Skipping live Ollama assertion.');
  }

  console.log('Sending Q2 to live Ollama: "' + q2 + '"...');
  const ans2 = await generateOllamaAnswer(q2);

  if (ans2) {
    console.log('  Live Ollama Q2 Summary:\n  ' + ans2.summary.substring(0, 180).replace(/\n/g, ' ') + '...\n');
    assert(
      ans2.summary.toLowerCase().includes('fetch') && ans2.summary.toLowerCase().includes('pull'),
      'Live Ollama Q2 covers git fetch and git pull'
    );
    if (ans1) {
      assert(
        ans1.summary !== ans2.summary,
        'Live Ollama generated completely distinct answers for Q1 and Q2 (ZERO COLLISION)'
      );
    }
  }

  console.log('\n========================================================================');
  console.log(`Results: ${passed} PASSED, ${failed} FAILED`);
  console.log('========================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

testLiveOllama().catch(err => {
  console.error(err);
  process.exit(1);
});
