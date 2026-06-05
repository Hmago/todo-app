const { contextBridge, ipcRenderer } = require('electron');

// Exposes a minimal, safe surface so the web renderer can hand reminders to
// the main process where they can be delivered as native OS notifications
// even when the BrowserWindow is hidden, minimized, or in the tray.
contextBridge.exposeInMainWorld('desktopAPI', {
  isDesktop: true,
  notify: (title, body) => ipcRenderer.invoke('notify', { title, body }),
  schedule: (key, whenMs, title, body) =>
    ipcRenderer.invoke('schedule-notification', { key, whenMs, title, body }),
  cancel: (key) => ipcRenderer.invoke('cancel-notification', { key }),
  cancelAll: () => ipcRenderer.invoke('cancel-all-notifications'),
});
