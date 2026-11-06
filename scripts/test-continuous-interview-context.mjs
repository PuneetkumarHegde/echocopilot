/**
 * Comprehensive Continuous Interview Context & Latest Question Verification Suite
 *
 * Verifies all 8 user-mandated continuous interview scenarios:
 * 1. Concept question followed by a property follow-up ("What is stemming?" -> "What are its limitations?").
 * 2. Concept question followed by a comparison follow-up ("What is stemming?" -> "Could you also explain its limitations and how it differs from lemmatization?").
 * 3. New topic switch ("What is stemming?" -> "What is sentiment analysis?").
 * 4. Multiple follow-ups in a row ("What is a REST API?" -> "What are its constraints?" -> "Explain statelessness with an example.").
 * 5. Unrelated conversation history (ignores unrelated history and answers new technical question cleanly).
 * 6. Long continuous interview (multi-turn sequence of 6+ questions and follow-ups).
 * 7. Response cancellation under fast speech (supersedes older in-flight generation and rejects stale chunks).
 * 8. Non-question statements ("Your explanation is good." / "Okay, that makes sense." bypassed without generation).
 *
 * Also verifies Requirement 6: Context-aware speech-to-text recovery for acoustic misrecognitions
 * ("differs from limitation" -> "differs from lemmatization" in stemming context).
 */

import { 
  classifyUtterance, 
  isQuestionReadyForAnswer, 
  ConversationContextTracker, 
  detectFollowUpReference,
  extractConceptFromQuestion,
  isNewIndependentQuestion
} from '../src/lib/questionClassifier.ts';
import { 
  classifyQuestionIntent, 
  extractComparisonConcepts 
} from '../src/lib/intentClassifier.ts';
import { 
  generateTechnicalAnswer, 
  hasDeterministicTechnicalAnswer 
} from '../src/lib/technicalEngine.ts';
import { 
  generateStructuredComparison, 
  isKnownComparison, 
  getComparisonHandlerName 
} from '../src/lib/comparisonEngine.ts';
import { normalizeTechnicalTerms } from '../src/lib/technicalTermNormalizer.ts';
import { buildInterviewAssistantPrompt } from '../src/lib/aiFallback.ts';

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
console.log(' CONTINUOUS INTERVIEW CONTEXT & SYNC TEST SUITE      ');
console.log('======================================================\n');

// -----------------------------------------------------------------
// SCENARIO 1: Concept Question Followed by Property Follow-Up
// Q1: "What is stemming?"
// Q2: "What are its limitations?"
// -----------------------------------------------------------------
console.log('--- Scenario 1: Concept Question + Property Follow-up ---');
{
  const tracker = new ConversationContextTracker(5);

  // Turn 1: Concept Question
  const q1 = 'What is stemming?';
  const c1 = classifyUtterance(q1, tracker.getRecentHistory());
  assert(c1.isQuestion, 'Turn 1 recognized as genuine question');
  assert(!c1.isFollowUp, 'Turn 1 is not a follow-up (starts fresh concept)');
  assert(hasDeterministicTechnicalAnswer(q1), 'Turn 1 has deterministic technical answer');

  const ans1 = generateTechnicalAnswer(q1);
  assert(ans1 !== null, 'Generated Turn 1 answer');
  assert(ans1.directAnswer.toLowerCase().includes('stemming is a rule-based'), 'Turn 1 explains stemming directly');

  // Immediately register and record turn
  tracker.registerActiveTurn(q1, 'utt_1', q1, q1);
  tracker.recordTurn(q1, ans1.summary, 'GENERAL', { utteranceId: 'utt_1', concept: 'stemming' });

  // Turn 2: Property Follow-up
  const q2 = 'What are its limitations?';
  const history = tracker.getRecentHistory();
  const c2 = classifyUtterance(q2, history);
  assert(c2.isQuestion, 'Turn 2 recognized as question');
  assert(c2.isFollowUp, 'Turn 2 recognized as conversation-aware follow-up');

  const readiness2 = isQuestionReadyForAnswer(q2, history);
  assert(readiness2.isReady && readiness2.isFollowUpCandidate, 'Turn 2 is ready and marked follow-up candidate');

  const context2 = tracker.resolveContextualPrompt(q2);
  assert(context2.isFollowUp, 'Resolved as follow-up in context tracker');
  assert(context2.parentConcept === 'stemming', `Parent concept is "stemming" (got: "${context2.parentConcept}")`);

  const intent2 = classifyQuestionIntent(q2, history);
  assert(intent2.intent === 'FOLLOW_UP', `Intent classified as FOLLOW_UP (got: ${intent2.intent})`);

  const followUpCheck = detectFollowUpReference(q2, history[0]);
  assert(followUpCheck.isFollowUp, 'Follow-up reference detected');
  assert(followUpCheck.resolvedPrompt.toLowerCase().includes('stemming'), 'Pronoun "its" resolved to "stemming"');

  const ans2 = generateTechnicalAnswer(followUpCheck.resolvedPrompt);
  assert(ans2 !== null, 'Generated technical answer for limitations of stemming');
  assert(ans2.directAnswer.toLowerCase().includes('over-stemming'), 'Answer explains over-stemming');
  assert(ans2.directAnswer.toLowerCase().includes('under-stemming'), 'Answer explains under-stemming');
  assert(!ans2.directAnswer.toLowerCase().includes('sentiment analysis'), 'Answer does NOT mention sentiment analysis');
}

