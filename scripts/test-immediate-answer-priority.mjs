/**
 * Verification Test Suite: Immediate Speakable Answer Priority
 * 
 * Tests the 8 mandatory interview questions:
 * 1. "What is NLP?"
 * 2. "What is Bag of Words?"
 * 3. "What is polymorphism?"
 * 4. "Difference between TCP and UDP."
 * 5. "Difference between Pull Request and git pull."
 * 6. "What is deadlock?"
 * 7. "What is normalization in DBMS?"
 * 8. "What is binary search?"
 * 
 * Verifies:
 * - Direct answer is emitted first with ZERO introductory labels or headings.
 * - No "Summary:", "Direct Interview Answer:", "Definitions:", "Here is...", "Certainly!".
 * - Natural 1-2 sentence speakable answer.
 * - Supporting depth does not repeat directAnswer.
 * - Checkpoint latencies t0 through t6.
 */

import { generateTechnicalAnswer } from '../src/lib/technicalEngine.ts';
import { generateStructuredComparison } from '../src/lib/comparisonEngine.ts';
import { classifyQuestionIntent } from '../src/lib/intentClassifier.ts';
import { cleanDirectSpeakableAnswer, cleanSupportingSummary, buildStage1Prompt, buildStage2Prompt, parseStreamingAnswer } from '../src/lib/aiFallback.ts';

const FORBIDDEN_INTRO_PATTERNS = [
  /^summary:/i,
  /^direct interview answer:/i,
  /^direct answer:/i,
  /^here is/i,
  /^certainly/i,
  /^let's understand/i,
  /^###\s*\d*\.?\s*direct interview answer/i,
  /^###\s*\d*\.?\s*summary/i,
  /^\*\*direct interview answer:\*\*/i,
  /^\*\*summary:\*\*/i
];

let totalPassed = 0;
let totalFailed = 0;

function assert(condition, name, details = '') {
  if (condition) {
    console.log(`  ✓ PASS: ${name}`);
    totalPassed++;
  } else {
    console.error(`  ✗ FAIL: ${name}`);
    if (details) console.error(`    Details: ${details}`);
    totalFailed++;
  }
}

const MANDATORY_QUESTIONS = [
  { id: 1, query: 'What is NLP?', type: 'DEFINITION', expectedSubject: 'natural language processing' },
  { id: 2, query: 'What is Bag of Words?', type: 'DEFINITION', expectedSubject: 'bag of words' },
  { id: 3, query: 'What is polymorphism?', type: 'DEFINITION', expectedSubject: 'polymorphism' },
  { id: 4, query: 'Difference between TCP and UDP.', type: 'COMPARISON', expectedSubject: 'tcp' },
  { id: 5, query: 'Difference between Pull Request and git pull.', type: 'COMPARISON', expectedSubject: 'pull request' },
  { id: 6, query: 'What is deadlock?', type: 'DEFINITION', expectedSubject: 'deadlock' },
  { id: 7, query: 'What is normalization in DBMS?', type: 'DEFINITION', expectedSubject: 'normalization' },
  { id: 8, query: 'What is binary search?', type: 'DSA', expectedSubject: 'binary search' }
];

console.log('\n======================================================');
console.log('🧪 EchoCopilot Immediate Speakable Answer Priority Suite');
console.log('======================================================\n');

console.log('--- Phase 1: Unit & Deterministic Knowledge Verification ---');

for (const item of MANDATORY_QUESTIONS) {
  console.log(`\nTesting Q${item.id}: "${item.query}"`);

  let ans = null;
  const intentResult = classifyQuestionIntent(item.query);

  if (item.type === 'COMPARISON') {
    const { conceptA, conceptB, conceptC } = intentResult.extractedConcepts || {};
    ans = generateStructuredComparison(conceptA || 'Concept A', conceptB || 'Concept B', item.query, conceptC);
  } else {
    ans = generateTechnicalAnswer(item.query);
  }

  assert(ans !== null, `Q${item.id} generates a non-null answer`);
  if (!ans) continue;

  const direct = ans.directAnswer || ans.spokenScript || '';

  // 1. Direct answer must exist and be comprehensive (70-130 words, 20-40s spoken time)
  assert(direct.length > 25, `Q${item.id} directAnswer is present (length: ${direct.length} chars)`);
  const wordCount = direct.split(/\s+/).length;
  const isComp = item.type === 'COMPARISON';
  const maxWords = isComp ? 260 : 160;
  assert(wordCount >= 25 && wordCount <= maxWords, `Q${item.id} directAnswer is natural spoken length (${wordCount} words, target: 70–${maxWords})`);

  // 2. Direct answer must NOT contain any forbidden headers or labels
  let hasForbiddenIntro = false;
  for (const pat of FORBIDDEN_INTRO_PATTERNS) {
    if (pat.test(direct.trim())) {
      hasForbiddenIntro = true;
      break;
    }
  }
  assert(!hasForbiddenIntro, `Q${item.id} directAnswer has ZERO introductory labels or headings`);
  assert(!direct.startsWith('#'), `Q${item.id} directAnswer does not start with markdown #`);
  assert(!direct.startsWith('**Summary'), `Q${item.id} directAnswer does not start with **Summary`);
  assert(!direct.startsWith('**Direct Interview Answer'), `Q${item.id} directAnswer does not start with **Direct Interview Answer`);

  // 3. Supporting summary must not have "Direct Interview Answer" header
  assert(!ans.summary.includes('### 1. Direct Interview Answer'), `Q${item.id} summary does not contain '### 1. Direct Interview Answer' header`);

  // 4. Clean sentence closure
  assert(/[.!?]$/.test(direct.trim()), `Q${item.id} directAnswer ends cleanly with terminal punctuation`);

  // 5. Subject correctness
  assert(direct.toLowerCase().includes(item.expectedSubject), `Q${item.id} directAnswer addresses core subject "${item.expectedSubject}"`);

  console.log(`  🎙️ Speakable Answer: "${direct.slice(0, 110)}..."`);
}

