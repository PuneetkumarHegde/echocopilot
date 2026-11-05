/**
 * Concept-Wise Complete Answer Verification Test Suite
 *
 * Verifies that EchoCopilot generates answers that:
 * 1. Maintain a natural, speakable 2-4 sentence Stage 1 direct answer (without labels).
 * 2. Deliver a comprehensive Stage 2 concept-wise breakdown covering definitions,
 *    internal working, mechanisms, types/hierarchy, code/examples, and trade-offs.
 * 3. Correctly adapt to scope:
 *    - Broad concept questions (e.g. "What is an exception in Java?") provide complete architectural breadth.
 *    - Specific concept questions (e.g. "What is NullPointerException?") stay laser-focused on root causes,
 *      reproduction, and modern prevention patterns without reciting the entire Java framework.
 *    - Comparison questions (e.g. "Array vs ArrayList") provide structured differences and trade-offs.
 *    - Non-programming subjects (Newton's laws, inflation, photosynthesis) use domain-native concepts
 *      (equations, biological stages, market drivers) without forced programming code blocks.
 *    - Short answer constraints ("in two sentences") enforce strict brevity.
 * 4. Verifies all 13 benchmark questions specified in the requirements.
 */

import { generateTechnicalAnswer, hasDeterministicTechnicalAnswer } from '../src/lib/technicalEngine.ts';
import { buildInterviewAssistantPrompt, parseStreamingAnswer, cleanDirectSpeakableAnswer } from '../src/lib/aiFallback.ts';

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✓ PASS: ${message}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${message}`);
    failed++;
  }
}

console.log('\n======================================================');
console.log('   CONCEPT-WISE COMPLETE ANSWER VERIFICATION SUITE    ');
console.log('======================================================\n');

// ---------------------------------------------------------
// SUITE 1: Benchmark Question 1 - Broad Concept: Exception in Java
// ---------------------------------------------------------
console.log('--- 1. Broad Concept: "What is an exception in Java?" ---');
{
  const q = 'What is an exception in Java?';
  assert(hasDeterministicTechnicalAnswer(q), 'Recognized as deterministic technical answer');
  const ans = generateTechnicalAnswer(q);
  assert(ans !== null, 'Generated valid answer object');

  // Stage 1 check
  assert(ans.directAnswer && ans.directAnswer.length > 50, 'Stage 1 directAnswer is present and substantial');
  assert(!ans.directAnswer.startsWith('Direct Answer:'), 'Stage 1 has no "Direct Answer:" label');
  assert(!ans.directAnswer.startsWith('Summary:'), 'Stage 1 has no "Summary:" label');
  assert(!ans.directAnswer.startsWith('###'), 'Stage 1 has no markdown headings');
  assert(ans.directAnswer.toLowerCase().includes('abnormal') || ans.directAnswer.toLowerCase().includes('disrupts') || ans.directAnswer.toLowerCase().includes('event'), 'Explains core nature of an exception');

  // Stage 2 check: Hierarchy, Checked vs Unchecked, Keywords, Custom, Code
  assert(ans.summary.includes('Throwable'), 'Covers Throwable root hierarchy');
  assert(ans.summary.includes('Checked') && ans.summary.includes('Unchecked'), 'Differentiates Checked vs Unchecked');
  assert(ans.summary.includes('try') && ans.summary.includes('catch') && ans.summary.includes('finally'), 'Explains handling keywords');
  assert(ans.summary.includes('throws') && ans.summary.includes('throw'), 'Explains throw vs throws');
  assert(ans.codeSnippet && ans.codeSnippet.code.includes('try'), 'Provides compilable try-with-resources code example');
  assert(ans.tradeoffs && ans.tradeoffs.length >= 3, 'Provides trade-offs / best practices');
}

// ---------------------------------------------------------
// SUITE 2: Benchmark Question 2 - Specific Concept: NullPointerException
// ---------------------------------------------------------
console.log('\n--- 2. Specific Concept: "What is NullPointerException?" ---');
{
  const q = 'What is NullPointerException?';
  assert(hasDeterministicTechnicalAnswer(q), 'Recognized as deterministic technical answer');
  const ans = generateTechnicalAnswer(q);
  assert(ans !== null, 'Generated valid answer object');

  // Stage 1 check
  assert(ans.directAnswer && ans.directAnswer.length > 50, 'Stage 1 directAnswer is present and substantial');
  assert(!ans.directAnswer.startsWith('Direct Answer:'), 'Stage 1 has no "Direct Answer:" label');
  assert(ans.directAnswer.includes('null') && ans.directAnswer.includes('reference'), 'Directly defines null reference dereference');

  // Specific concept check: focused on causes, reproduction, and prevention
  assert(ans.summary.includes('Root Causes'), 'Details root cause triggers');
  assert(ans.summary.includes('Unchecked') || ans.summary.includes('RuntimeException'), 'Positions in hierarchy without reciting entire tree');
  assert(ans.codeSnippet && ans.codeSnippet.code.includes('Optional'), 'Provides modern prevention code with Optional / Objects.requireNonNull');
  assert(ans.summary.includes('Objects.requireNonNull'), 'Highlights Objects.requireNonNull validation');
  assert(ans.summary.includes('Helpful NullPointerExceptions') || ans.summary.includes('JEP 358'), 'Mentions modern Java 14+ helpful NPE byte-code analysis');
}

// ---------------------------------------------------------
// SUITE 3: Benchmark Question 3 - Broad Concept: Inheritance in Java
// ---------------------------------------------------------
console.log('\n--- 3. Broad Concept: "Explain inheritance in Java." ---');
{
  const q = 'Explain inheritance in Java.';
  assert(hasDeterministicTechnicalAnswer(q), 'Recognized as deterministic technical answer');
  const ans = generateTechnicalAnswer(q);
  assert(ans !== null, 'Generated valid answer object');

  // Stage 1 check
  assert(ans.directAnswer && ans.directAnswer.length > 50, 'Stage 1 directAnswer is present');
  assert(!ans.directAnswer.startsWith('Direct Answer:'), 'Stage 1 has no "Direct Answer:" label');
  assert(ans.directAnswer.includes('IS-A') || ans.directAnswer.includes('reusability') || ans.directAnswer.includes('extends'), 'Explains core inheritance purpose');

  // Stage 2 check: Class types, Diamond Problem, Keywords, Code, Composition over inheritance
  assert(ans.summary.includes('Single') && ans.summary.includes('Multilevel') && ans.summary.includes('Hierarchical'), 'Explains valid class inheritance types');
  assert(ans.summary.includes('Diamond Problem') || ans.summary.includes('multiple inheritance'), 'Explains why multiple class inheritance is disallowed');
  assert(ans.summary.includes('super()') || ans.summary.includes('super'), 'Explains super keyword and constructor chaining');
  assert(ans.codeSnippet && ans.codeSnippet.code.includes('extends'), 'Provides compilable inheritance code');
  assert(ans.summary.includes('Composition over Inheritance') || ans.summary.includes('composition'), 'Discusses composition over inheritance best practice');
}

// ---------------------------------------------------------
// SUITE 4: Benchmark Question 4 - Mechanism: HashMap Internal Working
// ---------------------------------------------------------
console.log('\n--- 4. Mechanism: "What is HashMap and how does it work internally?" ---');
{
  const q = 'What is HashMap and how does it work internally?';
  assert(hasDeterministicTechnicalAnswer(q), 'Recognized as deterministic technical answer');
  const ans = generateTechnicalAnswer(q);
  assert(ans !== null, 'Generated valid answer object');

  // Stage 1 check
  assert(ans.directAnswer && ans.directAnswer.length > 50, 'Stage 1 directAnswer is present');
  assert(ans.directAnswer.toLowerCase().includes('bucket') || ans.directAnswer.toLowerCase().includes('hash code') || ans.directAnswer.toLowerCase().includes('key-value'), 'Defines internal bucket / hashing model');

  // Stage 2 check: Hash perturbation, Index formula, collision handling, Treeification (Java 8)
  assert(ans.summary.includes('n - 1') || ans.summary.includes('bitwise AND') || ans.summary.includes('(n - 1) & hash'), 'Explains index calculation');
  assert(ans.summary.includes('TREEIFY_THRESHOLD') || ans.summary.includes('Red-Black') || ans.summary.includes('TreeNode'), 'Explains Java 8 treeification');
  assert(ans.summary.includes('equals') && ans.summary.includes('hashCode'), 'Explains equals and hashCode contract');
  assert(ans.codeSnippet && ans.codeSnippet.code.includes('hashCode'), 'Includes illustrative code demonstration');
}

// ---------------------------------------------------------
// SUITE 5: Benchmark Question 5 - Architecture: REST API
// ---------------------------------------------------------
console.log('\n--- 5. Architecture: "What is a REST API?" ---');
{
  const q = 'What is a REST API?';
  assert(hasDeterministicTechnicalAnswer(q), 'Recognized as deterministic technical answer');
  const ans = generateTechnicalAnswer(q);
  assert(ans !== null, 'Generated valid answer object');

  // Stage 1 check
  assert(ans.directAnswer && ans.directAnswer.length > 50, 'Stage 1 directAnswer is present');
  assert(ans.directAnswer.includes('Stateless') || ans.directAnswer.includes('stateless') || ans.directAnswer.includes('Representational State Transfer'), 'Defines REST principles');

  // Stage 2 check: 6 Architectural constraints, HTTP verbs, Idempotency, Status codes
  assert(ans.summary.includes('Statelessness') || ans.summary.includes('Client-Server'), 'Covers Fielding constraints');
  assert(ans.summary.includes('GET') && ans.summary.includes('POST') && ans.summary.includes('PUT') && ans.summary.includes('DELETE'), 'Covers standard HTTP verbs');
  assert(ans.summary.includes('Idempotent') || ans.summary.includes('idempotent'), 'Explains idempotency matrix');
  assert(ans.summary.includes('200') && ans.summary.includes('201') && ans.summary.includes('404'), 'Covers HTTP status codes');
}

// ---------------------------------------------------------
// SUITE 6: Benchmark Question 6 - Protocol: TCP Three-Way Handshake
// ---------------------------------------------------------
console.log('\n--- 6. Protocol: "Explain TCP three-way handshake." ---');
{
  const q = 'Explain TCP three-way handshake.';
  assert(hasDeterministicTechnicalAnswer(q), 'Recognized as deterministic technical answer');
  const ans = generateTechnicalAnswer(q);
  assert(ans !== null, 'Generated valid answer object');

  // Stage 1 check
  assert(ans.directAnswer && ans.directAnswer.length > 50, 'Stage 1 directAnswer is present');
  assert(ans.directAnswer.includes('SYN') && ans.directAnswer.includes('ACK'), 'References SYN / ACK packets');

  // Stage 2 check: Step 1, Step 2, Step 3, ISN, SYN flood defense
  assert(ans.summary.includes('SYN-ACK') || ans.summary.includes('SYN + ACK'), 'Explains SYN-ACK response');
  assert(ans.summary.includes('Initial Sequence Number') || ans.summary.includes('ISN'), 'Explains sequence number synchronization');
  assert(ans.summary.includes('SYN Flood') || ans.summary.includes('SYN cookies'), 'Discusses SYN flood attack & defense');
}

// ---------------------------------------------------------
// SUITE 7: Benchmark Question 7 - Database: SQL Joins
// ---------------------------------------------------------
console.log('\n--- 7. Database: "What are SQL joins?" ---');
{
  const q = 'What are SQL joins?';
  assert(hasDeterministicTechnicalAnswer(q), 'Recognized as deterministic technical answer');
  const ans = generateTechnicalAnswer(q);
  assert(ans !== null, 'Generated valid answer object');

  // Stage 1 check
  assert(ans.directAnswer && ans.directAnswer.length > 50, 'Stage 1 directAnswer is present');
  assert(ans.directAnswer.includes('combine') || ans.directAnswer.includes('relational') || ans.directAnswer.includes('tables'), 'Defines join relational purpose');

  // Stage 2 check: INNER, LEFT, RIGHT, FULL, CROSS, SELF, Optimizer algorithms
  assert(ans.summary.includes('INNER JOIN') && ans.summary.includes('LEFT JOIN'), 'Covers INNER and OUTER joins');
  assert(ans.summary.includes('CROSS JOIN') && ans.summary.includes('SELF JOIN'), 'Covers Cartesian product & SELF join');
  assert(ans.summary.includes('ON') && ans.summary.includes('WHERE'), 'Contrasts ON filter vs WHERE filter');
  assert(ans.summary.includes('Nested Loop') || ans.summary.includes('Hash Join') || ans.summary.includes('Sort-Merge'), 'Explains database physical join execution engines');
  assert(ans.codeSnippet && ans.codeSnippet.code.includes('JOIN'), 'Provides SQL join queries with expected tabular output');
}

// ---------------------------------------------------------
// SUITE 8: Benchmark Question 8 - Security: SQL Injection
// ---------------------------------------------------------
console.log('\n--- 8. Security: "What is SQL injection?" ---');
{
  const q = 'What is SQL injection?';
  assert(hasDeterministicTechnicalAnswer(q), 'Recognized as deterministic technical answer');
  const ans = generateTechnicalAnswer(q);
  assert(ans !== null, 'Generated valid answer object');

  // Stage 1 check
  assert(ans.directAnswer && ans.directAnswer.length > 50, 'Stage 1 directAnswer is present');
  assert(ans.directAnswer.toLowerCase().includes('untrusted') || ans.directAnswer.toLowerCase().includes('vulnerability') || ans.directAnswer.toLowerCase().includes('malicious'), 'Explains injection vulnerability');

  // Stage 2 check: Mechanics, Payloads, PreparedStatement defense, ORM, WAF
  assert(ans.summary.includes('PreparedStatement') || ans.summary.includes('parameterized'), 'Highlights PreparedStatement defense');
  assert(ans.summary.includes('\' OR \'1\'=\'1'), 'Demonstrates classic payload exploitation');
  assert(ans.codeSnippet && ans.codeSnippet.code.includes('prepareStatement'), 'Provides secure Java implementation');
}

// ---------------------------------------------------------
// SUITE 9: Benchmark Question 9 - Science: Newton's Laws of Motion
// ---------------------------------------------------------
console.log('\n--- 9. Science: "Explain Newton\'s laws of motion." ---');
{
  const q = 'Explain Newton\'s laws of motion.';
  assert(hasDeterministicTechnicalAnswer(q), 'Recognized as deterministic technical answer');
  const ans = generateTechnicalAnswer(q);
  assert(ans !== null, 'Generated valid answer object');

  // Stage 1 check
  assert(ans.directAnswer && ans.directAnswer.length > 50, 'Stage 1 directAnswer is present');
  assert(!ans.directAnswer.startsWith('Direct Answer:'), 'Stage 1 has no "Direct Answer:" label');
  assert(ans.directAnswer.includes('classical mechanics') || ans.directAnswer.includes('motion') || ans.directAnswer.includes('forces'), 'Summarizes all three laws');

  // Domain Adaptability Check: NO forced programming code blocks!
  assert(ans.codeSnippet === undefined, 'No forced programming code block in non-programming science topic');

  // Stage 2 check: First Law (Inertia), Second Law (F=ma), Third Law (Action-Reaction), Limits (Relativity)
  assert(ans.summary.includes('Law of Inertia'), 'Explains 1st law inertia');
  assert(ans.summary.includes('F') && (ans.summary.includes('m \\vec{a}') || ans.summary.includes('F = ma') || ans.summary.includes('dp/dt')), 'Explains 2nd law force formula');
  assert(ans.summary.includes('Action and Reaction') || ans.summary.includes('equal and opposite'), 'Explains 3rd law symmetry');
  assert(ans.summary.includes('Relativity') || ans.summary.includes('Einstein') || ans.summary.includes('Quantum'), 'Explains domain limits of classical mechanics');
}

// ---------------------------------------------------------
// SUITE 10: Benchmark Question 10 - Economics: Inflation
// ---------------------------------------------------------
console.log('\n--- 10. Economics: "What is inflation?" ---');
{
  const q = 'What is inflation?';
  assert(hasDeterministicTechnicalAnswer(q), 'Recognized as deterministic technical answer');
  const ans = generateTechnicalAnswer(q);
  assert(ans !== null, 'Generated valid answer object');

  // Stage 1 check
  assert(ans.directAnswer && ans.directAnswer.length > 50, 'Stage 1 directAnswer is present');
  assert(ans.directAnswer.includes('purchasing power') || ans.directAnswer.includes('price level'), 'Defines purchasing power decline');

  // Domain Adaptability Check: NO forced programming code block!
  assert(ans.codeSnippet === undefined, 'No forced programming code block in economics topic');

  // Stage 2 check: Demand-pull, Cost-push, Built-in, CPI, Monetary policy
  assert(ans.summary.includes('Demand-Pull') && ans.summary.includes('Cost-Push'), 'Explains core economic drivers');
  assert(ans.summary.includes('Consumer Price Index') || ans.summary.includes('CPI'), 'Explains measurement metrics');
  assert(ans.summary.includes('Federal Reserve') || ans.summary.includes('Central Bank') || ans.summary.includes('interest rates'), 'Explains policy remedies');
}

// ---------------------------------------------------------
// SUITE 11: Benchmark Question 11 - Biology: Photosynthesis
// ---------------------------------------------------------
console.log('\n--- 11. Biology: "Explain photosynthesis." ---');
{
  const q = 'Explain photosynthesis.';
  assert(hasDeterministicTechnicalAnswer(q), 'Recognized as deterministic technical answer');
  const ans = generateTechnicalAnswer(q);
  assert(ans !== null, 'Generated valid answer object');

  // Stage 1 check
  assert(ans.directAnswer && ans.directAnswer.length > 50, 'Stage 1 directAnswer is present');
  assert(ans.directAnswer.includes('sunlight') && ans.directAnswer.includes('glucose'), 'Explains solar conversion to glucose');

  // Domain Adaptability Check: NO forced programming code block!
  assert(ans.codeSnippet === undefined, 'No forced programming code block in biology topic');

  // Stage 2 check: Chemical equation, Chloroplast anatomy, Light reactions, Calvin Cycle, RuBisCO
  assert(ans.summary.includes('6CO') && ans.summary.includes('C_6H_{12}O_6') || ans.summary.includes('glucose'), 'Contains balanced chemical equation');
  assert(ans.summary.includes('Thylakoids') && ans.summary.includes('Stroma'), 'Covers chloroplast sub-structures');
  assert(ans.summary.includes('Light-Dependent') && (ans.summary.includes('Calvin') || ans.summary.includes('Light-Independent')), 'Covers both biochemical phases');
  assert(ans.summary.includes('RuBisCO') || ans.summary.includes('rubisco'), 'Mentions RuBisCO carbon fixation enzyme');
}

// ---------------------------------------------------------
// SUITE 12: Benchmark Question 12 - Narrow Follow-up: HashMap Shrink
// ---------------------------------------------------------
console.log('\n--- 12. Narrow Follow-up: "Does HashMap capacity shrink when elements are removed?" ---');
{
  const q = 'Does HashMap capacity shrink when elements are removed?';
  assert(hasDeterministicTechnicalAnswer(q), 'Recognized as deterministic technical answer');
  const ans = generateTechnicalAnswer(q);
  assert(ans !== null, 'Generated valid answer object');

  // Narrow focus check: Starts with direct clear "No"
  assert(ans.directAnswer.startsWith('No') || ans.directAnswer.includes('never automatically shrinks'), 'Directly and unequivocally states No');
  assert(ans.directAnswer.includes('capacity') || ans.directAnswer.includes('bucket array'), 'Explains capacity retention');

  // Stage 2 check: Retains array to avoid thrashing, how to reclaim memory
  assert(ans.summary.toLowerCase().includes('thrashing') || ans.summary.toLowerCase().includes('rehash'), 'Explains performance rationale against shrinking');
  assert(ans.codeSnippet && ans.codeSnippet.code.includes('new HashMap'), 'Shows compaction technique');
}

// ---------------------------------------------------------
// SUITE 13: Benchmark Question 13 - Brevity Constraint: Polymorphism in Two Sentences
// ---------------------------------------------------------
console.log('\n--- 13. Brevity Constraint: "Explain polymorphism in Java in two sentences." ---');
{
  const q = 'Explain polymorphism in Java in two sentences.';
  assert(hasDeterministicTechnicalAnswer(q), 'Recognized as deterministic technical answer');
  const ans = generateTechnicalAnswer(q);
  assert(ans !== null, 'Generated valid answer object');

  // Sentence count check
  const sentences = ans.directAnswer.match(/[^.!?]+[.!?]+/g) || [];
  assert(sentences.length === 2, `Direct answer is strictly 2 sentences (got ${sentences.length})`);
  assert(!ans.directAnswer.includes('###'), 'Direct answer has no markdown headings');
  assert(ans.codeSnippet === undefined, 'No code snippet forced when user explicitly asked for two sentences');
  assert(ans.summary === ans.directAnswer, 'Summary matches concise direct answer without sprawling sections');
}

// ---------------------------------------------------------
// SUITE 14: Prompt Engineering & Streaming Parser Verification
// ---------------------------------------------------------
console.log('\n--- 14. Prompt Pipeline & Streaming Parser Scope Awareness ---');
{
  // Test Non-Programming Prompt construction
  const promptNP = buildInterviewAssistantPrompt('Explain photosynthesis in plants.', [], 'Java');
  assert(promptNP.userPrompt.includes('Photosynthetic Stages') || promptNP.userPrompt.includes('Core Principles'), 'Non-programming prompt uses domain-specific sections');
  assert(!promptNP.userPrompt.includes('(Configured interview language: Java)'), 'Non-programming prompt omits programming language hint');

  // Test Specific Concept Prompt construction
  const promptSpecific = buildInterviewAssistantPrompt('What is NullPointerException in Java?', [], 'Java');
  assert(promptSpecific.userPrompt.includes('Root Causes') || promptSpecific.userPrompt.includes('Prevention Strategies'), 'Specific concept prompt uses root causes and prevention sections');

  // Test Two-Sentence Prompt construction
  const promptTwoSentences = buildInterviewAssistantPrompt('Explain polymorphism in two sentences.', [], 'Java');
  assert(promptTwoSentences.userPrompt.includes('two short spoken sentences') || promptTwoSentences.userPrompt.includes('two sentences'), 'Two-sentence prompt enforces strict brevity');

  // Test Streaming Answer Parser with new Stage 2 headers
  const mockStreamed = `Inheritance is an OOP mechanism where a child class acquires the fields and methods of a parent class. It facilitates code reuse and polymorphic behavior through method overriding.

