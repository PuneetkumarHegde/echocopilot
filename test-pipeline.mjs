import { isMeaningfulQuestion, QuestionDeduplicator, shouldTriggerAnswer, isAutoAnswerAllowedForMode } from './src/lib/audioPipelineHelper.ts';

console.log('--- TEST 1: Question Detection & Filler Rejection ---');
console.log('"yeah ok" ->', isMeaningfulQuestion('yeah ok'), '(Expected: false)');
console.log('"hello" ->', isMeaningfulQuestion('hello'), '(Expected: false)');
console.log('"can you hear me" ->', isMeaningfulQuestion('can you hear me'), '(Expected: false)');
console.log('"what is JavaScript" ->', isMeaningfulQuestion('what is JavaScript'), '(Expected: true)');
console.log('"can you explain react hooks?" ->', isMeaningfulQuestion('can you explain react hooks?'), '(Expected: true)');
console.log('"tell me about method overloading" ->', isMeaningfulQuestion('tell me about method overloading'), '(Expected: true)');

console.log('\n--- TEST 2: Deduplication (15s Window) ---');
const dedup = new QuestionDeduplicator(15000);
console.log('Query 1 "what is java":', dedup.isNewQuestion('what is java'), '(Expected: true)');
console.log('Query 2 (Duplicate) "what is java":', dedup.isNewQuestion('what is java'), '(Expected: false)');
console.log('Query 3 (New) "what is python":', dedup.isNewQuestion('what is python'), '(Expected: true)');

console.log('\n--- TEST 3: Feedback Loop Prevention & Source Separation ---');
const candidateTurn = {
  id: 'turn_1',
  speaker: 'candidate',
  source: 'mic',
  text: 'JavaScript is a single-threaded language running on the V8 engine.',
  timestamp: Date.now()
};

const candidateQuestionTurn = {
  id: 'turn_2',
  speaker: 'candidate',
  source: 'mic',
  text: 'What is the event loop?',
  timestamp: Date.now()
};

const interviewerTurn = {
  id: 'turn_3',
  speaker: 'interviewer',
  source: 'meeting',
  text: 'What is method overloading in Java?',
  timestamp: Date.now()
};

const manualTurn = {
  id: 'turn_4',
  speaker: 'interviewer',
  source: 'manual',
  text: 'Explain binary search trees',
  timestamp: Date.now()
};

console.log('Interviewer question in DEVICE mode -> triggers answer?:',
  shouldTriggerAnswer(interviewerTurn, 'device_only', true), '(Expected: true)');

console.log('Candidate question in MIC mode -> triggers answer?:',
  shouldTriggerAnswer(candidateQuestionTurn, 'mic_only', true), '(Expected: true)');

console.log('Interviewer question in BOTH mode -> triggers answer?:',
  shouldTriggerAnswer(interviewerTurn, 'both', true), '(Expected: true)');

console.log('Candidate spoken answer in BOTH mode -> triggers answer?:',
  shouldTriggerAnswer(candidateTurn, 'both', true), '(Expected: false - Feedback Loop Prevented)');

console.log('Candidate spoken question in BOTH mode -> triggers answer?:',
  shouldTriggerAnswer(candidateQuestionTurn, 'both', true), '(Expected: false - Only Device Triggers in Both)');

console.log('Manual fallback Ask in BOTH mode -> triggers answer?:',
  shouldTriggerAnswer(manualTurn, 'both', true), '(Expected: true)');

console.log('\n--- TEST 4: Consecutive Questions without Session Restart ---');
const dedup2 = new QuestionDeduplicator(15000);
console.log('Consecutive Q1 "What is Java":', dedup2.isNewQuestion('What is Java'), '(Expected: true)');
console.log('Consecutive Q2 "What is Python":', dedup2.isNewQuestion('What is Python'), '(Expected: true)');
console.log('Consecutive Q3 "How does overriding differ":', dedup2.isNewQuestion('How does overriding differ'), '(Expected: true)');
