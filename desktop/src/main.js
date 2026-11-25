'use strict';

const path = require('path');
const { app, BrowserWindow, ipcMain, shell, dialog } = require('electron');
const { PROVIDERS, searchAll, resolveMagnetLink } = require('./search-engine');
const { DesktopStreamManager, findVlcExecutable } = require('./stream-engine');

const ALLOWED_EXTERNAL_PROTOCOLS = new Set(['http:', 'https:', 'magnet:']);

let mainWindow = null;
let customVlcPath = null;
let streamManager = null;

function createWindow() {
  const iconPath = path.join(__dirname, '..', 'assets', 'icon.png');
  mainWindow = new BrowserWindow({
    width: 1240,
    height: 840,
    minWidth: 900,
    minHeight: 620,
    backgroundColor: '#070709',
    autoHideMenuBar: true,
    icon: iconPath,
    title: 'Magnet2Torrent Desktop',
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#0c0c0f',
      symbolColor: '#e4e4e7',
      height: 36,
    },
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    try {
      const parsed = new URL(url);
      if (ALLOWED_EXTERNAL_PROTOCOLS.has(parsed.protocol)) {
        shell.openExternal(url);
      }
    } catch {
      // Ignore malformed URLs
    }
    return { action: 'deny' };
  });

  mainWindow.webContents.on('will-navigate', (event, targetUrl) => {
    if (!targetUrl.startsWith('file://')) {
      event.preventDefault();
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'ui', 'index.html'));

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function registerIpc() {
  streamManager = new DesktopStreamManager((eventPayload) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('m2t:stream-event', eventPayload);
    }
  });

  ipcMain.handle('m2t:init-info', () => ({
    version: app.getVersion(),
    providers: PROVIDERS,
    vlcPath: findVlcExecutable(customVlcPath),
    platform: process.platform,
  }));

  ipcMain.handle('m2t:search', async (_event, query) => searchAll(query));

  ipcMain.handle('m2t:resolve-magnet', async (_event, item) => {
    if (item?.magnet && String(item.magnet).startsWith('magnet:?')) {
      return item.magnet;
    }
    if (!item?.desc) {
      throw new Error('Missing torrent detail URL or magnet link.');
    }
    return resolveMagnetLink(item.desc, item.title || '');
  });

  ipcMain.handle('m2t:open-external', async (_event, rawUrl) => {
    const parsed = new URL(String(rawUrl));
    if (!ALLOWED_EXTERNAL_PROTOCOLS.has(parsed.protocol)) {
      throw new Error(`Blocked protocol: ${parsed.protocol}`);
    }
    await shell.openExternal(parsed.toString());
    return true;
  });

  ipcMain.handle('m2t:stream-start', async (_event, payload) => {
    let magnet = payload?.magnet;
    if (!magnet || !String(magnet).startsWith('magnet:?')) {
      if (!payload?.desc) {
        throw new Error('Missing torrent detail URL or magnet link.');
      }
      magnet = await resolveMagnetLink(payload.desc, payload.title || '');
    }
    const res = await streamManager.start({
      magnet,
      title: payload?.title || 'Magnet Stream',
      customVlcPath: customVlcPath || payload?.customVlcPath || null,
      keepFiles: Boolean(payload?.keepFiles),
    });
    return { ...res, magnet };
  });

  ipcMain.handle('m2t:stream-select-file', (_event, index) => streamManager.selectFile(index));
  ipcMain.handle('m2t:stream-stop', () => streamManager.stop());
  ipcMain.handle('m2t:stream-reopen-vlc', () => streamManager.reopenVlc(customVlcPath));

  ipcMain.handle('m2t:pick-vlc-path', async () => {
    const res = await dialog.showOpenDialog(mainWindow, {
      title: 'Select VLC Media Player Executable',
      properties: ['openFile'],
      filters:
        process.platform === 'win32'
          ? [{ name: 'VLC Executable', extensions: ['exe'] }]
          : undefined,
    });
    if (res.canceled || !res.filePaths?.[0]) return null;
    customVlcPath = res.filePaths[0];
    return customVlcPath;
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
    registerIpc();
    createWindow();
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });
}

app.on('before-quit', async (event) => {
  if (streamManager && streamManager.session) {
    event.preventDefault();
    await streamManager.stop();
    app.exit(0);
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
