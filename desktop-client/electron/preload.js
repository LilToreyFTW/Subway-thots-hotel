const { contextBridge, ipcRenderer } = require('electron');
const invoke = (channel, value) => ipcRenderer.invoke(channel, value);
contextBridge.exposeInMainWorld('sthDesktop', {
  getState: () => invoke('desktop:get-state'), checkForUpdates: () => invoke('desktop:check-updates'), downloadUpdate: () => invoke('desktop:download-update'), installUpdate: () => invoke('desktop:install-update'), launchGame: () => invoke('desktop:launch-game'), returnLauncher: () => invoke('desktop:return-launcher'), getSettings: () => invoke('desktop:get-settings'), saveSettings: (settings) => invoke('desktop:save-settings'),
  onUpdateState: (callback) => ipcRenderer.on('update-state', (_event, state) => callback(state)), onGameError: (callback) => ipcRenderer.on('game-error', (_event, reason) => callback(reason)), onReturned: (callback) => ipcRenderer.on('returned-to-launcher', callback)
});
