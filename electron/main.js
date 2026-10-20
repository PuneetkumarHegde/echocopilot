const { app, BrowserWindow, ipcMain, screen, desktopCapturer } = require('electron');
const path = require('path');
const http = require('http');

let mainWindow = null;

// Screen-capture protection state (defaults to false or configured via env/CLI)
let isContentProtectionEnabled = process.env.PROTECT_SCREEN === 'true' || process.argv.includes('--protect-screen');

// Set dedicated user data directory to avoid cache lock issues
try {
  const tempUserData = path.join(app.getPath('temp'), 'echocopilot-electron-data');
  app.setPath('userData', tempUserData);
} catch {}

// Command line switches for audio capture & reliable GPU compositing
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');
app.commandLine.appendSwitch('disable-gpu-shader-disk-cache');

/**
 * Checks if the local Next.js server is ready
 */
function checkServerReady(url, maxRetries = 60, interval = 500) {
  return new Promise((resolve) => {
    let retries = 0;
    const check = () => {
      http.get(url, (res) => {
        if (res.statusCode >= 200 && res.statusCode < 400) {
          resolve(true);
        } else {
          retry();
        }
      }).on('error', () => {
        retry();
      });
    };

    const retry = () => {
      retries++;
      if (retries >= maxRetries) {
        // Resolve anyway so Electron can attempt load and auto-retry
        resolve(false);
      } else {
        setTimeout(check, interval);
      }
    };

    check();
  });
}

function createWindow() {
  const primaryDisplay = screen.getPrimaryDisplay();
  const { x: dispX, y: dispY, width: screenWidth, height: screenHeight } = primaryDisplay.workArea;

  // Start in Collapsed State (Option 1): small circular icon (72x72) floating on screen
  const defaultWidth = 72;
  const defaultHeight = 72;
  const initialX = Math.max(dispX + 10, dispX + screenWidth - 100);
  const initialY = Math.max(dispY + 10, dispY + 100);

  lastCollapsedPosition = { x: initialX, y: initialY };
  lastExpandedPosition = {
    x: Math.max(dispX + 20, Math.round(dispX + (screenWidth - 940) / 2)),
    y: Math.max(dispY + 20, Math.round(dispY + (screenHeight - 460) / 2))
  };

  mainWindow = new BrowserWindow({
    width: defaultWidth,
    height: defaultHeight,
    x: initialX,
    y: initialY,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    hasShadow: false,
    alwaysOnTop: true,
    resizable: true,
    skipTaskbar: false,
    show: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false // Keep STT & audio pipeline active in background
    }
  });

  // Make the floating window stay genuinely on top of Google Meet, Zoom, and other apps
  mainWindow.setAlwaysOnTop(true, 'screen-saver');
  mainWindow.show();
  mainWindow.focus();

  // Keep native window surface alpha at 1.0 so text and controls remain crisp,
  // while CSS dark glass rgba(10, 14, 23, alpha) provides true desktop see-through transparency
  mainWindow.setOpacity(1.0);

  // Screen-capture protection: applied specifically to the EchoCopilot window
  if (typeof mainWindow.setContentProtection === 'function') {
    try {
      mainWindow.setContentProtection(isContentProtectionEnabled);
      console.log(`[Electron] mainWindow initial setContentProtection(${isContentProtectionEnabled}) applied`);
    } catch (err) {
      console.warn('[Electron] setContentProtection not supported or failed on initial window setup:', err.message);
    }
  }

  // Auto-grant permissions for microphone and display capture
  const ses = mainWindow.webContents.session;
  ses.setPermissionRequestHandler((webContents, permission, callback) => {
    callback(true);
  });

  if (ses.setPermissionCheckHandler) {
    ses.setPermissionCheckHandler(() => true);
  }

  if (ses.setDevicePermissionHandler) {
    ses.setDevicePermissionHandler(() => true);
  }

  // Handle getDisplayMedia requests for tab/device audio capture inside Electron
  if (ses.setDisplayMediaRequestHandler) {
    ses.setDisplayMediaRequestHandler((request, callback) => {
      desktopCapturer.getSources({ types: ['screen', 'window'] })
        .then((sources) => {
          if (sources && sources.length > 0) {
            callback({ video: sources[0], audio: 'loopback' });
          } else {
            callback(null);
          }
        })
        .catch((err) => {
          console.warn('[Electron] desktopCapturer error:', err);
          callback(null);
        });
    });
  }

  const startUrl = process.env.ELECTRON_START_URL || 'http://localhost:3000/floating';

  // Load URL immediately
  console.log(`[Electron] Loading ${startUrl}...`);
  mainWindow.loadURL(startUrl);

  // If initial load fails because Next.js is still compiling, auto-retry smoothly
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
    console.log(`[Electron] did-fail-load (${errorDescription}). Retrying in 1s...`);
    setTimeout(() => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.loadURL(startUrl);
      }
    }, 1000);
  });

  mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
    console.log(`[Renderer] ${message}`);
  });

  mainWindow.webContents.on('did-finish-load', () => {
    console.log('[Electron] mainWindow did-finish-load fired');
    mainWindow.webContents.insertCSS(`
      html, body {
        background: transparent !important;
        background-color: transparent !important;
        overflow: hidden !important;
      }
    `);
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.show();
      mainWindow.focus();
      mainWindow.setAlwaysOnTop(true, 'screen-saver');
    }
  });

  mainWindow.on('close', (e) => {
    console.log('[Electron] mainWindow "close" event fired');
  });

  mainWindow.on('closed', () => {
    console.log('[Electron] mainWindow "closed" event fired');
    mainWindow = null;
  });
}

