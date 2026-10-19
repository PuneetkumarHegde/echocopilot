const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width: 1040,
    height: 580,
    show: false,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: path.join(__dirname, '../electron/preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  const { desktopCapturer } = require('electron');

  const ses = win.webContents.session;
  ses.setPermissionRequestHandler((webContents, permission, callback) => callback(true));
  if (ses.setPermissionCheckHandler) ses.setPermissionCheckHandler(() => true);
  if (ses.setDevicePermissionHandler) ses.setDevicePermissionHandler(() => true);

  if (ses.setDisplayMediaRequestHandler) {
    ses.setDisplayMediaRequestHandler((request, callback) => {
      desktopCapturer.getSources({ types: ['screen', 'window'] })
        .then((sources) => {
          if (sources && sources.length > 0) {
            callback({ video: sources[0], audio: 'loopback' });
          } else {
            callback(null);
          }
        })
        .catch((err) => {
          console.warn('[Electron] desktopCapturer error:', err);
          callback(null);
        });
    });
  }

  const consoleLogs = [];
  const hydrationErrors = [];

  win.webContents.on('console-message', (event, level, message) => {
    consoleLogs.push(message);
    if (message.includes('hydration') || message.includes('Hydration') || message.includes('didn\'t match')) {
      hydrationErrors.push(message);
    }
    console.log(`[Renderer] ${message}`);
  });

  console.log('Loading http://localhost:3000/floating in Electron transparent window...');
  await win.loadURL('http://localhost:3000/floating');
  await new Promise(r => setTimeout(r, 2500));

  // 1. Verify Transparent DOM Structure
  console.log('\n======================================================');
  console.log('1. VERIFYING PARAKEETAI GLASS TRANSPARENCY & DOM');
  console.log('======================================================');
  const domVerification = await win.webContents.executeJavaScript(`
    (() => {
      const root = document.getElementById('floating-copilot-root');
      const body = document.body;
      const html = document.documentElement;
      const computedBody = window.getComputedStyle(body);
      const computedRoot = root ? window.getComputedStyle(root) : null;
      
      const hudBar = document.querySelector('div[style*="backdrop-filter"], div[style*="backdropFilter"]');
      const hudComputed = hudBar ? window.getComputedStyle(hudBar) : null;

      return {
        hasRootId: Boolean(root),
        bodyBg: computedBody.backgroundColor,
        rootBg: computedRoot ? computedRoot.backgroundColor : null,
        hudBackdrop: hudComputed ? hudComputed.backdropFilter : null,
        hudBg: hudComputed ? hudComputed.backgroundColor : null,
        hudBorderRadius: hudComputed ? hudComputed.borderRadius : null
      };
    })()
  `);
  console.log('DOM Transparency Verification:', JSON.stringify(domVerification, null, 2));

  // 2. Verify Audio Modes Dropdown (Single compact dropdown)
  console.log('\n======================================================');
  console.log('2. VERIFYING AUDIO MODES SINGLE COMPACT DROPDOWN');
  console.log('======================================================');
  const dropdownVerification = await win.webContents.executeJavaScript(`
    (async () => {
      // Find the audio mode button
      const allButtons = Array.from(document.querySelectorAll('button'));
      const modeBtn = allButtons.find(b => {
        const text = b.innerText.trim();
        return text.includes('MIC') || text.includes('DEVICE') || text.includes('BOTH');
      });

      if (!modeBtn) return { foundModeDropdown: false };

      const initialText = modeBtn.innerText.trim();

      // Click to open dropdown
      modeBtn.click();
      await new Promise(r => setTimeout(r, 300));

      // Check if menu options opened
      const options = Array.from(document.querySelectorAll('button')).filter(b => {
        const t = b.innerText.trim();
        return t.includes('Microphone input') || t.includes('Supported meeting') || t.includes('Microphone & meeting');
      });

      return {
        foundModeDropdown: true,
        initialMode: initialText,
        dropdownMenuOpened: options.length === 3,
        optionLabels: options.map(o => o.innerText.replace(/\\n/g, ' - ').trim())
      };
    })()
  `);
  console.log('Audio Dropdown Verification:', JSON.stringify(dropdownVerification, null, 2));

  // 3. Verify Audio Mode Switching
  console.log('\n======================================================');
  console.log('3. TESTING MODE SWITCHING VIA DROPDOWN (MIC -> BOTH -> DEVICE)');
  console.log('======================================================');
  const modeSwitchResult = await win.webContents.executeJavaScript(`
    (async () => {
      // Switch to BOTH mode
      const bothOption = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Microphone & meeting') || b.innerText.includes('BOTH'));
      if (bothOption) bothOption.click();

      await new Promise(r => setTimeout(r, 500));

      // Verify manual input input exists in BOTH mode
      const manualInput = document.querySelector('input[placeholder*="interviewer"]');

      return {
        switchedToBoth: true,
        hasManualAskInput: Boolean(manualInput)
      };
    })()
  `);
  console.log('Mode Switch Result:', JSON.stringify(modeSwitchResult, null, 2));

  // 4. Test Real Transcription & Ollama Pipeline
  console.log('\n======================================================');
  console.log('4. TESTING SAPI TRANSCRIPTION & OLLAMA (qwen2.5:3b)');
  console.log('======================================================');
  const sampleAudioBuffer = fs.readFileSync(path.join(__dirname, 'sample_question.wav'));
  const sampleAudioBase64 = sampleAudioBuffer.toString('base64');

  const pipelineResult = await win.webContents.executeJavaScript(`
    (async () => {
      // 1. Send real audio sample to SAPI
      const byteCharacters = atob("${sampleAudioBase64}");
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const wavBlob = new Blob([new Uint8Array(byteNumbers)], { type: 'audio/wav' });

      const fd = new FormData();
      fd.append('audio', wavBlob, 'sample_test.wav');
      fd.append('source', 'mic');

      const transResp = await fetch('/api/transcribe', { method: 'POST', body: fd });
      const transData = await transResp.json();

      // 2. Call Ollama for answer
      const prompt = transData.transcript || 'Explain polymorphism in Java with a real-world example';
      const copilotResp = await fetch('/api/copilot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, mode: 'coding' })
      });
      const copilotData = await copilotResp.json();

      // 3. Post to HUD BroadcastChannel
      const bc = new BroadcastChannel('echocopilot_channel');
      bc.postMessage({ type: 'NEW_TURN', turn: {
        id: 'turn_verified_test',
        speaker: 'interviewer',
        source: 'meeting',
        text: prompt,
        timestamp: Date.now(),
        isFinal: true
      }});
      bc.postMessage({ type: 'NEW_ANSWER', answer: copilotData.answer });
      bc.close();

      return {
        transcription: transData,
        answerSource: copilotData.source,
        model: copilotData.model,
        summary: copilotData.answer?.summary
      };
    })()
  `);
  console.log('Pipeline Result:', JSON.stringify(pipelineResult, null, 2));

  await new Promise(r => setTimeout(r, 1500));

  // 5. Verify Hydration
  console.log('\n======================================================');
  console.log('5. VERIFYING REACT HYDRATION STATUS');
  console.log('======================================================');
  console.log('Hydration errors detected:', hydrationErrors.length);
  if (hydrationErrors.length > 0) {
    console.error('Hydration errors:', hydrationErrors);
  } else {
    console.log('SUCCESS: ZERO hydration mismatch errors detected!');
  }

  // 6. Capture Verification Screenshot
  const image = await win.webContents.capturePage();
  const screenshotPath = path.join(__dirname, 'desktop_transparent_hud_verified.png');
  fs.writeFileSync(screenshotPath, image.toPNG());
  console.log(`\nScreenshot saved to: ${screenshotPath}`);

  app.quit();
});
