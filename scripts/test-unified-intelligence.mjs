/**
 * EchoCopilot Unified AI Intelligence & Answer Quality Verification Suite
 * Tests A through L according to the official upgrade specification.
 */

import { isSecretFileName, sanitizeSourceCode } from '../src/lib/secretSanitizer.ts';
import { analyzeProjectFiles } from '../src/lib/projectAnalyzer.ts';
import { 
  generatePersonalizedQuestions, 
  generatePersonalizedAnswer, 
  evaluatePracticeAnswer 
} from '../src/lib/personalizedEngine.ts';
import { classifyQuestionIntent, selectContextForIntent } from '../src/lib/intentClassifier.ts';
import { generateStructuredComparison } from '../src/lib/comparisonEngine.ts';
import { generateTechnicalAnswer } from '../src/lib/technicalEngine.ts';
import { generateSmartCopilotAnswer } from '../src/lib/aiFallback.ts';
import { normalizeTechnicalTerms } from '../src/lib/technicalTermNormalizer.ts';
import { INITIAL_USER_PROFILE, INITIAL_PROJECTS, DEFAULT_ACTIVE_CONTEXT } from '../src/lib/storage.ts';

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

console.log('================================================================');
console.log('  EchoCopilot Unified AI Intelligence Verification Suite (A-L)  ');
console.log('================================================================\n');

// -----------------------------------------------------------------
// TEST A: General Java Question ("What is an ArrayList in Java?")
// -----------------------------------------------------------------
console.log('--- TEST A: General Java Question (ArrayList in Java) ---');
const qA = 'What is an ArrayList in Java?';
const intentA = classifyQuestionIntent(qA);
assert(intentA.intent === 'CONCEPT_EXPLANATION' || intentA.intent === 'GENERAL_TECHNICAL', 'Intent classified as Concept Explanation / General Technical');
assert(intentA.isProjectAware === false, 'Context isolated: isProjectAware is FALSE');

const ansA = generateSmartCopilotAnswer(qA);
assert(ansA.summary.toLowerCase().includes('resizable') || ansA.summary.toLowerCase().includes('dynamic'), 'Contains accurate definition of dynamic/resizable array');
assert(ansA.summary.includes('Object[]') || ansA.summary.includes('elementData'), 'Explains internal backing array mechanism');
assert(ansA.summary.includes('50%'), 'Explains dynamic 50% capacity expansion');
assert(ansA.summary.includes('O(1)'), 'Includes time complexity for index access');
assert(Boolean(ansA.codeSnippet && ansA.codeSnippet.code), 'Includes Java code snippet');
assert(ansA.summary.includes('Expected Output'), 'Shows expected output for Java code');
assert(!ansA.summary.toLowerCase().includes('echocopilot'), 'Zero project contamination: EchoCopilot not mentioned');
assert(!ansA.summary.toLowerCase().includes('| dimension |'), 'Does NOT output a comparison table when only a single concept was asked');

// -----------------------------------------------------------------
// TEST B: Comparison Question ("difference between array and ArrayList in Java")
// -----------------------------------------------------------------
console.log('\n--- TEST B: Comparison Question (Array vs ArrayList in Java) ---');
const qB = 'What is the difference between an array and an ArrayList in Java?';
const intentB = classifyQuestionIntent(qB);
assert(intentB.intent === 'COMPARISON', 'Intent classified as COMPARISON');
assert(intentB.extractedConcepts.conceptA.includes('array'), 'Extracted concept A as array');
assert(intentB.extractedConcepts.conceptB.includes('arraylist'), 'Extracted concept B as ArrayList');

const ansB = generateSmartCopilotAnswer(qB);
// 1. Definitions first before table
const defAIdx = ansB.summary.indexOf('Array (Java):');
const defBIdx = ansB.summary.indexOf('ArrayList (Java):');
const tableIdx = ansB.summary.indexOf('| Dimension |');
assert(defAIdx !== -1 && defBIdx !== -1, 'A. Defines Concept A and Concept B first');
assert(defAIdx < tableIdx && defBIdx < tableIdx, 'Definitions appear BEFORE the comparison table');

