const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  loadData: () => ipcRenderer.invoke('data:load'),
  saveData: (data) => ipcRenderer.invoke('data:save', data),
  minimize: () => ipcRenderer.invoke('window:minimize'),
  close: () => ipcRenderer.invoke('window:close'),
  setDeskLock: (lock) => ipcRenderer.invoke('window:set-desk-lock', lock),
  // Synchronous on purpose: this runs from a mousemove handler right
  // before a possible click, and an async invoke() doesn't block the
  // renderer long enough to beat that click, so the OS can still deliver
  // it to the window while it's briefly still interactive (race condition).
  setClickThrough: (ignore) => ipcRenderer.sendSync('window:set-click-through-sync', ignore),
  onDeskLockChanged: (callback) => {
    ipcRenderer.on('desk-lock-changed', (event, lock) => callback(lock));
  },
  getAutostart: () => ipcRenderer.invoke('app:get-autostart'),
  setAutostart: (enabled) => ipcRenderer.invoke('app:set-autostart', enabled)
});