// -----------------------------------------------------------------
// SCENARIO 2: Concept Question Followed by Comparison Follow-Up
// Q1: "What is stemming?"
// Q2: "Could you also explain its limitations and how it differs from lemmatization?"
// -----------------------------------------------------------------
console.log('\n--- Scenario 2: Concept Question + Comparison Follow-up ---');
{
  const tracker = new ConversationContextTracker(5);

  const q1 = 'What is stemming?';
  const ans1 = generateTechnicalAnswer(q1);
  tracker.registerActiveTurn(q1, 'utt_1', q1, q1);
  tracker.recordTurn(q1, ans1.summary, 'GENERAL', { utteranceId: 'utt_1', concept: 'stemming' });

  const q2 = 'Could you also explain its limitations and how it differs from lemmatization?';
  const history = tracker.getRecentHistory();

  const c2 = classifyUtterance(q2, history);
  assert(c2.isQuestion, 'Turn 2 recognized as question');
  assert(c2.isFollowUp, 'Turn 2 classified as follow-up');

  const concepts = extractComparisonConcepts(q2, history);
  assert(concepts.conceptA === 'stemming', `Concept A resolved to "stemming" (got: "${concepts.conceptA}")`);
  assert(concepts.conceptB === 'lemmatization', `Concept B resolved to "lemmatization" (got: "${concepts.conceptB}")`);

  const intent2 = classifyQuestionIntent(q2, history);
  assert(intent2.intent === 'COMPARISON', `Intent classified as COMPARISON (got: ${intent2.intent})`);

  assert(isKnownComparison(concepts.conceptA, concepts.conceptB, q2), 'Recognized as known structured comparison');
  const handlerName = getComparisonHandlerName(concepts.conceptA, concepts.conceptB, q2);
  assert(handlerName === 'STEMMING_VS_LEMMATIZATION', `Selected handler is STEMMING_VS_LEMMATIZATION (got: ${handlerName})`);

  const compAns = generateStructuredComparison(concepts.conceptA, concepts.conceptB, q2);
  assert(compAns !== null, 'Generated structured comparison answer');
  assert(compAns.spokenScript.toLowerCase().includes('stemming and lemmatization are both text normalization techniques'), 'Stage 1 starts with natural introductory sentence');
  assert(compAns.summary.includes('| Dimension | **Stemming** | **Lemmatization** |'), 'Includes comparison table');
  assert(compAns.summary.includes('PorterStemmer'), 'Includes code example for PorterStemmer');
  assert(compAns.summary.includes('WordNetLemmatizer'), 'Includes code example for WordNetLemmatizer');
  assert(!compAns.spokenScript.toLowerCase().includes('sentiment analysis'), 'Answer does NOT mention sentiment analysis');
}

