import { buildQuestionSpecificPrompt } from '../src/lib/aiFallback';

async function testTruncation() {
  const questions = [
    "What is the difference between a compiler and an interpreter?",
    "What is a checked exception in Java?",
    "What is the difference between a process and a thread?",
    "Explain method overloading with an example."
  ];

  for (const q of questions) {
    console.log(`\n======================================================`);
    console.log(`Testing Question: "${q}"`);
    console.log(`======================================================`);

    const p = buildQuestionSpecificPrompt(q, 'coding');

    const res = await fetch('http://127.0.0.1:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'qwen2.5:3b',
        prompt: `${p.systemPrompt}\n\nCandidate Question: ${p.userPrompt}`,
        stream: false,
        options: {
          num_gpu: 99,
          num_predict: 250,
          temperature: 0.1
        },
        keep_alive: -1
      })
    });

    const data = await res.json();
    const text = data.response || '';
    console.log(`Length: ${text.length} chars, eval_count: ${data.eval_count} tokens`);
    console.log(`Done Reason: ${data.done_reason}`);
    console.log(`Response:\n${text}`);
    
    // Check if ends with punctuation or cut off mid-sentence
    const endsWithTerminalPunctuation = /[.!?]"?$/.test(text.trim());
    console.log(`Ends with terminal punctuation: ${endsWithTerminalPunctuation}`);
  }
}

testTruncation().catch(console.error);