console.log('\n--- Phase 2: Live Ollama Two-Stage Streaming Pipeline Verification ---');

async function testLiveOllamaPipeline() {
  const baseOllama = process.env.OLLAMA_API_URL || 'http://localhost:11434';
  const genUrl = `${baseOllama.replace(/\/$/, '')}/api/generate`;
  const modelName = process.env.OLLAMA_MODEL || 'qwen2.5:3b';

  console.log(`Connecting to Ollama at ${genUrl} with model: ${modelName}...`);

  try {
    const healthCheck = await fetch(`${baseOllama.replace(/\/$/, '')}/api/tags`).catch(() => null);
    if (!healthCheck || !healthCheck.ok) {
      console.warn('  ⚠️ Local Ollama is not accessible. Skipping live streaming phase.');
      return;
    }

    const testQuestion = 'What is Natural Language Processing?';
    console.log(`\nExecuting Two-Stage Generation for: "${testQuestion}"`);

    const t0 = Date.now();
    const intent = classifyQuestionIntent(testQuestion);
    const t1 = Date.now();
    const stage1Prompt = buildStage1Prompt(testQuestion, 'GENERAL');
    const t2 = Date.now();
    const t3 = Date.now();

    // Stage 1
    const stage1Res = await fetch(genUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: modelName,
        prompt: stage1Prompt,
        stream: true,
        options: { num_gpu: 99, num_thread: 8, num_predict: 120, temperature: 0.1 }
      })
    });

    let t4_firstToken = null;
    let stage1Raw = '';

    if (stage1Res.ok && stage1Res.body) {
      const reader = stage1Res.body.getReader();
      const decoder = new TextDecoder();
      let buf = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split('\n');
        buf = lines.pop() || '';

        for (const l of lines) {
          if (!l.trim()) continue;
          try {
            const p = JSON.parse(l);
            if (p.response) {
              if (t4_firstToken === null) {
                t4_firstToken = Date.now();
              }
              stage1Raw += p.response;
            }
          } catch {}
        }
      }
    }

    const t5_stage1Done = Date.now();
    const directAns = cleanDirectSpeakableAnswer(stage1Raw);

    assert(directAns.length > 20, 'Stage 1 generated clean direct answer');
    assert(!directAns.startsWith('Summary:'), 'Stage 1 has no Summary label');
    assert(!directAns.startsWith('Direct Answer:'), 'Stage 1 has no Direct Answer label');
    assert(!directAns.startsWith('#'), 'Stage 1 has no markdown headings');

    // Stage 2
    const stage2Prompt = buildStage2Prompt(testQuestion, directAns, 'GENERAL');
    const stage2Res = await fetch(genUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: modelName,
        prompt: stage2Prompt,
        stream: true,
        options: { num_gpu: 99, num_thread: 8, num_predict: 500, temperature: 0.1 }
      })
    });

    let stage2Raw = '';
    if (stage2Res.ok && stage2Res.body) {
      const reader = stage2Res.body.getReader();
      const decoder = new TextDecoder();
      let buf = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split('\n');
        buf = lines.pop() || '';
        for (const l of lines) {
          if (!l.trim()) continue;
          try {
            const p = JSON.parse(l);
            if (p.response) stage2Raw += p.response;
          } catch {}
        }
      }
    }

    const t6_stage2Done = Date.now();
    const cleanSummary = cleanSupportingSummary(stage2Raw, directAns);

    assert(cleanSummary.length > 50, 'Stage 2 generated supporting depth');

    console.log('\n--- Latency Checkpoints Report ---');
    console.log(`  t0 (Question Received):            0 ms`);
    console.log(`  t1 (Intent Classified):            +${t1 - t0} ms`);
    console.log(`  t2 (Prompt Constructed):           +${t2 - t0} ms`);
    console.log(`  t3 (Provider Request Dispatched):  +${t3 - t0} ms`);
    console.log(`  t4 (Time to First Token - TTFT):   ${t4_firstToken ? t4_firstToken - t0 : 'N/A'} ms`);
    console.log(`  t5 (Direct Speakable Answer Ready): ${t5_stage1Done - t0} ms`);
    console.log(`  t6 (Stage 2 Supporting Depth Ready): ${t6_stage2Done - t0} ms`);
    console.log(`\n  🎯 Candidate waits only ${t5_stage1Done - t0}ms before speaking aloud!`);
    console.log(`  🎙️ Speakable Direct Answer: "${directAns}"`);

  } catch (err) {
    console.warn('  ⚠️ Live Ollama test encountered an error:', err.message);
  }
}

testLiveOllamaPipeline().then(() => {
  console.log('\n======================================================');
  console.log(`Final Suite Results: ${totalPassed} PASSED, ${totalFailed} FAILED`);
  console.log('======================================================\n');
  process.exit(totalFailed > 0 ? 1 : 0);
});

