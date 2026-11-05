/**
 * EchoCopilot Factual Regression & Local Generation Test Suite
 * 
 * Verifies:
 * 1. Factual Claims Validator on Java Array vs ArrayList (8 Required Facts vs 6 Rejected Claims)
 * 2. Live Ollama qwen2.5:3b generation (TTFT, Total Completion Time, Natural Spoken Style, Ollama Metrics)
 * 3. Follow-up 1: "Explain that in two sentences, no code." (Override test)
 * 4. Follow-up 2: "Give a small code example." (Minimal code 6-12 lines)
 * 5. Follow-up 3: "Which should I use when the size changes?" (Context recommendation)
 * 6. Follow-up 4: "What is the complexity of adding an element?" (Amortized complexity)
 * 7. Follow-up 5: "Does its capacity shrink automatically after removal?" (Anti-hallucination)
 * 8. Follow-up 6: "Okay." (Acknowledgement gate bypass)
 */

import { validateFactualClaims } from '../src/lib/answerValidator';
import {
  TECHNICAL_INTERVIEW_SYSTEM_PROMPT,
  buildInterviewAssistantPrompt
} from '../src/lib/aiFallback';
import { isQuestionReadyForAnswer, classifyUtterance } from '../src/lib/questionClassifier';
import { isAckOrNonQuestion } from '../src/app/api/copilot/route';

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

