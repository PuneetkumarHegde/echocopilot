const { app, BrowserWindow, ipcMain, screen, desktopCapturer } = require('electron');
const path = require('path');
const http = require('http');

let mainWindow = null;

// Command line switches to ensure transparency & audio capture work reliably
app.commandLine.appendSwitch('enable-transparent-visuals');
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');

/**
 * Checks if the local Next.js server is ready
 */
function checkServerReady(url, maxRetries = 40, interval = 500) {
  return new Promise((resolve, reject) => {
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
        // Resolve anyway, letting Electron load and show error/reload
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
  const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize;

  const initialWidth = 1040;
  const initialHeight = 580;

  mainWindow = new BrowserWindow({
    width: initialWidth,
    height: initialHeight,
    x: Math.round((screenWidth - initialWidth) / 2),
    y: 35,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    hasShadow: false,
    alwaysOnTop: true,
    resizable: true,
    skipTaskbar: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false // Keep STT & audio pipeline active in background
    }
  });

  // Make the floating window stay genuinely on top of Google Meet, Zoom, and other apps
  mainWindow.setAlwaysOnTop(true, 'screen-saver');

  // Set default native desktop opacity (0.75 for true translucent glass view of underlying desktop)
  mainWindow.setOpacity(0.75);

  // Auto-grant permissions for microphone and display capture
  const ses = mainWindow.webContents.session;
  ses.setPermissionRequestHandler((webContents, permission, callback) => {
    if (permission === 'media' || permission === 'display-capture' || permission === 'mediaKeySystem') {
      return callback(true);
    }
    callback(true);
  });

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
        .catch(() => callback(null));
    });
  }

  const startUrl = process.env.ELECTRON_START_URL || 'http://localhost:3000/floating';

  checkServerReady('http://localhost:3000/api/health').then(() => {
    mainWindow.loadURL(startUrl);
  });

  mainWindow.on('closed', () => {
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

ipcMain.on('move-window', (event, { deltaX, deltaY }) => {
  const win = getTargetWin(event);
  if (win && !win.isDestroyed()) {
    const [currentX, currentY] = win.getPosition();
    win.setPosition(currentX + Math.round(deltaX), currentY + Math.round(deltaY));
  }
});

// App lifecycle
app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
