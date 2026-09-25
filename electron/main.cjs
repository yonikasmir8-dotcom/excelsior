// Desktop wrapper. Serves the build over a privileged app:// scheme, stores saves as files with
// atomic writes and rolling backups, and gives the game a chance to save before the window closes.
const { app, BrowserWindow, protocol, net, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');

protocol.registerSchemesAsPrivileged([{ scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true } }]);
const DIST = path.join(__dirname, '..', 'dist');
const saveDir = () => { const d = path.join(app.getPath('userData'), 'saves'); fs.mkdirSync(d, { recursive: true }); return d; };
const slotFile = (slot, suffix = '') => path.join(saveDir(), `slot${Number(slot) | 0}${suffix}.json`);
const BACKUPS = 3;
let win = null, quitting = false;

function readIf(p) { try { return fs.readFileSync(p, 'utf8'); } catch (e) { return null; } }

ipcMain.on('save:read', (e, slot) => {
  const backups = []; for (let i = 1; i <= BACKUPS; i++) backups.push(readIf(slotFile(slot, `.bak${i}`)));
  e.returnValue = { main: readIf(slotFile(slot)), backups };
});
ipcMain.on('save:write', (e, slot, text) => {
  const main = slotFile(slot), tmp = slotFile(slot, '.tmp');
  try {
    // 1) write + fsync a temp file, 2) rotate backups, 3) atomically rename temp over the main save
    const fd = fs.openSync(tmp, 'w'); fs.writeSync(fd, text); fs.fsyncSync(fd); fs.closeSync(fd);
    if (fs.existsSync(main)) {
      for (let i = BACKUPS; i > 1; i--) { const from = slotFile(slot, `.bak${i - 1}`); if (fs.existsSync(from)) fs.copyFileSync(from, slotFile(slot, `.bak${i}`)); }
      fs.copyFileSync(main, slotFile(slot, '.bak1'));
    }
    fs.renameSync(tmp, main);
    e.returnValue = { ok: true };
  } catch (err) {
    try { fs.unlinkSync(tmp); } catch (_) {}
    e.returnValue = { ok: false, error: String(err && err.code || err) };
  }
});
ipcMain.on('save:delete', (e, slot) => {
  for (const s of ['', '.tmp', ...Array.from({ length: BACKUPS }, (_, i) => `.bak${i + 1}`)]) { try { fs.unlinkSync(slotFile(slot, s)); } catch (_) {} }
  e.returnValue = true;
});
ipcMain.handle('save:export', async (e, slot, text) => {
  const r = await dialog.showSaveDialog(win, { title: 'Export save', defaultPath: `forgotten-tavern-slot${slot}.json`, filters: [{ name: 'Save file', extensions: ['json'] }] });
  if (r.canceled || !r.filePath) return { ok: false, canceled: true };
  try { fs.writeFileSync(r.filePath, text); return { ok: true, path: r.filePath }; } catch (err) { return { ok: false, error: String(err) }; }
});
ipcMain.handle('save:import', async () => {
  const r = await dialog.showOpenDialog(win, { title: 'Import save', properties: ['openFile'], filters: [{ name: 'Save file', extensions: ['json'] }] });
  if (r.canceled || !r.filePaths[0]) return { ok: false, canceled: true };
  try { const st = fs.statSync(r.filePaths[0]); if (st.size > 5e6) return { ok: false, error: 'File is too large to be a save.' }; return { ok: true, text: fs.readFileSync(r.filePaths[0], 'utf8') }; } catch (err) { return { ok: false, error: String(err) }; }
});
ipcMain.on('crash:log', (e, text) => { try { fs.appendFileSync(path.join(app.getPath('userData'), 'crash.log'), `[${new Date().toISOString()}] ${String(text).slice(0, 8000)}\n`); } catch (_) {} });
ipcMain.on('app:quit', () => { if (win) win.close(); });
ipcMain.on('app:quit-ready', () => { quitting = true; if (win) win.close(); });

function createWindow() {
  win = new BrowserWindow({
    width: 1600, height: 900, minWidth: 1100, minHeight: 650,
    backgroundColor: '#0e0a08', title: 'The Forgotten Tavern', autoHideMenuBar: true,
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true, preload: path.join(__dirname, 'preload.cjs') },
  });
  win.loadURL('app://game/index.html');
  win.webContents.on('before-input-event', (e, input) => { if (input.key === 'F11' && input.type === 'keyDown') win.setFullScreen(!win.isFullScreen()); });
  // give the game up to 2s to write a final save before the window closes
  win.on('close', (e) => { if (quitting) return; e.preventDefault(); win.webContents.send('app:before-quit'); setTimeout(() => { quitting = true; if (win && !win.isDestroyed()) win.close(); }, 2000); });
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', (e) => e.preventDefault());
}

app.whenReady().then(() => {
  protocol.handle('app', (req) => {
    const rel = decodeURIComponent(new URL(req.url).pathname).replace(/^\/+/, '');
    const file = path.normalize(path.join(DIST, rel || 'index.html'));
    if (!file.startsWith(DIST)) return new Response('Forbidden', { status: 403 });
    return net.fetch(pathToFileURL(file).toString());
  });
  createWindow();
});
app.on('window-all-closed', () => app.quit());
