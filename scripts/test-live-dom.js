const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width: 1040,
    height: 620,
    show: false,
    backgroundColor: '#0a0e17',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, '../electron/preload.js')
    }
  });

  await win.loadURL('http://localhost:3000/floating');
  await new Promise(r => setTimeout(r, 2000));

  // Switch to BOTH mode to show the manual input, type question and click Ask
  const domRes = await win.webContents.executeJavaScript(`
    (async () => {
      // 1. Click BOTH button
      const buttons = Array.from(document.querySelectorAll('button'));
      const bothBtn = buttons.find(b => b.innerText.includes('BOTH'));
      if (bothBtn) bothBtn.click();
      
      await new Promise(r => setTimeout(r, 500));

      // 2. Find input and type question
      const input = document.querySelector('input[placeholder*="interviewer"]');
      if (!input) return { error: 'Input not found' };

      // Set value with React input setter
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      nativeInputValueSetter.call(input, 'How do you find the longest substring without repeating characters in Python?');
      input.dispatchEvent(new Event('input', { bubbles: true }));

      await new Promise(r => setTimeout(r, 300));

      // 3. Find and click Ask button
      const askBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Ask'));
      if (!askBtn) return { error: 'Ask button not found' };
      askBtn.click();

      // Wait 2.5s for /api/copilot to generate answer and update UI
      await new Promise(r => setTimeout(r, 2500));

      return {
        success: true,
        bodyText: document.body.innerText.substring(0, 600)
      };
    })()
  `);

  console.log('[LIVE DOM RESULT]:', domRes);

  // Capture screenshot
  const image = await win.capturePage();
  fs.writeFileSync('scripts/live_hud_answer.png', image.toPNG());
  console.log('[SAVED LIVE ANSWER SCREENSHOT]: scripts/live_hud_answer.png');

  win.close();
  app.quit();
});
