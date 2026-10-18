const { app, BrowserWindow } = require('electron');
const fs = require('fs');

app.whenReady().then(async () => {
  // Non-transparent background window with dark slate background (simulating Windows desktop wallpaper)
  const win = new BrowserWindow({
    width: 1040,
    height: 700,
    show: false,
    backgroundColor: '#0f172a' // Slate desktop wallpaper color
  });

  await win.loadURL('http://localhost:3000/floating');
  await new Promise(r => setTimeout(r, 1000));

  await win.webContents.executeJavaScript(`
    new Promise(async (resolve) => {
      const res = await fetch('/api/copilot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: 'How do you implement a binary search tree in Python?', mode: 'coding' })
      });
      const data = await res.json();
      
      const bc = new BroadcastChannel('echocopilot_channel');
      setTimeout(resolve, 1000);
      bc.postMessage({ type: 'NEW_ANSWER', answer: data.answer });
      bc.close();
    })
  `);

  const img = await win.capturePage();
  fs.writeFileSync('scripts/rendered_against_wallpaper.png', img.toPNG());
  console.log('[SAVED WALLPAPER SCREENSHOT]: scripts/rendered_against_wallpaper.png');

  win.close();
  app.quit();
});
