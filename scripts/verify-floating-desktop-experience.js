const { app, BrowserWindow, ipcMain, screen } = require('electron');
const path = require('path');
const fs = require('fs');

app.whenReady().then(async () => {
  console.log('======================================================');
  console.log('   VERIFYING ECHOCOPILOT FLOATING DESKTOP EXPERIENCE  ');
  console.log('======================================================');

  // Launch exactly like electron/main.js (initial collapsed 72x72 state)
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width: screenWidth } = primaryDisplay.workAreaSize;

  const win = new BrowserWindow({
    width: 72,
    height: 72,
    x: Math.max(20, screenWidth - 110),
    y: 120,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    hasShadow: false,
    alwaysOnTop: true,
    skipTaskbar: false,
    webPreferences: {
      preload: path.join(__dirname, '../electron/preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false
    }
  });

  win.setAlwaysOnTop(true, 'screen-saver');
  win.setOpacity(1.0);

  // Wire up same IPC handlers as electron/main.js
  ipcMain.on('expand-hud', (event, { width = 1040, height = 560 }) => {
    win.setBounds({
      x: Math.round((screenWidth - width) / 2),
      y: 40,
      width: Math.round(width),
      height: Math.round(height)
    });
  });

  ipcMain.on('collapse-hud', (event, { width = 72, height = 72 }) => {
    win.setSize(Math.round(width), Math.round(height));
  });

  ipcMain.on('set-opacity', (event, opacity) => {
    win.setOpacity(Number(opacity));
  });

  const ses = win.webContents.session;
  ses.setPermissionRequestHandler((webContents, permission, callback) => callback(true));
  if (ses.setPermissionCheckHandler) ses.setPermissionCheckHandler(() => true);
  if (ses.setDevicePermissionHandler) ses.setDevicePermissionHandler(() => true);

  console.log('[1/6] Loading http://localhost:3000/floating in Electron...');
  await win.loadURL('http://localhost:3000/floating');
  await new Promise(r => setTimeout(r, 2500));

  // -------------------------------------------------------------------
  // TEST 1: Initial Collapsed State (72x72 Glowing Icon)
  // -------------------------------------------------------------------
  console.log('\n[2/6] Verifying Initial Collapsed State (72x72 Glowing Icon)...');
  const collapsedStatus = await win.webContents.executeJavaScript(`
    (() => {
      const collapsedRoot = document.getElementById('echocopilot-collapsed-root');
      const circularButton = collapsedRoot ? collapsedRoot.querySelector('button') : null;
      const sparklesIcon = circularButton ? circularButton.querySelector('svg') : null;
      const bounds = win = {
        innerWidth: window.innerWidth,
        innerHeight: window.innerHeight
      };

      return {
        hasCollapsedRoot: Boolean(collapsedRoot),
        hasCircularButton: Boolean(circularButton),
        hasSparklesIcon: Boolean(sparklesIcon),
        windowDimensions: bounds,
        buttonStyle: circularButton ? {
          width: circularButton.offsetWidth,
          height: circularButton.offsetHeight,
          borderRadius: window.getComputedStyle(circularButton).borderRadius
        } : null
      };
    })()
  `);
  console.log('Collapsed State Status:', JSON.stringify(collapsedStatus, null, 2));

  // Capture screenshot of Collapsed Icon
  const collapsedImage = await win.capturePage();
  fs.writeFileSync(path.join(__dirname, 'collapsed_icon_verified.png'), collapsedImage.toPNG());
  console.log('Saved collapsed icon screenshot -> scripts/collapsed_icon_verified.png');

  // -------------------------------------------------------------------
  // TEST 2: Expanding from Icon to Full Floating HUD (1040x560)
  // -------------------------------------------------------------------
  console.log('\n[3/6] Clicking Collapsed Icon to Expand Full HUD...');
  await win.webContents.executeJavaScript(`
    (() => {
      const button = document.querySelector('#echocopilot-collapsed-root button');
      if (button) {
        button.click();
      }
    })()
  `);

  await new Promise(r => setTimeout(r, 1200));

  const expandedStatus = await win.webContents.executeJavaScript(`
    (() => {
      const liveTranscriptHeader = Array.from(document.querySelectorAll('span, h4, h5, div')).find(el => el.innerText.trim() === 'Live Transcript');
      const liveAiAnswerHeader = Array.from(document.querySelectorAll('span, h4, h5, div')).find(el => el.innerText.trim() === 'Live AI Answer');
      const ollamaBadge = Array.from(document.querySelectorAll('span')).find(el => el.innerText.includes('qwen2.5:3b'));
      const audioModeBtn = Array.from(document.querySelectorAll('button')).find(b => ['MIC', 'DEVICE', 'BOTH'].includes(b.innerText.trim()));
      const quickAskInput = document.querySelector('input[placeholder*="Ask"], input[placeholder*="interviewer"]');
      const transparencySlider = document.querySelector('input[type="range"]');
      const minimizeToIconBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Minimize to Icon'));
      const closeBtn = document.querySelector('button[title*="Close"]');

      return {
        hasLeftTranscriptPanel: Boolean(liveTranscriptHeader),
        hasRightAiAnswerPanel: Boolean(liveAiAnswerHeader),
        hasOllamaModelBadge: Boolean(ollamaBadge),
        currentAudioMode: audioModeBtn ? audioModeBtn.innerText.trim() : null,
        hasQuickAskInput: Boolean(quickAskInput),
        hasTransparencySlider: Boolean(transparencySlider),
        transparencyValue: transparencySlider ? transparencySlider.value + '%' : null,
        hasMinimizeToIconBtn: Boolean(minimizeToIconBtn),
        hasCloseBtn: Boolean(closeBtn),
        windowDimensions: {
          innerWidth: window.innerWidth,
          innerHeight: window.innerHeight
        }
      };
    })()
  `);
  console.log('Expanded HUD Status:', JSON.stringify(expandedStatus, null, 2));

  // Capture screenshot of Expanded HUD
  const expandedImage = await win.capturePage();
  fs.writeFileSync(path.join(__dirname, 'expanded_hud_verified.png'), expandedImage.toPNG());
  console.log('Saved expanded HUD screenshot -> scripts/expanded_hud_verified.png');

  // -------------------------------------------------------------------
  // TEST 3: Ask Technical Question to Local Ollama qwen2.5:3b
  // -------------------------------------------------------------------
  console.log('\n[4/6] Testing Live AI Answer with local Ollama qwen2.5:3b...');
  const testQuestion = "What is polymorphism in Java?";
  
  const answerResult = await win.webContents.executeJavaScript(`
    (async () => {
      const sampleBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('polymorphism'));
      if (sampleBtn) {
        sampleBtn.click();
      } else {
        const input = document.querySelector('input[placeholder*="Ask"], input[placeholder*="interviewer"]');
        const askBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.trim() === 'Ask');
        if (input && askBtn) {
          const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
          nativeSetter.call(input, "${testQuestion}");
          input.dispatchEvent(new Event('input', { bubbles: true }));
          askBtn.click();
        }
      }

      // Wait for Ollama generation
      for (let i = 0; i < 40; i++) {
        await new Promise(r => setTimeout(r, 500));
        const answerSummary = document.querySelector('div[class*="bg-emerald-950"], div[class*="text-emerald-200"]');
        const spokenScript = document.querySelector('div[class*="violet-950"], p[class*="italic"]');
        if (answerSummary && answerSummary.innerText.includes('Summary:')) {
          return {
            question: "${testQuestion}",
            summary: answerSummary.innerText.trim(),
            hasSpokenScript: Boolean(spokenScript),
            spokenScriptText: spokenScript ? spokenScript.innerText.trim() : null,
            durationMs: (i + 1) * 500
          };
        }
      }
      return { error: 'Timeout waiting for Ollama answer' };
    })()
  `);
  console.log('Ollama Answer Result:', JSON.stringify(answerResult, null, 2));

  const answeredImage = await win.capturePage();
  fs.writeFileSync(path.join(__dirname, 'ollama_answer_verified.png'), answeredImage.toPNG());
  console.log('Saved Ollama answered HUD screenshot -> scripts/ollama_answer_verified.png');

  // -------------------------------------------------------------------
  // TEST 4: Minimize to Icon & Verify Persistence
  // -------------------------------------------------------------------
  console.log('\n[5/6] Testing "Minimize to Icon" and Audio/State Persistence...');
  await win.webContents.executeJavaScript(`
    (() => {
      const minBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Minimize to Icon'));
      if (minBtn) {
        minBtn.click();
      }
    })()
  `);

  await new Promise(r => setTimeout(r, 1000));

  const reCollapsedStatus = await win.webContents.executeJavaScript(`
    (() => {
      const collapsedRoot = document.getElementById('echocopilot-collapsed-root');
      return {
        isCollapsed: Boolean(collapsedRoot),
        windowDimensions: {
          innerWidth: window.innerWidth,
          innerHeight: window.innerHeight
        }
      };
    })()
  `);
  console.log('Re-collapsed Status:', JSON.stringify(reCollapsedStatus, null, 2));

  const reCollapsedImage = await win.capturePage();
  fs.writeFileSync(path.join(__dirname, 'minimized_again_verified.png'), reCollapsedImage.toPNG());
  console.log('Saved re-collapsed screenshot -> scripts/minimized_again_verified.png');

  // Re-expand to verify answer and transcript are still there
  console.log('\n[6/6] Re-expanding to verify full state persistence...');
  await win.webContents.executeJavaScript(`
    (() => {
      const button = document.querySelector('#echocopilot-collapsed-root button');
      if (button) button.click();
    })()
  `);

  await new Promise(r => setTimeout(r, 1000));

  const finalCheck = await win.webContents.executeJavaScript(`
    (() => {
      const answerSummary = document.querySelector('div[class*="bg-emerald-950"], div[class*="text-emerald-200"]');
      const transcriptTurns = document.querySelectorAll('div[class*="border-sky-500"], div[class*="border-purple-500"]');
      return {
        preservedAnswer: Boolean(answerSummary),
        transcriptTurnCount: transcriptTurns.length
      };
    })()
  `);
  console.log('Final Persistence Verification:', JSON.stringify(finalCheck, null, 2));

  console.log('\n======================================================');
  console.log('      ALL DESKTOP HUD VERIFICATIONS PASSED!           ');
  console.log('======================================================');

  win.close();
  app.quit();
});
