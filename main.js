const { app, BrowserWindow, Tray, Menu, ipcMain, screen } = require('electron');
const path = require('path');
const fs = require('fs');
const { execFile } = require('child_process');

const DATA_FILE = path.join(app.getPath('userData'), 'codenote-data.json');

const DEFAULT_DATA = {
  todos: [],
  notes: '',
  theme: 'dark',
  deskLocked: false,
  windowBounds: null
};

function loadData() {
  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf-8');
    return { ...DEFAULT_DATA, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_DATA };
  }
}

function saveData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

let mainWindow = null;
let tray = null;
let isQuitting = false;
let deskLocked = false;

function getHwnd(win) {
  const buf = win.getNativeWindowHandle();
  return buf.length >= 8 ? buf.readBigUInt64LE(0).toString() : buf.readUInt32LE(0).toString();
}

function runDesktopWidgetScript(action, win) {
  try {
    const hwnd = getHwnd(win);
    const scriptPath = path.join(__dirname, 'scripts', 'desktop-widget.ps1');
    console.log(`[desktop-widget] running action=${action} hwnd=${hwnd}`);
    execFile(
      'powershell.exe',
      ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', scriptPath, '-Action', action, '-Hwnd', hwnd],
      (err, stdout, stderr) => {
        if (stdout && stdout.trim()) console.log(`[desktop-widget] ${action} stdout:`, stdout.trim());
        if (stderr && stderr.trim()) console.error(`[desktop-widget] ${action} stderr:`, stderr.trim());
        if (err) console.error(`[desktop-widget] ${action} failed:`, err);
      }
    );
  } catch (e) {
    console.error('runDesktopWidgetScript error:', e);
  }
}

function attachToDesktop(win) {
  runDesktopWidgetScript('attach', win);
}

function detachFromDesktop(win) {
  runDesktopWidgetScript('detach', win);
}

function applyDeskLock(lock, notifyRenderer = true) {
  deskLocked = lock;
  if (!mainWindow) return;
  if (lock) {
    mainWindow.setAlwaysOnTop(false);
    mainWindow.setIgnoreMouseEvents(true, { forward: true });
    console.log('[desk-lock] ignoreMouseEvents=true (forward) applied');
    mainWindow.setSkipTaskbar(true);
    attachToDesktop(mainWindow);
  } else {
    detachFromDesktop(mainWindow);
    mainWindow.setIgnoreMouseEvents(false);
    mainWindow.setSkipTaskbar(false);
    mainWindow.moveTop();
    mainWindow.focus();
  }
  const data = loadData();
  data.deskLocked = lock;
  saveData(data);
  if (notifyRenderer && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('desk-lock-changed', lock);
  }
}

function showWindow() {
  mainWindow.show();
  if (deskLocked) {
    attachToDesktop(mainWindow);
  } else {
    mainWindow.focus();
  }
}

function createWindow() {
  const data = loadData();
  const display = screen.getPrimaryDisplay().workAreaSize;

  const bounds = data.windowBounds || {
    width: 380,
    height: 520,
    x: display.width - 400,
    y: 60
  };

  mainWindow = new BrowserWindow({
    ...bounds,
    minWidth: 300,
    minHeight: 360,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    alwaysOnTop: false,
    skipTaskbar: false,
    icon: path.join(__dirname, 'assets', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.loadFile('index.html');

  mainWindow.once('ready-to-show', () => {
    if (data.deskLocked) {
      applyDeskLock(true);
    }
  });

  mainWindow.on('close', (e) => {
    if (!isQuitting) {
      e.preventDefault();
      const data = loadData();
      data.windowBounds = mainWindow.getBounds();
      saveData(data);
      mainWindow.hide();
    }
  });

  mainWindow.on('resize', persistBounds);
  mainWindow.on('move', persistBounds);
}

function persistBounds() {
  if (!mainWindow) return;
  const data = loadData();
  data.windowBounds = mainWindow.getBounds();
  saveData(data);
}

function createTray() {
  const iconPath = path.join(__dirname, 'assets', 'tray.png');
  tray = new Tray(iconPath);
  tray.setToolTip('CodeNote');

  const contextMenu = Menu.buildFromTemplate([
    {
      label: '顯示 / 隱藏',
      click: () => {
        if (mainWindow.isVisible()) {
          mainWindow.hide();
        } else {
          showWindow();
        }
      }
    },
    {
      label: '解除桌布鎖定',
      click: () => {
        applyDeskLock(false);
      }
    },
    { type: 'separator' },
    {
      label: '結束',
      click: () => {
        isQuitting = true;
        app.quit();
      }
    }
  ]);

  tray.setContextMenu(contextMenu);

  tray.on('click', () => {
    if (mainWindow.isVisible()) {
      mainWindow.hide();
    } else {
      showWindow();
    }
  });
}

app.whenReady().then(() => {
  createWindow();
  createTray();
});

app.on('before-quit', () => {
  isQuitting = true;
});

app.on('window-all-closed', (e) => {
  e.preventDefault();
});

// IPC handlers
ipcMain.handle('data:load', () => loadData());

ipcMain.handle('data:save', (event, data) => {
  saveData(data);
  return true;
});

ipcMain.handle('window:minimize', () => {
  mainWindow.hide();
});

ipcMain.handle('window:close', () => {
  const data = loadData();
  data.windowBounds = mainWindow.getBounds();
  saveData(data);
  mainWindow.hide();
});

ipcMain.handle('window:set-desk-lock', (event, lock) => {
  applyDeskLock(lock, false);
  return lock;
});

ipcMain.on('window:set-click-through-sync', (event, ignore) => {
  if (mainWindow && deskLocked) {
    mainWindow.setIgnoreMouseEvents(ignore, { forward: true });
  }
  event.returnValue = ignore;
});

ipcMain.handle('app:get-autostart', () => {
  return app.getLoginItemSettings().openAtLogin;
});

ipcMain.handle('app:set-autostart', (event, enabled) => {
  app.setLoginItemSettings({
    openAtLogin: enabled,
    path: process.execPath
  });
  return enabled;
});
