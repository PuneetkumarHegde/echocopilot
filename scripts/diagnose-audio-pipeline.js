const { app, session, BrowserWindow, desktopCapturer } = require('electron');
const path = require('path');

app.whenReady().then(async () => {
  const ses = session.defaultSession;

  // Set permission handlers
  ses.setPermissionRequestHandler((webContents, permission, callback) => {
    console.log('[Electron Main] Permission requested:', permission);
    callback(true);
  });

  if (ses.setPermissionCheckHandler) {
    ses.setPermissionCheckHandler((webContents, permission) => {
      console.log('[Electron Main] Permission checked:', permission);
      return true;
    });
  }

  if (ses.setDisplayMediaRequestHandler) {
    ses.setDisplayMediaRequestHandler((request, callback) => {
      console.log('[Electron Main] setDisplayMediaRequestHandler called!');
      desktopCapturer.getSources({ types: ['screen', 'window'] })
        .then((sources) => {
          console.log('[Electron Main] Desktop sources count:', sources.length);
          if (sources.length > 0) {
            callback({ video: sources[0], audio: 'loopback' });
          } else {
            callback(null);
          }
        })
        .catch(err => {
          console.error('[Electron Main] desktopCapturer error:', err);
          callback(null);
        });
    });
  }

  const win = new BrowserWindow({
    width: 900,
    height: 600,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, '../electron/preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false
    }
  });

  win.webContents.on('console-message', (event, level, message, line, sourceId) => {
    console.log(`[Renderer Console] [${level}] ${message}`);
  });

  console.log('Loading http://localhost:3000/floating...');
  await win.loadURL('http://localhost:3000/floating');
  await new Promise(r => setTimeout(r, 2000));

  console.log('Running in-renderer diagnostic tests...');
  const diag = await win.webContents.executeJavaScript(`
    (async () => {
      const results = {};

      // 1. Check audio devices
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        results.devices = devices.map(d => ({ kind: d.kind, label: d.label, id: d.deviceId }));
      } catch (err) {
        results.devicesError = err.toString();
      }

      // 2. Test getUserMedia
      try {
        const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        results.micStream = {
          active: micStream.active,
          tracks: micStream.getAudioTracks().map(t => ({
            label: t.label,
            enabled: t.enabled,
            muted: t.muted,
            readyState: t.readyState
          }))
        };

        // Test AudioContext
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        results.audioCtxStateInitial = ctx.state;
        if (ctx.state === 'suspended') {
          await ctx.resume();
        }
        results.audioCtxStateResumed = ctx.state;

        // Clean up
        micStream.getTracks().forEach(t => t.stop());
        await ctx.close();
      } catch (err) {
        results.micError = {
          name: err.name,
          message: err.message,
          stack: err.stack
        };
      }

      // 3. Test getDisplayMedia
      try {
        if (!navigator.mediaDevices.getDisplayMedia) {
          results.displayMediaSupported = false;
        } else {
          results.displayMediaSupported = true;
          const displayStream = await navigator.mediaDevices.getDisplayMedia({
            video: true,
            audio: true
          });
          results.displayStream = {
            active: displayStream.active,
            audioTracks: displayStream.getAudioTracks().map(t => ({
              label: t.label,
              enabled: t.enabled,
              muted: t.muted,
              readyState: t.readyState
            }))
          };
          displayStream.getTracks().forEach(t => t.stop());
        }
      } catch (err) {
        results.displayError = {
          name: err.name,
          message: err.message
        };
      }

      return results;
    })()
  `);

  console.log('\n--- DIAGNOSTIC RESULTS ---');
  console.log(JSON.stringify(diag, null, 2));

  app.quit();
});
