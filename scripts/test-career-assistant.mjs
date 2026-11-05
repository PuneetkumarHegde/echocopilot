/**
 * Automated Verification Test Suite for EchoCopilot
 * Personalized Career & Interview Assistant Upgrade
 */

import { isSecretFileName, sanitizeSourceCode } from '../src/lib/secretSanitizer.ts';
import { analyzeProjectFiles } from '../src/lib/projectAnalyzer.ts';
import { 
  generatePersonalizedQuestions, 
  generatePersonalizedAnswer, 
  evaluatePracticeAnswer 
} from '../src/lib/personalizedEngine.ts';
import { INITIAL_USER_PROFILE, INITIAL_PROJECTS } from '../src/lib/storage.ts';

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

console.log('====================================================');
console.log('  EchoCopilot Career Assistant Verification Suite   ');
console.log('====================================================\n');

// -----------------------------------------------------------------
// TEST 1: Secret & Credential Sanitizer
// -----------------------------------------------------------------
console.log('--- TEST 1: Secret & Credential Shield ---');

assert(isSecretFileName('.env'), 'Blocks exact .env file');
assert(isSecretFileName('.env.local'), 'Blocks .env.local file');
assert(isSecretFileName('.env.production'), 'Blocks .env.production file');
assert(isSecretFileName('id_rsa'), 'Blocks id_rsa private key');
assert(isSecretFileName('server.key'), 'Blocks .key files');
assert(isSecretFileName('service-account.json'), 'Blocks service-account JSON credentials');
assert(!isSecretFileName('UserService.java'), 'Allows clean Java source file');
assert(!isSecretFileName('page.tsx'), 'Allows clean Next.js file');

const sensitiveCode = `
const apiKey = "sk-proj-abc1234567890abcdefghijklmnopqrstuvwxyz";
const dbUrl = "postgres://postgres:supersecretpassword123@db.example.com:5432/production";
console.log("Starting server with", apiKey);
`;

const sanitizedResult = sanitizeSourceCode(sensitiveCode, 'server.ts');
assert(sanitizedResult.sanitized.includes('[REDACTED_OPENAI_KEY]'), 'Redacts raw OpenAI API key');
assert(sanitizedResult.sanitized.includes('[REDACTED_USER]:[REDACTED_PWD]'), 'Redacts database connection string passwords');
assert(!sanitizedResult.sanitized.includes('supersecretpassword123'), 'Raw password completely removed');
assert(sanitizedResult.redactedCount >= 2, 'Accurately recorded redacted count');

// -----------------------------------------------------------------
// TEST 2: Project Codebase Analyzer
// -----------------------------------------------------------------
console.log('\n--- TEST 2: Project Codebase Analyzer & Extraction ---');

const mockFiles = [
  {
    name: 'OrderController.java',
    path: 'src/main/java/com/example/OrderController.java',
    content: `
      package com.example;
      import org.springframework.web.bind.annotation.*;
      @RestController
      @RequestMapping("/api/orders")
      public class OrderController {
        @GetMapping("/{id}")
        public Order getOrder(@PathVariable String id) { return null; }
      }
    `
  },
  {
    name: 'Order.java',
    path: 'src/main/java/com/example/Order.java',
    content: `
      package com.example;
      import jakarta.persistence.*;
      @Entity
      public class Order {
        @Id private String id;
      }
    `
  },
  {
    name: '.env.local',
    path: '.env.local',
    content: 'DATABASE_PASSWORD=secret123'
  }
];

const analysis = analyzeProjectFiles('Order Service', mockFiles);
assert(analysis.blockedFilesCount === 1, 'Blocked .env.local from project indexing');
assert(analysis.sanitizedFilesCount === 2, 'Sanitized both clean Java files');
assert(analysis.project.technologyStack.some(t => t.name === 'Spring Boot' || t.name === 'Java'), 'Detected Java & Spring Boot in codebase');
assert(analysis.project.verifiedContributions.length > 0, 'Generated verified contribution proposals');
assert(analysis.project.verifiedContributions[0].isPersonallyImplemented === false, 'Initially marked as unverified (awaiting candidate confirmation)');

// -----------------------------------------------------------------
// TEST 3: Dynamic Personalized Question Generation
// -----------------------------------------------------------------
console.log('\n--- TEST 3: Dynamic Question Generation ---');

const generatedQuestions = generatePersonalizedQuestions(
  INITIAL_USER_PROFILE,
  INITIAL_PROJECTS
);

const qTexts = generatedQuestions.map(q => q.question.toLowerCase());