// 2. Comparison table
assert(tableIdx !== -1, 'B. Includes readable Markdown comparison table');
assert(ansB.summary.includes('Size & Mutability'), 'Table compares size and mutability');
assert(ansB.summary.includes('Supported Data Types'), 'Table compares primitives vs wrapper objects');
assert(ansB.summary.includes('Memory Behavior'), 'Table compares contiguous memory vs heap overhead');

// 3. Separate code examples
assert(ansB.summary.includes('Array (Java) Example') || ansB.summary.includes('Array Example'), 'C. Separate code example for Array');
assert(ansB.summary.includes('ArrayList (Java) Example') || ansB.summary.includes('ArrayList Example'), 'C. Separate code example for ArrayList');

// 4. Expected outputs
assert(ansB.summary.includes('Array Length: 3'), 'D. Shows expected output for Array');
assert(ansB.summary.includes('ArrayList Size: 4'), 'D. Shows expected output for ArrayList');

// 5. Use cases & trade-offs
assert(ansB.summary.includes('When to choose Array'), 'E. Explains practical use cases for Array');
assert(ansB.summary.includes('When to choose ArrayList'), 'E. Explains practical use cases for ArrayList');

// 6. Spoken summary
assert(ansB.spokenScript.length > 50, 'F. Produces concise spoken summary suitable for interview speech');

// 7. Strict negative constraint: NO concurrency, network latency, or distributed systems!
assert(!ansB.summary.toLowerCase().includes('concurrency'), 'Strict negative constraint: No unrelated concurrency discussion');
assert(!ansB.summary.toLowerCase().includes('network latency'), 'Strict negative constraint: No unrelated network latency discussion');
assert(!ansB.summary.toLowerCase().includes('distributed systems'), 'Strict negative constraint: No unrelated distributed systems discussion');

// -----------------------------------------------------------------
// TEST C: General DSA Question ("Explain binary search and its time complexity")
// -----------------------------------------------------------------
console.log('\n--- TEST C: General DSA Question (Binary Search & Complexity) ---');
const qC = 'Explain binary search and its time complexity.';
const intentC = classifyQuestionIntent(qC);
assert(intentC.intent === 'DSA_PROBLEM', 'Intent classified as DSA_PROBLEM');

const ansC = generateSmartCopilotAnswer(qC);
assert(ansC.summary.toLowerCase().includes('sorted'), 'Explicitly mandates sorted input collection requirement');
assert(ansC.summary.includes('O(log N)') || ansC.summary.includes('O(log n)'), 'Specifies O(log N) time complexity');
assert(ansC.summary.includes('O(1)'), 'Specifies O(1) iterative space complexity');
assert(ansC.summary.includes('low + (high - low) / 2'), 'Explains safe midpoint calculation to prevent 32-bit integer overflow');
assert(ansC.summary.includes('Target Not Found') || ansC.summary.includes('-1'), 'Explains not-found edge case');
assert(Boolean(ansC.codeSnippet && ansC.codeSnippet.code.includes('binarySearch')), 'Includes compilable binary search code snippet');
assert(ansC.summary.includes('Target 23 found at index: 5'), 'Shows expected execution output');

// -----------------------------------------------------------------
// TEST D: Personal Introduction ("Tell me about yourself")
// -----------------------------------------------------------------
console.log('\n--- TEST D: Personal Introduction ("Tell me about yourself") ---');
const qD = 'Tell me about yourself.';
const intentD = classifyQuestionIntent(qD);
assert(intentD.intent === 'PERSONAL_CAREER', 'Intent classified as PERSONAL_CAREER');

const ansD = generatePersonalizedAnswer(qD, 'medium', INITIAL_USER_PROFILE, INITIAL_PROJECTS);
assert(ansD.spokenScript.startsWith('I am a') || ansD.spokenScript.startsWith('I hold a'), 'Spoken script is written naturally in first person ("I am...")');
assert(ansD.spokenScript.includes(INITIAL_USER_PROFILE.education[0].fieldOfStudy), 'References candidate verified degree field');
assert(ansD.spokenScript.includes(INITIAL_PROJECTS[0].name), 'References candidate verified project name');
assert(!ansD.spokenScript.includes('40%'), 'Never fabricates fictional metrics (no fake "40% latency reduction")');
assert(ansD.bullets.length >= 3, 'Contains structured bullet points for review');

