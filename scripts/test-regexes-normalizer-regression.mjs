/**
 * EchoCopilot Regression Suite: Fix for "regexes is not iterable"
 * 
 * Verifies:
 * 1. Prototype property collisions ('constructor', 'toString', '__proto__', etc.) do NOT cause "regexes is not iterable".
 * 2. Input validation guards against undefined, null, empty arrays, numbers, objects, and unexpected types.
 * 3. Java technical terms (ArrayList, LinkedList, HashMap, JVM, REST API) continue normalizing correctly.
 * 4. Medical / negative collocations ('throat infection') continue being guarded properly.
 * 5. Audio transcription normalization fallbacks ensure valid speech is never discarded.
 */

import {
  normalizeTechnicalTerms,
  hasNegativeCollocation,
  detectContextDomains,
  levenshteinDistance,
  stringSimilarity,
  phoneticSimilarity,
  resolveGitCanonicalConcept
} from '../src/lib/technicalTermNormalizer.ts';

import {
  normalizeTechnicalSpeech,
  isLikelyQuestion,
  formatQuestionUtterance
} from '../src/lib/speechNormalizer.ts';

let passed = 0;
let failed = 0;

function assert(condition, testName, details = '') {
  if (condition) {
    console.log(`  ✓ PASS: ${testName}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${testName}`);
    if (details) console.error(`    Details: ${details}`);
    failed++;
  }
}

console.log('\n========================================================================');
console.log('🧪 EchoCopilot Regression Suite: "regexes is not iterable" & Input Safety');
console.log('========================================================================\n');

// -----------------------------------------------------------------------------
// Part 1: Prototype Property & Collision Resilience (The Core Root Cause)
// -----------------------------------------------------------------------------
console.log('--- Part 1: Prototype Collision & Property Access Safety ---');

const prototypeTerms = [
  'constructor',
  'toString',
  'valueOf',
  'hasOwnProperty',
  'isPrototypeOf',
  'propertyIsEnumerable',
  'toLocaleString',
  '__proto__',
  '__defineGetter__',
  '__defineSetter__'
];

for (const prop of prototypeTerms) {
  try {
    const res = hasNegativeCollocation(prop, `What is a ${prop} in Java?`);
    assert(res === false, `hasNegativeCollocation("${prop}") returns false without throwing`);
  } catch (err) {
    assert(false, `hasNegativeCollocation("${prop}") threw exception: ${err.message}`);
  }
}

// Test real interview questions with 'constructor' and prototype-related terms
try {
  const norm1 = normalizeTechnicalTerms('What is a constructor in Java?');
  assert(norm1 && typeof norm1.normalizedText === 'string', 'normalizeTechnicalTerms handles "What is a constructor in Java?"');
  assert(norm1.normalizedText.toLowerCase().includes('constructor'), 'Preserves term "constructor"');
} catch (err) {
  assert(false, `normalizeTechnicalTerms("What is a constructor in Java?") threw: ${err.message}`);
}

try {
  const norm2 = normalizeTechnicalTerms('Can a private constructor be called in Java?');
  assert(norm2 && norm2.normalizedText.toLowerCase().includes('constructor'), 'Handles "Can a private constructor be called in Java?"');
} catch (err) {
  assert(false, `normalizeTechnicalTerms threw on private constructor: ${err.message}`);
}

try {
  const norm3 = normalizeTechnicalTerms('Explain overriding toString and equals methods');
  assert(norm3 && norm3.normalizedText.toLowerCase().includes('tostring'), 'Handles "Explain overriding toString and equals methods"');
} catch (err) {
  assert(false, `normalizeTechnicalTerms threw on toString: ${err.message}`);
}

try {
  const norm4 = normalizeTechnicalTerms('What is __proto__ and prototype inheritance in JavaScript?');
  assert(norm4 && norm4.normalizedText.toLowerCase().includes('proto'), 'Handles "__proto__" and prototype inheritance');
} catch (err) {
  assert(false, `normalizeTechnicalTerms threw on __proto__: ${err.message}`);
}

// -----------------------------------------------------------------------------
// Part 2: Input Type Validation & Unexpected Argument Types
// -----------------------------------------------------------------------------
console.log('\n--- Part 2: Type Validation (undefined, null, empty arrays, numbers, objects) ---');

