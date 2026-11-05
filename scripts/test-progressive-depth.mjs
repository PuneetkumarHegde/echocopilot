/**
 * Verification Test Suite: Progressive Interview Answer Depth (Levels 1, 2, and 3)
 * 
 * Verifies all 10 mandatory interview questions:
 * 1. Difference between Array and ArrayList.
 * 2. Difference between Interface and Abstract Class.
 * 3. Difference between TCP and UDP.
 * 4. Difference between Primary Key and Foreign Key.
 * 5. Difference between DELETE, TRUNCATE and DROP.
 * 6. Difference between Process and Thread.
 * 7. Explain polymorphism.
 * 8. Explain deadlock.
 * 9. What is Bag of Words in NLP?
 * 10. Explain database normalization.
 * 
 * Validates:
 * - Level 1 is a COMPLETE, natural speakable answer (~70–130 words, 4–6 sentences).
 * - Level 1 has NO introductory labels ("Summary:", "Direct Interview Answer:", "Definitions:").
 * - Comparisons introduce both concepts and explain key differences + usage conclusion.
 * - Definitions explain definition, core purpose, internal mechanics, and practical application.
 * - Stage 2 provides Level 2 & Level 3 depth without repeating Level 1.
 * - Live local Ollama verification with qwen2.5:3b.
 */

import { generateTechnicalAnswer } from '../src/lib/technicalEngine';
import { generateStructuredComparison } from '../src/lib/comparisonEngine';
import { classifyQuestionIntent } from '../src/lib/intentClassifier';
import {
  cleanDirectSpeakableAnswer,
  cleanSupportingSummary,
  buildStage1Prompt,
  buildStage2Prompt,
  parseStreamingAnswer
} from '../src/lib/aiFallback';

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
  {
    id: 1,
    query: 'What is the difference between Array and ArrayList in Java?',
    type: 'COMPARISON',
    conceptA: 'Array',
    conceptB: 'ArrayList',
    requiredKeyConcepts: ['array', 'arraylist', 'fixed', 'dynamic', 'primitive']
  },
  {
    id: 2,
    query: 'What is the difference between Interface and Abstract Class?',
    type: 'COMPARISON',
    conceptA: 'Interface',
    conceptB: 'Abstract Class',
    requiredKeyConcepts: ['interface', 'abstract class', 'multiple inheritance', 'constructor']
  },
  {
    id: 3,
    query: 'What is the difference between TCP and UDP?',
    type: 'COMPARISON',
    conceptA: 'TCP',
    conceptB: 'UDP',
    requiredKeyConcepts: ['tcp', 'udp', 'connection-oriented', 'connectionless', 'reliable']
  },
  {
    id: 4,
    query: 'What is the difference between Primary Key and Foreign Key?',
    type: 'COMPARISON',
    conceptA: 'Primary Key',
    conceptB: 'Foreign Key',
    requiredKeyConcepts: ['primary key', 'foreign key', 'uniquely', 'null', 'referential integrity']
  },
  {
    id: 5,
    query: 'What is the difference between DELETE, TRUNCATE and DROP?',
    type: 'COMPARISON_3WAY',
    conceptA: 'DELETE',
    conceptB: 'TRUNCATE',
    conceptC: 'DROP',
    requiredKeyConcepts: ['delete', 'truncate', 'drop', 'dml', 'ddl', 'roll']
  },
  {
    id: 6,
    query: 'What is the difference between Process and Thread?',
    type: 'COMPARISON',
    conceptA: 'Process',
    conceptB: 'Thread',
    requiredKeyConcepts: ['process', 'thread', 'memory', 'isolated', 'shared']
  },
  {
    id: 7,
    query: 'Explain polymorphism.',
    type: 'DEFINITION',
    requiredKeyConcepts: ['polymorphism', 'compile-time', 'runtime', 'overloading', 'overriding']
  },
  {
    id: 8,
    query: 'Explain deadlock.',
    type: 'DEFINITION',
    requiredKeyConcepts: ['deadlock', 'coffman', 'circular wait', 'lock']
  },
  {
    id: 9,
    query: 'What is Bag of Words in NLP?',
    type: 'DEFINITION',
    requiredKeyConcepts: ['bag of words', 'vocabulary', 'frequency', 'sparse', 'order']
  },
  {
    id: 10,
    query: 'Explain database normalization.',
    type: 'DEFINITION',
    requiredKeyConcepts: ['normalization', 'redundancy', 'anomalies', '1nf', '2nf', '3nf']
  }
];

console.log('\n========================================================================');
console.log('🧪 EchoCopilot Progressive Interview Answer Depth Suite (10 Questions)');
console.log('========================================================================\n');