// -----------------------------------------------------------------
// TEST E: Project Explanation ("Tell me about my current project")
// -----------------------------------------------------------------
console.log('\n--- TEST E: Project Explanation ("Tell me about my current project") ---');
const qE = 'Tell me about my current project.';
const intentE = classifyQuestionIntent(qE);
assert(intentE.intent === 'PROJECT_SPECIFIC', 'Intent classified as PROJECT_SPECIFIC');

const ansE = generatePersonalizedAnswer(qE, 'medium', INITIAL_USER_PROFILE, INITIAL_PROJECTS);
assert(ansE.structure.directAnswer.includes('EchoCopilot'), 'Step 1: Identifies active project name (EchoCopilot)');
assert(Boolean(ansE.structure.personalMotivation), 'Step 2: Explains core problem being solved');
assert(ansE.structure.supportingExample.includes('Next.js') || ansE.structure.supportingExample.includes('React'), 'Step 3 & 4: Outlines technology stack and architecture');
assert(ansE.structure.roleOrCareerConnection.includes('challenge') || ansE.structure.roleOrCareerConnection.includes('rebuild'), 'Step 6 & 7: Explains technical challenge, outcome, and rebuild reflections');

// -----------------------------------------------------------------
// TEST F: Project-Specific Technical Question ("Why does this project use its current database?")
// -----------------------------------------------------------------
console.log('\n--- TEST F: Project Technical Question (Database Choice) ---');
const qF = 'Why does this project use its current database?';
const intentF = classifyQuestionIntent(qF);
assert(intentF.intent === 'PROJECT_SPECIFIC', 'Intent classified as PROJECT_SPECIFIC');

const ansF = generatePersonalizedAnswer(qF, 'medium', INITIAL_USER_PROFILE, INITIAL_PROJECTS);
assert(ansF.structure.directAnswer.toLowerCase().includes('indexeddb'), 'Directly answers with actual configured project database (IndexedDB v2)');
assert(ansF.structure.personalMotivation.toLowerCase().includes('privacy') || ansF.structure.supportingExample.toLowerCase().includes('privacy'), 'Explains privacy and offline design rationale');
assert(!ansF.structure.directAnswer.toLowerCase().includes('mongodb'), 'Does not falsely confuse project database with unrelated stores');

// -----------------------------------------------------------------
// TEST G: Missing Personal Information (Internship Achievement)
// -----------------------------------------------------------------
console.log('\n--- TEST G: Missing Personal Information (Internship Achievement) ---');
const qG = 'What was my biggest achievement during my internship?';
const intentG = classifyQuestionIntent(qG);
assert(intentG.intent === 'PERSONAL_CAREER', 'Intent classified as PERSONAL_CAREER');

// G1: Missing Information: Profile without internship records
const profileWithoutInternship = {
  ...INITIAL_USER_PROFILE,
  workExperience: []
};
const ansG = generatePersonalizedAnswer(qG, 'medium', profileWithoutInternship, INITIAL_PROJECTS);
assert(ansG.structure.directAnswer.toLowerCase().includes('do not have an internship') || ansG.structure.directAnswer.toLowerCase().includes('not yet added'), 'Anti-Hallucination Guard triggers on missing internship');
assert(!ansG.spokenScript.includes('Google') && !ansG.spokenScript.includes('Amazon') && !ansG.spokenScript.includes('Microsoft'), 'Does not invent a fictional company');
assert(Boolean(ansG.missingContextDetected), 'Returns missingContextDetected card');
assert(ansG.missingContextDetected.suggestedCategory === 'experience', 'Guides user to Career Profile > Work Experience');