// -------------------------------------------------------------
// Native Desktop Window IPC Handlers
// -------------------------------------------------------------
function getTargetWin(event) {
  return (event && event.sender ? BrowserWindow.fromWebContents(event.sender) : null) || mainWindow;
}

ipcMain.on('set-opacity', (event, opacity) => {
  const win = getTargetWin(event);
  if (win && !win.isDestroyed()) {
    const clamped = Math.max(0.15, Math.min(1.0, Number(opacity)));
    win.setOpacity(clamped);
  }
});

ipcMain.on('set-always-on-top', (event, flag) => {
  const win = getTargetWin(event);
  if (win && !win.isDestroyed()) {
    win.setAlwaysOnTop(Boolean(flag), 'screen-saver');
  }
});

// Configurable screen-capture protection for the EchoCopilot window
ipcMain.handle('set-content-protection', (event, enable) => {
  const win = getTargetWin(event);
  if (!win || win.isDestroyed()) {
    return { success: false, error: 'Target window not available', enabled: false, supported: false };
  }
  if (typeof win.setContentProtection !== 'function') {
    return {
      success: false,
      error: 'setContentProtection is not supported on this platform or Electron build',
      enabled: false,
      supported: false
    };
  }
  try {
    const boolVal = Boolean(enable);
    win.setContentProtection(boolVal);
    isContentProtectionEnabled = boolVal;
    console.log(`[Electron] setContentProtection updated to: ${isContentProtectionEnabled}`);
    return {
      success: true,
      enabled: isContentProtectionEnabled,
      supported: true,
      disclaimer: 'Protected via OS display affinity (Windows WDA_EXCLUDEFROMCAPTURE / macOS NSWindowSharingNone). Standard screen shares (Zoom, Meet, Teams) cannot capture this window, but hardware capture cards or specialized mirror drivers may bypass OS affinity.'
    };
  } catch (err) {
    console.error('[Electron] Error executing setContentProtection:', err);
    return { success: false, error: err.message, enabled: isContentProtectionEnabled, supported: false };
  }
});

ipcMain.handle('get-content-protection', (event) => {
  const win = getTargetWin(event);
  const supported = Boolean(win && !win.isDestroyed() && typeof win.setContentProtection === 'function');
  return {
    supported,
    enabled: isContentProtectionEnabled,
    platform: process.platform,
    disclaimer: 'Protected via OS display affinity. Note that specialized capture tools or hardware devices may bypass OS display affinity.'
  };
});

ipcMain.on('minimize-window', (event) => {
  const win = getTargetWin(event);
  if (win && !win.isDestroyed()) {
    win.minimize();
  }
});

ipcMain.on('restore-window', (event) => {
  const win = getTargetWin(event);
  if (win && !win.isDestroyed()) {
    win.restore();
  }
});

ipcMain.on('maximize-window', (event) => {
  const win = getTargetWin(event);
  if (win && !win.isDestroyed()) {
    if (win.isMaximized()) {
      win.unmaximize();
    } else {
      win.maximize();
    }
  }
});

