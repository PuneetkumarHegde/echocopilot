/**
 * EchoCopilot Core CS & Technical Question-Answering Evaluation Suite
 * 
 * Tests all 15 Core CS comparison topics, single-concept deep dives,
 * anti-hallucination guards, spoken script readiness, and context isolation.
 */

import { generateStructuredComparison, isKnownComparison } from '../src/lib/comparisonEngine.ts';
import { generateTechnicalAnswer, hasDeterministicTechnicalAnswer } from '../src/lib/technicalEngine.ts';
import { classifyQuestionIntent, selectContextForIntent } from '../src/lib/intentClassifier.ts';
import { normalizeTechnicalTerms } from '../src/lib/technicalTermNormalizer.ts';
import { validateTechnicalAnswer } from '../src/lib/answerValidator.ts';
import { INITIAL_USER_PROFILE, INITIAL_PROJECTS } from '../src/lib/storage.ts';

let passedTests = 0;
let failedTests = 0;

function assert(condition, testName, details = '') {
  if (condition) {
    console.log(`  ✓ PASS: ${testName}`);
    passedTests++;
  } else {
    console.error(`  ✗ FAIL: ${testName}`);
    if (details) console.error(`    Details: ${details}`);
    failedTests++;
  }
}

console.log('\n======================================================');
console.log('🧪 EchoCopilot Core CS & Technical Evaluation Suite');
console.log('======================================================\n');

// -----------------------------------------------------------------
// Group 1: Mandatory Comparisons (Factual Correctness & Structure)
// -----------------------------------------------------------------
console.log('--- Group 1: 15 Mandatory Core CS Comparisons ---');

// 1. Array vs ArrayList
{
  const q = 'What is the difference between Array and ArrayList in Java?';
  const intent = classifyQuestionIntent(q);
  const ans = generateStructuredComparison('Array', 'ArrayList', q);
  assert(intent.intent === 'COMPARISON', '1. Array vs ArrayList is classified as COMPARISON');
  assert(ans.summary.includes('fixed size') || ans.summary.includes('Fixed-size'), '1. Mentions Array is fixed size');
  assert(ans.summary.includes('dynamic') || ans.summary.includes('resizable'), '1. Mentions ArrayList is dynamic/resizable');
  assert(ans.summary.includes('primitive'), '1. Explains primitive support');
  assert(!ans.summary.includes('workload patterns and structural guarantees'), '1. Zero generic hallucinated filler');
  assert(ans.spokenScript && ans.spokenScript.length > 20, '1. Spoken script is ready');
}

// 2. Git Pull vs GitHub Pull Request (Explicit Factual Accuracy)
{
  const q = 'What is the difference between a Pull Request and git pull?';
  const intent = classifyQuestionIntent(q);
  const ans = generateStructuredComparison('Pull Request', 'git pull', q);
  assert(intent.intent === 'COMPARISON', '2. Pull Request vs git pull is classified as COMPARISON');
  assert(isKnownComparison('Pull Request', 'git pull', q), '2. isKnownComparison detects PR vs git pull');
  assert(ans.summary.includes('GitHub') || ans.summary.includes('web-based') || ans.summary.includes('platform'), '2. Mentions PR is a web/platform collaboration feature');
  assert(ans.summary.includes('CLI') || ans.summary.includes('command-line'), '2. Mentions git pull is a CLI command');
  assert(ans.summary.includes('fetch') && ans.summary.includes('merge'), '2. Mentions git pull executes fetch + merge');
  assert(!ans.summary.includes('applyPull requestPattern'), '2. No fake function names');
}

// 3. Git Fetch vs Git Pull
{
  const q = 'Explain the difference between git fetch and git pull';
  const ans = generateStructuredComparison('git fetch', 'git pull', q);
  assert(ans.summary.includes('working directory') || ans.summary.includes('working tree'), '3. Mentions working directory impact');
  assert(ans.summary.includes('remote-tracking'), '3. Mentions remote-tracking branches');
  assert(ans.summary.includes('conflict'), '3. Contrasts merge conflict risks');
}

// 4. Primary Key vs Foreign Key
{
  const q = 'What is the difference between Primary Key and Foreign Key in SQL?';
  const ans = generateStructuredComparison('Primary Key', 'Foreign Key', q);
  assert(ans.summary.includes('NOT NULL') || ans.summary.includes('cannot accept NULL'), '4. Explains Primary Key cannot be NULL');
  assert(ans.summary.includes('referential integrity'), '4. Mentions Foreign Key enforces referential integrity');
  assert(ans.summary.includes('uniquely identifies'), '4. Primary Key unique identification');
}