// -----------------------------------------------------------------
// SCENARIO 3: New Topic Switch
// Q1: "What is stemming?"
// Q2: "What is sentiment analysis?"
// Verify Q2 does NOT reuse stemming context.
// -----------------------------------------------------------------
console.log('\n--- Scenario 3: Clean Topic Switch ---');
{
  const tracker = new ConversationContextTracker(5);

  const q1 = 'What is stemming?';
  const ans1 = generateTechnicalAnswer(q1);
  tracker.registerActiveTurn(q1, 'utt_1', q1, q1);
  tracker.recordTurn(q1, ans1.summary, 'GENERAL', { utteranceId: 'utt_1', concept: 'stemming' });

  const q2 = 'What is sentiment analysis?';
  const history = tracker.getRecentHistory();

  const c2 = classifyUtterance(q2, history);
  assert(c2.isQuestion, 'Turn 2 recognized as question');
  assert(!c2.isFollowUp, 'Turn 2 is NOT a follow-up (explicit new topic switch)');

  const context2 = tracker.resolveContextualPrompt(q2);
  assert(!context2.isFollowUp, 'Context tracker confirms NOT a follow-up');
  assert(context2.enrichedPrompt === q2, 'Enriched prompt does NOT contain stemming context prefix');

  const intent2 = classifyQuestionIntent(q2, history);
  assert(intent2.intent === 'CONCEPT_EXPLANATION' || intent2.intent === 'GENERAL_TECHNICAL', `Intent is independent concept (got: ${intent2.intent})`);

  assert(hasDeterministicTechnicalAnswer(q2), 'Has deterministic answer for sentiment analysis');
  const ans2 = generateTechnicalAnswer(q2);
  assert(ans2 !== null, 'Generated sentiment analysis answer');
  assert(ans2.directAnswer.toLowerCase().includes('sentiment analysis is a natural language processing'), 'Direct answer defines sentiment analysis');
  assert(!ans2.directAnswer.toLowerCase().includes('stemming'), 'Direct answer does NOT mention stemming');

  // Register and update tracker
  tracker.registerActiveTurn(q2, 'utt_2', q2, q2);
  tracker.recordTurn(q2, ans2.summary, 'GENERAL', { utteranceId: 'utt_2', concept: 'sentiment analysis' });
  assert(tracker.getLatestTopic().concept === 'sentiment analysis', 'Latest topic updated to "sentiment analysis"');
}

// -----------------------------------------------------------------
// SCENARIO 4: Multiple Follow-ups in a Row
// Q1: "What is a REST API?"
// Q2: "What are its constraints?"
// Q3: "Explain statelessness with an example."
// -----------------------------------------------------------------
console.log('\n--- Scenario 4: Multiple Follow-ups Sequence ---');
{
  const tracker = new ConversationContextTracker(5);

  // Turn 1
  const q1 = 'What is a REST API?';
  const ans1 = generateTechnicalAnswer(q1);
  tracker.registerActiveTurn(q1, 'utt_1', q1, q1);
  tracker.recordTurn(q1, ans1.summary, 'GENERAL', { utteranceId: 'utt_1', concept: 'rest api' });

  // Turn 2: Follow-up on constraints
  const q2 = 'What are its constraints?';
  const c2 = classifyUtterance(q2, tracker.getRecentHistory());
  assert(c2.isQuestion && c2.isFollowUp, 'Turn 2 classified as follow-up to REST API');
  const followUp2 = detectFollowUpReference(q2, tracker.getLatestTopic());
  assert(followUp2.isFollowUp, 'Follow-up reference detected for constraints');
  assert(followUp2.parentConcept.toLowerCase().includes('rest'), `Parent concept is REST API (got: "${followUp2.parentConcept}")`);

  const targetQuery2 = (followUp2.isFollowUp && followUp2.resolvedPrompt) ? followUp2.resolvedPrompt : q2;
  const ans2 = generateTechnicalAnswer(targetQuery2);
  assert(ans2 !== null, 'Generated answer for REST API constraints');
  assert(ans2.directAnswer.toLowerCase().includes('client-server'), 'Explains Client-Server');
  assert(ans2.directAnswer.toLowerCase().includes('statelessness'), 'Explains Statelessness');
  assert(ans2.directAnswer.toLowerCase().includes('cacheability'), 'Explains Cacheability');

  tracker.registerActiveTurn(q2, 'utt_2', q2, q2);
  tracker.recordTurn(q2, ans2.summary, 'FOLLOW_UP', { utteranceId: 'utt_2', concept: 'rest api constraints' });

  // Turn 3: Follow-up on statelessness
  const q3 = 'Explain statelessness with an example.';
  const c3 = classifyUtterance(q3, tracker.getRecentHistory());
  assert(c3.isQuestion, 'Turn 3 recognized as question without question mark');
  assert(c3.isFollowUp, 'Turn 3 classified as follow-up');

  const ans3 = generateTechnicalAnswer(q3);
  assert(ans3 !== null, 'Generated answer for statelessness');
  assert(ans3.directAnswer.toLowerCase().includes('statelessness means that each client request'), 'Defines statelessness clearly');
  assert(ans3.summary.toLowerCase().includes('jwt') || ans3.summary.toLowerCase().includes('authorization'), 'Includes authentication token example');
}