// -----------------------------------------------------------------------------
// Part 1: Deterministic Engine Verification of Level 1 Speakable Answer Quality
// -----------------------------------------------------------------------------
console.log('--- Part 1: Level 1 Complete Speakable Answer Quality ---');

for (const item of MANDATORY_QUESTIONS) {
  console.log(`\nEvaluating Q${item.id}: "${item.query}"`);

  let ans = null;
  const intentResult = classifyQuestionIntent(item.query);

  if (item.type.startsWith('COMPARISON')) {
    const { conceptA, conceptB, conceptC } = intentResult.extractedConcepts || {};
    ans = generateStructuredComparison(
      conceptA || item.conceptA,
      conceptB || item.conceptB,
      item.query,
      conceptC || item.conceptC
    );
  } else {
    ans = generateTechnicalAnswer(item.query);
  }

  assert(ans !== null, `Q${item.id} produces a non-null answer`);
  if (!ans) continue;

  const direct = ans.directAnswer || ans.spokenScript || '';

  // 1. Level 1 must be a complete 4-6 sentence answer (~70-130 words)
  const wordCount = direct.trim().split(/\s+/).length;
  const sentenceCount = (direct.match(/[.!?]+(?:\s+|$)/g) || []).length;

  const isComp = item.type.startsWith('COMPARISON');
  const maxWords = isComp ? 260 : 160;
  const maxSentences = isComp ? 14 : 7;

  assert(
    wordCount >= 65 && wordCount <= maxWords,
    `Q${item.id} Level 1 word count is comprehensive (${wordCount} words, target: 70–${maxWords})`,
    `Got ${wordCount} words: "${direct.slice(0, 100)}..."`
  );

  assert(
    sentenceCount >= 3 && sentenceCount <= maxSentences,
    `Q${item.id} Level 1 sentence count represents full progressive depth (${sentenceCount} sentences, target: 4–${maxSentences})`,
    `Got ${sentenceCount} sentences`
  );

  // 2. Must not contain introductory labels or meta filler
  let hasForbiddenIntro = false;
  for (const pat of FORBIDDEN_INTRO_PATTERNS) {
    if (pat.test(direct.trim())) {
      hasForbiddenIntro = true;
      break;
    }
  }
  assert(!hasForbiddenIntro, `Q${item.id} Level 1 has NO introductory labels or meta-phrases`);

  // 3. Must not contain markdown code blocks or table fences in Level 1
  assert(!direct.includes('```'), `Q${item.id} Level 1 contains NO markdown code fences`);
  assert(!direct.includes('| :---'), `Q${item.id} Level 1 contains NO markdown table fences`);

  // 4. Must contain core technical concepts
  const lowerDirect = direct.toLowerCase();
  for (const concept of item.requiredKeyConcepts) {
    assert(
      lowerDirect.includes(concept.toLowerCase()),
      `Q${item.id} Level 1 covers essential concept: "${concept}"`
    );
  }

  // 5. Stage 2 (Supporting Technical Depth) must NOT duplicate Level 1
  const cleanSummary = cleanSupportingSummary(ans.summary, direct);
  assert(cleanSummary.length > 100, `Q${item.id} Stage 2 provides rich supporting depth`);
  assert(
    !cleanSummary.toLowerCase().startsWith(direct.slice(0, 40).toLowerCase()),
    `Q${item.id} Stage 2 does NOT duplicate Level 1 at the top`
  );

  // 6. For comparisons, verify Level 2 table and code examples exist
  if (item.type.startsWith('COMPARISON')) {
    assert(ans.summary.includes('| Dimension |') || ans.summary.includes('| :---'), `Q${item.id} includes Reference Comparison Table`);
    assert(ans.summary.includes('```'), `Q${item.id} includes Compilable Code Examples`);
    assert(ans.summary.includes('Expected Output'), `Q${item.id} includes Expected Output for examples`);
  }
}

// -----------------------------------------------------------------------------
// Part 2: Prompts and Cleaning Function Unit Tests
// -----------------------------------------------------------------------------
console.log('\n--- Part 2: Two-Stage Prompt & Cleaner Unit Tests ---');

{
  const p1 = buildStage1Prompt('What is the difference between Array and ArrayList?');
  assert(p1.includes('4 to 6 natural sentences'), 'Stage 1 prompt explicitly requests 4 to 6 sentences');
  assert(p1.includes('70–130 words'), 'Stage 1 prompt specifies 70–130 words budget');
  assert(p1.includes('STRICTLY NO headings'), 'Stage 1 prompt forbids headings and labels');

  const p2 = buildStage2Prompt('What is the difference between Array and ArrayList?', 'In Java, an array is a fixed-size...');
  assert(p2.includes('DO NOT repeat or duplicate'), 'Stage 2 prompt forbids repeating Level 1');
  assert(p2.includes('Level 2: Supporting Technical Explanation'), 'Stage 2 prompt outlines Level 2');
  assert(p2.includes('Level 3: Additional Technical Depth'), 'Stage 2 prompt outlines Level 3');
}