// 5. DELETE vs TRUNCATE vs DROP (3-Way SQL Comparison)
{
  const q = 'What is the difference between DELETE, TRUNCATE, and DROP in SQL?';
  const intent = classifyQuestionIntent(q);
  const { conceptA, conceptB, conceptC } = intent.extractedConcepts || {};
  const ans = generateStructuredComparison(conceptA || 'DELETE', conceptB || 'TRUNCATE', q, conceptC || 'DROP');
  assert(ans.summary.includes('DML') && ans.summary.includes('DDL'), '5. Contrasts DML vs DDL');
  assert(ans.summary.includes('WHERE'), '5. Mentions WHERE clause support');
  assert(ans.summary.includes('data pages') || ans.summary.includes('deallocat'), '5. TRUNCATE page deallocation');
  assert(ans.summary.includes('catalog') || ans.summary.includes('schema'), '5. DROP destroys table definition/schema');
}

// 6. TCP vs UDP
{
  const q = 'TCP vs UDP difference';
  const ans = generateStructuredComparison('TCP', 'UDP', q);
  assert(ans.summary.includes('connection-oriented') || ans.summary.includes('3-way handshake'), '6. TCP connection-oriented');
  assert(ans.summary.includes('connectionless'), '6. UDP connectionless');
  assert(ans.summary.includes('reliable') || ans.summary.includes('guarantee'), '6. Reliable delivery contrast');
}

// 7. HTTP vs HTTPS
{
  const q = 'Difference between HTTP and HTTPS';
  const ans = generateStructuredComparison('HTTP', 'HTTPS', q);
  assert(ans.summary.includes('443') && ans.summary.includes('80'), '7. Mentions port 80 and 443');
  assert(ans.summary.includes('TLS') || ans.summary.includes('SSL'), '7. Mentions TLS/SSL encryption');
  assert(ans.summary.includes('certificate'), '7. Mentions CA certificate verification');
}

// 8. Stack vs Queue
{
  const q = 'Stack vs Queue in data structures';
  const ans = generateStructuredComparison('Stack', 'Queue', q);
  assert(ans.summary.includes('LIFO') && ans.summary.includes('FIFO'), '8. Explains LIFO vs FIFO');
  assert(ans.summary.includes('DFS') && ans.summary.includes('BFS'), '8. Explains DFS vs BFS applications');
}

// 9. Binary Search vs Linear Search
{
  const q = 'Difference between Binary Search and Linear Search';
  const ans = generateStructuredComparison('Binary Search', 'Linear Search', q);
  assert(ans.summary.includes('O(log N)') || ans.summary.includes('O(log n)'), '9. Binary search O(log N)');
  assert(ans.summary.includes('O(N)') || ans.summary.includes('O(n)'), '9. Linear search O(N)');
  assert(ans.summary.includes('sorted'), '9. Prerequisite: sorted array');
}

// 10. Authentication vs Authorization
{
  const q = 'What is the difference between Authentication and Authorization?';
  const ans = generateStructuredComparison('Authentication', 'Authorization', q);
  assert(ans.summary.includes('Who are you') || ans.summary.includes('identity'), '10. AuthN verifies identity');
  assert(ans.summary.includes('What are you allowed') || ans.summary.includes('permissions'), '10. AuthZ verifies permissions');
  assert(ans.summary.includes('401') && ans.summary.includes('403'), '10. HTTP 401 vs HTTP 403');
}

// 11. Heap vs Stack Memory
{
  const q = 'Difference between Stack memory and Heap memory';
  const ans = generateStructuredComparison('Stack', 'Heap', q);
  assert(ans.summary.includes('thread-private') || ans.summary.includes('private to each'), '11. Stack is thread-private');
  assert(ans.summary.includes('shared across all threads') || ans.summary.includes('shared pool'), '11. Heap is shared');
  assert(ans.summary.includes('StackOverflowError') && ans.summary.includes('OutOfMemoryError'), '11. Contrasts failure modes');
}

// 12. Deadlock & Coffman Conditions
{
  const q = 'Explain Deadlock and the four Coffman conditions';
  const ans = generateStructuredComparison('Deadlock', 'Coffman Conditions', q);
  assert(ans.summary.includes('Mutual Exclusion'), '12. Condition 1: Mutual Exclusion');
  assert(ans.summary.includes('Hold and Wait'), '12. Condition 2: Hold and Wait');
  assert(ans.summary.includes('No Preemption'), '12. Condition 3: No Preemption');
  assert(ans.summary.includes('Circular Wait'), '12. Condition 4: Circular Wait');
  assert(ans.summary.includes('lock ordering') || ans.summary.includes('hierarchy'), '12. Lock ordering solution');
}

// 13. Checked vs Unchecked Exceptions
{
  const q = 'Checked vs Unchecked Exceptions in Java';
  const ans = generateStructuredComparison('Checked', 'Unchecked', q);
  assert(ans.summary.includes('compile time') || ans.summary.includes('compiler'), '13. Compile-time enforcement');
  assert(ans.summary.includes('RuntimeException'), '13. RuntimeException inheritance');
  assert(ans.summary.includes('throws') || ans.summary.includes('try-catch'), '13. throws / try-catch declaration');
}