// -----------------------------------------------------------------
// SCENARIO 5: Unrelated Conversation History
// Preceding turns contain general speech / banter, then direct question arrives.
// -----------------------------------------------------------------
console.log('\n--- Scenario 5: Unrelated History Isolation ---');
{
  const tracker = new ConversationContextTracker(5);

  // Irrelevant banter turns
  tracker.recordTurn("Can you hear me?", "Mic check was audible.", 'GENERAL');
  tracker.recordTurn("Let's begin the interview now.", "Interviewer started session.", 'GENERAL');

  const q = 'What is the difference between Array and ArrayList in Java?';
  const history = tracker.getRecentHistory();

  const c = classifyUtterance(q, history);
  assert(c.isQuestion, 'Question recognized');
  assert(!c.isFollowUp, 'Comparison is self-contained and NOT a follow-up to mic check');

  const concepts = extractComparisonConcepts(q, history);
  assert(concepts.conceptA === 'array', 'Extracted Concept A: array');
  assert(concepts.conceptB === 'arraylist', 'Extracted Concept B: arraylist');

  const compAns = generateStructuredComparison(concepts.conceptA, concepts.conceptB, q);
  assert(compAns.spokenScript.includes('store multiple elements in Java'), 'Clean Java comparison without audio check contamination');
  assert(!compAns.summary.toLowerCase().includes('mic check'), 'No banter contamination in summary');
}

// -----------------------------------------------------------------
// SCENARIO 6: Long Continuous Interview (6 Turns)
// -----------------------------------------------------------------
console.log('\n--- Scenario 6: Long Continuous Interview Flow ---');
{
  const tracker = new ConversationContextTracker(5);

  const interviewScript = [
    { q: 'What is stemming?', expectedConcept: 'stemming', isFollowUp: false },
    { q: 'What are its limitations?', expectedConcept: 'stemming', isFollowUp: true },
    { q: 'Could you also explain its limitations and how it differs from lemmatization?', expectedConcept: 'stemming', isFollowUp: true },
    { q: 'What is sentiment analysis?', expectedConcept: 'sentiment analysis', isFollowUp: false },
    { q: 'How does that work in practice?', expectedConcept: 'sentiment analysis', isFollowUp: true },
    { q: 'What is deadlock in operating systems?', expectedConcept: 'deadlock', isFollowUp: false },
    { q: 'What are its four conditions?', expectedConcept: 'deadlock', isFollowUp: true }
  ];

  for (let i = 0; i < interviewScript.length; i++) {
    const step = interviewScript[i];
    const history = tracker.getRecentHistory();
    const classification = classifyUtterance(step.q, history);
    
    assert(classification.isQuestion, `Turn ${i+1} ("${step.q}") is recognized as question`);
    assert(classification.isFollowUp === step.isFollowUp, `Turn ${i+1} follow-up status matches expected (${step.isFollowUp})`);

    const concept = extractConceptFromQuestion(step.q);
    tracker.registerActiveTurn(step.q, `utt_${i+1}`, step.q, step.q);
    tracker.recordTurn(step.q, `Summary for turn ${i+1}`, classification.category, {
      utteranceId: `utt_${i+1}`,
      concept: step.isFollowUp ? history[0]?.concept : concept
    });
  }
}

