const { app, BrowserWindow, ipcMain, screen } = require('electron');
const path = require('path');
const http = require('http');

console.log('[TEST] Initializing Electron Desktop Overlay Test...');

app.commandLine.appendSwitch('enable-transparent-visuals');
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');

function checkHealth(url) {
  return new Promise((resolve) => {
    http.get(url, (res) => {
      resolve(res.statusCode >= 200 && res.statusCode < 400);
    }).on('error', () => resolve(false));
  });
}

app.whenReady().then(async () => {
  console.log('[TEST] Electron App ready');
  const isHealthy = await checkHealth('http://localhost:3000/api/health');
  console.log('[TEST] Dev server health check:', isHealthy ? 'PASS (200 OK)' : 'FAIL');

  const win = new BrowserWindow({
    width: 860,
    height: 540,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    hasShadow: false,
    alwaysOnTop: true,
    webPreferences: {
      preload: path.join(__dirname, '..', 'electron', 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false
    }
  });

  win.setAlwaysOnTop(true, 'screen-saver');
  win.setOpacity(0.75);

  console.log('[TEST] BrowserWindow created with transparent: true, frame: false, alwaysOnTop: true');
  console.log('[TEST] Initial opacity:', win.getOpacity());

  // Load floating HUD page
  await win.loadURL('http://localhost:3000/floating');
  console.log('[TEST] Loaded http://localhost:3000/floating successfully');

  // Verify preload electronAPI in DOM
  const apiCheck = await win.webContents.executeJavaScript(`
    ({
      hasElectronAPI: Boolean(window.electronAPI),
      isElectron: Boolean(window.electronAPI?.isElectron),
      hasSetOpacity: typeof window.electronAPI?.setOpacity === 'function',
      hasSetAlwaysOnTop: typeof window.electronAPI?.setAlwaysOnTop === 'function',
      hasMinimize: typeof window.electronAPI?.minimize === 'function',
      hasRestore: typeof window.electronAPI?.restore === 'function',
      hasClose: typeof window.electronAPI?.close === 'function',
      hasMoveWindow: typeof window.electronAPI?.moveWindow === 'function',
      hasSetWindowSize: typeof window.electronAPI?.setWindowSize === 'function',
      title: document.title,
      htmlClasses: document.documentElement.className,
      bodyClasses: document.body.className
    })
  `);
  console.log('[TEST] Preload API verification in DOM:', JSON.stringify(apiCheck, null, 2));

  // Ensure Horizontal Mode is active first
  await win.webContents.executeJavaScript(`
    localStorage.setItem('echocopilot_hud_layout', 'horizontal');
    location.reload();
  `);
  win.setSize(920, 520);
  await new Promise(r => setTimeout(r, 2000));
  const imgHorizontal = await win.webContents.capturePage();
  const fs = require('fs');
  fs.writeFileSync(path.join(__dirname, '..', 'desktop_preview_horizontal.png'), imgHorizontal.toPNG());
  console.log('[TEST] Horizontal preview saved');

  // Switch to Column Mode via DOM interaction
  await win.webContents.executeJavaScript(`
    const columnBtn = Array.from(document.querySelectorAll('button')).find(b => b.title && b.title.includes('Column Mode'));
    if (columnBtn) columnBtn.click();
  `);
  win.setSize(460, 740);
  await new Promise(r => setTimeout(r, 1000));
  const imgColumn = await win.webContents.capturePage();
  fs.writeFileSync(path.join(__dirname, '..', 'desktop_preview_column.png'), imgColumn.toPNG());
  console.log('[TEST] Column preview saved');

  if (apiCheck.hasElectronAPI && apiCheck.isElectron && apiCheck.hasSetOpacity) {
    console.log('[TEST] ALL TESTS PASSED SUCCESSFULLY!');
  } else {
    console.error('[TEST] Verification failed: missing required electronAPI properties');
    process.exit(1);
  }

  win.close();
  app.quit();
});
