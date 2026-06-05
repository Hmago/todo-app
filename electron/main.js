const { app, BrowserWindow, shell, ipcMain, Notification, Tray, Menu, nativeImage } = require('electron');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

// Fixed port keeps the origin (and therefore localStorage / AsyncStorage data)
// stable across launches, so user data persists between sessions.
const PORT = 19112;
const HOST = '127.0.0.1';
const BASE = '/todo-app';

// The web export lives next to this file once packaged (inside app.asar) and at
// ../dist during local development.
const DIST_DIR = path.join(__dirname, '..', 'dist');
const ICON_PATH = path.join(__dirname, '..', 'assets', 'icon.png');

// Brand notifications on Windows ("To Do" instead of "electron.app.todo_app").
// Must match the shortcut AppUserModelID written by NSIS (electron-builder uses
// the appId by default).
if (process.platform === 'win32') {
  app.setAppUserModelId('com.learnplan.desktop');
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.map': 'application/json; charset=utf-8',
};

function send(res, status, body, headers = {}) {
  res.writeHead(status, headers);
  res.end(body);
}

function serveFile(res, filePath) {
  fs.readFile(filePath, (err, data) => {
    if (err) {
      send(res, 404, 'Not found');
      return;
    }
    const type = MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream';
    send(res, 200, data, { 'Content-Type': type });
  });
}

function createServer() {
  return http.createServer((req, res) => {
    let pathname;
    try {
      pathname = decodeURIComponent(new URL(req.url, `http://${HOST}:${PORT}`).pathname);
    } catch {
      send(res, 400, 'Bad request');
      return;
    }

    // Normalise: strip the baseUrl prefix the export bakes into asset paths.
    let rel = pathname;
    if (rel === BASE || rel === `${BASE}/`) rel = '/';
    else if (rel.startsWith(`${BASE}/`)) rel = rel.slice(BASE.length);

    if (rel === '/' || rel === '') rel = '/index.html';

    // Resolve safely within DIST_DIR (prevent path traversal).
    const safe = path
      .normalize(rel)
      .replace(/^(\.\.[/\\])+/, '')
      .replace(/^[/\\]+/, '');
    const filePath = path.join(DIST_DIR, safe);

    if (!filePath.startsWith(DIST_DIR)) {
      send(res, 403, 'Forbidden');
      return;
    }

    fs.stat(filePath, (err, stat) => {
      if (!err && stat.isFile()) {
        serveFile(res, filePath);
      } else {
        // SPA fallback so client-side navigation works.
        serveFile(res, path.join(DIST_DIR, 'index.html'));
      }
    });
  });
}

let mainWindow = null;
let tray = null;
let isQuitting = false;

// Scheduled OS notifications keyed by reminder id, so we can cancel / replace
// them when the renderer re-syncs.
const scheduledTimers = new Map();
const MAX_TIMEOUT = 2 ** 31 - 1;

function showMainWindow() {
  if (!mainWindow) {
    createWindow();
    return;
  }
  if (mainWindow.isMinimized()) mainWindow.restore();
  if (!mainWindow.isVisible()) mainWindow.show();
  mainWindow.focus();
}

function deliverNotification(title, body) {
  if (!Notification.isSupported()) return;
  const n = new Notification({
    title: title || 'To Do',
    body: body || '',
    icon: ICON_PATH,
    silent: false,
  });
  n.on('click', () => {
    showMainWindow();
  });
  n.show();
}

function clearScheduled(key) {
  const t = scheduledTimers.get(key);
  if (t) {
    clearTimeout(t);
    scheduledTimers.delete(key);
  }
}

function scheduleNotification(key, whenMs, title, body) {
  clearScheduled(key);
  const delay = Math.max(0, whenMs - Date.now());
  if (delay > MAX_TIMEOUT) {
    // Re-arm in chunks for far-future reminders (>~24.8 days).
    const timer = setTimeout(() => {
      scheduledTimers.delete(key);
      scheduleNotification(key, whenMs, title, body);
    }, MAX_TIMEOUT);
    scheduledTimers.set(key, timer);
    return;
  }
  const timer = setTimeout(() => {
    scheduledTimers.delete(key);
    deliverNotification(title, body);
  }, delay);
  scheduledTimers.set(key, timer);
}

function createTray() {
  if (tray) return;
  try {
    const image = nativeImage.createFromPath(ICON_PATH);
    tray = new Tray(image.isEmpty() ? nativeImage.createEmpty() : image);
  } catch {
    tray = new Tray(nativeImage.createEmpty());
  }
  tray.setToolTip('To Do');
  const menu = Menu.buildFromTemplate([
    { label: 'Open To Do', click: () => showMainWindow() },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        isQuitting = true;
        app.quit();
      },
    },
  ]);
  tray.setContextMenu(menu);
  tray.on('click', () => showMainWindow());
  tray.on('double-click', () => showMainWindow());
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 480,
    height: 880,
    minWidth: 360,
    minHeight: 560,
    backgroundColor: '#1b1b1f',
    title: 'To Do',
    icon: ICON_PATH,
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  mainWindow.loadURL(`http://${HOST}:${PORT}${BASE}/`);

  // Open external links in the user's default browser, not a new app window.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      if (!url.startsWith(`http://${HOST}:${PORT}`)) {
        shell.openExternal(url);
        return { action: 'deny' };
      }
    }
    return { action: 'allow' };
  });

  // Hide-to-tray on close so scheduled reminders keep firing. The user can
  // fully exit from the tray menu or via File > Quit on macOS.
  mainWindow.on('close', (e) => {
    if (!isQuitting) {
      e.preventDefault();
      mainWindow.hide();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    showMainWindow();
  });

  // IPC: renderer-driven OS notifications.
  ipcMain.handle('notify', (_evt, { title, body } = {}) => {
    deliverNotification(title, body);
    return true;
  });
  ipcMain.handle('schedule-notification', (_evt, { key, whenMs, title, body } = {}) => {
    if (!key || typeof whenMs !== 'number') return false;
    scheduleNotification(key, whenMs, title, body);
    return true;
  });
  ipcMain.handle('cancel-notification', (_evt, { key } = {}) => {
    if (key) clearScheduled(key);
    return true;
  });
  ipcMain.handle('cancel-all-notifications', () => {
    for (const key of Array.from(scheduledTimers.keys())) clearScheduled(key);
    return true;
  });

  app.whenReady().then(() => {
    createTray();
    const server = createServer();
    server.on('error', (err) => {
      // If the port is already taken (e.g. a stale instance), load anyway —
      // the existing server is serving the same content on the same origin.
      if (err && err.code === 'EADDRINUSE') {
        createWindow();
      }
    });
    server.listen(PORT, HOST, () => {
      createWindow();
    });

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
      else showMainWindow();
    });
  });

  app.on('before-quit', () => {
    isQuitting = true;
    for (const key of Array.from(scheduledTimers.keys())) clearScheduled(key);
  });

  // On Windows/Linux we deliberately keep the app alive when all windows are
  // closed so that scheduled reminders can fire from the tray. The user quits
  // explicitly via the tray menu.
  app.on('window-all-closed', () => {
    if (process.platform === 'darwin') {
      // macOS conventionally keeps the app running too; nothing to do.
    }
  });
}