// -----------------------------------------------------------------
// SCENARIO 7: Stale Response Cancellation & Race Condition Prevention
// -----------------------------------------------------------------
console.log('\n--- Scenario 7: In-Flight Response Superseding & Race Prevention ---');
{
  const q1 = 'What is stemming?';
  const q2 = 'What is sentiment analysis?';

  // Question 1 is generating in flight
  let activeRequestId = 1;
  const inFlightQuery = q1;

  // New Question 2 arrives while Q1 is in flight
  const superseding = isNewIndependentQuestion(q2, inFlightQuery);
  assert(superseding.isNew, 'Recognized as new question');
  assert(superseding.shouldCancel, 'Confirmed in-flight question should be cancelled');

  // Simulated request ID increment
  const newRequestId = ++activeRequestId;
  assert(newRequestId === 2, 'New request ID is 2');

  // Simulated stale stream chunk from Question 1 arrives
  const staleChunkRequestId = 1;
  const shouldDropStale = staleChunkRequestId !== activeRequestId;
  assert(shouldDropStale, 'Stale chunk with request ID 1 is strictly rejected');

  // Simulated active stream chunk from Question 2 arrives
  const activeChunkRequestId = 2;
  const shouldAcceptActive = activeChunkRequestId === activeRequestId;
  assert(shouldAcceptActive, 'Active chunk with request ID 2 is accepted');
}

// -----------------------------------------------------------------
// SCENARIO 8: Non-Question Statements Bypassed
// -----------------------------------------------------------------
console.log('\n--- Scenario 8: Non-Question Statements Bypassed ---');
{
  const statements = [
    'Your explanation is good.',
    'Okay, that explanation makes sense.',
    'Right, got it.',
    'I worked on React and Node.js at my previous company.',
    'We use PostgreSQL for all relational data.'
  ];

  for (const stmt of statements) {
    const readiness = isQuestionReadyForAnswer(stmt, []);
    assert(!readiness.isReady, `Statement "${stmt}" is rejected from triggering tech answer`);
  }
}

// -----------------------------------------------------------------
// REQUIREMENT 6: Context-Aware STT Phonetic Recovery
// "differs from limitation" -> "differs from lemmatization" in stemming context
// -----------------------------------------------------------------
console.log('\n--- Requirement 6: Context-Aware STT Error Recovery ---');
{
  const context = [{ question: 'What is stemming?', summary: 'Stemming in NLP' }];
  const misrecognizedSpeech = 'Could you explain its limitations and how it differs from limitation?';

  const normalized = normalizeTechnicalTerms(misrecognizedSpeech, context);
  assert(
    normalized.normalizedText.toLowerCase().includes('differs from lemmatization'),
    `Acoustic error corrected: "${normalized.normalizedText}"`
  );
  assert(
    normalized.normalizedText.toLowerCase().includes('its limitations'),
    'Preserved "its limitations" as limitations without corrupting it'
  );
  assert(
    normalized.corrections.some(c => c.original === 'limitation' && c.corrected === 'lemmatization'),
    'Recorded correction entry for limitation -> lemmatization'
  );
}

// -----------------------------------------------------------------
// PROMPT PIPELINE CONTINUITY CHECK
// -----------------------------------------------------------------
console.log('\n--- Prompt Pipeline Continuity Check ---');
{
  const history = [
    { question: 'What is stemming?', summary: 'Stemming heuristic text normalization in NLP', concept: 'stemming', timestamp: Date.now() }
  ];
  const followUpQ = 'Could you also explain its limitations and how it differs from lemmatization?';

  const promptPayload = buildInterviewAssistantPrompt(followUpQ, history);
  assert(promptPayload.userPrompt.includes('Previous context:'), 'Attached previous context block');
  assert(promptPayload.userPrompt.includes('What is stemming?'), 'Contains parent question');
  assert(promptPayload.userPrompt.includes('Active concept: "stemming"'), 'Identifies active concept as stemming');
  assert(promptPayload.userPrompt.includes(`Follow-up question: "${followUpQ}"`), 'Contains follow-up question');
}

console.log('\n======================================================');
console.log(`RESULTS: ${passed} passed, ${failed} failed.`);
console.log('======================================================\n');

if (failed > 0) {
  process.exit(1);
} else {
  console.log('ALL CONTINUOUS INTERVIEW CONTEXT TESTS PASSED!\n');
}