ipcMain.on('close-window', (event) => {
  console.log('[Electron] Received close-window IPC call!');
  const win = getTargetWin(event);
  if (win && !win.isDestroyed()) {
    win.close();
  }
});

ipcMain.on('set-window-size', (event, { width, height }) => {
  const win = getTargetWin(event);
  if (win && !win.isDestroyed()) {
    win.setSize(Math.round(width), Math.round(height));
  }
});

let lastExpandedPosition = null;
let lastCollapsedPosition = null;

ipcMain.on('expand-hud', (event, arg) => {
  console.log('[Electron] expand-hud received:', arg);
  const win = getTargetWin(event);
  if (win && !win.isDestroyed()) {
    const [currX, currY] = win.getPosition();
    const [w] = win.getSize();
    if (w <= 120) {
      lastCollapsedPosition = { x: currX, y: currY };
    }

    const width = (arg && typeof arg === 'object' && arg.width) ? Number(arg.width) : 940;
    const height = (arg && typeof arg === 'object' && arg.height) ? Number(arg.height) : 460;

    const display = screen.getDisplayMatching(win.getBounds());
    const { x: dispX, y: dispY, width: dispW, height: dispH } = display.workArea;
    const targetW = Math.round(width);
    const targetH = Math.round(height);

    let targetX = lastExpandedPosition ? lastExpandedPosition.x : Math.round(dispX + (dispW - targetW) / 2);
    let targetY = lastExpandedPosition ? lastExpandedPosition.y : Math.round(dispY + (dispH - targetH) / 2);

    // Keep expanded window within visible screen bounds
    if (targetX + targetW > dispX + dispW) {
      targetX = Math.max(dispX + 10, dispX + dispW - targetW - 20);
    }
    if (targetY + targetH > dispY + dispH) {
      targetY = Math.max(dispY + 10, dispY + dispH - targetH - 20);
    }
    win.setBounds({ x: targetX, y: targetY, width: targetW, height: targetH });
    win.setAlwaysOnTop(true, 'screen-saver');
    win.show();
    win.focus();
  }
});

ipcMain.on('collapse-hud', (event, arg) => {
  console.log('[Electron] collapse-hud received:', arg);
  const win = getTargetWin(event);
  if (win && !win.isDestroyed()) {
    const [currX, currY] = win.getPosition();
    lastExpandedPosition = { x: currX, y: currY };

    const width = (arg && typeof arg === 'object' && arg.width) ? Number(arg.width) : 72;
    const height = (arg && typeof arg === 'object' && arg.height) ? Number(arg.height) : 72;

    const display = screen.getDisplayMatching(win.getBounds());
    const { x: dispX, y: dispY, width: dispW } = display.workArea;
    const iconX = lastCollapsedPosition ? lastCollapsedPosition.x : Math.max(dispX + 10, dispX + dispW - 90);
    const iconY = lastCollapsedPosition ? lastCollapsedPosition.y : Math.max(dispY + 10, 120);

    win.setBounds({ x: iconX, y: iconY, width: Math.round(width), height: Math.round(height) });
  }
});

ipcMain.on('move-window', (event, { deltaX, deltaY }) => {
  const win = getTargetWin(event);
  if (win && !win.isDestroyed()) {
    const [currentX, currentY] = win.getPosition();
    const newX = currentX + Math.round(deltaX);
    const newY = currentY + Math.round(deltaY);
    win.setPosition(newX, newY);

    const [w] = win.getSize();
    if (w <= 120) {
      lastCollapsedPosition = { x: newX, y: newY };
    } else {
      lastExpandedPosition = { x: newX, y: newY };
    }
  }
});

process.on('uncaughtException', (err) => {
  console.error('[Electron] uncaughtException:', err);
});

process.on('unhandledRejection', (reason) => {
  console.error('[Electron] unhandledRejection:', reason);
});

app.on('before-quit', (e) => {
  console.log('[Electron] before-quit event');
});

app.on('will-quit', (e) => {
  console.log('[Electron] will-quit event');
});

// App lifecycle
app.whenReady().then(() => {
  console.log('[Electron] app.whenReady fired');
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  console.log('[Electron] window-all-closed event');
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
