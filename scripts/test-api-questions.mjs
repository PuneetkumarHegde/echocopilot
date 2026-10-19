async function testApi() {
  const url = 'http://localhost:3000/api/copilot';

  const questions = [
    'What is polymorphism in Java?',
    'What is the difference between an array and ArrayList?'
  ];

  for (const q of questions) {
    console.log(`\n======================================================`);
    console.log(`TESTING QUESTION: "${q}"`);
    console.log(`======================================================`);

    const t0 = Date.now();
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: q,
        mode: 'coding'
      })
    });

    const elapsed = Date.now() - t0;
    console.log(`Status: ${resp.status} (took ${elapsed}ms)`);
    
    if (!resp.ok) {
      const errText = await resp.text();
      console.error('Error response:', errText);
      continue;
    }

    const data = await resp.json();
    console.log(`Source: ${data.source} (Model: ${data.model || 'built-in'})`);
    console.log('Answer ID:', data.answer?.id);
    console.log('Summary:', data.answer?.summary);
    console.log('Spoken Script:', data.answer?.spokenScript);
    console.log('Bullets:', data.answer?.bullets);
    if (data.answer?.codeSnippet) {
      console.log('Code Snippet Language:', data.answer.codeSnippet.language);
      console.log('Code Snippet:', data.answer.codeSnippet.code);
    }
    if (data.answer?.tradeoffs) {
      console.log('Trade-offs:', data.answer.tradeoffs);
    }
  }
}

testApi().catch(console.error);
