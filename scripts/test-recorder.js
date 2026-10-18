const { app, BrowserWindow } = require('electron');

app.whenReady().then(async () => {
  const win = new BrowserWindow({ show: false });
  await win.loadURL('http://localhost:3000/floating');
  
  const testRes = await win.webContents.executeJavaScript(`
    new Promise((resolve) => {
      try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        const ctx = new AudioCtx({ sampleRate: 16000 });
        const osc = ctx.createOscillator();
        const proc = ctx.createScriptProcessor(4096, 1, 1);
        let samplesCollected = 0;
        
        proc.onaudioprocess = (e) => {
          const data = e.inputBuffer.getChannelData(0);
          samplesCollected += data.length;
          if (samplesCollected >= 16000) {
            osc.stop();
            ctx.close();
            resolve({ success: true, samplesCollected, sampleRate: ctx.sampleRate });
          }
        };
        
        osc.connect(proc);
        proc.connect(ctx.destination);
        osc.start();
      } catch (err) {
        resolve({ success: false, error: err.message });
      }
    });
  `);
  
  console.log('[AUDIO CONTEXT PCM TEST]:', JSON.stringify(testRes));
  win.close();
  app.quit();
});
