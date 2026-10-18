const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width: 1040,
    height: 700,
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, '../electron/preload.js')
    }
  });

  await win.loadURL('http://localhost:3000/floating');
  await new Promise(r => setTimeout(r, 2000));

  const check = await win.webContents.executeJavaScript(`
    (async () => {
      // 1. Submit a prompt directly
      const input = document.querySelector('input');
      const form = document.querySelector('form');
      
      // Call onManualAnswer via window or trigger copilot fetch directly
      const copilotRes = await fetch('/api/copilot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: 'Explain the difference between TCP and UDP',
          mode: 'coding'
        })
      });
      const data = await copilotRes.json();
      
      // Broadcast answer to channel so page receives it
      const bc = new BroadcastChannel('echocopilot_channel');
      bc.postMessage({ type: 'NEW_ANSWER', answer: data.answer });
      bc.close();

      await new Promise(r => setTimeout(r, 1000));

      const answerCard = document.querySelector('h4');
      const cardRect = answerCard ? answerCard.getBoundingClientRect() : null;
      const allText = document.body.innerText;

      return {
        hasH4: !!answerCard,
        h4Text: answerCard ? answerCard.innerText : null,
        cardRect,
        bodySnippet: allText.substring(0, 500)
      };
    })()
  `);

  console.log('[GEOMETRY CHECK]:', JSON.stringify(check, null, 2));

  // Take screenshot of the window
  const img = await win.capturePage();
  fs.writeFileSync('scripts/geometry_screenshot.png', img.toPNG());
  console.log('[SAVED]: scripts/geometry_screenshot.png');

  win.close();
  app.quit();
});
