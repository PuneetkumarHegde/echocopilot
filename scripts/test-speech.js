const { app, BrowserWindow } = require('electron');

app.whenReady().then(async () => {
  const win = new BrowserWindow({ show: false });
  await win.loadURL('http://localhost:3000/floating');
  const result = await win.webContents.executeJavaScript(`
    new Promise((resolve) => {
      const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SpeechRec) return resolve({ supported: false });
      const rec = new SpeechRec();
      rec.onstart = () => console.log('SpeechRec started');
      rec.onerror = (e) => resolve({ supported: true, error: e.error, message: e.message });
      rec.onresult = () => resolve({ supported: true, result: true });
      try {
        rec.start();
        setTimeout(() => resolve({ supported: true, timeout: true }), 3000);
      } catch (err) {
        resolve({ supported: true, startError: err.message });
      }
    });
  `);
  console.log('[SPEECH TEST RESULT]:', JSON.stringify(result));
  win.close();
  app.quit();
});