// G2: Verified Information: Profile with authentic internship records
const ansGWithIntern = generatePersonalizedAnswer(qG, 'medium', INITIAL_USER_PROFILE, INITIAL_PROJECTS);
assert(ansGWithIntern.structure.directAnswer.includes('Tech Innovations Lab'), 'Uses authentic verified internship company');
assert(ansGWithIntern.structure.directAnswer.includes('Optimized slow database queries'), 'Uses authentic verified technical achievement');

// -----------------------------------------------------------------
// TEST H: Unrelated General Question After Project Discussion (Context Contamination)
// -----------------------------------------------------------------
console.log('\n--- TEST H: Context Contamination Isolation Check ---');
// Step 1: Project discussion
const projQuery = 'Explain my current project';
const projIntent = classifyQuestionIntent(projQuery);
const projContext = selectContextForIntent(projIntent.intent, projQuery, INITIAL_USER_PROFILE, INITIAL_PROJECTS);
assert(Boolean(projContext.relevantProject), 'Project query correctly receives project context');

// Step 2: Unrelated Java query immediately after
const generalQuery = 'What is an ArrayList in Java?';
const generalIntent = classifyQuestionIntent(generalQuery);
const generalContext = selectContextForIntent(generalIntent.intent, generalQuery, INITIAL_USER_PROFILE, INITIAL_PROJECTS);
assert(generalContext.relevantProject === null, 'Context selector strictly drops project context for general query');
assert(generalContext.relevantProfile === null, 'Context selector strictly drops profile context for general query');

const generalAns = generateSmartCopilotAnswer(generalQuery);
assert(!generalAns.summary.toLowerCase().includes('echocopilot'), 'Zero project bleeding into general technical answer');
assert(!generalAns.summary.toLowerCase().includes('vault'), 'Zero vault bleeding into general technical answer');

// -----------------------------------------------------------------
// TEST I: Contextual Follow-Up Question
// -----------------------------------------------------------------
console.log('\n--- TEST I: Contextual Follow-Up Resolution ---');
const mockChatHistory = [
  {
    question: 'What is an ArrayList in Java?',
    summary: 'An ArrayList is a dynamic resizable array backed by an Object[] array that grows by 50%.',
    timestamp: Date.now()
  }
];

const followUpQuery = 'Give an example.';
const followUpIntent = classifyQuestionIntent(followUpQuery, mockChatHistory);
assert(followUpIntent.intent === 'FOLLOW_UP', 'Follow-up query correctly classified as FOLLOW_UP');

const followUpContext = selectContextForIntent(followUpIntent.intent, followUpQuery, null, null, null, null, mockChatHistory);
assert(Boolean(followUpContext.immediateParentTurn), 'Retains immediate parent turn without older stale context');
assert(followUpContext.immediateParentTurn.question === 'What is an ArrayList in Java?', 'Bound to correct parent topic');

// -----------------------------------------------------------------
// TEST J: Existing Core Features Preserved
// -----------------------------------------------------------------
console.log('\n--- TEST J: Existing Core Features Preserved ---');
assert(Boolean(INITIAL_USER_PROFILE.id), 'Profile manager default schema intact');
assert(INITIAL_USER_PROFILE.technicalSkills.length > 0, 'Technical skills preserved in profile');
assert(INITIAL_PROJECTS.length > 0, 'Project Vault initial records preserved');
assert(INITIAL_PROJECTS[0].name === 'EchoCopilot', 'EchoCopilot is the primary project');
assert(DEFAULT_ACTIVE_CONTEXT.selectedProjectIds.includes('proj_echocopilot'), 'Active context selection defaults to EchoCopilot');

// -----------------------------------------------------------------
// TEST K: Removed Project Data Check (No AlertIQ/ThreatWatch/UNSW/SWAPS)
// -----------------------------------------------------------------
console.log('\n--- TEST K: Clean Separation Check (No AlertIQ Reintroduction) ---');
const storageJson = JSON.stringify(INITIAL_PROJECTS) + JSON.stringify(INITIAL_USER_PROFILE);
assert(!storageJson.includes('AlertIQ'), 'AlertIQ is NOT in active project or profile data');
assert(!storageJson.includes('threatwatch'), 'ThreatWatch is NOT in active project or profile data');
assert(!storageJson.includes('UNSW-NB15'), 'UNSW-NB15 dataset is NOT in active project or profile data');
assert(!storageJson.includes('SWAPS'), 'SWAPS scoring logic is NOT in active project or profile data');

