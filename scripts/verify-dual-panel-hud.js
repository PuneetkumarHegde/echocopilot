const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width: 1040,
    height: 540,
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

  console.log('Loading http://localhost:3000/floating in Electron transparent dual-panel window...');
  await win.loadURL('http://localhost:3000/floating');
  await new Promise(r => setTimeout(r, 2500));

  // 1. Check Initial Dual-Panel HUD Structure
  console.log('\n======================================================');
  console.log('1. VERIFYING DUAL-PANEL HUD LAYOUT (SIMULTANEOUS VIEW)');
  console.log('======================================================');
  const initialHudStatus = await win.webContents.executeJavaScript(`
    (() => {
      const liveTranscriptHeader = Array.from(document.querySelectorAll('span, h4, h5, div')).find(el => el.innerText.trim() === 'Live Transcript');
      const liveAiAnswerHeader = Array.from(document.querySelectorAll('span, h4, h5, div')).find(el => el.innerText.trim() === 'Live AI Answer');
      const ollamaBadge = Array.from(document.querySelectorAll('span')).find(el => el.innerText.includes('qwen2.5:3b'));
      const modeBtn = Array.from(document.querySelectorAll('button')).find(b => ['MIC', 'DEVICE', 'BOTH'].includes(b.innerText.trim()));
      const quickAskInput = document.querySelector('input[placeholder*="Ask"], input[placeholder*="interviewer"]');

      return {
        hasLeftTranscriptPanel: Boolean(liveTranscriptHeader),
        hasRightAiAnswerPanel: Boolean(liveAiAnswerHeader),
        hasOllamaModelBadge: Boolean(ollamaBadge),
        currentAudioMode: modeBtn ? modeBtn.innerText.trim() : null,
        hasQuickAskInput: Boolean(quickAskInput)
      };
    })()
  `);
  console.log('Initial Dual-Panel HUD Status:', JSON.stringify(initialHudStatus, null, 2));

  // 2. Test Audio Pipeline with Real Audio & Ollama Answer
  console.log('\n======================================================');
  console.log('2. TESTING AUDIO PIPELINE -> TRANSCRIPT (LEFT) & OLLAMA (RIGHT)');
  console.log('======================================================');
  const sampleAudioBuffer = fs.readFileSync(path.join(__dirname, 'sample_question.wav'));
  const sampleAudioBase64 = sampleAudioBuffer.toString('base64');

  const livePipelineResult = await win.webContents.executeJavaScript(`
    (async () => {
      // 1. Transcribe WAV sample via SAPI /api/transcribe
      const byteCharacters = atob("${sampleAudioBase64}");
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const wavBlob = new Blob([new Uint8Array(byteNumbers)], { type: 'audio/wav' });

      const fd = new FormData();
      fd.append('audio', wavBlob, 'live_test.wav');
      fd.append('source', 'meeting');

      const transResp = await fetch('/api/transcribe', { method: 'POST', body: fd });
      const transData = await transResp.json();
      const questionText = transData.transcript || "What is polymorphism in Java?";

      // 2. Generate answer with Ollama qwen2.5:3b
      const copilotResp = await fetch('/api/copilot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: questionText, mode: 'coding' })
      });
      const copilotData = await copilotResp.json();

      // 3. Dispatch to HUD
      const bc = new BroadcastChannel('echocopilot_channel');
      const turn1 = {
        id: 'turn_interviewer_1',
        speaker: 'interviewer',
        source: 'meeting',
        text: questionText,
        timestamp: Date.now() - 5000,
        isFinal: true
      };
      const turn2 = {
        id: 'turn_candidate_2',
        speaker: 'candidate',
        source: 'mic',
        text: 'Polymorphism allows objects of different classes to be treated through a unified interface.',
        timestamp: Date.now(),
        isFinal: true
      };

      bc.postMessage({ type: 'NEW_TURN', turn: turn1 });
      bc.postMessage({ type: 'NEW_TURN', turn: turn2 });
      bc.postMessage({ type: 'NEW_ANSWER', answer: copilotData.answer });
      bc.close();

      return {
        transcription: transData,
        answerSource: copilotData.source,
        model: copilotData.model,
        summary: copilotData.answer?.summary,
        bulletsCount: copilotData.answer?.bullets?.length || 0,
        hasCode: Boolean(copilotData.answer?.codeSnippet)
      };
    })()
  `);
  console.log('Live Pipeline Execution Result:', JSON.stringify(livePipelineResult, null, 2));

  await new Promise(r => setTimeout(r, 1800));

  // 3. Verify DOM Contents of Both Panels Simultaneously
  console.log('\n======================================================');
  console.log('3. VERIFYING SIMULTANEOUS CONTENT ON LEFT & RIGHT PANELS');
  console.log('======================================================');
  const dualPanelContent = await win.webContents.executeJavaScript(`
    (() => {
      // Left Panel checks
      const interviewerTurn = Array.from(document.querySelectorAll('span')).find(s => s.innerText.includes('Interviewer'));
      const candidateTurn = Array.from(document.querySelectorAll('span')).find(s => s.innerText.includes('Candidate'));
      
      // Right Panel checks
      const summaryCallout = Array.from(document.querySelectorAll('div')).find(d => d.innerText.includes('Summary:'));
      const spokenScriptCard = Array.from(document.querySelectorAll('span')).find(s => s.innerText.includes('How to Say it Out Loud'));
      const keyPointsList = Array.from(document.querySelectorAll('span')).find(s => s.innerText.includes('Key Technical Points'));
      const codeBlock = document.querySelector('pre code');

      return {
        leftPanelHasInterviewerBadge: Boolean(interviewerTurn),
        leftPanelHasCandidateBadge: Boolean(candidateTurn),
        rightPanelHasSummary: Boolean(summaryCallout),
        rightPanelHasSpokenScript: Boolean(spokenScriptCard),
        rightPanelHasKeyPoints: Boolean(keyPointsList),
        rightPanelHasCodeSnippet: Boolean(codeBlock)
      };
    })()
  `);
  console.log('Simultaneous Content Verification:', JSON.stringify(dualPanelContent, null, 2));

  // 4. Verify React Hydration
  console.log('\n======================================================');
  console.log('4. VERIFYING REACT HYDRATION INTEGRITY');
  console.log('======================================================');
  console.log('Total Hydration Errors:', hydrationErrors.length);
  if (hydrationErrors.length > 0) {
    console.error('Hydration Errors:', hydrationErrors);
  } else {
    console.log('SUCCESS: Zero React hydration mismatch errors detected!');
  }

  // 5. Capture Verification Screenshot
  const image = await win.webContents.capturePage();
  const screenshotPath = path.join(__dirname, 'dual_panel_hud_verified.png');
  fs.writeFileSync(screenshotPath, image.toPNG());
  console.log(`\nScreenshot saved to: ${screenshotPath}`);

  app.quit();
});
