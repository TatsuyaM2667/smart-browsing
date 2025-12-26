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
  setUiHeight: (height) => ipcRenderer.send('set-ui-height', height),
  addressBarFocus: () => ipcRenderer.send('address-bar-focus'),
  addressBarBlur: () => ipcRenderer.send('address-bar-blur'),
  deleteHistoryItem: (url) => ipcRenderer.invoke('delete-history-item', url),
  setIncognito: (isActive) => ipcRenderer.send('set-incognito', isActive),
  onIncognitoChanged: (callback) => ipcRenderer.on('incognito-changed', (event, isActive) => callback(isActive)),

  // 新しいタブ管理API
  newTab: (initialUrl) => ipcRenderer.send('new-tab', initialUrl),
  switchTab: (tabId) => ipcRenderer.send('switch-tab', tabId),
  closeTab: (tabId) => ipcRenderer.send('close-tab', tabId),
  getTabs: () => ipcRenderer.invoke('get-tabs'),

  // メインプロセスからのイベントリスナー
  onTabUpdated: (callback) => ipcRenderer.on('tab-updated', (event, data) => callback(data)),
  onActiveTabChanged: (callback) => ipcRenderer.on('active-tab-changed', (event, tabId) => callback(tabId)),
  onTabClosed: (callback) => ipcRenderer.on('tab-closed', (event, tabId) => callback(tabId)),

  // ブックマーク関連API
  addBookmark: (url, title) => ipcRenderer.invoke('add-bookmark', url, title),
  removeBookmark: (url) => ipcRenderer.invoke('remove-bookmark', url),
  updateBookmark: (oldUrl, newUrl, newTitle) => ipcRenderer.invoke('update-bookmark', oldUrl, newUrl, newTitle),
  isBookmarked: (url) => ipcRenderer.invoke('is-bookmarked', url),
  getBookmarks: () => ipcRenderer.invoke('get-bookmarks'),

  openMenu: (x, y) => ipcRenderer.send('open-main-menu', { x, y }),
  onNavigateInternal: (callback) => ipcRenderer.on('navigate-internal', (event, path) => callback(path)),

  onVideoDetected: (callback) => ipcRenderer.on('video-detected', (event, urls) => callback(urls)),
  onImagesExtracted: (callback) => ipcRenderer.on('images-extracted', (event, urls) => callback(urls)),
  getExtractedImages: () => ipcRenderer.invoke('get-extracted-images'),
  getExtractedVideos: () => ipcRenderer.invoke('get-extracted-videos'),
  downloadImage: (url) => ipcRenderer.send('download-video', url), // Re-use download-video for now as it does downloadURL
  onDownloadStatus: (callback) => ipcRenderer.on('download-status', (event, data) => callback(data)),
  downloadVideo: (url) => ipcRenderer.send('download-video', url),
  extractPageContent: () => ipcRenderer.invoke('extract-page-content'),
  triggerPiP: () => ipcRenderer.send('trigger-pip'),
  selectLocalImage: () => ipcRenderer.invoke('select-local-image'),
  getFirebaseConfig: () => ipcRenderer.invoke('get-firebase-config'),
  getFirebaseConfigSync: () => ipcRenderer.sendSync('get-firebase-config-sync'),
});

console.log('preload.js: Script finished');