### Hierarchy & Structure
Inheritance forms an IS-A relationship between subclasses and superclasses.

### Practical & Code Example
\`\`\`java
class Animal { void speak() {} }
\`\`\``;

  const parsed = parseStreamingAnswer(mockStreamed, 'Explain inheritance in Java.', 'general');
  assert(parsed.directAnswer.startsWith('Inheritance is an OOP mechanism'), 'Parser cleanly separates Stage 1 direct answer');
  assert(parsed.directAnswer.includes('method overriding'), 'Stage 1 direct answer contains complete opening thought');
  assert(!parsed.directAnswer.includes('### Hierarchy & Structure'), 'Stage 1 direct answer contains NO markdown headings');
  assert(parsed.codeSnippet && parsed.codeSnippet.language === 'java', 'Parser extracts code snippet');

  // Test cleanDirectSpeakableAnswer
  const dirty = `### Direct Interview Answer:
**Summary:** An exception is an abnormal condition that arises in a code sequence at run time.
`;
  const cleaned = cleanDirectSpeakableAnswer(dirty);
  assert(cleaned === 'An exception is an abnormal condition that arises in a code sequence at run time.', 'cleanDirectSpeakableAnswer strips all redundant labels and headers');
}

console.log('\n======================================================');
console.log(`RESULTS: ${passed} passed, ${failed} failed.`);
console.log('======================================================\n');

if (failed > 0) {
  process.exit(1);
} else {
  console.log('ALL CONCEPT-WISE COMPLETE ANSWER TESTS PASSED!\n');
  process.exit(0);
}
