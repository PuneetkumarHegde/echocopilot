const { app, BrowserWindow } = require('electron');
const fs = require('fs');

app.whenReady().then(async () => {
  const win = new BrowserWindow({ width: 1040, height: 700, show: false });
  await win.loadURL('http://localhost:3000/floating');
  await new Promise(r => setTimeout(r, 1000));

  const rect = await win.webContents.executeJavaScript(`
    new Promise(async (resolve) => {
      // Fetch an answer from /api/copilot
      const res = await fetch('/api/copilot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: 'Explain the difference between TCP and UDP', mode: 'coding' })
      });
      const data = await res.json();
      
      // Broadcast it via BroadcastChannel
      const bc = new BroadcastChannel('echocopilot_channel');
      // Wait for React to receive and render
      setTimeout(() => {
        const h4 = document.querySelector('h4');
        if (!h4) {
          resolve({ error: 'Still NO H4' });
          return;
        }
        const r = h4.getBoundingClientRect();
        resolve({ top: r.top, left: r.left, width: r.width, height: r.height, text: h4.innerText });
      }, 1000);

      bc.postMessage({ type: 'NEW_ANSWER', answer: data.answer });
      bc.close();
    })
  `);
  console.log('H4 RECT AFTER GENERATION:', rect);

  const img = await win.capturePage();
  fs.writeFileSync('scripts/rendered_h4_answer.png', img.toPNG());
  console.log('[SAVED SCREENSHOT]: scripts/rendered_h4_answer.png');

  win.close();
  app.quit();
});
