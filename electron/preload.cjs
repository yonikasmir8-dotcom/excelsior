// Narrow, audited bridge between the game and the OS. The renderer never gets Node access.
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('electronAPI', {
  saveRead: (slot) => ipcRenderer.sendSync('save:read', slot),          // → { main, backups: [...] } raw strings or null
  saveWrite: (slot, text) => ipcRenderer.sendSync('save:write', slot, text), // → { ok, error }
  saveDelete: (slot) => ipcRenderer.sendSync('save:delete', slot),
  exportSave: (slot, text) => ipcRenderer.invoke('save:export', slot, text),
  importSave: () => ipcRenderer.invoke('save:import'),
  crashLog: (text) => ipcRenderer.send('crash:log', text),
  onBeforeQuit: (fn) => ipcRenderer.on('app:before-quit', fn),
  quitReady: () => ipcRenderer.send('app:quit-ready'),
  quit: () => ipcRenderer.send('app:quit'),
});