assert(qTexts.some(q => q.includes('why did you choose java')), 'Generated "Why did you choose Java?" from technical skills');
assert(qTexts.some(q => q.includes('how does java support your career goals')), 'Generated "How does Java support your career goals?"');
assert(qTexts.some(q => q.includes('why did you choose your bachelor of technology')), 'Generated degree choice question from education');
assert(qTexts.some(q => q.includes('why did you select this project\'s technology stack for echocopilot')), 'Generated project tech stack rationale question');
assert(qTexts.some(q => q.includes('why did you use postgresql instead of mongodb') || q.includes('why did you use postgresql instead of alternative')), 'Generated PostgreSQL vs MongoDB / alternative trade-off question');
assert(qTexts.some(q => q.includes('specific personal contribution to echocopilot')), 'Generated verified contribution drill-down question');
assert(qTexts.some(q => q.includes('most difficult technical problem you solved in echocopilot')), 'Generated hardest technical problem question');
assert(qTexts.some(q => q.includes('architectural trade-offs did you consider')), 'Generated architectural trade-offs question');
assert(qTexts.some(q => q.includes('cybersecurity background help in software development')), 'Generated cybersecurity domain advantage question');
assert(qTexts.some(q => q.includes('what would you improve if you rebuilt echocopilot')), 'Generated rebuild & future improvement question');

// -----------------------------------------------------------------
// TEST 4: Personalized 4-Part Answer Generation & Anti-Hallucination
// -----------------------------------------------------------------
console.log('\n--- TEST 4: Personalized 4-Part Answer Synthesis & Anti-Hallucination ---');

// Test authentic answer generation for Java
const javaAnswer = generatePersonalizedAnswer(
  'Why did you choose Java?',
  'medium',
  INITIAL_USER_PROFILE,
  INITIAL_PROJECTS
);

assert(Boolean(javaAnswer.structure.directAnswer), 'Has 1. Direct Answer');
assert(Boolean(javaAnswer.structure.personalMotivation), 'Has 2. Personal Motivation');
assert(Boolean(javaAnswer.structure.supportingExample), 'Has 3. Supporting Real Example');
assert(Boolean(javaAnswer.structure.roleOrCareerConnection), 'Has 4. Connection to Target Role & Goals');
assert(javaAnswer.spokenScript.length > 50, 'Generated natural spoken script for verbal interviews');
assert(javaAnswer.bullets.length >= 3, 'Generated structured bullets');
assert(!javaAnswer.missingContextDetected, 'No missing context for Java when profile is complete');

// Test Anti-Hallucination Guardrail: Question where profile lacks information
const incompleteProfile = {
  ...INITIAL_USER_PROFILE,
  education: [{ ...INITIAL_USER_PROFILE.education[0], reasonForDegree: '' }]
};

const incompleteAnswer = generatePersonalizedAnswer(
  'Why did you choose your degree or specialization?',
  'medium',
  incompleteProfile,
  INITIAL_PROJECTS
);

assert(Boolean(incompleteAnswer.missingContextDetected), 'Anti-Hallucination Guard triggered on missing personal detail');
assert(incompleteAnswer.missingContextDetected.suggestedCategory === 'education', 'Identified missing education category');
assert(Boolean(incompleteAnswer.missingContextDetected.suggestedPrompt), 'Provided targeted follow-up prompt for user to fill profile');

// -----------------------------------------------------------------
// TEST 5: Practice Turn Evaluation (4-Metric Rubric & Hesitation Detection)
// -----------------------------------------------------------------
console.log('\n--- TEST 5: Practice Evaluator & 4-Metric Rubric ---');

// 5A: Confident, structured response
const confidentAnswer = `
I chose Java because of its predictable JVM multithreading model and strong type safety.
For example, in EchoCopilot and my past internship, I used Spring Boot with connection pooling to handle high concurrency.
This directly supports my goal as a Backend Engineer building fault-tolerant microservices.
`;

const evalConfident = evaluatePracticeAnswer(
  'Why did you choose Java?',
  confidentAnswer,
  1,
  'technical',
  INITIAL_USER_PROFILE,
  INITIAL_PROJECTS
);

assert(evalConfident.rubricScores.correctness >= 8, 'High correctness score on structured answer');
assert(evalConfident.rubricScores.confidence >= 8, 'High confidence score on assertive phrasing');
assert(evalConfident.strengths.length > 0, 'Identified specific strengths');
assert(Boolean(evalConfident.adaptiveFollowUp), 'Generated intelligent adaptive follow-up question');

// 5B: Hesitant response with filler words
const hesitantAnswer = 'Umm, I think maybe Java is good because like I guess it has threads, but I am not sure.';
const evalHesitant = evaluatePracticeAnswer(
  'Why did you choose Java?',
  hesitantAnswer,
  2,
  'technical',
  INITIAL_USER_PROFILE,
  INITIAL_PROJECTS
);

assert(evalHesitant.rubricScores.confidence < 8, 'Penalized confidence score for hesitant hedging phrases');
assert(evalHesitant.confidenceWordingFeedback.includes('tentative') || evalHesitant.confidenceWordingFeedback.includes('hesitant'), 'Provided actionable advice to remove hesitant qualifiers');

// -----------------------------------------------------------------
// SUMMARY
// -----------------------------------------------------------------
console.log('\n====================================================');
console.log(`  Tests Passed: ${passed} / ${passed + failed}`);
if (failed === 0) {
  console.log('  ALL TEST SUITES PASSED CLEANLY! ✨');
  process.exit(0);
} else {
  console.error(`  ${failed} test(s) failed.`);
  process.exit(1);
}