// hasNegativeCollocation with unexpected input types
assert(hasNegativeCollocation(undefined, undefined) === false, 'hasNegativeCollocation(undefined, undefined) returns false');
assert(hasNegativeCollocation(null, null) === false, 'hasNegativeCollocation(null, null) returns false');
assert(hasNegativeCollocation('', '') === false, 'hasNegativeCollocation("", "") returns false');
assert(hasNegativeCollocation('   ', '   ') === false, 'hasNegativeCollocation("   ", "   ") returns false');
assert(hasNegativeCollocation(12345, 'valid text') === false, 'hasNegativeCollocation(number, string) returns false');
assert(hasNegativeCollocation('valid', 12345) === false, 'hasNegativeCollocation(string, number) returns false');
assert(hasNegativeCollocation({}, {}) === false, 'hasNegativeCollocation({}, {}) returns false');
assert(hasNegativeCollocation([], []) === false, 'hasNegativeCollocation([], []) returns false');

// normalizeTechnicalTerms with unexpected input types
{
  const undefRes = normalizeTechnicalTerms(undefined);
  assert(undefRes && undefRes.normalizedText === '', 'normalizeTechnicalTerms(undefined) returns safe empty result');

  const nullRes = normalizeTechnicalTerms(null);
  assert(nullRes && nullRes.normalizedText === '', 'normalizeTechnicalTerms(null) returns safe empty result');

  const numRes = normalizeTechnicalTerms(9999);
  assert(numRes && numRes.normalizedText === '', 'normalizeTechnicalTerms(number) returns safe empty result');

  const objRes = normalizeTechnicalTerms({ query: 'test' });
  assert(objRes && objRes.normalizedText === '', 'normalizeTechnicalTerms(object) returns safe empty result');
}

// normalizeTechnicalTerms with unexpected contextHistory
{
  const res1 = normalizeTechnicalTerms('What is an array list?', undefined);
  assert(res1 && res1.normalizedText.toLowerCase().includes('arraylist'), 'Handles contextHistory = undefined');

  const res2 = normalizeTechnicalTerms('What is an array list?', null);
  assert(res2 && res2.normalizedText.toLowerCase().includes('arraylist'), 'Handles contextHistory = null');

  const res3 = normalizeTechnicalTerms('What is an array list?', []);
  assert(res3 && res3.normalizedText.toLowerCase().includes('arraylist'), 'Handles contextHistory = empty array');

  const res4 = normalizeTechnicalTerms('What is an array list?', ['valid history 1', 'valid history 2']);
  assert(res4 && res4.normalizedText.toLowerCase().includes('arraylist'), 'Handles contextHistory = valid string array');

  const res5 = normalizeTechnicalTerms('What is an array list?', [{ question: 'What is Java?', summary: 'OOP language' }]);
  assert(res5 && res5.normalizedText.toLowerCase().includes('arraylist'), 'Handles contextHistory = object array');

  const res6 = normalizeTechnicalTerms('What is an array list?', [null, undefined, 123, {}]);
  assert(res6 && res6.normalizedText.toLowerCase().includes('arraylist'), 'Handles contextHistory with mixed unexpected types');
}

// detectContextDomains with unexpected input types
{
  assert(Array.isArray(detectContextDomains(undefined, undefined)), 'detectContextDomains(undefined, undefined) returns array');
  assert(Array.isArray(detectContextDomains(null, null)), 'detectContextDomains(null, null) returns array');
  assert(Array.isArray(detectContextDomains('java jvm', undefined)), 'detectContextDomains("java jvm", undefined) returns array');
}

// levenshteinDistance and stringSimilarity with unexpected input types
{
  assert(levenshteinDistance(null, undefined) === 0, 'levenshteinDistance(null, undefined) returns 0');
  assert(levenshteinDistance('test', null) === 4, 'levenshteinDistance("test", null) returns length of valid string');
  assert(stringSimilarity(null, undefined) === 0, 'stringSimilarity(null, undefined) returns 0');
  assert(phoneticSimilarity(null, undefined) === 0, 'phoneticSimilarity(null, undefined) returns 0');
  assert(resolveGitCanonicalConcept(null) === null, 'resolveGitCanonicalConcept(null) returns null');
  assert(resolveGitCanonicalConcept(undefined) === null, 'resolveGitCanonicalConcept(undefined) returns null');
}

// -----------------------------------------------------------------------------
// Part 3: Negative Collocation Guards (Medical vs Technical Disambiguation)
// -----------------------------------------------------------------------------
console.log('\n--- Part 3: Medical & Non-Technical Negative Collocations ---');

// Medical collocation MUST return true
assert(hasNegativeCollocation('throat', 'The patient has a severe throat infection') === true, 'Collocation matches "throat infection"');
assert(hasNegativeCollocation('throat', 'I bought lozenges for my sore throat') === true, 'Collocation matches "sore throat"');
assert(hasNegativeCollocation('throat', 'doctor checked my swollen throat') === true, 'Collocation matches "swollen throat"');

