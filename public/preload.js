const { contextBridge, ipcRenderer } = require('electron');

console.log('preload.js: Script started');

contextBridge.exposeInMainWorld('electronAPI', {
  send: (channel, data) => {
    console.log(`preload.js: Sending ${channel} with data:`, data);
    ipcRenderer.send(channel, data);
  },
  on: (channel, func) => {
    console.log(`preload.js: Setting up listener for ${channel}`);
    ipcRenderer.on(channel, (event, ...args) => func(...args));
  },
  removeAllListeners: (channel) => {
    console.log(`preload.js: Removing all listeners for ${channel}`);
    ipcRenderer.removeAllListeners(channel);
  },
  getHistory: () => ipcRenderer.invoke('get-history'),
  clearHistory: () => ipcRenderer.send('clear-history'),
  setBrowserViewVisibility: (isVisible) => ipcRenderer.send('set-browser-view-visibility', isVisible),
  
  // 新しいタブ管理API
  newTab: (initialUrl) => ipcRenderer.send('new-tab', initialUrl),
  switchTab: (tabId) => ipcRenderer.send('switch-tab', tabId),
  closeTab: (tabId) => ipcRenderer.send('close-tab', tabId),
  getTabs: () => ipcRenderer.invoke('get-tabs'),
  
  // メインプロセスからのイベントリスナー
  onTabUpdated: (callback) => ipcRenderer.on('tab-updated', (event, data) => callback(data)),
  onActiveTabChanged: (callback) => ipcRenderer.on('active-tab-changed', (event, tabId) => callback(tabId)),
  onTabClosed: (callback) => ipcRenderer.on('tab-closed', (event, tabId) => callback(tabId)),
});

console.log('preload.js: Script finished');