// -----------------------------------------------------------------
// TEST L: Actual Model Quality & Inference Path
// -----------------------------------------------------------------
console.log('\n--- TEST L: Actual Inference Path & Formatting ---');
const sampleQuestions = [
  'What is an ArrayList in Java?',
  'What is the difference between an array and an ArrayList in Java?',
  'Explain binary search and its time complexity.',
  'Tell me about yourself.',
  'Tell me about my current project.'
];

for (const q of sampleQuestions) {
  const ans = generateSmartCopilotAnswer(q);
  assert(Boolean(ans && ans.summary && ans.summary.length > 50), `Inference generated comprehensive response for: "${q.substring(0, 35)}..."`);
  assert(Boolean(ans.spokenScript && ans.spokenScript.length > 20), `Spoken script generated for: "${q.substring(0, 35)}..."`);
  assert(Array.isArray(ans.bullets) && ans.bullets.length >= 3, `Bullet points generated for: "${q.substring(0, 35)}..."`);
}

// -----------------------------------------------------------------
// TEST M: Comparison Natural Sentences & Definitions Formatting (Requirement 1)
// -----------------------------------------------------------------
console.log('\n--- TEST M: Comparison Natural Sentences & Formatting (Requirement 1) ---');
const qM = 'What is the difference between an array and an ArrayList in Java?';
const ansM = generateSmartCopilotAnswer(qM);

assert(Boolean(ansM.directAnswer && ansM.directAnswer.length > 50), 'Level 1: Starts directly with interview-ready spoken answer');
assert(ansM.summary.includes('**Array (Java):**\n\n') && ansM.summary.includes('**ArrayList (Java):**\n\n'), 'Section 1: Definitions separated with clear labels and blank lines');
assert(ansM.summary.includes('**Size:**') && ansM.summary.toLowerCase().includes('fixed size') && ansM.summary.toLowerCase().includes('dynamic'), 'Section 2: Explains size difference in natural sentences');
assert(ansM.summary.includes('**Data types:**') && ansM.summary.toLowerCase().includes('primitive'), 'Section 2: Explains data types difference in natural sentences');
assert((ansM.summary.includes('**Operations:**') || ansM.summary.includes('**Insertion and deletion:**')) && ansM.summary.includes('add()'), 'Section 2: Explains operations difference in natural sentences');
assert(ansM.summary.includes('#### Reference Comparison Table'), 'Section 2: Provides comparison table as an additional reference');
assert(ansM.summary.includes('### 3. Code Examples & Expected Output') || ansM.summary.includes('### 4. Code Examples'), 'Section 3: Contains code examples and expected output');
assert(ansM.summary.includes('### 4. Practical Use Cases & Engineering Trade-Offs') || ansM.summary.includes('### 5. Practical Use Cases'), 'Section 4: Practical use cases and trade-offs');
assert(ansM.summary.includes('### 5. Concise Conclusion') || ansM.summary.includes('### 6. Concise Conclusion'), 'Section 5: Concise conclusion');

// -----------------------------------------------------------------
// TEST N: Project-Aware Implementation vs General Technical (Requirements 2, 3)
// -----------------------------------------------------------------
console.log('\n--- TEST N: Project-Aware vs General Technical Authentication (Requirements 2, 3) ---');

// N1. General Technical Authentication Question
const qN1 = 'Explain authentication in Java.';
const intentN1 = classifyQuestionIntent(qN1);
assert(intentN1.intent === 'CONCEPT_EXPLANATION' || intentN1.intent === 'GENERAL_TECHNICAL', 'N1: "Explain authentication in Java" classified as General Technical');
assert(intentN1.isProjectAware === false, 'N1: Context isolated: isProjectAware is FALSE');
const ansN1 = generateTechnicalAnswer(qN1);
assert(Boolean(ansN1), 'N1: Technical answer generated');
assert(ansN1.summary.includes('Spring Security') && ansN1.summary.includes('SecurityFilterChain'), 'N1: Explains Spring Security and SecurityFilterChain');
assert(ansN1.summary.includes('JwtAuthenticationFilter'), 'N1: Demonstrates token filter pattern in Java');
assert(!ansN1.summary.toLowerCase().includes('echocopilot'), 'N1: Zero project contamination: EchoCopilot not mentioned');
assert(!ansN1.summary.toLowerCase().includes('indexeddb'), 'N1: Zero project contamination: IndexedDB not mentioned');

