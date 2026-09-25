// Desktop wrapper: `npm run desktop` builds the game and opens it in a native window.
const { app, BrowserWindow } = require('electron');
const path = require('path');

function createWindow() {
  const win = new BrowserWindow({
    width: 1600, height: 900, minWidth: 1100, minHeight: 650,
    backgroundColor: '#120d16',
    title: 'The Forgotten Tavern',
    autoHideMenuBar: true,
    webPreferences: { contextIsolation: true }
  });
  win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
}

app.whenReady().then(createWindow);
app.on('window-all-closed', () => app.quit());