// 14. Process vs Thread
{
  const q = 'Difference between Process and Thread in OS';
  const ans = generateStructuredComparison('Process', 'Thread', q);
  assert(ans.summary.includes('address space') || ans.summary.includes('isolated'), '14. Memory space isolation');
  assert(ans.summary.includes('IPC'), '14. Inter-process communication');
  assert(ans.summary.includes('lightweight'), '14. Thread is lightweight execution unit');
}

// 15. Interface vs Abstract Class
{
  const q = 'Difference between Interface and Abstract Class in Java';
  const ans = generateStructuredComparison('Interface', 'Abstract Class', q);
  assert(ans.summary.includes('multiple inheritance') || ans.summary.includes('multiple interfaces'), '15. Multiple inheritance support');
  assert(ans.summary.includes('constructor') || ans.summary.includes('constructors'), '15. Constructor capability');
  assert(ans.summary.includes('instance field') || ans.summary.includes('state'), '15. Mutable state capability');
}

// -----------------------------------------------------------------
// Group 2: Single-Concept Deep Dives (Technical Engine)
// -----------------------------------------------------------------
console.log('\n--- Group 2: Single-Concept Technical Deep Dives ---');

// Deadlock Deep Dive
{
  const q = 'What is a deadlock in OS?';
  const tech = generateTechnicalAnswer(q);
  assert(tech !== null, 'Deadlock query triggers technicalEngine');
  assert(tech.summary.includes('Coffman'), 'Includes Coffman conditions in explanation');
  assert(tech.spokenScript && tech.spokenScript.includes('Circular Wait'), 'Spoken script highlights Circular Wait');
}

// Stack vs Heap Memory Deep Dive
{
  const q = 'Explain stack memory and heap memory layout';
  const tech = generateTechnicalAnswer(q);
  assert(tech !== null, 'Memory layout query triggers technicalEngine');
  assert(tech.summary.includes('StackOverflowError'), 'Includes StackOverflowError');
  assert(tech.summary.includes('OutOfMemoryError'), 'Includes OutOfMemoryError');
}

// Git Architecture Deep Dive
{
  const q = 'Explain how Git works internally';
  const tech = generateTechnicalAnswer(q);
  assert(tech !== null, 'Git architecture triggers technicalEngine');
  assert(tech.summary.includes('Blob') && tech.summary.includes('Tree') && tech.summary.includes('Commit'), 'Details the 4 Git object types');
}

// -----------------------------------------------------------------
// Group 3: Anti-Hallucination & Term Normalization
// -----------------------------------------------------------------
console.log('\n--- Group 3: Anti-Hallucination & Speech Normalization ---');

{
  const norm1 = normalizeTechnicalTerms('What is an array list in Java?');
  assert(norm1.normalizedText.toLowerCase().includes('arraylist'), 'Normalizes "array list" to "ArrayList"');

  const norm2 = normalizeTechnicalTerms('Explain git pool vs git fetch');
  assert(norm2.normalizedText.toLowerCase().includes('git pull'), 'Normalizes "git pool" to "git pull"');

  const norm3 = normalizeTechnicalTerms('Explain the difference between primary key and foreign key');
  assert(!norm3.hasUnknownSuspectTerm, 'Recognizes SQL vocabulary without false suspect flags');
}

// -----------------------------------------------------------------
// Group 4: Context Isolation (Zero Contamination)
// -----------------------------------------------------------------
console.log('\n--- Group 4: Context Isolation & Zero Contamination ---');

{
  const q = 'What is the difference between a Pull Request and git pull?';
  const intent = classifyQuestionIntent(q);
  const isolated = selectContextForIntent(intent.intent, q, INITIAL_USER_PROFILE, INITIAL_PROJECTS);
  assert(isolated.relevantProfile === null, 'No candidate profile injected into general technical comparison');
  assert(isolated.relevantProject === null, 'No personal project injected into general technical comparison');
}

// -----------------------------------------------------------------
// Group 5: Answer Validator Quality Checks
// -----------------------------------------------------------------
console.log('\n--- Group 5: Answer Validator Quality Checks ---');

{
  const fakeAnswer = {
    id: 'test_1',
    question: 'What is Array vs ArrayList?',
    mode: 'general',
    summary: 'Here is what you need to know: Array is fixed while ArrayList has workload patterns and structural guarantees.',
    spokenScript: '### Direct Answer\nThis is an answer.',
    bullets: ['Point 1'],
    timestamp: Date.now()
  };

  const validation = validateTechnicalAnswer('What is Array vs ArrayList?', fakeAnswer, 'COMPARISON', { conceptA: 'Array', conceptB: 'ArrayList' });
  assert(!validation.repairedAnswer.summary.includes('workload patterns and structural guarantees'), 'Validator strips forbidden filler phrase');
  assert(!validation.repairedAnswer.spokenScript.startsWith('###'), 'Validator strips markdown header from spokenScript');
}

console.log('\n======================================================');
console.log(`Results: ${passedTests} PASSED, ${failedTests} FAILED`);
console.log('======================================================\n');

if (failedTests > 0) {
  process.exit(1);
} else {
  process.exit(0);
}

