const { app, BrowserWindow, shell } = require('electron');
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

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 480,
    height: 880,
    minWidth: 360,
    minHeight: 560,
    backgroundColor: '#1b1b1f',
    title: 'To Do',
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
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

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
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
    });
  });

  app.on('window-all-closed', () => {
    app.quit();
  });
}
