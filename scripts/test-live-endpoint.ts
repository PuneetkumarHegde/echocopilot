async function testEndpoint() {
  console.log('Testing live http://localhost:3000/api/copilot endpoint...');
  try {
    const res = await fetch('http://localhost:3000/api/copilot', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: 'What is the difference between var and let in JavaScript?',
        stream: true,
        category: 'DIFFERENCE'
      })
    });

    console.log('HTTP Status:', res.status, res.statusText);
    console.log('Content-Type:', res.headers.get('content-type'));

    if (res.ok && res.body) {
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let chunkCount = 0;
      let firstTokenMs = null;
      const startTime = Date.now();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.trim()) continue;
          chunkCount++;
          if (line.includes('event: first_token')) {
            firstTokenMs = Date.now() - startTime;
            console.log('  -> Received event: first_token!', line);
          } else if (line.includes('event: chunk')) {
            // print first couple chunks
            if (chunkCount <= 5) {
              console.log('  -> Received event: chunk:', line.substring(0, 80));
            }
          } else if (line.includes('event: done')) {
            console.log('  -> Received event: done!');
          }
        }
      }
      console.log(`Stream complete! Total events received: ${chunkCount}, First token latency: ${firstTokenMs}ms`);
    } else {
      console.log('Response text:', await res.text());
    }
  } catch (err: any) {
    console.warn('Endpoint error:', err.message);
  }
}

testEndpoint();