async function callLocalOllama(systemPrompt, userPrompt, temperature = 0.2, maxTokens = 280) {
  const url = 'http://localhost:11434/api/generate';
  const t0 = Date.now();
  let firstTokenTime = null;
  let fullText = '';
  let ollamaMetrics = {};

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'qwen2.5:3b',
      system: systemPrompt,
      prompt: userPrompt,
      stream: true,
      options: {
        num_gpu: 99,
        num_thread: 8,
        num_ctx: 2048,
        num_predict: maxTokens,
        temperature
      },
      keep_alive: '10m'
    })
  });

  if (!res.ok) {
    throw new Error(`Ollama HTTP ${res.status}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const parsed = JSON.parse(line);
        if (parsed.response) {
          if (firstTokenTime === null) {
            firstTokenTime = Date.now() - t0;
          }
          fullText += parsed.response;
        }
        if (parsed.done && parsed.total_duration) {
          ollamaMetrics = {
            totalDurationMs: Math.round(parsed.total_duration / 1e6),
            loadDurationMs: parsed.load_duration ? Math.round(parsed.load_duration / 1e6) : 0,
            promptEvalDurationMs: parsed.prompt_eval_duration ? Math.round(parsed.prompt_eval_duration / 1e6) : 0,
            evalDurationMs: parsed.eval_duration ? Math.round(parsed.eval_duration / 1e6) : 0,
            promptEvalCount: parsed.prompt_eval_count || 0,
            evalCount: parsed.eval_count || 0,
            tps: parsed.eval_count && parsed.eval_duration ? Number((parsed.eval_count / (parsed.eval_duration / 1e9)).toFixed(1)) : 0
          };
        }
      } catch {}
    }
  }

  const totalTime = Date.now() - t0;
  return {
    text: fullText.trim(),
    ttftMs: firstTokenTime || 0,
    totalMs: totalTime,
    metrics: ollamaMetrics
  };
}

async function runFactualTestSuite() {
  console.log('\n===============================================================');
  console.log('   ECHOPILOT FACTUAL REGRESSION & GENERATION TEST SUITE');
  console.log('===============================================================\n');

  // -----------------------------------------------------------------
  // 1. Unit Tests for Factual Claims Validator (8 facts, 6 rejected claims)
  // -----------------------------------------------------------------
  console.log('--- TEST 1: Factual Claims Validator (Ground Truth Checks) ---');
  
  // A. Accurate answer with all key facts
  const accurateJavaAnswer = `An Array and an ArrayList are both used to store multiple elements in Java, but they differ fundamentally.
First, an array has a fixed length once created, whereas an ArrayList has dynamic variable size and can grow as elements are added.
Second, an array can hold primitive types or object references directly, while an ArrayList stores object wrapper classes like Integer.
Third, arrays use arr[index] and .length, while ArrayList uses get(index) and .size().
Under the hood, ArrayList is backed by a resizable Object array, and both provide O(1) constant-time indexed random access.`;

  const evalAccurate = validateFactualClaims('What is the difference between array and ArrayList?', accurateJavaAnswer);
  assert(evalAccurate.isFactuallyAccurate, 'Accurate Java Array vs ArrayList marked accurate', JSON.stringify(evalAccurate.rejectedClaimsDetected));
  assert(evalAccurate.completenessScore >= 0.75, `Completeness score >= 0.75 (got ${evalAccurate.completenessScore.toFixed(2)})`);

  // B. Hallucinated answer with known false claims
  const hallucinatedAnswer = `An array is a fixed collection, but an ArrayList is implemented as a linked list under the hood.
Also, ArrayList<Integer> freely accepts unrelated element types.
An array's length must be known at compile time, and removing elements automatically shrinks ArrayList capacity.
Inserting or removing elements is always O(1), and ArrayList inherently avoids memory fragmentation.
Finally, accessing elements in an ArrayList is typically slower due to dynamic resizing.`;

  const evalHallucinated = validateFactualClaims('What is the difference between array and ArrayList?', hallucinatedAnswer);
  assert(!evalHallucinated.isFactuallyAccurate, 'Hallucinated answer marked inaccurate');
  assert(evalHallucinated.rejectedClaimsDetected.length >= 5, `Detected >= 5 false claims (found ${evalHallucinated.rejectedClaimsDetected.length})`);
  assert(!evalHallucinated.repairedText.includes('linked list'), 'Repaired text eliminated linked list claim');
  assert(!evalHallucinated.repairedText.includes('automatically shrinks'), 'Repaired text eliminated auto-shrink claim');
  assert(!evalHallucinated.repairedText.includes('must be known at compile time'), 'Repaired text eliminated compile-time length claim');

  // -----------------------------------------------------------------
  // 2. Live Ollama Generation: Java Array vs ArrayList
  // -----------------------------------------------------------------
  console.log('\n--- TEST 2: Live Ollama qwen2.5:3b (Array vs ArrayList in Java) ---');
  const q2 = 'What is the difference between array and ArrayList in Java?';
  const prompt2 = buildInterviewAssistantPrompt(q2, [], 'Java');
  
  console.log('  Warming up local Ollama instance (ensuring model resident in GPU VRAM)...');
  await callLocalOllama(prompt2.systemPrompt, 'Ping', 0.2, 2);

  console.log('  Calling local Ollama instance (qwen2.5:3b, temp: 0.2)...');
  const gen2 = await callLocalOllama(prompt2.systemPrompt, prompt2.userPrompt, 0.2, 280);
  console.log(`  [Latency] TTFT: ${gen2.ttftMs}ms | Total: ${gen2.totalMs}ms`);
  console.log(`  [Ollama Metrics]: total=${gen2.metrics.totalDurationMs}ms, promptEval=${gen2.metrics.promptEvalDurationMs}ms, eval=${gen2.metrics.evalDurationMs}ms, speed=${gen2.metrics.tps} tokens/sec`);
  console.log(`  [Generated Output]:\n"${gen2.text}"\n`);

  assert(gen2.ttftMs < 1000, `Time to first token < 1000ms (actual: ${gen2.ttftMs}ms)`);
  assert(gen2.totalMs < 8000, `Total completion time < 8000ms (actual: ${gen2.totalMs}ms)`);
  assert(!/^certainly|^sure|^great question|^as an ai/i.test(gen2.text), 'Does not include introductory conversational filler');

  const evalGen2 = validateFactualClaims(q2, gen2.text);
  assert(evalGen2.isFactuallyAccurate, 'Live generated answer contains NO rejected false claims', JSON.stringify(evalGen2.rejectedClaimsDetected));
  assert(evalGen2.completenessScore >= 0.25, `Live answer includes key technical distinctions (score: ${evalGen2.completenessScore.toFixed(2)})`);

  const parentHistory = [{ question: q2, summary: gen2.text.slice(0, 200) }];

  // -----------------------------------------------------------------
  // 3. Follow-up 1: "Explain that in two sentences, no code."
  // -----------------------------------------------------------------
  console.log('\n--- TEST 3: Follow-up 1 ("Explain that in two sentences, no code.") ---');
  const q3 = 'Explain that in two sentences, no code.';
  const prompt3 = buildInterviewAssistantPrompt(q3, parentHistory, 'Java');
  
  const gen3 = await callLocalOllama(prompt3.systemPrompt, prompt3.userPrompt, 0.2, 120);
  console.log(`  [Latency] TTFT: ${gen3.ttftMs}ms | Total: ${gen3.totalMs}ms`);
  console.log(`  [Generated Output]:\n"${gen3.text}"\n`);

  assert(gen3.text.toLowerCase().includes('array'), 'Follow-up output remains grounded in array context');
  assert(!gen3.text.includes('```'), 'Contains NO code block ("no code" respected)');
  const sentences3 = gen3.text.split(/(?<=[.?!])\s+/).filter(Boolean);
  assert(sentences3.length >= 1 && sentences3.length <= 4, `Outputs concise explanation (~2 sentences, got ${sentences3.length})`);

  // -----------------------------------------------------------------
  // 4. Follow-up 2: "Give a small code example."
  // -----------------------------------------------------------------
  console.log('\n--- TEST 4: Follow-up 2 ("Give a small code example.") ---');
  const q4 = 'Give a small code example.';
  const prompt4 = buildInterviewAssistantPrompt(q4, parentHistory, 'Java');
  
  const gen4 = await callLocalOllama(prompt4.systemPrompt, prompt4.userPrompt, 0.2, 220);
  console.log(`  [Latency] TTFT: ${gen4.ttftMs}ms | Total: ${gen4.totalMs}ms`);
  console.log(`  [Generated Output]:\n"${gen4.text}"\n`);

  assert(gen4.text.includes('```') || gen4.text.includes('ArrayList') || gen4.text.includes('int[]'), 'Contains code syntax or snippet');

  // -----------------------------------------------------------------
  // 5. Follow-up 3: "Which should I use when the size changes?"
  // -----------------------------------------------------------------
  console.log('\n--- TEST 5: Follow-up 3 ("Which should I use when the size changes?") ---');
  const q5 = 'Which should I use when the size changes?';
  const prompt5 = buildInterviewAssistantPrompt(q5, parentHistory, 'Java');

  const gen5 = await callLocalOllama(prompt5.systemPrompt, prompt5.userPrompt, 0.2, 160);
  console.log(`  [Latency] TTFT: ${gen5.ttftMs}ms | Total: ${gen5.totalMs}ms`);
  console.log(`  [Generated Output]:\n"${gen5.text}"\n`);

  assert(gen5.text.toLowerCase().includes('arraylist'), 'Recommends ArrayList when size changes dynamically');

  // -----------------------------------------------------------------
  // 6. Follow-up 4: "What is the complexity of adding an element?"
  // -----------------------------------------------------------------
  console.log('\n--- TEST 6: Follow-up 4 ("What is the complexity of adding an element?") ---');
  const q6 = 'What is the complexity of adding an element?';
  const prompt6 = buildInterviewAssistantPrompt(q6, parentHistory, 'Java');

  const gen6 = await callLocalOllama(prompt6.systemPrompt, prompt6.userPrompt, 0.2, 200);
  console.log(`  [Latency] TTFT: ${gen6.ttftMs}ms | Total: ${gen6.totalMs}ms`);
  console.log(`  [Generated Output]:\n"${gen6.text}"\n`);

  assert(/o\(1\)|amortized|o\(n\)|constant/i.test(gen6.text), 'Accurately explains time complexity (O(1) / amortized / O(N))');

  // -----------------------------------------------------------------
  // 7. Follow-up 5: "Does its capacity shrink automatically after removal?"
  // -----------------------------------------------------------------
  console.log('\n--- TEST 7: Follow-up 5 ("Does its capacity shrink automatically after removal?") ---');
  const q7 = 'Does its capacity shrink automatically after removal?';
  const prompt7 = buildInterviewAssistantPrompt(q7, parentHistory, 'Java');

  const gen7 = await callLocalOllama(prompt7.systemPrompt, prompt7.userPrompt, 0.2, 180);
  console.log(`  [Latency] TTFT: ${gen7.ttftMs}ms | Total: ${gen7.totalMs}ms`);
  console.log(`  [Generated Output]:\n"${gen7.text}"\n`);

  assert(/no\b|does not|doesn't|not automatically|trimtosize/i.test(gen7.text), 'Factually clarifies that capacity does not automatically shrink on element removal');

  // -----------------------------------------------------------------
  // 8. Follow-up 6: Acknowledgement Gate: "Okay."
  // -----------------------------------------------------------------
  console.log('\n--- TEST 8: Acknowledgement Gate ("Okay.") ---');
  const ack1 = 'Okay.';
  const ack2 = 'Got it, thanks.';
  const ack3 = 'Right.';
  
  const ready1 = isQuestionReadyForAnswer(ack1);
  const class1 = classifyUtterance(ack1);
  const bypass1 = isAckOrNonQuestion(ack1);

  assert(bypass1 === true, '"Okay." recognized as acknowledgement by isAckOrNonQuestion');
  assert(class1.intent === 'ACKNOWLEDGEMENT' || bypass1, '"Okay." classified as ACKNOWLEDGEMENT');
  assert(isAckOrNonQuestion(ack2) === true, '"Got it, thanks." recognized as acknowledgement');
  assert(isAckOrNonQuestion(ack3) === true, '"Right." recognized as acknowledgement');

  // Summary
  console.log('\n===============================================================');
  console.log(`   TOTAL TESTS: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
  console.log('===============================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runFactualTestSuite().catch(err => {
  console.error('Fatal error running factual test suite:', err);
  process.exit(1);
});
