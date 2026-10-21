/**
 * Comprehensive verification script for EchoCopilot Real-Time Improvements.
 * Tests:
 * 1. Lightweight NLP question detection (Statements, greetings, topic transitions, genuine questions)
 * 2. Speech fragment merging (removing duplicate overlapping words across chunks)
 * 3. Context tracking & follow-up interpretation ("Why?", "What about the alternative?")
 * 4. In-flight generation superseding & cancellation logic
 * 5. Prompt adherence to the 5 Mandatory Answer Structure Rules
 * 6. Live Ollama generation verifying:
 *    - Definition starts with direct answer in sentence 1
 *    - Difference states main difference immediately
 *    - How/Why gives direct answer first
 *    - Follow-up directly answers using context
 *    - Fast streaming TTFT (<1000ms)
 */

import { 
  classifyUtterance, 
  mergeSpeechFragments, 
  ConversationContextTracker, 
  isNewIndependentQuestion 
} from '../src/lib/questionClassifier';
import { buildQuestionSpecificPrompt, parseStreamingAnswer } from '../src/lib/aiFallback';

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

async function runTests() {
  console.log('\n=== TEST 1: Question Detection & Statement Rejection ===');
  
  // 1A. Topic transitions that MUST NOT trigger Ollama
  const transition1 = classifyUtterance("Now let's discuss JavaScript");
  assert(!transition1.isQuestion && transition1.intent === 'TOPIC_TRANSITION', 
    `"Now let's discuss JavaScript" -> Rejected as ${transition1.intent} (${transition1.reason})`);

  const transition2 = classifyUtterance("Let's move on to the next question");
  assert(!transition2.isQuestion && transition2.intent === 'TOPIC_TRANSITION', 
    `"Let's move on to the next question" -> Rejected as ${transition2.intent}`);

  const transition3 = classifyUtterance("Next let's talk about database indexing");
  assert(!transition3.isQuestion && transition3.intent === 'TOPIC_TRANSITION', 
    `"Next let's talk about database indexing" -> Rejected as ${transition3.intent}`);

  // 1B. Acknowledgements & Backchanneling
  const ack1 = classifyUtterance("Okay, got it.");
  assert(!ack1.isQuestion && ack1.intent === 'ACKNOWLEDGEMENT', 
    `"Okay, got it." -> Rejected as ${ack1.intent}`);

  const ack2 = classifyUtterance("Makes sense");
  assert(!ack2.isQuestion && ack2.intent === 'ACKNOWLEDGEMENT', 
    `"Makes sense" -> Rejected as ${ack2.intent}`);

  // 1C. Greetings & Banter
  const greeting1 = classifyUtterance("Hello, can you hear me?");
  assert(!greeting1.isQuestion && greeting1.intent === 'GREETING_OR_BANTER', 
    `"Hello, can you hear me?" -> Rejected as ${greeting1.intent}`);

  // 1D. Candidate Declarative Statements
  const stmt1 = classifyUtterance("I have worked with React and TypeScript for 4 years");
  assert(!stmt1.isQuestion && stmt1.intent === 'STATEMENT', 
    `"I have worked with React..." -> Rejected as ${stmt1.intent}`);

  // 1E. Genuine Complete Questions
  const qDirect = classifyUtterance("What is a closure in JavaScript?");
  assert(qDirect.isQuestion && qDirect.category === 'DIRECT', 
    `"What is a closure in JavaScript?" -> Accepted as GENUINE_QUESTION, Category: ${qDirect.category}`);

  const qDiff = classifyUtterance("What is the difference between var, let, and const?");
  assert(qDiff.isQuestion && qDiff.category === 'DIFFERENCE', 
    `"What is the difference between..." -> Accepted as GENUINE_QUESTION, Category: ${qDiff.category}`);

  const qHowWhy = classifyUtterance("How does the Node.js event loop handle asynchronous I/O?");
  assert(qHowWhy.isQuestion && qHowWhy.category === 'HOW_WHY', 
    `"How does the Node.js event loop..." -> Accepted as GENUINE_QUESTION, Category: ${qHowWhy.category}`);

  console.log('\n=== TEST 2: Speech Fragment Merging across Chunks ===');
  
  // Test joining chunks with overlapping repeated words
  const chunkA = "What is the difference";
  const chunkB = "difference between var and let in JavaScript";
  const mergedAB = mergeSpeechFragments(chunkA, chunkB);
  assert(mergedAB === "What is the difference between var and let in JavaScript" || mergedAB === "What is the difference between var and let in JavaScript?", 
    `Merged chunks with overlap -> "${mergedAB}"`);

  // Test joining contiguous non-overlapping chunks
  const chunkC = "Can you explain";
  const chunkD = "how B-tree indexes improve database queries?";
  const mergedCD = mergeSpeechFragments(chunkC, chunkD);
  assert(mergedCD === "Can you explain how B-tree indexes improve database queries?", 
    `Merged consecutive chunks -> "${mergedCD}"`);

  // Test incomplete trailing fragment detection
  const incompleteFragment = classifyUtterance("What is the difference between");
  assert(!incompleteFragment.isQuestion && incompleteFragment.intent === 'INCOMPLETE_FRAGMENT', 
    `Incomplete trailing word "between" flagged as ${incompleteFragment.intent}`);

  console.log('\n=== TEST 3: Context Tracking & Follow-up Interpretation ===');
  
  const tracker = new ConversationContextTracker(5);
  tracker.recordTurn(
    "What is the difference between process and thread?", 
    "A process is an isolated execution instance with its own memory space, whereas threads share the process virtual address space.",
    "DIFFERENCE"
  );

  const followUp1 = tracker.resolveContextualPrompt("Why?");
  assert(followUp1.isFollowUp && followUp1.category === 'FOLLOW_UP', 
    `"Why?" resolved as follow-up: isFollowUp=${followUp1.isFollowUp}`);
  assert(followUp1.enrichedPrompt.includes("process and thread"), 
    `Enriched prompt retains parent context: "${followUp1.enrichedPrompt.substring(0, 90)}..."`);

  const followUp2 = tracker.resolveContextualPrompt("What about the alternative?");
  assert(followUp2.isFollowUp && followUp2.category === 'FOLLOW_UP', 
    `"What about the alternative?" resolved with parent context.`);

  console.log('\n=== TEST 4: New-Question Handling & In-Flight Cancellation ===');
  
  // Same question -> do not cancel
  const sameCheck = isNewIndependentQuestion("What is Redis?", "What is Redis?");
  assert(!sameCheck.shouldCancel, `Identical question does not cancel: ${sameCheck.reason}`);

  // Query extension -> supersedes partial
  const extensionCheck = isNewIndependentQuestion("What is Redis caching and how does it work?", "What is Redis");
  assert(extensionCheck.shouldCancel, `Extended question supersedes partial: ${extensionCheck.reason}`);

  // Completely new independent question arriving during generation
  const newQuestionCheck = isNewIndependentQuestion(
    "Explain CAP theorem in distributed systems", 
    "What is a closure in JavaScript?"
  );
  assert(newQuestionCheck.shouldCancel, 
    `New independent question cancels in-flight answer: ${newQuestionCheck.reason}`);

  console.log('\n=== TEST 5: Prompt Adherence to Mandatory Answer Rules ===');
  
  const directPrompt = buildQuestionSpecificPrompt("What is a checked exception?", "coding");
  assert(directPrompt.category === 'DIRECT', `Direct prompt category: ${directPrompt.category}`);
  assert(directPrompt.systemPrompt.includes("RULE 1 (ANSWER THE EXACT QUESTION FIRST)"), `Prompt enforces Rule 1`);
  assert(directPrompt.systemPrompt.includes("RULE 2 (SHORT EXPLANATION AFTER DEFINITION)"), `Prompt enforces Rule 2`);
  assert(directPrompt.systemPrompt.includes("RULE 3 (DIFFERENCE QUESTIONS)"), `Prompt enforces Rule 3`);
  assert(directPrompt.systemPrompt.includes("RULE 4 (MATCH ANSWER LENGTH TO QUESTION)"), `Prompt enforces Rule 4`);
  assert(directPrompt.systemPrompt.includes("RULE 5 (ACCURACY BEFORE FLUENCY)"), `Prompt enforces Rule 5`);

  const diffPrompt = buildQuestionSpecificPrompt("What is the difference between checked and unchecked exceptions?", "general");
  assert(diffPrompt.category === 'DIFFERENCE', `Diff prompt category: ${diffPrompt.category}`);
  assert(diffPrompt.systemPrompt.includes("State the primary difference immediately"), `Difference prompt requires immediate main difference`);

  const howWhyPrompt = buildQuestionSpecificPrompt("How does the JVM handle exceptions?", "general");
  assert(howWhyPrompt.category === 'HOW_WHY', `How/Why prompt category: ${howWhyPrompt.category}`);
  assert(howWhyPrompt.systemPrompt.includes("Direct answer stating the mechanism or core reason first"), `How/Why requires direct answer first`);

  console.log('\n=== TEST 6: Live Ollama Answer Structure Verification ===');
  
  try {
    // Ensure model is pre-warmed in VRAM
    console.log(`  Pre-warming local Ollama model in VRAM (keep_alive: -1)...`);
    await fetch('http://127.0.0.1:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'qwen2.5:3b',
        prompt: '',
        options: { num_gpu: 99 },
        keep_alive: -1
      })
    }).catch(() => {});

    // 6A. Test Definition Question Structure (Rule 1 & Rule 2)
    const testDef = "What is a checked exception?";
    console.log(`\n  [6A] Testing Definition: "${testDef}"`);
    const pDef = buildQuestionSpecificPrompt(testDef, 'general');
    const startDef = Date.now();
    let ttftDef: number | null = null;
    let textDef = '';

    const resDef = await fetch('http://127.0.0.1:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'qwen2.5:3b',
        prompt: `${pDef.systemPrompt}\n\nCandidate Question: ${pDef.userPrompt}`,
        stream: true,
        options: { num_gpu: 99, num_predict: 120, temperature: 0.1 },
        keep_alive: -1
      })
    });

    if (resDef.ok && resDef.body) {
      const reader = resDef.body.getReader();
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
            const p = JSON.parse(line);
            if (p.response) {
              if (ttftDef === null) ttftDef = Date.now() - startDef;
              textDef += p.response;
            }
          } catch {}
        }
      }
    }

    const cleanDef = textDef.trim();
    console.log(`  Output: "${cleanDef}"`);
    console.log(`  TTFT: ${ttftDef}ms`);
    assert(ttftDef !== null && ttftDef < 1000, `Definition TTFT is sub-second (${ttftDef}ms)`);
    
    // Verify Rule 1: First sentence directly defines checked exception
    const firstSentenceDef = cleanDef.split(/[.!?]\s+/)[0].toLowerCase();
    const definesChecked = firstSentenceDef.includes('checked exception') && 
      (firstSentenceDef.includes('compiler') || firstSentenceDef.includes('catch') || firstSentenceDef.includes('throws') || firstSentenceDef.includes('compile time'));
    assert(definesChecked, `Definition begins directly with response: "${firstSentenceDef}"`);

    // Verify Rule 1: No filler or preambles
    const noPreamble = !cleanDef.startsWith('In an interview') && 
                       !cleanDef.startsWith("Let's understand") && 
                       !cleanDef.startsWith('Sure') &&
                       !cleanDef.startsWith('**Direct Answer:**');
    assert(noPreamble, `No meta-preambles or conversational filler at start`);

    // 6B. Test Difference Question Structure (Rule 3)
    const testDiff = "What is the difference between checked and unchecked exceptions?";
    console.log(`\n  [6B] Testing Difference: "${testDiff}"`);
    const pDiff = buildQuestionSpecificPrompt(testDiff, 'general');
    const resDiff = await fetch('http://127.0.0.1:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'qwen2.5:3b',
        prompt: `${pDiff.systemPrompt}\n\nCandidate Question: ${pDiff.userPrompt}`,
        stream: false,
        options: { num_gpu: 99, num_predict: 180, temperature: 0.1 },
        keep_alive: -1
      })
    });
    const dataDiff = await resDiff.json();
    const cleanDiff = (dataDiff.response || '').trim();
    console.log(`  Output: "${cleanDiff}"`);

    const firstSentenceDiff = cleanDiff.split(/[.!?]\s+/)[0].toLowerCase();
    const statesDifference = (firstSentenceDiff.includes('difference') || 
                              firstSentenceDiff.includes('while') || 
                              firstSentenceDiff.includes('whereas') || 
                              firstSentenceDiff.includes('checked')) && 
      (firstSentenceDiff.includes('checked') || firstSentenceDiff.includes('compile') || firstSentenceDiff.includes('handle') || firstSentenceDiff.includes('declare'));
    assert(statesDifference, `Difference begins by stating main difference immediately: "${firstSentenceDiff}"`);

    // Check that both concepts and practical examples are present
    const hasBothConcepts = cleanDiff.toLowerCase().includes('checked') && 
                           cleanDiff.toLowerCase().includes('unchecked');
    assert(hasBothConcepts, `Difference explains both checked and unchecked concepts`);

    // 6C. Test How/Why Question Structure (Rule 4)
    const testHowWhy = "How does the JVM handle exceptions?";
    console.log(`\n  [6C] Testing How/Why: "${testHowWhy}"`);
    const pHowWhy = buildQuestionSpecificPrompt(testHowWhy, 'general');
    const resHowWhy = await fetch('http://127.0.0.1:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'qwen2.5:3b',
        prompt: `${pHowWhy.systemPrompt}\n\nCandidate Question: ${pHowWhy.userPrompt}`,
        stream: false,
        options: { num_gpu: 99, num_predict: 140, temperature: 0.1 },
        keep_alive: -1
      })
    });
    const dataHowWhy = await resHowWhy.json();
    const cleanHowWhy = (dataHowWhy.response || '').trim();
    console.log(`  Output: "${cleanHowWhy}"`);
    const firstSentenceHowWhy = cleanHowWhy.split(/[.!?]\s+/)[0].toLowerCase();
    const answersMechanism = firstSentenceHowWhy.includes('jvm') && 
      (firstSentenceHowWhy.includes('handle') || firstSentenceHowWhy.includes('exception') || firstSentenceHowWhy.includes('mechanism') || firstSentenceHowWhy.includes('throw'));
    assert(answersMechanism, `How/Why begins directly with the mechanism: "${firstSentenceHowWhy}"`);

    // 6D. Test Follow-Up Structure (Rule 4)
    console.log(`\n  [6D] Testing Follow-Up Resolution`);
    const tracker = new ConversationContextTracker(5);
    tracker.recordTurn(
      "What is the difference between checked and unchecked exceptions?",
      "Checked exceptions are verified by the compiler and must be declared or caught, whereas unchecked exceptions are RuntimeException subclasses that occur at runtime.",
      "DIFFERENCE"
    );
    const resolvedFollowUp = tracker.resolveContextualPrompt("Why are unchecked exceptions not checked at compile time?");
    const pFollowUp = buildQuestionSpecificPrompt(resolvedFollowUp.enrichedPrompt, 'general', 'FOLLOW_UP');
    const resFollowUp = await fetch('http://127.0.0.1:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'qwen2.5:3b',
        prompt: `${pFollowUp.systemPrompt}\n\nCandidate Question: ${pFollowUp.userPrompt}`,
        stream: false,
        options: { num_gpu: 99, num_predict: 140, temperature: 0.1 },
        keep_alive: -1
      })
    });
    const dataFollowUp = await resFollowUp.json();
    const cleanFollowUp = (dataFollowUp.response || '').trim();
    console.log(`  Output: "${cleanFollowUp}"`);
    const firstSentenceFollowUp = cleanFollowUp.split(/[.!?]\s+/)[0].toLowerCase();
    const answersFollowUp = firstSentenceFollowUp.includes('unchecked') || 
                            firstSentenceFollowUp.includes('runtime') || 
                            firstSentenceFollowUp.includes('compile');
    assert(answersFollowUp, `Follow-up begins directly answering the why: "${firstSentenceFollowUp}"`);

  } catch (err: any) {
    console.warn('  [WARN] Ollama live testing failed:', err.message);
  }

  console.log(`\n========================================`);
  console.log(`Summary: ${passed} PASSED, ${failed} FAILED`);
  console.log(`========================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
