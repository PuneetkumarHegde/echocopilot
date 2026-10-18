const { contextBridge, ipcRenderer } = require('electron');

// Expose safe, powerful native desktop window management API to the HUD renderer
contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,
  setOpacity: (opacity) => ipcRenderer.send('set-opacity', opacity),
  setAlwaysOnTop: (alwaysOnTop) => ipcRenderer.send('set-always-on-top', alwaysOnTop),
  minimize: () => ipcRenderer.send('minimize-window'),
  maximize: () => ipcRenderer.send('maximize-window'),
  restore: () => ipcRenderer.send('restore-window'),
  close: () => ipcRenderer.send('close-window'),
  setWindowSize: (width, height) => ipcRenderer.send('set-window-size', { width, height }),
  moveWindow: (deltaX, deltaY) => ipcRenderer.send('move-window', { deltaX, deltaY })
});

// Immediately ensure DOM background is 100% transparent for real desktop glassmorphism
window.addEventListener('DOMContentLoaded', () => {
  if (document.documentElement) {
    document.documentElement.classList.add('electron-window');
    document.documentElement.style.background = 'transparent';
    document.documentElement.style.backgroundColor = 'transparent';
  }
  if (document.body) {
    document.body.classList.add('electron-window');
    document.body.style.background = 'transparent';
    document.body.style.backgroundColor = 'transparent';
  }
});

