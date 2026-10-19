const { app, BrowserWindow } = require('electron');

app.whenReady().then(async () => {
  const win = new BrowserWindow({ show: false });
  win.webContents.session.setPermissionRequestHandler((wc, p, cb) => cb(true));
  win.webContents.session.setPermissionCheckHandler(() => true);
  await win.loadURL('http://localhost:3000/floating');
  const res = await win.webContents.executeJavaScript(`
    new Promise((resolve) => {
      const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SpeechRec) return resolve({ status: 'not_supported' });
      const rec = new SpeechRec();
      rec.onstart = () => resolve({ status: 'started' });
      rec.onerror = (e) => resolve({ status: 'error', error: e.error, message: e.message });
      try {
        rec.start();
      } catch (err) {
        resolve({ status: 'exception', error: err.message });
      }
    });
  `);
  console.log('RESULT:', JSON.stringify(res));
  win.close();
  app.quit();
});
