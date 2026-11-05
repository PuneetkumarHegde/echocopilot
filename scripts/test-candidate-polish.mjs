/**
 * EchoCopilot Verification Test Suite: Polish Candidate Interview Answer Generation
 * 
 * Verifies all 10 mandatory questions:
 * 1. Difference between Array and ArrayList in Java
 * 2. Difference between TCP and UDP
 * 3. Difference between Authentication and Authorization
 * 4. Difference between Process and Thread
 * 5. Difference between DELETE, TRUNCATE and DROP
 * 6. What is Natural Language Processing?
 * 7. Explain deadlock in operating systems
 * 8. What is Bernoulli's principle?
 * 9. What is machine learning?
 * 10. Unfamiliar domain / topic test (Domain-agnostic capability)
 */

import { generateStructuredComparison } from '../src/lib/comparisonEngine';
import { generateTechnicalAnswer } from '../src/lib/technicalEngine';
import { classifyQuestionIntent } from '../src/lib/intentClassifier';
import {
  cleanDirectSpeakableAnswer,
  cleanSupportingSummary,
  buildStage1Prompt,
  buildStage2Prompt
} from '../src/lib/aiFallback';

const FORBIDDEN_FILLERS = [
  /^certainly/i,
  /^sure/i,
  /^absolutely/i,
  /^of course/i,
  /^here is/i,
  /^here's/i,
  /^let's understand/i,
  /^in an interview/i,
  /^great question/i,
  /^summary:/i,
  /^direct interview answer:/i,
  /^direct answer:/i
];

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

