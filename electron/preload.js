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
  moveWindow: (deltaX, deltaY) => ipcRenderer.send('move-window', { deltaX, deltaY }),
  expandHUD: (width = 940, height = 460) => ipcRenderer.send('expand-hud', { width, height }),
  collapseHUD: (width = 72, height = 72) => ipcRenderer.send('collapse-hud', { width, height })
});

// electronAPI exposed to main world cleanly without mutating DOM before React hydration

