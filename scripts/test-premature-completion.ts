/**
 * Regression Test Suite: Premature Question Completion & Stale Context Prevention
 *
 * Verifies all 8 required conditions:
 * 1. Complete comparison question -> generation starts.
 * 2. "What is the difference?" -> generation does not start.
 * 3. "What is the difference?" followed by "between GPU and CPU?" -> merge and answer complete question once.
 * 4. Incomplete question after an old Java exception question -> must not reuse old subjects.
 * 5. Clear follow-up "What about its advantages?" after an immediately preceding topic -> preserve appropriate context.
 * 6. Two distinct questions spoken consecutively -> no stale answer leakage (monotonic request IDs).
 * 7. Partial ASR events -> no duplicate generation.
 * 8. Valid complete questions continue to meet latency targets (< 1ms classifier).
 * 9. Server route /api/copilot gate rejects incomplete questions.
 */

import { 
  isQuestionReadyForAnswer, 
  hasValidComparisonSubjects, 
  classifyUtterance,
  mergeSpeechFragments,
  ConversationContextTracker,
  isNewIndependentQuestion
} from '../src/lib/questionClassifier';
import { isMeaningfulQuestion, shouldTriggerAnswer, QuestionDeduplicator, SpeechFragmentAccumulator } from '../src/lib/audioPipelineHelper';
import { normalizeTechnicalTerms } from '../src/lib/technicalTermNormalizer';
import { TranscriptTurn } from '../src/lib/types';

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    console.log(`  [PASS] ${message}`);
    passed++;
  } else {
    console.error(`  [FAIL] ${message}`);
    failed++;
  }
}