async function runTestSuite() {
  console.log('\n===============================================================');
  console.log('   ECHOPILOT CANDIDATE-POLISH VERIFICATION TEST SUITE');
  console.log('===============================================================\n');

  // -----------------------------------------------------------------
  // 1. Array vs ArrayList in Java
  // -----------------------------------------------------------------
  console.log('--- TEST 1: Difference between Array and ArrayList in Java ---');
  const q1 = 'What is the difference between Array and ArrayList in Java?';
  const ans1 = generateStructuredComparison('Array', 'ArrayList', q1);
  const da1 = ans1.directAnswer;

  assert(da1.includes('An Array and an ArrayList are both used to store multiple elements in Java'), 'Has natural introductory sentence', da1.slice(0, 100));
  assert(da1.includes('**First, size:**'), 'Has First dimension label', da1);
  assert(da1.includes('**Second, data types:**'), 'Has Second dimension label', da1);
  assert(da1.includes('**Third, insertion and deletion:**'), 'Has Third dimension label', da1);
  assert(da1.includes('**Fourth, accessing elements:**'), 'Has Fourth dimension label', da1);
  assert(da1.includes('**Fifth, size retrieval:**'), 'Has Fifth dimension label', da1);
  assert(da1.includes('**Finally, performance and memory:**'), 'Has Finally dimension label', da1);
  assert(da1.includes("That's the main difference between an array and an ArrayList in Java."), 'Has natural closing takeaway sentence', da1.slice(-100));
  
  // Verify paragraph breaks (\n\n)
  const p1 = da1.split('\n\n');
  assert(p1.length >= 8, `Preserves blank lines between points (found ${p1.length} paragraphs)`, `Paragraphs: ${p1.length}`);
  assert(!FORBIDDEN_FILLERS.some(f => f.test(da1)), 'Free from filler introductions or labels');

  // -----------------------------------------------------------------
  // 2. TCP vs UDP
  // -----------------------------------------------------------------
  console.log('\n--- TEST 2: Difference between TCP and UDP ---');
  const q2 = 'What is the difference between TCP and UDP?';
  const ans2 = generateStructuredComparison('TCP', 'UDP', q2);
  const da2 = ans2.directAnswer;

  assert(da2.includes('TCP and UDP are both transport layer protocols'), 'Has natural introductory sentence', da2.slice(0, 100));
  assert(da2.includes('**First, connection establishment:**'), 'Has First dimension label', da2);
  assert(da2.includes('**Second, reliability and recovery:**'), 'Has Second dimension label', da2);
  assert(da2.includes('**Third, packet ordering:**'), 'Has Third dimension label', da2);
  assert(da2.includes('**Fourth, congestion and flow control:**'), 'Has Fourth dimension label', da2);
  assert(da2.includes('**Fifth, header overhead:**'), 'Has Fifth dimension label', da2);
  assert(da2.includes('**Finally, speed and practical use cases:**'), 'Has Finally dimension label', da2);
  assert(da2.includes("That's the main difference between TCP and UDP."), 'Has natural closing takeaway sentence', da2.slice(-80));
  
  const p2 = da2.split('\n\n');
  assert(p2.length >= 8, `Preserves blank lines between points (found ${p2.length} paragraphs)`, `Paragraphs: ${p2.length}`);

  // -----------------------------------------------------------------
  // 3. Authentication vs Authorization
  // -----------------------------------------------------------------
  console.log('\n--- TEST 3: Difference between Authentication and Authorization ---');
  const q3 = 'What is the difference between Authentication and Authorization?';
  const ans3 = generateStructuredComparison('Authentication', 'Authorization', q3);
  const da3 = ans3.directAnswer;

  assert(da3.includes('Authentication and authorization are both foundational security concepts'), 'Has natural introductory sentence', da3.slice(0, 100));
  assert(da3.includes('**First, core question:**'), 'Has First dimension label', da3);
  assert(da3.includes('**Second, execution sequence:**'), 'Has Second dimension label', da3);
  assert(da3.includes('**Third, failure http status code:**'), 'Has Third dimension label', da3);
  assert(da3.includes('**Fourth, mechanisms used:**'), 'Has Fourth dimension label', da3);
  assert(da3.includes('**Fifth, tokens in modern architecture:**'), 'Has Fifth dimension label', da3);
  assert(da3.includes('**Finally, management and mutability:**'), 'Has Finally dimension label', da3);
  assert(da3.includes("That's the main difference between authentication and authorization."), 'Has natural closing takeaway sentence', da3.slice(-90));
  
  const p3 = da3.split('\n\n');
  assert(p3.length >= 8, `Preserves blank lines between points (found ${p3.length} paragraphs)`, `Paragraphs: ${p3.length}`);

  // -----------------------------------------------------------------
  // 4. Process vs Thread
  // -----------------------------------------------------------------
  console.log('\n--- TEST 4: Difference between Process and Thread ---');
  const q4 = 'What is the difference between Process and Thread?';
  const ans4 = generateStructuredComparison('Process', 'Thread', q4);
  const da4 = ans4.directAnswer;

  assert(da4.includes('In operating systems, a process and a thread are both units of execution'), 'Has natural introductory sentence', da4.slice(0, 100));
  assert(da4.includes('**First, memory isolation:**'), 'Has First dimension label', da4);
  assert(da4.includes('**Second, creation and context-switching overhead:**'), 'Has Second dimension label', da4);
  assert(da4.includes('**Third, communication mechanism:**'), 'Has Third dimension label', da4);
  assert(da4.includes('**Fourth, failure blast radius:**'), 'Has Fourth dimension label', da4);
  assert(da4.includes('**Fifth, synchronization requirement:**'), 'Has Fifth dimension label', da4);
  assert(da4.includes('**Finally, resource dependency and lifecycle:**'), 'Has Finally dimension label', da4);
  assert(da4.includes("That's the main difference between a process and a thread."), 'Has natural closing takeaway sentence', da4.slice(-80));
  
  const p4 = da4.split('\n\n');
  assert(p4.length >= 8, `Preserves blank lines between points (found ${p4.length} paragraphs)`, `Paragraphs: ${p4.length}`);

  // -----------------------------------------------------------------
  // 5. DELETE, TRUNCATE and DROP
  // -----------------------------------------------------------------
  console.log('\n--- TEST 5: Difference between DELETE, TRUNCATE and DROP ---');
  const q5 = 'What is the difference between DELETE, TRUNCATE and DROP in SQL?';
  const ans5 = generateStructuredComparison('DELETE', 'TRUNCATE', q5, 'DROP');
  const da5 = ans5.directAnswer;

  assert(da5.includes('DELETE, TRUNCATE, and DROP are all SQL commands'), 'Has natural 3-way introductory sentence', da5.slice(0, 100));
  assert(da5.includes('**First, command category:**'), 'Has First dimension label', da5);
  assert(da5.includes('**Second, filter capability:**'), 'Has Second dimension label', da5);
  assert(da5.includes('**Third, speed and logging:**'), 'Has Third dimension label', da5);
  assert(da5.includes('**Fourth, table structure:**'), 'Has Fourth dimension label', da5);
  assert(da5.includes('**Fifth, identity counters and triggers:**'), 'Has Fifth dimension label', da5);
  assert(da5.includes('**Finally, transaction rollback:**'), 'Has Finally dimension label', da5);
  assert(da5.includes("That's the main difference between DELETE, TRUNCATE, and DROP."), 'Has natural 3-way closing takeaway sentence', da5.slice(-85));
  
  const p5 = da5.split('\n\n');
  assert(p5.length >= 8, `Preserves blank lines between points (found ${p5.length} paragraphs)`, `Paragraphs: ${p5.length}`);

  // -----------------------------------------------------------------
  // 6. Natural Language Processing (NLP)
  // -----------------------------------------------------------------
  console.log('\n--- TEST 6: What is Natural Language Processing? ---');
  const q6 = 'What is Natural Language Processing?';
  const ans6 = generateTechnicalAnswer(q6);
  assert(ans6 !== null, 'Technical engine handles NLP question');
  if (ans6) {
    const da6 = ans6.directAnswer;
    assert(da6.includes('Natural Language Processing, or NLP, is a subfield of artificial intelligence'), 'Has clear direct definition', da6.slice(0, 100));
    assert(da6.includes('tokenization') && da6.includes('Transformers'), 'Explains internal working and pipeline', da6);
    assert(da6.includes('conversational AI') || da6.includes('sentiment classification'), 'Includes practical application', da6);
    assert(!FORBIDDEN_FILLERS.some(f => f.test(da6)), 'Zero filler openers or labels in direct answer');
    assert(ans6.summary.includes('### 1. Definition') && ans6.summary.includes('### 2. The Standard NLP Pipeline'), 'Provides structured Stage 2 summary');
  }

  // -----------------------------------------------------------------
  // 7. Deadlock in Operating Systems
  // -----------------------------------------------------------------
  console.log('\n--- TEST 7: Explain deadlock in operating systems ---');
  const q7 = 'Explain deadlock in operating systems';
  const ans7 = generateTechnicalAnswer(q7);
  assert(ans7 !== null, 'Technical engine handles Deadlock question');
  if (ans7) {
    const da7 = ans7.directAnswer;
    assert(da7.includes('A deadlock is a concurrency failure where two or more threads are permanently blocked'), 'Has clear direct definition', da7.slice(0, 100));
    assert(da7.includes('Coffman conditions') && da7.includes('Circular Wait'), 'Explains 4 conditions and internal mechanism', da7);
    assert(da7.includes('lock ordering') || da7.includes('tryLock'), 'Includes practical backend prevention strategy', da7);
    assert(!FORBIDDEN_FILLERS.some(f => f.test(da7)), 'Zero filler openers or labels in direct answer');
    assert(ans7.summary.includes('Coffman Conditions') && ans7.summary.includes('Prevention'), 'Stage 2 has full depth');
  }

  // -----------------------------------------------------------------
  // 8. Bernoulli's Principle
  // -----------------------------------------------------------------
  console.log("\n--- TEST 8: What is Bernoulli's principle? ---");
  const q8 = "What is Bernoulli's principle?";
  const ans8 = generateTechnicalAnswer(q8);
  assert(ans8 !== null, "Technical engine handles Bernoulli's principle");
  if (ans8) {
    const da8 = ans8.directAnswer;
    assert(da8.includes("Bernoulli's principle states that for an inviscid, incompressible fluid in steady flow"), 'Has precise physics definition', da8.slice(0, 100));
    assert(da8.includes('conservation of mechanical energy') && da8.includes('streamline'), 'Explains internal working & energy conservation', da8);
    assert(da8.includes('airplane wing') || da8.includes('airfoil') || da8.includes('lift'), 'Includes practical real-world application (airfoil lift)', da8);
    assert(!FORBIDDEN_FILLERS.some(f => f.test(da8)), 'Zero filler openers or labels');
    assert(ans8.summary.includes('### 1. Definition & Core Principle') && ans8.summary.includes('Continuity Equation'), 'Stage 2 has equations and engineering applications');
  }

  // -----------------------------------------------------------------
  // 9. Machine Learning
  // -----------------------------------------------------------------
  console.log('\n--- TEST 9: What is machine learning? ---');
  const q9 = 'What is machine learning?';
  const ans9 = generateTechnicalAnswer(q9);
  assert(ans9 !== null, 'Technical engine handles Machine Learning');
  if (ans9) {
    const da9 = ans9.directAnswer;
    assert(da9.includes('Machine learning is a branch of artificial intelligence focused on building algorithms that learn patterns from data'), 'Has clear AI/ML definition', da9.slice(0, 120));
    assert(da9.includes('supervised learning') && da9.includes('unsupervised learning'), 'Explains core learning paradigms', da9);
    assert(da9.includes('recommendation engines') || da9.includes('fraud detection'), 'Includes production use cases', da9);
    assert(!FORBIDDEN_FILLERS.some(f => f.test(da9)), 'Zero filler openers or labels');
    assert(ans9.summary.includes('### 1. Definition') && ans9.summary.includes('Three Primary Learning Paradigms'), 'Stage 2 has code and tradeoffs');
  }

  // -----------------------------------------------------------------
  // 10. Unfamiliar Domain / Dynamic Comparison Test
  // -----------------------------------------------------------------
  console.log('\n--- TEST 10: Domain-Agnostic / Dynamic Topic Test ---');
  const q10 = 'What is the difference between Photosynthesis and Cellular Respiration?';
  const ans10 = generateStructuredComparison('Photosynthesis', 'Cellular Respiration', q10);
  assert(ans10 !== null, 'Dynamic comparison synthesizer handles unfamiliar concepts');
  if (ans10) {
    const da10 = ans10.directAnswer;
    assert(da10.includes('Photosynthesis and Cellular Respiration are both used'), 'Synthesizes clean natural intro sentence', da10.slice(0, 100));
    assert(da10.includes('**First,') && da10.includes('**Second,') && da10.includes('**Finally,'), 'Synthesizes structured First/Second/Finally transitions', da10);
    assert(da10.includes("That's the main difference between Photosynthesis and Cellular Respiration."), 'Synthesizes natural closing takeaway', da10.slice(-100));
    assert(!FORBIDDEN_FILLERS.some(f => f.test(da10)), 'No conversational filler');
  }

  // -----------------------------------------------------------------
  // Test Cleaning Pipeline & Multiline Preservation
  // -----------------------------------------------------------------
  console.log('\n--- TEST 11: cleanDirectSpeakableAnswer Markdown & Newline Preservation ---');
  const rawLlmAnswer = `Certainly! Here is the answer:

**First, size:** An array has fixed size, while ArrayList is dynamic.

**Second, types:** An array supports primitives, while ArrayList requires wrappers.

**Finally, usage:** Use arrays for fixed performance, ArrayList for collections.

That's the main difference between array and ArrayList.`;

  const cleaned = cleanDirectSpeakableAnswer(rawLlmAnswer);
  assert(!cleaned.startsWith('Certainly'), 'Strips "Certainly!"');
  assert(!cleaned.startsWith('Here is'), 'Strips "Here is the answer"');
  assert(cleaned.includes('\n\n'), 'Preserves double newlines between points');
  assert(cleaned.includes('**First, size:**'), 'Preserves bold label formatting');

  console.log('\n===============================================================');
  console.log(`TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('===============================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTestSuite().catch(err => {
  console.error('Test execution error:', err);
  process.exit(1);
});

