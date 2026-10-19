const { app, BrowserWindow, screen } = require('electron');
const path = require('path');
const fs = require('fs');

const logFile = path.join(__dirname, 'electron_crash_diag.log');
function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}\n`;
  console.log(msg);
  fs.appendFileSync(logFile, line);
}

fs.writeFileSync(logFile, '--- Starting Electron Diagnostic Run ---\n');

process.on('uncaughtException', (err) => {
  log(`UNCAUGHT EXCEPTION: ${err.stack || err}`);
});

process.on('unhandledRejection', (reason) => {
  log(`UNHANDLED REJECTION: ${reason}`);
});

app.on('will-quit', (e) => {
  log('app will-quit fired');
});

app.on('quit', (e, exitCode) => {
  log(`app quit fired with exitCode: ${exitCode}`);
});

app.on('window-all-closed', () => {
  log('app window-all-closed fired');
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Load main.js logic
require('../electron/main.js');
