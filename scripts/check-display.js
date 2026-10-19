const { app, screen } = require('electron');
app.whenReady().then(() => {
  const p = screen.getPrimaryDisplay();
  console.log('PRIMARY_DISPLAY:', JSON.stringify({
    workAreaSize: p.workAreaSize,
    scaleFactor: p.scaleFactor,
    bounds: p.bounds,
    workArea: p.workArea
  }));
  const all = screen.getAllDisplays().map(d => ({ bounds: d.bounds, workArea: d.workArea }));
  console.log('ALL_DISPLAYS:', JSON.stringify(all));
  app.quit();
});