// N2. Project-Specific Authentication Question
const qN2 = 'How does authentication work in my project?';
const intentN2 = classifyQuestionIntent(qN2);
assert(intentN2.intent === 'PROJECT_SPECIFIC', 'N2: "How does authentication work in my project?" classified as PROJECT_SPECIFIC');
assert(intentN2.isProjectAware === true, 'N2: Context correctly includes project context');
const ansN2 = generatePersonalizedAnswer(qN2, 'medium', INITIAL_USER_PROFILE, INITIAL_PROJECTS);
assert(ansN2.structure.directAnswer.toLowerCase().includes('no remote user login') || ansN2.structure.directAnswer.toLowerCase().includes('local-first'), 'N2: Explains local-first zero-user-login architecture');
assert(ansN2.structure.supportingExample.includes('localStorage') && ansN2.structure.supportingExample.includes('Settings'), 'N2: Explains client-side API keys in localStorage');
assert(ansN2.structure.supportingExample.includes('SecretSanitizer'), 'N2: Mentions SecretSanitizer credential protection');

// N3. JWT Authentication in Project Question (Distinguishing reality from concept)
const qN3 = 'How does JWT authentication work in my project?';
const intentN3 = classifyQuestionIntent(qN3);
assert(intentN3.intent === 'PROJECT_SPECIFIC', 'N3: "How does JWT authentication work in my project?" classified as PROJECT_SPECIFIC');
const ansN3 = generatePersonalizedAnswer(qN3, 'medium', INITIAL_USER_PROFILE, INITIAL_PROJECTS);
assert(ansN3.structure.directAnswer.includes('does not use JWT authentication'), 'N3: Honestly states that EchoCopilot does not use JWT in active codebase');
assert(ansN3.structure.personalMotivation.includes('local-first'), 'N3: Explains why JWT is not required for single-user local app');
assert(ansN3.structure.supportingExample.includes('RS256') || ansN3.structure.supportingExample.includes('enterprise'), 'N3: Accurately explains how JWT would be designed if extended');

// N4. Project Architecture Question
const qN4 = 'Explain my project architecture.';
const intentN4 = classifyQuestionIntent(qN4);
assert(intentN4.intent === 'PROJECT_SPECIFIC', 'N4: Architecture query classified as PROJECT_SPECIFIC');
const ansN4 = generatePersonalizedAnswer(qN4, 'medium', INITIAL_USER_PROFILE, INITIAL_PROJECTS);
assert(ansN4.structure.directAnswer.includes('Next.js App Router') && ansN4.structure.directAnswer.includes('Electron'), 'N4: Identifies Next.js and Electron HUD');
assert(ansN4.structure.supportingExample.includes('src/components/CopilotModule.tsx'), 'N4: Inspects and mentions verified source files');

// N5. Verified Personal Contribution
const qN5 = 'What was my contribution?';
const intentN5 = classifyQuestionIntent(qN5);
assert(intentN5.intent === 'PROJECT_SPECIFIC' || intentN5.intent === 'PERSONAL_CAREER', 'N5: Contribution query classified correctly');
const ansN5 = generatePersonalizedAnswer(qN5, 'medium', INITIAL_USER_PROFILE, INITIAL_PROJECTS);
assert(ansN5.structure.directAnswer.includes('Personalized Career & Question Generation Engine') || ansN5.structure.directAnswer.includes('Secret Sanitizer'), 'N5: Strictly uses verified contributions');