// Technical question MUST NOT match negative collocation
assert(hasNegativeCollocation('throat', 'What is the difference between throat and process in OS?') === false, 'Operating system context is NOT negative collocation');

// Normalization preserves "throat infection" and does NOT morph to "thread infection"
{
  const medical = normalizeTechnicalTerms('What is the treatment for a sore throat infection?');
  assert(!medical.normalizedText.toLowerCase().includes('thread infection'), 'Does NOT turn throat infection into thread infection');
  assert(medical.normalizedText.toLowerCase().includes('throat infection'), 'Preserves natural throat infection');
}

// -----------------------------------------------------------------------------
// Part 4: Technical-Term Normalization for Java & CS Terms (Requirement 8)
// -----------------------------------------------------------------------------
console.log('\n--- Part 4: Java & CS Term Normalization (ArrayList, LinkedList, HashMap, JVM, REST API) ---');

// 1. ArrayList
{
  const r1 = normalizeTechnicalTerms('What is the difference between Array and array list in Java?');
  assert(r1.normalizedText.toLowerCase().includes('arraylist'), 'Normalizes "array list" -> "ArrayList"');

  const s1 = normalizeTechnicalSpeech('what is the difference between array and array list in java');
  assert(s1.includes('ArrayList'), 'normalizeTechnicalSpeech produces PascalCase "ArrayList"');
}

// 2. LinkedList
{
  const r2 = normalizeTechnicalTerms('What is a linked list in Java?');
  assert(r2.normalizedText.toLowerCase().includes('linkedlist'), 'Normalizes "linked list" -> "LinkedList"');

  const s2 = normalizeTechnicalSpeech('explain linked list in java');
  assert(s2.includes('LinkedList'), 'normalizeTechnicalSpeech produces PascalCase "LinkedList"');
}

// 3. HashMap
{
  const r3 = normalizeTechnicalTerms('How does a hash map resolve collisions?');
  assert(r3.normalizedText.toLowerCase().includes('hashmap'), 'Normalizes "hash map" -> "HashMap"');

  const s3 = normalizeTechnicalSpeech('how does a hash map resolve collisions');
  assert(s3.includes('HashMap'), 'normalizeTechnicalSpeech produces PascalCase "HashMap"');
}

// 4. JVM
{
  const r4 = normalizeTechnicalTerms('Explain jvm memory structure');
  assert(r4.normalizedText.toUpperCase().includes('JVM'), 'Normalizes "jvm" -> "JVM"');

  const s4 = normalizeTechnicalSpeech('explain j v m memory structure');
  assert(s4.includes('JVM'), 'normalizeTechnicalSpeech normalizes "j v m" -> "JVM"');
}

// 5. REST API
{
  const r5 = normalizeTechnicalTerms('What is a restful api?');
  assert(r5.normalizedText.toUpperCase().includes('REST API'), 'Normalizes "restful api" -> "REST API"');

  const s5 = normalizeTechnicalSpeech('how to design a restful api');
  assert(s5.includes('REST API'), 'normalizeTechnicalSpeech produces uppercase "REST API"');
}

// -----------------------------------------------------------------------------
// Part 5: Audio Pipeline & Speech Resilience (Requirement 10)
// -----------------------------------------------------------------------------
console.log('\n--- Part 5: Speech & Transcription Pipeline Resilience ---');

// Verify normalizeTechnicalSpeech handles any input gracefully
assert(normalizeTechnicalSpeech(undefined) === '', 'normalizeTechnicalSpeech(undefined) returns empty string');
assert(normalizeTechnicalSpeech(null) === '', 'normalizeTechnicalSpeech(null) returns empty string');
assert(normalizeTechnicalSpeech('') === '', 'normalizeTechnicalSpeech("") returns empty string');

// Verify speech questions are recognized and formatted cleanly
{
  const speechQuestion = 'What is the difference between array and array list in java';
  const formatted = formatQuestionUtterance(speechQuestion);
  assert(formatted.endsWith('?'), 'formatQuestionUtterance appends question mark to questions');
  assert(formatted.includes('ArrayList'), 'formatQuestionUtterance normalizes technical terms');
}

// Verify that an error in normalization never throws or discards raw speech
{
  const candidateUtterance = 'Can a constructor in Java be marked as private?';
  const clean = normalizeTechnicalSpeech(candidateUtterance);
  assert(clean.length >= candidateUtterance.length, 'Valid speech is fully preserved and never discarded');
  assert(clean.includes('constructor'), 'Speech preserves core concept word "constructor"');
}

console.log('\n========================================================================');
console.log(`Results: ${passed} PASSED, ${failed} FAILED`);
console.log('========================================================================\n');

if (failed > 0) {
  process.exit(1);
} else {
  process.exit(0);
}