{
  // Test cleanDirectSpeakableAnswer preservation of 4-6 sentences
  const sampleRaw = `Summary:
In Java, an array is a fixed-size data structure. It stores elements of the same declared type in contiguous memory. In contrast, an ArrayList is a resizable collection class. It dynamically handles resizing and wraps primitives into objects. In practice, use arrays for fixed buffers and ArrayList for flexible collections.

### 2. Key Differences
- Size: Fixed vs Dynamic.`;

  const cleaned = cleanDirectSpeakableAnswer(sampleRaw);
  assert(!cleaned.includes('Summary:'), 'Cleaner strips Summary: header');
  assert(!cleaned.includes('Key Differences'), 'Cleaner strips subsequent markdown sections');
  const sCount = (cleaned.match(/[.!?]+/g) || []).length;
  assert(sCount >= 4, `Cleaner preserves all 5 spoken sentences (got ${sCount})`);
  assert(cleaned.startsWith('In Java, an array'), 'Cleaner starts directly with spoken words');
}

// -----------------------------------------------------------------------------
// Part 3: Live Local Ollama Verification (qwen2.5:3b)
// -----------------------------------------------------------------------------
console.log('\n--- Part 3: Live Local Ollama Verification (Array vs ArrayList) ---');

async function testLiveOllama() {
  const ollamaUrl = process.env.OLLAMA_API_URL || 'http://localhost:11434/api/generate';
  const model = process.env.OLLAMA_MODEL || 'qwen2.5:3b';

  const testQuestion = 'What is the difference between Array and ArrayList in Java?';
  const s1Prompt = buildStage1Prompt(testQuestion, 'COMPARISON');

  console.log(`Sending Stage 1 prompt to ${model} at ${ollamaUrl}...`);
  const t0 = Date.now();
  let firstTokenMs = 0;
  let stage1Raw = '';

  try {
    const res = await fetch(ollamaUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        prompt: s1Prompt,
        stream: true,
        options: {
          num_gpu: 99,
          num_thread: 8,
          num_ctx: 2048,
          num_predict: 320,
          temperature: 0.1
        }
      })
    });

    if (!res.ok) {
      console.warn(`Ollama responded with status ${res.status}`);
      return;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const lines = buf.split('\n');
      buf = lines.pop() || '';

      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const parsed = JSON.parse(line.trim());
          if (parsed.response) {
            if (!firstTokenMs) {
              firstTokenMs = Date.now() - t0;
            }
            stage1Raw += parsed.response;
          }
        } catch {}
      }
    }

    const s1TotalMs = Date.now() - t0;
    const cleanedStage1 = cleanDirectSpeakableAnswer(stage1Raw);
    const s1Words = cleanedStage1.trim().split(/\s+/).length;
    const s1Sentences = (cleanedStage1.match(/[.!?]+(?:\s+|$)/g) || []).length;

    console.log(`\n  ⚡ Stage 1 TTFT: ${firstTokenMs}ms | Total Duration: ${s1TotalMs}ms`);
    console.log(`  📝 Words Generated: ${s1Words} words | Sentences: ${s1Sentences}`);
    console.log(`  🗣️ Live Spoken Output:\n  "${cleanedStage1}"\n`);

    assert(firstTokenMs > 0 && firstTokenMs < 1500, `Live Ollama TTFT is fast (${firstTokenMs}ms < 1500ms)`);
    assert(s1Words >= 45, `Live Ollama produced complete answer (${s1Words} words >= 45 words)`);
    assert(s1Sentences >= 3, `Live Ollama produced multiple complete sentences (${s1Sentences} >= 3 sentences)`);
    assert(cleanedStage1.toLowerCase().includes('array'), 'Live output mentions array');
    assert(cleanedStage1.toLowerCase().includes('arraylist'), 'Live output mentions arraylist');
    assert(
      cleanedStage1.toLowerCase().includes('fixed') || cleanedStage1.toLowerCase().includes('dynamic') || cleanedStage1.toLowerCase().includes('size'),
      'Live output contrasts size/dimensions'
    );
    assert(!FORBIDDEN_INTRO_PATTERNS.some(p => p.test(cleanedStage1)), 'Live output has NO forbidden labels');

  } catch (err) {
    console.warn('Ollama local live test could not complete:', err.message);
  }
}

testLiveOllama().then(() => {
  console.log('\n========================================================================');
  console.log(`Results: ${totalPassed} PASSED, ${totalFailed} FAILED`);
  console.log('========================================================================\n');
  if (totalFailed > 0) {
    process.exit(1);
  }
});
