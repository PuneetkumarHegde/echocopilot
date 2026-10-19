const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width: 950,
    height: 700,
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, '../electron/preload.js')
    }
  });

  console.log('Loading http://localhost:3000/floating...');
  await win.loadURL('http://localhost:3000/floating');

  // Wait for React hydration
  await new Promise(r => setTimeout(r, 2000));

  console.log('Triggering Ollama answer generation for: "What is polymorphism in Java?"...');
  const result = await win.webContents.executeJavaScript(`
    (async () => {
      try {
        // Query /api/copilot directly from the floating HUD context
        const resp = await fetch('/api/copilot', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt: 'What is polymorphism in Java?',
            mode: 'coding'
          })
        });

        const data = await resp.json();
        if (!data || !data.answer) {
          return { error: 'No answer returned: ' + JSON.stringify(data) };
        }

        // Store into localStorage to hydrate state and post message
        localStorage.setItem('echocopilot_latest_answer', JSON.stringify(data.answer));

        // Also broadcast
        const bc = new BroadcastChannel('echocopilot_channel');
        bc.postMessage({ type: 'NEW_ANSWER', answer: data.answer });
        bc.close();

        // Also set on window for direct inspection
        window.__TEST_LATEST_ANSWER__ = data.answer;

        return { 
          success: true, 
          source: data.source,
          model: data.model,
          answer: data.answer 
        };
      } catch (err) {
        return { error: err.toString() };
      }
    })()
  `);

  console.log('Result from API inside HUD:', JSON.stringify(result, null, 2));

  // Reload page to let HUD render the saved answer from localStorage/state
  await win.loadURL('http://localhost:3000/floating');
  await new Promise(r => setTimeout(r, 2500));

  // Verify DOM content
  const domVerification = await win.webContents.executeJavaScript(`
    (() => {
      const bodyText = document.body.innerText;
      return {
        hasQuestion: bodyText.includes('What is polymorphism in Java?'),
        hasPolymorphism: bodyText.toLowerCase().includes('polymorphism'),
        hasSuperclass: bodyText.toLowerCase().includes('superclass') || bodyText.toLowerCase().includes('class') || bodyText.toLowerCase().includes('method'),
        hasSpokenScript: bodyText.toLowerCase().includes('spoken') || bodyText.toLowerCase().includes('how to say') || bodyText.toLowerCase().includes('script'),
        cardLength: bodyText.length
      };
    })()
  `);

  console.log('HUD DOM Verification:', JSON.stringify(domVerification, null, 2));

  // Take screenshot as proof
  const image = await win.webContents.capturePage();
  const screenshotPath = path.join(__dirname, 'ollama_hud_verified.png');
  fs.writeFileSync(screenshotPath, image.toPNG());
  console.log('Verification screenshot saved to:', screenshotPath);

  app.quit();
});