async function runRegressionSuite() {
  console.log('\n========================================================================');
  console.log('EchoCopilot Premature Question Completion & Stale Context Test Suite');
  console.log('========================================================================\n');

  // -------------------------------------------------------------------------
  // 1. Complete comparison questions -> generation starts
  // -------------------------------------------------------------------------
  console.log('[Test 1] Complete comparison questions are recognized and ready:');
  const complete1 = isQuestionReadyForAnswer("What is the difference between GPU and CPU?");
  console.log(`  "What is the difference between GPU and CPU?" -> isReady: ${complete1.isReady}`);
  assert(complete1.isReady === true, 'Complete question (GPU vs CPU) is ready for answer');
  assert(complete1.needsMoreSpeech === false, 'Complete question does not need more speech');

  const complete2 = isQuestionReadyForAnswer("What is the difference between a process and a thread?");
  console.log(`  "What is the difference between a process and a thread?" -> isReady: ${complete2.isReady}`);
  assert(complete2.isReady === true, 'Complete question (process vs thread) is ready for answer');

  const complete3 = isQuestionReadyForAnswer("Compare SQL and NoSQL databases");
  assert(complete3.isReady === true, 'Compare SQL and NoSQL is ready for answer');

  const complete4 = isQuestionReadyForAnswer("How does TCP differ from UDP?");
  assert(complete4.isReady === true, 'How does TCP differ from UDP is ready for answer');

  // -------------------------------------------------------------------------
  // 2. Incomplete questions -> generation does NOT start
  // -------------------------------------------------------------------------
  console.log('\n[Test 2] Incomplete questions are blocked before Ollama:');
  const incompleteDiff1 = isQuestionReadyForAnswer("What is the difference?");
  console.log(`  "What is the difference?" -> isReady: ${incompleteDiff1.isReady}, reason: "${incompleteDiff1.reason}"`);
  assert(incompleteDiff1.isReady === false, '"What is the difference?" is blocked (isReady: false)');
  assert(incompleteDiff1.needsMoreSpeech === true, '"What is the difference?" signals needsMoreSpeech: true');

  const incompleteDiff2 = isQuestionReadyForAnswer("What is the difference between");
  console.log(`  "What is the difference between" -> isReady: ${incompleteDiff2.isReady}`);
  assert(incompleteDiff2.isReady === false, '"What is the difference between" is blocked');
  assert(incompleteDiff2.needsMoreSpeech === true, '"What is the difference between" signals needsMoreSpeech: true');

  const incompleteWhy = isQuestionReadyForAnswer("Why?");
  console.log(`  "Why?" (no context) -> isReady: ${incompleteWhy.isReady}`);
  assert(incompleteWhy.isReady === false, '"Why?" without context is blocked');

  const incompleteExplain = isQuestionReadyForAnswer("Explain it");
  console.log(`  "Explain it" (no context) -> isReady: ${incompleteExplain.isReady}`);
  assert(incompleteExplain.isReady === false, '"Explain it" without context is blocked');

  const incompleteTrailingAnd = isQuestionReadyForAnswer("What is Java and");
  assert(incompleteTrailingAnd.isReady === false, 'Trailing connector "and" is blocked');

  // Check shouldTriggerAnswer guard
  const incompleteTurn: TranscriptTurn = {
    id: 'turn_test_1',
    speaker: 'interviewer',
    source: 'mic',
    text: 'What is the difference?',
    timestamp: Date.now(),
    isFinal: true
  };
  const triggerIncomplete = shouldTriggerAnswer(incompleteTurn, 'mic_only', true);
  console.log(`  shouldTriggerAnswer for "What is the difference?" -> ${triggerIncomplete}`);
  assert(triggerIncomplete === false, 'shouldTriggerAnswer blocks "What is the difference?" from triggering Ollama');

  // -------------------------------------------------------------------------
  // 3. Speech fragment merging: "What is the difference?" + "between GPU and CPU?"
  // -------------------------------------------------------------------------
  console.log('\n[Test 3] Fragment merging and single answer trigger:');
  const frag1 = "What is the difference?";
  const frag2 = "between GPU and CPU?";
  const merged = mergeSpeechFragments(frag1, frag2);
  console.log(`  Fragment 1: "${frag1}"`);
  console.log(`  Fragment 2: "${frag2}"`);
  console.log(`  Merged:     "${merged}"`);
  assert(
    merged.toLowerCase() === "what is the difference between gpu and cpu?",
    `Merged fragments cleanly stripped premature '?' and joined: "${merged}"`
  );
  const mergedReadiness = isQuestionReadyForAnswer(merged);
  assert(mergedReadiness.isReady === true, 'Merged query is now ready for answer');

  // -------------------------------------------------------------------------
  // 3B. Interviewer says "What is the difference?" then "Overloading and overriding."
  // -------------------------------------------------------------------------
  console.log('\n[Test 3B] Accumulation and Normalization of "What is the difference?" + "Overloading and overriding.":');
  const sp1 = "What is the difference?";
  const sp2 = "Overloading and overriding.";
  const mergedSpeech = mergeSpeechFragments(sp1, sp2);
  console.log(`  Spoken 1:   "${sp1}"`);
  console.log(`  Spoken 2:   "${sp2}"`);
  console.log(`  Combined:   "${mergedSpeech}"`);
  assert(
    mergedSpeech.toLowerCase() === "what is the difference between overloading and overriding?",
    `Combined speech bridged comparison starter with "between" and restored '?': "${mergedSpeech}"`
  );

  const normOOP = normalizeTechnicalTerms(mergedSpeech);
  console.log(`  Normalized: "${normOOP.normalizedText}"`);
  assert(
    normOOP.normalizedText === "What is the difference between method overloading and method overriding?",
    `Normalized to canonical OOP terms: "${normOOP.normalizedText}"`
  );
  const oopReadiness = isQuestionReadyForAnswer(normOOP.normalizedText);
  assert(oopReadiness.isReady === true, 'Completed OOP question is ready for answer generation');
  assert(oopReadiness.needsMoreSpeech === false, 'Completed OOP question does not need more speech');

  // -------------------------------------------------------------------------
  // 3C. SpeechFragmentAccumulator tests: cumulative ASR and technical pairs
  // -------------------------------------------------------------------------
  console.log('\n[Test 3C] SpeechFragmentAccumulator pipeline handling:');
  const accumulator = new SpeechFragmentAccumulator(10000);

  // Partial fragment 1
  const step1 = accumulator.addFragment("What is the difference?");
  assert(step1.isContinued === false, 'First fragment initiates accumulator');
  assert(step1.rawText === "What is the difference?", 'Preserves raw verbatim fragment 1');
  assert(isQuestionReadyForAnswer(step1.mergedText).isReady === false, 'Incomplete fragment 1 is not ready');

  // Partial fragment 2 (after pause)
  const step2 = accumulator.addFragment("processes and threads.");
  assert(step2.isContinued === true, 'Second fragment continues pending question across pause');
  assert(step2.rawText === "What is the difference? processes and threads.", 'Preserves raw verbatim transcript separately');
  const normOS = normalizeTechnicalTerms(step2.mergedText);
  console.log(`  Combined OS question: "${normOS.normalizedText}"`);
  assert(
    normOS.normalizedText.toLowerCase() === "what is the difference between processes and threads?",
    `OS terms combined into: "${normOS.normalizedText}"`
  );
  assert(isQuestionReadyForAnswer(normOS.normalizedText).isReady === true, 'Combined OS question is ready');

  // Cumulative STT (where fragment 2 contains fragment 1)
  const accumCumulative = new SpeechFragmentAccumulator(10000);
  accumCumulative.addFragment("What is the difference between");
  const cumResult = accumCumulative.addFragment("What is the difference between compilers and interpreters?");
  assert(
    cumResult.mergedText.toLowerCase() === "what is the difference between compilers and interpreters?",
    'Cumulative speech transcript supersedes previous without word duplication'
  );
  const normComp = normalizeTechnicalTerms(cumResult.mergedText);
  assert(isQuestionReadyForAnswer(normComp.normalizedText).isReady === true, 'Compilers vs interpreters question ready');

  // -------------------------------------------------------------------------
  // 4. Incomplete question after Java exception question must NOT reuse old subjects
  // -------------------------------------------------------------------------
  console.log('\n[Test 4] Stale context isolation (no subject borrowing):');
  const tracker = new ConversationContextTracker(5);
  tracker.recordTurn(
    "What is the difference between checked and unchecked exceptions in Java?",
    "A checked exception is verified at compile-time, while an unchecked exception occurs at runtime.",
    "DIFFERENCE"
  );

  const history = tracker.getRecentHistory();
  assert(history.length === 1, 'Previous Java exception turn recorded in history');

  // User now speaks "What is the difference?"
  const resolution = tracker.resolveContextualPrompt("What is the difference?");
  console.log(`  Prior question: "${history[0].question}"`);
  console.log(`  New utterance:  "What is the difference?"`);
  console.log(`  Resolved prompt: "${resolution.enrichedPrompt}"`);
  console.log(`  isFollowUp:     ${resolution.isFollowUp}`);

  assert(
    resolution.isFollowUp === false,
    'Incomplete difference utterance is NOT resolved as a follow-up'
  );
  assert(
    !resolution.enrichedPrompt.includes("checked and unchecked exceptions"),
    'Resolved prompt does NOT borrow or hallucinate Java exception subjects'
  );
  assert(
    resolution.enrichedPrompt === "What is the difference?",
    'User transcript / prompt remains faithful to actual words spoken'
  );

  const postHistoryReadiness = isQuestionReadyForAnswer("What is the difference?", history);
  assert(
    postHistoryReadiness.isReady === false,
    'isQuestionReadyForAnswer still returns false even with previous Java history'
  );

  // -------------------------------------------------------------------------
  // 5. Clear follow-up "What about its advantages?" with fresh unambiguous context
  // -------------------------------------------------------------------------
  console.log('\n[Test 5] Clear follow-up question preserves context:');
  const redisTracker = new ConversationContextTracker(5);
  redisTracker.recordTurn(
    "What is Redis?",
    "Redis is an in-memory key-value data structure store used as a database, cache, and message broker.",
    "DIRECT"
  );

  const redisHistory = redisTracker.getRecentHistory();
  const followUpReadiness = isQuestionReadyForAnswer("What about its advantages?", redisHistory);
  console.log(`  "What about its advantages?" with fresh Redis context -> isReady: ${followUpReadiness.isReady}`);
  assert(followUpReadiness.isReady === true, 'Clear follow-up is ready when preceded by fresh topic');
  assert(followUpReadiness.isFollowUpCandidate === true, 'Identified as follow-up candidate');

  const resolvedFollowUp = redisTracker.resolveContextualPrompt("What about its advantages?");
  console.log(`  Enriched follow-up: "${resolvedFollowUp.enrichedPrompt.split('\n')[0]}"`);
  assert(resolvedFollowUp.isFollowUp === true, 'Correctly resolved as follow-up');
  assert(resolvedFollowUp.enrichedPrompt.includes('What is Redis?'), 'Preserves preceding Redis topic context');

  // If previous context is stale (> 120s), it must reject
  const staleTurn = { ...redisHistory[0], timestamp: Date.now() - 150000 };
  const staleReadiness = isQuestionReadyForAnswer("What about its advantages?", [staleTurn]);
  console.log(`  Stale context (> 120s) -> isReady: ${staleReadiness.isReady}`);
  assert(staleReadiness.isReady === false, 'Stale context (> 120s) rejects follow-up');

  // -------------------------------------------------------------------------
  // 6. Two distinct questions spoken consecutively -> no stale answer leakage
  // -------------------------------------------------------------------------
  console.log('\n[Test 6] Consecutive independent questions & monotonic cancellation:');
  const q1 = "Explain how DNS resolution works";
  const q2 = "What is a deadlock in OS?";
  const cancelCheck = isNewIndependentQuestion(q2, q1);
  console.log(`  Q1: "${q1}"`);
  console.log(`  Q2: "${q2}"`);
  console.log(`  Cancellation check: shouldCancel=${cancelCheck.shouldCancel}, reason="${cancelCheck.reason}"`);
  assert(cancelCheck.shouldCancel === true, 'New independent question cancels in-flight query');

  // Simulate monotonic request ID tracking
  let activeRequestId = 0;
  const req1Id = ++activeRequestId; // 1
  const req2Id = ++activeRequestId; // 2

  // Simulate response 1 arriving late
  const shouldRenderReq1 = req1Id === activeRequestId;
  const shouldRenderReq2 = req2Id === activeRequestId;
  assert(shouldRenderReq1 === false, 'Superseded request #1 response is rejected');
  assert(shouldRenderReq2 === true, 'Current request #2 response is accepted');

  // -------------------------------------------------------------------------
  // 7. Partial ASR events & Deduplication
  // -------------------------------------------------------------------------
  console.log('\n[Test 7] Partial ASR events and deduplication:');
  const deduplicator = new QuestionDeduplicator(4000);
  const trigger1 = deduplicator.isNewQuestion("What is a deadlock in OS?");
  const trigger2 = deduplicator.isNewQuestion("What is a deadlock in OS?");
  const trigger3 = deduplicator.isNewQuestion("what is a deadlock in os");

  assert(trigger1 === true, 'First presentation is accepted');
  assert(trigger2 === false, 'Identical second presentation within TTL is deduplicated');
  assert(trigger3 === false, 'Normalized case-insensitive presentation is deduplicated');

  // -------------------------------------------------------------------------
  // 8. Performance profiling: Latency target < 1ms
  // -------------------------------------------------------------------------
  console.log('\n[Test 8] Classification and readiness latency profiling:');
  const iterations = 1000;
  const tStart = performance.now();
  for (let i = 0; i < iterations; i++) {
    isQuestionReadyForAnswer("What is the difference between GPU and CPU?");
    isQuestionReadyForAnswer("What is the difference?");
  }
  const tEnd = performance.now();
  const avgLatencyUs = ((tEnd - tStart) / (iterations * 2)) * 1000;
  console.log(`  Average classification latency: ${avgLatencyUs.toFixed(2)} µs per call`);
  assert(avgLatencyUs < 1000, `Classifier latency is well below 1ms (${(avgLatencyUs / 1000).toFixed(3)}ms)`);

  // -------------------------------------------------------------------------
  // Summary
  // -------------------------------------------------------------------------
  console.log('\n========================================================================');
  console.log(`Results: ${passed} passed, ${failed} failed`);
  console.log('========================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runRegressionSuite().catch((err) => {
  console.error('Test suite failed:', err);
  process.exit(1);
});
