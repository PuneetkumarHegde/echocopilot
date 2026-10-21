import { buildQuestionSpecificPrompt, parseStreamingAnswer } from '../src/lib/aiFallback';

async function runPipelineTests() {
  console.log('================================================================');
  console.log('EchoCopilot Incomplete Answers & Truncation Pipeline Test Suite');
  console.log('================================================================\n');

  let allPassed = true;

  // -------------------------------------------------------------
  // Test 1: Unit Test - parseStreamingAnswer Truncation Bug Fix
  // -------------------------------------------------------------
  console.log('[TEST 1] Verifying parseStreamingAnswer bug fix (No 160-char ellipsis truncation)...');
  const comparativeText = "The main difference is that a compiler translates the entire source code into machine code before execution, while an interpreter executes the code line by line at runtime. Compilers produce an executable binary upfront, resulting in faster runtime performance. Interpreters execute code on the fly, offering rapid prototyping at the cost of execution speed. In summary, compilers prioritize raw performance while interpreters prioritize agility.";

  const parsedComparative = parseStreamingAnswer(comparativeText, "What is the difference between a compiler and an interpreter?");
  
  if (parsedComparative.summary.endsWith('...')) {
    console.error('❌ FAIL: parsedComparative.summary ends with artificial "..." ellipsis!');
    allPassed = false;
  } else if (parsedComparative.summary.length <= 165) {
    console.error(`❌ FAIL: parsedComparative.summary was truncated to ${parsedComparative.summary.length} chars!`);
    allPassed = false;
  } else {
    console.log(`✅ PASS: parseStreamingAnswer preserved full summary (${parsedComparative.summary.length} chars) without artificial truncation.`);
  }

  // -------------------------------------------------------------
  // Test 2: Incomplete text detection without fabricated text
  // -------------------------------------------------------------
  console.log('\n[TEST 2] Verifying incomplete response detection without text fabrication...');
  const incompleteText = "A compiler translates source code into machine code before execution, while an interpreter executes";
  const parsedIncomplete = parseStreamingAnswer(incompleteText, "What is the difference between a compiler and an interpreter?", 'general', 'length');

  if (!parsedIncomplete.isIncomplete) {
    console.error('❌ FAIL: Incomplete response was not flagged as isIncomplete = true!');
    allPassed = false;
  } else if (parsedIncomplete.summary.endsWith('...')) {
    console.error('❌ FAIL: Artificial "..." was appended to incomplete response!');
    allPassed = false;
  } else {
    console.log(`✅ PASS: Correctly detected incomplete generation (isIncomplete=true, doneReason='length') without fabricating text.`);
  }

  // -------------------------------------------------------------
  // Test 3: Real Local Ollama Pipeline Test for all 4 Questions
  // -------------------------------------------------------------
  const questions = [
    {
      q: "What is the difference between a compiler and an interpreter?",
      expectedKeyword: "compiler",
      expectedStart: "The main difference is that"
    },
    {
      q: "What is a checked exception in Java?",
      expectedKeyword: "checked exception",
      expectedStart: "A checked exception"
    },
    {
      q: "What is the difference between a process and a thread?",
      expectedKeyword: "process",
      expectedStart: "The main difference is that"
    },
    {
      q: "Explain method overloading with an example.",
      expectedKeyword: "overloading",
      expectedStart: "Method overloading"
    }
  ];

  console.log('\n[TEST 3] Running full inference pipeline with local Ollama (qwen2.5:3b, num_predict: 650)...');

  for (const item of questions) {
    console.log(`\n----------------------------------------------------------------`);
    console.log(`Testing Question: "${item.q}"`);
    console.log(`----------------------------------------------------------------`);

    const { systemPrompt, userPrompt } = buildQuestionSpecificPrompt(item.q, 'coding');
    const startTime = Date.now();

    // Call Ollama with streaming enabled to test SSE chunk accumulation
    const res = await fetch('http://127.0.0.1:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'qwen2.5:3b',
        prompt: `${systemPrompt}\n\nCandidate Question: ${userPrompt}`,
        stream: true,
        options: {
          num_gpu: 99,
          num_thread: 8,
          num_ctx: 2048,
          num_predict: 650,
          temperature: 0.1
        },
        keep_alive: -1
      })
    });

    if (!res.ok || !res.body) {
      console.error(`❌ FAIL: Ollama returned HTTP ${res.status}`);
      allPassed = false;
      continue;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let accumulatedText = '';
    let doneReason = '';
    let evalCount = 0;
    let firstTokenLatencyMs = 0;
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        try {
          const parsed = JSON.parse(trimmed);
          if (parsed.response) {
            if (!firstTokenLatencyMs) firstTokenLatencyMs = Date.now() - startTime;
            accumulatedText += parsed.response;
          }
          if (parsed.done) {
            doneReason = parsed.done_reason || 'stop';
            evalCount = parsed.eval_count || 0;
          }
        } catch {}
      }
    }

    // Flush decoder
    buffer += decoder.decode();
    if (buffer.trim()) {
      try {
        const parsed = JSON.parse(buffer.trim());
        if (parsed.response) accumulatedText += parsed.response;
        if (parsed.done) doneReason = parsed.done_reason || doneReason;
      } catch {}
    }

    const totalTimeMs = Date.now() - startTime;
    console.log(`Latency: TTFT = ${firstTokenLatencyMs}ms, Total = ${totalTimeMs}ms, Tokens = ${evalCount}`);
    console.log(`Done reason: ${doneReason}`);

    // Parse using the updated parser
    const answer = parseStreamingAnswer(accumulatedText, item.q, 'coding', doneReason);

    console.log(`\nParsed Answer Structure:`);
    console.log(`- Summary (${answer.summary.length} chars):\n  "${answer.summary.replace(/\n/g, ' ')}"`);
    if (answer.codeSnippet) {
      console.log(`- Code Snippet (${answer.codeSnippet.language}):\n${answer.codeSnippet.code}`);
    }
    if (answer.bullets && answer.bullets.length > 0) {
      console.log(`- Bullets (${answer.bullets.length}): ${JSON.stringify(answer.bullets)}`);
    }

    // Assertions
    const trimmedSummary = answer.summary.trim();
    const endsWithPunctuation = /[.!?]"?`?$/.test(trimmedSummary) || (answer.codeSnippet !== undefined);
    const hasDanglingEllipsis = trimmedSummary.endsWith('...') || answer.rawText?.endsWith('...');

    console.log(`\nValidation:`);
    console.log(`- TTFT <= 600ms: ${firstTokenLatencyMs <= 600 ? '✅' : '⚠️'} (${firstTokenLatencyMs}ms)`);
    console.log(`- Completed with done_reason === 'stop': ${doneReason === 'stop' ? '✅' : '❌'}`);
    console.log(`- Finished all sentences (terminal punctuation): ${endsWithPunctuation ? '✅' : '❌'}`);
    console.log(`- Zero dangling ellipses (...): ${!hasDanglingEllipsis ? '✅' : '❌'}`);
    console.log(`- Not flagged as isIncomplete: ${!answer.isIncomplete ? '✅' : '❌'}`);

    if (doneReason !== 'stop') {
      console.error(`❌ FAIL: Model did not finish naturally (done_reason: ${doneReason})`);
      allPassed = false;
    }
    if (!endsWithPunctuation) {
      console.error(`❌ FAIL: Answer does not end with terminal punctuation!`);
      allPassed = false;
    }
    if (hasDanglingEllipsis) {
      console.error(`❌ FAIL: Answer ends with dangling ellipsis!`);
      allPassed = false;
    }
    if (answer.isIncomplete) {
      console.error(`❌ FAIL: Answer unexpectedly marked as incomplete!`);
      allPassed = false;
    }
  }

  console.log(`\n================================================================`);
  if (allPassed) {
    console.log('🎉 ALL PIPELINE TRUNCATION TESTS PASSED SUCCESSFULLY!');
  } else {
    console.log('❌ SOME PIPELINE TESTS FAILED.');
    process.exit(1);
  }
  console.log('================================================================\n');
}

runPipelineTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
