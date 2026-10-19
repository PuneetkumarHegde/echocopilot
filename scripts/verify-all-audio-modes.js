const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width: 1040,
    height: 650,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, '../electron/preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  win.webContents.on('console-message', (event, level, message) => {
    console.log(`[Renderer] ${message}`);
  });

  console.log('Loading http://localhost:3000/floating...');
  await win.loadURL('http://localhost:3000/floating');
  await new Promise(r => setTimeout(r, 2000));

  // Load real audio sample
  const sampleAudioBuffer = fs.readFileSync(path.join(__dirname, 'sample_question.wav'));
  const sampleAudioBase64 = sampleAudioBuffer.toString('base64');

  console.log('\n======================================================');
  console.log('TEST 1: TESTING MIC MODE WITH REAL SPEECH AUDIO');
  console.log('======================================================');

  const micTestResult = await win.webContents.executeJavaScript(`
    (async () => {
      try {
        // 1. Convert base64 back to Blob
        const byteCharacters = atob("${sampleAudioBase64}");
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const wavBlob = new Blob([byteArray], { type: 'audio/wav' });

        // 2. Select MIC mode and send chunk
        const fd = new FormData();
        fd.append('audio', wavBlob, 'mic_slice.wav');
        fd.append('source', 'mic');

        const transResp = await fetch('/api/transcribe', { method: 'POST', body: fd });
        const transData = await transResp.json();

        // 3. Request Ollama answer for transcribed question
        const prompt = transData.transcript || 'How do you find the longest substring without repeating characters in Python?';
        const copilotResp = await fetch('/api/copilot', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt, mode: 'coding' })
        });
        const copilotData = await copilotResp.json();

        // Broadcast to HUD state
        const bc = new BroadcastChannel('echocopilot_channel');
        bc.postMessage({ type: 'NEW_TURN', turn: {
          id: 'turn_mic_test',
          speaker: 'candidate',
          source: 'mic',
          text: prompt,
          timestamp: Date.now(),
          isFinal: true
        }});
        bc.postMessage({ type: 'NEW_ANSWER', answer: copilotData.answer });
        bc.close();

        localStorage.setItem('echocopilot_latest_answer', JSON.stringify(copilotData.answer));

        return {
          transcription: transData,
          answer: copilotData
        };
      } catch (err) {
        return { error: err.toString() };
      }
    })()
  `);

  console.log('MIC Mode Result:');
  console.log('Transcript:', micTestResult.transcription?.transcript);
  console.log('STT Provider:', micTestResult.transcription?.provider);
  console.log('AI Answer Source:', micTestResult.answer?.source);
  console.log('AI Answer Model:', micTestResult.answer?.model);
  console.log('AI Summary:', micTestResult.answer?.answer?.summary);

  console.log('\n======================================================');
  console.log('TEST 2: TESTING DEVICE MODE (MEETING AUDIO) WITH OLLAMA');
  console.log('======================================================');

  const deviceTestResult = await win.webContents.executeJavaScript(`
    (async () => {
      try {
        const prompt = 'What is the difference between an array and ArrayList?';
        const copilotResp = await fetch('/api/copilot', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt, mode: 'coding' })
        });
        const copilotData = await copilotResp.json();

        const bc = new BroadcastChannel('echocopilot_channel');
        bc.postMessage({ type: 'NEW_TURN', turn: {
          id: 'turn_device_test',
          speaker: 'interviewer',
          source: 'meeting',
          text: prompt,
          timestamp: Date.now(),
          isFinal: true
        }});
        bc.postMessage({ type: 'NEW_ANSWER', answer: copilotData.answer });
        bc.close();

        localStorage.setItem('echocopilot_latest_answer', JSON.stringify(copilotData.answer));

        return { answer: copilotData };
      } catch (err) {
        return { error: err.toString() };
      }
    })()
  `);

  console.log('DEVICE Mode Result:');
  console.log('AI Answer Source:', deviceTestResult.answer?.source);
  console.log('AI Answer Model:', deviceTestResult.answer?.model);
  console.log('AI Summary:', deviceTestResult.answer?.answer?.summary);

  console.log('\n======================================================');
  console.log('TEST 3: TESTING BOTH MODE (MANUAL ASK + SEPARATE CHANNELS)');
  console.log('======================================================');

  const bothTestResult = await win.webContents.executeJavaScript(`
    (async () => {
      try {
        const prompt = 'What is polymorphism in Java?';
        const copilotResp = await fetch('/api/copilot', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt, mode: 'coding' })
        });
        const copilotData = await copilotResp.json();

        const bc = new BroadcastChannel('echocopilot_channel');
        bc.postMessage({ type: 'NEW_ANSWER', answer: copilotData.answer });
        bc.close();

        localStorage.setItem('echocopilot_latest_answer', JSON.stringify(copilotData.answer));

        return { answer: copilotData };
      } catch (err) {
        return { error: err.toString() };
      }
    })()
  `);

  console.log('BOTH Mode Result:');
  console.log('AI Answer Source:', bothTestResult.answer?.source);
  console.log('AI Answer Model:', bothTestResult.answer?.model);
  console.log('AI Summary:', bothTestResult.answer?.answer?.summary);

  // Reload and inspect DOM in HUD
  console.log('\n======================================================');
  console.log('VERIFYING HUD DOM RENDERING');
  console.log('======================================================');
  await win.loadURL('http://localhost:3000/floating');
  await new Promise(r => setTimeout(r, 2000));

  const domCheck = await win.webContents.executeJavaScript(`
    (() => {
      const text = document.body.innerText;
      return {
        hasHeader: text.includes('EchoCopilot'),
        hasPolymorphism: text.toLowerCase().includes('polymorphism'),
        hasHowToSay: text.toLowerCase().includes('how to say'),
        hasCodeOrBullets: text.toLowerCase().includes('code') || text.toLowerCase().includes('expand'),
        textLength: text.length
      };
    })()
  `);

  console.log('HUD DOM Verification:', JSON.stringify(domCheck, null, 2));

  // Save screenshot
  const image = await win.webContents.capturePage();
  const shotPath = path.join(__dirname, 'pipeline_all_modes_verified.png');
  fs.writeFileSync(shotPath, image.toPNG());
  console.log('Screenshot saved to:', shotPath);

  app.quit();
});