// N6. Resume-grounded Project Explanation
const qN6 = 'Explain my project as described in my resume.';
const intentN6 = classifyQuestionIntent(qN6);
assert(intentN6.intent === 'PROJECT_SPECIFIC' || intentN6.intent === 'RESUME_BASED', 'N6: Resume project query classified correctly');
const ansN6 = generatePersonalizedAnswer(qN6, 'medium', INITIAL_USER_PROFILE, INITIAL_PROJECTS);
assert(ansN6.structure.directAnswer.includes('EchoCopilot'), 'N6: Grounds resume explanation in active project');
assert(ansN6.structure.supportingExample.includes('verified contributions'), 'N6: Emphasizes verified evidence over fabricated claims');

// -----------------------------------------------------------------
// TEST O: Networking & Cybersecurity Questions (Requirement 1.D)
// -----------------------------------------------------------------
console.log('\n--- TEST O: Networking & Cybersecurity Protocol Flows (Requirement 1.D) ---');

// O1. TCP 3-Way Handshake
const qO1 = 'Explain the TCP 3-way handshake.';
const ansO1 = generateTechnicalAnswer(qO1);
assert(Boolean(ansO1), 'O1: Technical answer generated for TCP 3-Way Handshake');
assert(ansO1.summary.includes('1. SYN') && ansO1.summary.includes('2. SYN-ACK') && ansO1.summary.includes('3. ACK'), 'O1: Shows complete protocol flow diagram');
assert(ansO1.summary.includes('SYN Cookies'), 'O1: Details defensive mitigation against SYN flood attacks');
assert(ansO1.summary.includes('Wireshark'), 'O1: Includes real-world packet capture analysis');

// O2. TCP vs UDP Protocol Comparison
const qO2 = 'What is the difference between TCP and UDP?';
const ansO2 = generateStructuredComparison('tcp', 'udp', qO2);
assert(ansO2.summary.includes('**Connection establishment:**'), 'O2: Explains connection establishment in natural sentences');
assert(ansO2.summary.includes('**Reliability and recovery:**'), 'O2: Explains reliability difference in natural sentences');
assert(ansO2.summary.includes('HTTP/HTTPS') && ansO2.summary.includes('DNS'), 'O2: Contrasts real-world protocols and scenarios');

// O3. SQL Injection Defense
const qO3 = 'What is SQL injection and how do you prevent it?';
const ansO3 = generateTechnicalAnswer(qO3);
assert(Boolean(ansO3), 'O3: Technical answer generated for SQL Injection');
assert(ansO3.summary.includes("' OR '1'='1"), 'O3: Illustrates injection attack payload mechanism');
assert(ansO3.summary.includes('PreparedStatement') && ansO3.summary.includes('pstmt.setString'), 'O3: Compilable defensive Java code with parameterized query');
assert(ansO3.summary.includes('Principle of Least Privilege'), 'O3: Explains defense-in-depth principles');

// -----------------------------------------------------------------
// TEST P: Speech Uncertainty & Clarification (Requirement 4 & 5)
// -----------------------------------------------------------------
console.log('\n--- TEST P: Speech Uncertainty & Anti-Hallucination Guard (Requirement 4) ---');
const qP = 'What is flurbenoid in Java?';
const normP = normalizeTechnicalTerms(qP);
assert(normP.hasUnknownSuspectTerm === true, 'P: Nonstandard term "flurbenoid" detected as suspect');
assert(Boolean(normP.suggestedClarification && normP.suggestedClarification.includes('not a recognized standard concept in java')), 'P: Generates polite clarification request');

const ansP = generateSmartCopilotAnswer(qP);
assert(ansP.summary.toLowerCase().includes('not a recognized standard concept') || ansP.summary.toLowerCase().includes('clarify'), 'P: Refuses to fabricate a fictional definition; asks for clarification');

// -----------------------------------------------------------------
// FINAL SUMMARY
// -----------------------------------------------------------------
console.log('\n================================================================');
console.log(`  Tests Passed: ${passed} / ${passed + failed}`);
if (failed === 0) {
  console.log('  ALL TESTS (A through L) PASSED WITH ZERO REGRESSIONS! ✨');
  process.exit(0);
} else {
  console.error(`  ${failed} test(s) failed.`);
  process.exit(1);
}
