const electron = require('electron');
const { app, BrowserWindow, BrowserView, ipcMain, Menu, dialog } = electron;
const path = require('path');
const url = require('url');
const fs = require('fs');
const { ElectronBlocker } = require('@cliqz/adblocker-electron');
const fetch = require('cross-fetch');

// Load .env values into process.env for main process
try {
  const envPath = path.join(__dirname, '.env');
  if (fs.existsSync(envPath)) {
    const envConfig = fs.readFileSync(envPath, 'utf8');
    envConfig.split(/\r?\n/).forEach(line => {
      const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
      if (match) {
        let value = match[2] ? match[2].trim() : '';
        if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
        if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
        process.env[match[1]] = value;
      }
    });
    console.log('.env loaded for main process');
  }
} catch (e) {
  console.error('Failed to load .env:', e);
}

const commonUserAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";



electron.protocol.registerSchemesAsPrivileged([
  {
    scheme: 'app',
    privileges: {
      standard: true,
      secure: true,
      allowServiceWorkers: true,
      corsEnabled: true,
      supportFetchAPI: true,
    },
  },
]);

let mainWindow;
let views = new Map(); // Map<tabId, { view: BrowserView, isHistory: boolean }>
let activeViewId = null;
let nextTabId = 0;
let uiOffsetHeight = 0;
let currentTheme = 'light';
let isIncognitoGlobal = false;
let sidebarOpenGlobal = false;
let readerModeActiveGlobal = false;
let authModalOpenGlobal = false;
let videoModalOpenGlobal = false;
let blocker;
const adblockedSessions = new Set();
let blocksPerSession = new Map(); // session -> count

const historyFilePath = path.join(app.getPath('userData'), 'history.json');

function loadHistory() {
  try {
    if (fs.existsSync(historyFilePath)) {
      return JSON.parse(fs.readFileSync(historyFilePath, 'utf8'));
    }
  } catch (error) { console.error('Failed to load history:', error); }
  return [];
}

function saveHistory(history) {
  try {
    fs.writeFileSync(historyFilePath, JSON.stringify(history, null, 2), 'utf8');
  } catch (error) { console.error('Failed to save history:', error); }
}

const bookmarksFilePath = path.join(app.getPath('userData'), 'bookmarks.json');

function loadBookmarks() {
  try {
    if (fs.existsSync(bookmarksFilePath)) {
      return JSON.parse(fs.readFileSync(bookmarksFilePath, 'utf8'));
    }
  } catch (error) { console.error('Failed to load bookmarks:', error); }
  return [];
}

function saveBookmarks(bookmarks) {
  try {
    fs.writeFileSync(bookmarksFilePath, JSON.stringify(bookmarks, null, 2), 'utf8');
  } catch (error) { console.error('Failed to save bookmarks:', error); }
}

function addBookmarkEntry(url, title) {
  const bookmarks = loadBookmarks();
  if (!bookmarks.some(b => b.url === url)) {
    bookmarks.push({ url, title, timestamp: new Date().toISOString() });
    saveBookmarks(bookmarks);
  }
}

function removeBookmarkEntry(url) {
  let bookmarks = loadBookmarks();
  saveBookmarks(bookmarks.filter(b => b.url !== url));
}

function isBookmarked(url) {
  return loadBookmarks().some(b => b.url === url);
}

function addHistoryEntry(url, title) {
  if (isIncognitoGlobal) return; // Skip history in incognito mode
  if (url.includes('#/history')) return; // Do not add history page to history
  const history = loadHistory();
  const newEntry = { url, title, timestamp: new Date().toISOString() };
  const uniqueHistory = [newEntry, ...history.filter(e => e.url !== url)];
  saveHistory(uniqueHistory.slice(0, 100));
}

// Store extracted images per tab or globally temporarily
let extractedImagesStore = new Map(); // tabId -> [urls]

async function setupAdblocker(session) {
  if (adblockedSessions.has(session)) return;

  try {
    if (!blocker) {
      blocker = await ElectronBlocker.fromPrebuiltAdsAndTracking(fetch);

      // Add patterns to allowlist to prevent site breakages
      blocker.addPatternsToAllowList([
        '*youtube.com*',
        '*googlevideo.com*',
        '*ytimg.com*',
        '*ggpht.com*',
        '*google.com*',
        '*gstatic.com*',
        '*googleusercontent.com*',
        '*apis.google.com*',
        '*firebaseapp.com*',
        '*firebaseio.com*',
        '*googleapis.com*',
        '*firebase.google.com*'
      ]);

      console.log('Adblocker initialized with extensive whitelists');
    }

    // Explicitly allow critical domains at the session level
    const bypassFilters = {
      urls: [
        '*://*.youtube.com/*',
        '*://*.googlevideo.com/*',
        '*://*.ytimg.com/*',
        '*://*.ggpht.com/*',
        '*://youtube.com/*',
        '*://www.youtube.com/*',
        '*://m.youtube.com/*',
        '*://*.google.com/*',
        '*://*.gstatic.com/*',
        '*://*.googleapis.com/*',
        '*://*.firebaseapp.com/*',
        '*://*.firebaseio.com/*',
        '*://*.apis.google.com/*',
        '*://*.firebase.google.com/*'
      ]
    };

    session.webRequest.onBeforeRequest(bypassFilters, (details, callback) => {
      if (details.url.includes('youtube.com')) {
        console.log(`Bypassing blocker for YouTube URL: ${details.url}`);
      }
      callback({ cancel: false });
    });

    blocker.enableBlockingInSession(session);
    adblockedSessions.add(session);
    blocksPerSession.set(session, 0);

    blocker.on('request-blocked', (request) => {
      const { url } = request;
      if (url.includes('youtube.com') || url.includes('googlevideo.com') || url.includes('ytimg.com')) {
        return;
      }
      const count = (blocksPerSession.get(session) || 0) + 1;
      blocksPerSession.set(session, count);

      // Update UI if this session belongs to the active view
      if (activeViewId !== null && views.has(activeViewId)) {
        if (views.get(activeViewId).view.webContents.session === session) {
          mainWindow.webContents.send('adblock-stats', count);
        }
      }
    });

    console.log(`Adblocker enabled for session: ${session.getStoragePath() || 'incognito'}`);
  } catch (error) {
    console.error('Failed to setup adblocker:', error);
  }
}

function createTab(initialUrl = '/home', options = {}) {
  const { isHistory = false } = options;
  const tabId = nextTabId++;
  const newView = new BrowserView({
    webPreferences: {
      preload: path.join(app.getAppPath(), 'public', 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      partition: isIncognitoGlobal ? 'incognito' : undefined,
    },
  });

  views.set(tabId, { view: newView, isHistory });

  newView.webContents.setUserAgent(commonUserAgent);
  const session = newView.webContents.session;
  setupAdblocker(session);

  const [width, height] = mainWindow.getContentSize();
  newView.setBounds({ x: 0, y: uiOffsetHeight, width: width, height: height - uiOffsetHeight });
  newView.setAutoResize({ width: true, height: true, horizontal: false, vertical: false });

  // Handle Internal URLs
  let loadUrl = initialUrl;
  const devServerUrl = 'http://localhost:3003';
  const buildUrl = url.format({ pathname: path.join(__dirname, './build/index.html'), protocol: 'file:', slashes: true });
  const baseUrl = process.env.ELECTRON_START_URL ? devServerUrl : buildUrl;

  if (initialUrl.startsWith('/')) {
    // It's an internal page, load it in the BrowserView with special mode
    const suffix = initialUrl === '/' ? '' : initialUrl;
    // Construct URL: http://localhost:3003/history?mode=browser-view or file://.../index.html#/history?mode=browser-view
    if (process.env.ELECTRON_START_URL) {
      loadUrl = `${baseUrl}${suffix}?mode=browser-view`;
    } else {
      loadUrl = `${baseUrl}#${suffix}?mode=browser-view`;
    }
  }

  newView.webContents.loadURL(loadUrl);

  newView.webContents.on('did-finish-load', async () => {
    const currentUrl = newView.webContents.getURL();
    let currentTitle = newView.webContents.getTitle();

    // Better Title Handling for Internal Pages
    if (currentUrl.includes('/history')) currentTitle = 'History';
    if (currentUrl.includes('/bookmarks')) currentTitle = 'Bookmarks';
    if (currentUrl.includes('/videos')) currentTitle = 'Extracted Videos';
    if (currentUrl.includes('/home')) currentTitle = 'New Tab';
    if (!currentTitle || currentUrl === 'about:blank') currentTitle = 'New Tab';

    // Send current theme to the new view
    newView.webContents.send('theme-updated', currentTheme);

    if (!isHistory && !currentUrl.includes('mode=browser-view')) { // Don't add internal pages to history
      addHistoryEntry(currentUrl, currentTitle);
    }

    if (activeViewId === tabId) sendNavState();

    // Send update to UI
    let displayUrl = currentUrl;
    if (currentUrl.includes('mode=browser-view')) {
      // Beautify URL for address bar
      if (currentUrl.includes('/history')) displayUrl = '/history';
      else if (currentUrl.includes('/bookmarks')) displayUrl = '/bookmarks';
      else if (currentUrl.includes('/images')) displayUrl = '/images';
    }

    sendTabUpdate(tabId, currentTitle, displayUrl, isHistory);

    // Auto-detect videos (skip for internal)
    if (!currentUrl.includes('mode=browser-view')) {
      try {
        const videoUrls = await newView.webContents.executeJavaScript(`
                Array.from(document.querySelectorAll('video'))
                    .map(v => v.src || v.querySelector('source')?.src)
                    .filter(src => src && src.startsWith('http'));
            `);
        if (activeViewId === tabId) {
          mainWindow.webContents.send('video-detected', videoUrls || []);
        }
      } catch (e) {
        if (activeViewId === tabId) {
          mainWindow.webContents.send('video-detected', []);
        }
      }
    } else {
      if (activeViewId === tabId) mainWindow.webContents.send('video-detected', []);
    }
  });

  newView.webContents.on('did-navigate', (event, url) => {
    if (activeViewId === tabId) {
      sendNavState();
      mainWindow.webContents.send('video-detected', []);
    }
  });

  return tabId;
}



function closeTab(tabId) {
  if (views.has(tabId)) {
    const { view } = views.get(tabId);
    // Remove the browser view from the window if it's currently attached
    if (activeViewId === tabId) {
      mainWindow.setBrowserView(null);
    }
    // Destroy the WebContents to stop audio/video and free resources
    // setTimeout to avoid destroying while IPC is potentially finishing
    setTimeout(() => {
      if (!view.webContents.isDestroyed()) {
        view.webContents.destroy();
      }
    }, 100);

    views.delete(tabId);
    if (activeViewId === tabId) {
      if (views.size > 0) {
        const newActiveTabId = views.keys().next().value;
        switchTab(newActiveTabId);
      } else {
        activeViewId = null;
        createTabAndSwitch('/home');
      }
    }
    sendTabClosed(tabId);
  }
}

function createTabAndSwitch(initialUrl, options = {}) {
  const newTabId = createTab(initialUrl, options);
  switchTab(newTabId);
  return newTabId;
}

function sendNavState() {
  if (activeViewId !== null && views.has(activeViewId)) {
    const { view, isHistory } = views.get(activeViewId);
    mainWindow.webContents.send('update-navigation-state', {
      url: view.webContents.getURL(),
      canGoBack: view.webContents.navigationHistory.canGoBack(),
      canGoForward: view.webContents.navigationHistory.canGoForward(),
      isHistoryTab: isHistory,
    });
  }
}

function sendTabUpdate(tabId, title, url, isHistory) {
  mainWindow.webContents.send('tab-updated', { tabId, title, url, isHistory });
}

function sendActiveTabChange(tabId) {
  mainWindow.webContents.send('active-tab-changed', tabId);
}

function sendTabClosed(tabId) {
  mainWindow.webContents.send('tab-closed', tabId);
}

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(app.getAppPath(), 'public', 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.webContents.setUserAgent(commonUserAgent);

  const startUrl = process.env.ELECTRON_START_URL || url.format({ pathname: path.join(__dirname, './build/index.html'), protocol: 'file:', slashes: true });
  mainWindow.loadURL(startUrl);
  mainWindow.setMaxListeners(20);

  if (process.env.ELECTRON_START_URL) {
    mainWindow.webContents.openDevTools();
  }

  // AdBlocker Setup - Disabled to fix YouTube issues
  // try {
  //   const blocker = await ElectronBlocker.fromPrebuiltAdsAndTracking(fetch);
  //   blocker.enableBlockingInSession(mainWindow.webContents.session);
  //   console.log('AdBlocker enabled');
  // } catch (err) {
  //   console.error('Failed to enable AdBlocker:', err);
  // }

  // Security: Permission Request Handler
  // Security: Permission Request Handler
  // Security: Permission Request Handler - Allow all by default as requested
  mainWindow.webContents.session.setPermissionRequestHandler((webContents, permission, callback) => {
    callback(true);
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Setup adblocker for the default session
  setupAdblocker(mainWindow.webContents.session);

  mainWindow.on('resize', () => {
    if (activeViewId !== null && views.has(activeViewId)) {
      const [width, height] = mainWindow.getContentSize();
      views.get(activeViewId).view.setBounds({ x: 0, y: uiOffsetHeight, width: width, height: height - uiOffsetHeight });
    }
  });

  // Handle downloads
  mainWindow.webContents.session.on('will-download', (event, item, webContents) => {
    console.log('Downloading:', item.getFilename());

    item.on('updated', (event, state) => {
      if (state === 'interrupted') {
        console.log('Download is interrupted but can be resumed')
      } else if (state === 'progressing') {
        // console.log(`Received bytes: ${item.getReceivedBytes()}`)
      }
    });

    item.once('done', (event, state) => {
      if (state === 'completed') {
        console.log('Download successfully');
        mainWindow.webContents.send('download-status', { status: 'success', filename: item.getFilename() });
      } else {
        console.log(`Download failed: ${state}`);
        mainWindow.webContents.send('download-status', { status: 'error', filename: item.getFilename(), state });
      }
    });
  });
  createTabAndSwitch('/home');
}

ipcMain.on('set-ui-height', (event, height) => {
  uiOffsetHeight = height;
  updateBrowserViewLayout();
});

// Send navigation state to renderer
function sendNavState() {
  if (activeViewId !== null && views.has(activeViewId)) {
    const { view } = views.get(activeViewId);
    const canGoBack = view.webContents.navigationHistory.canGoBack();
    const canGoForward = view.webContents.navigationHistory.canGoForward();
    const url = view.webContents.getURL();
    mainWindow.webContents.send('update-navigation-state', { canGoBack, canGoForward, url });
  }
}

// Send active tab change notification to renderer
function sendActiveTabChange(tabId) {
  mainWindow.webContents.send('active-tab-changed', tabId);
}

ipcMain.on('new-tab', (event, initialUrl) => createTabAndSwitch(initialUrl || '/home'));
function switchTab(tabId) {
  if (views.has(tabId)) {
    activeViewId = tabId;
    const { view } = views.get(tabId);

    // Unified switching - NO OVERLAYS
    mainWindow.setBrowserView(view);
    const [width, height] = mainWindow.getContentSize();
    view.setBounds({ x: 0, y: uiOffsetHeight, width: width, height: height - uiOffsetHeight });
    view.setAutoResize({ width: true, height: true, horizontal: false, vertical: false });

    sendNavState();
    sendActiveTabChange(tabId);

    // Send adblock stats for this session
    const session = view.webContents.session;
    mainWindow.webContents.send('adblock-stats', blocksPerSession.get(session) || 0);

    updateBrowserViewLayout();
  }
}

function updateBrowserViewLayout() {
  if (activeViewId === null || !views.has(activeViewId) || !mainWindow) return;
  const { view } = views.get(activeViewId);
  const bounds = mainWindow.getContentBounds();

  if (readerModeActiveGlobal || authModalOpenGlobal || videoModalOpenGlobal) {
    mainWindow.setBrowserView(null);
  } else {
    mainWindow.setBrowserView(view);
    const sidebarWidth = sidebarOpenGlobal ? 280 : 0;
    view.setBounds({
      x: sidebarWidth,
      y: uiOffsetHeight,
      width: Math.max(bounds.width - sidebarWidth, 0),
      height: Math.max(bounds.height - uiOffsetHeight, 0)
    });
    view.setAutoResize({ width: true, height: true, horizontal: false, vertical: false });
  }
}

ipcMain.on('ui-state-changed', (event, { sidebarOpen, readerModeActive, authModalOpen, videoModalOpen }) => {
  sidebarOpenGlobal = sidebarOpen;
  readerModeActiveGlobal = readerModeActive;
  authModalOpenGlobal = authModalOpen;
  videoModalOpenGlobal = videoModalOpen;
  updateBrowserViewLayout();
});


ipcMain.on('switch-tab', (event, tabId) => switchTab(tabId));
ipcMain.on('close-tab', (event, tabId) => closeTab(tabId));

ipcMain.handle('get-tabs', async () => {
  return Array.from(views.entries()).map(([id, tabData]) => {
    let title = tabData.isHistory ? 'History' : tabData.view.webContents.getTitle();
    const url = tabData.view.webContents.getURL();
    if (url.includes('/history')) title = 'History';
    if (url.includes('/bookmarks')) title = 'Bookmarks';
    if (url.includes('/images')) title = 'Extracted Images';
    if (!title || url === 'about:blank') title = 'New Tab';

    let displayUrl = url;
    if (url.includes('mode=browser-view')) {
      if (url.includes('/history')) displayUrl = '/history';
      else if (url.includes('/bookmarks')) displayUrl = '/bookmarks';
      else if (url.includes('/images')) displayUrl = '/images';
    }

    return {
      id: id,
      title: title,
      url: displayUrl,
      isActive: id === activeViewId,
      isHistory: tabData.isHistory,
    };
  });
});

ipcMain.on('navigate', (event, targetUrl) => {
  console.log(`Navigation requested to: ${targetUrl}`);
  if (activeViewId === null || !views.has(activeViewId)) return;
  const { view } = views.get(activeViewId);

  let finalUrl;
  try {
    const parsedUrl = new URL(targetUrl);
    finalUrl = parsedUrl.toString();
  } catch (e) {
    if (targetUrl.startsWith('/')) {
      // Internal navigation requested from address bar
      const devServerUrl = 'http://localhost:3003';
      const buildUrl = url.format({ pathname: path.join(__dirname, './build/index.html'), protocol: 'file:', slashes: true });
      const baseUrl = process.env.ELECTRON_START_URL ? devServerUrl : buildUrl;
      if (process.env.ELECTRON_START_URL) {
        finalUrl = `${baseUrl}${targetUrl}?mode=browser-view`;
      } else {
        finalUrl = `${baseUrl}#${targetUrl}?mode=browser-view`;
      }
    } else if (targetUrl.includes('.') && !targetUrl.includes(' ')) {
      finalUrl = `https://${targetUrl}`;
    } else {
      const searchUrlTemplate = process.env.SEARCH_ENGINE_URL || 'https://www.google.com/search?q=%s';
      finalUrl = searchUrlTemplate.replace('%s', encodeURIComponent(targetUrl));
    }
  }

  // Ensure BrowserView is visible and correctly sized
  updateBrowserViewLayout();
  view.webContents.loadURL(finalUrl);
});

ipcMain.on('go-back', () => { if (activeViewId !== null && views.has(activeViewId)) views.get(activeViewId).view.webContents.goBack(); });
ipcMain.on('go-forward', () => { if (activeViewId !== null && views.has(activeViewId)) views.get(activeViewId).view.webContents.goForward(); });
ipcMain.on('reload', () => { if (activeViewId !== null && views.has(activeViewId)) views.get(activeViewId).view.webContents.reload(); });

ipcMain.handle('get-history', async () => loadHistory());
ipcMain.on('clear-history', (event) => { saveHistory([]); event.sender.send('history-cleared'); });
ipcMain.handle('delete-history-item', async (event, url) => {
  let history = loadHistory();
  const filtered = history.filter(item => item.url !== url);
  saveHistory(filtered);
  return filtered;
});

ipcMain.handle('select-local-image', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: [
      { name: 'Images', extensions: ['jpg', 'png', 'gif', 'webp', 'jpeg'] }
    ]
  });

  if (result.canceled || result.filePaths.length === 0) return null;

  const filePath = result.filePaths[0];
  try {
    const data = fs.readFileSync(filePath);
    const extension = path.extname(filePath).slice(1);
    return `data:image/${extension};base64,${data.toString('base64')}`;
  } catch (e) {
    console.error('Failed to read image', e);
    return null;
  }
});

ipcMain.on('set-incognito', (event, isActive) => {
  isIncognitoGlobal = isActive;
  // Notify all windows
  mainWindow.webContents.send('incognito-changed', isActive);
  // Optional: Close all tabs when switching to incognito? 
  // For simplicity, let's just make NEW tabs incognito or use a separate window?
  // User asked for "switching", so let's make it global for new actions.
});

ipcMain.handle('add-bookmark', async (event, url, title) => addBookmarkEntry(url, title));
ipcMain.handle('remove-bookmark', async (event, url) => removeBookmarkEntry(url));
ipcMain.handle('update-bookmark', async (event, oldUrl, newUrl, newTitle) => {
  let bookmarks = loadBookmarks();
  const index = bookmarks.findIndex(b => b.url === oldUrl);
  if (index !== -1) {
    bookmarks[index] = { ...bookmarks[index], url: newUrl, title: newTitle, timestamp: new Date().toISOString() };
    saveBookmarks(bookmarks);
    return true;
  }
  return false;
});
ipcMain.handle('is-bookmarked', async (event, url) => isBookmarked(url));
ipcMain.on('get-firebase-config-sync', (event) => {
  event.returnValue = {
    apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
    authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
    storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.REACT_APP_FIREBASE_APP_ID,
    measurementId: process.env.REACT_APP_FIREBASE_MEASUREMENT_ID
  };
});

ipcMain.handle('get-firebase-config', () => {
  return {
    apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
    authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
    storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.REACT_APP_FIREBASE_APP_ID,
    measurementId: process.env.REACT_APP_FIREBASE_MEASUREMENT_ID
  };
});

ipcMain.handle('get-bookmarks', async () => loadBookmarks());

// Data store handler
ipcMain.handle('get-extracted-images', (event) => {
  // Return images for the *current* view (which should be the ImagesPage)
  // We need to know which tab this request comes from OR passed tabId
  // Actually, we can store it in views map.
  return views.get(activeViewId)?.extractedImages || [];
});

ipcMain.handle('get-extracted-videos', (event) => {
  return views.get(activeViewId)?.extractedVideos || [];
});

// Cleanup strict IPCs regarding visibility
ipcMain.on('set-browser-view-visibility', () => { }); // No-op now

ipcMain.on('address-bar-focus', () => { });


ipcMain.on('download-video', (event, url) => {
  mainWindow.webContents.downloadURL(url);
});

ipcMain.handle('extract-page-content', async () => {
  if (activeViewId === null || !views.has(activeViewId)) return null;
  const { view } = views.get(activeViewId);
  try {
    const result = await view.webContents.executeJavaScript(`
      (() => {
        const title = document.title;
        // Simple extraction: find the element with most paragraphs
        const articles = Array.from(document.querySelectorAll('article, main, .content, .post, .article'));
        let mainEl = articles.sort((a, b) => b.innerText.length - a.innerText.length)[0] || document.body;
        
        // Clone and clean up
        const clone = mainEl.cloneNode(true);
        const toRemove = clone.querySelectorAll('script, style, iframe, nav, footer, header, ads, .ads, .sidebar');
        toRemove.forEach(el => el.remove());
        
        return {
          title: title,
          content: clone.innerHTML
        };
      })()
    `);
    return result;
  } catch (e) {
    console.error('Extraction failed', e);
    return null;
  }
});

ipcMain.on('trigger-pip', async () => {
  if (activeViewId === null || !views.has(activeViewId)) return;
  const { view } = views.get(activeViewId);
  try {
    await view.webContents.executeJavaScript(`
      (() => {
        const video = document.querySelector('video');
        if (video) {
          if (document.pictureInPictureElement) {
            document.exitPictureInPicture();
          } else {
            video.requestPictureInPicture();
          }
        }
      })()
    `);
  } catch (e) {
    console.error('PiP failed', e);
  }
});

// Menu Handler with Video Extraction
ipcMain.on('theme-updated', (event, theme) => {
  currentTheme = theme;
  // Broadcast to all windows/views
  mainWindow.webContents.send('theme-updated', theme);
  views.forEach(({ view }) => {
    view.webContents.send('theme-updated', theme);
  });
});

ipcMain.on('open-main-menu', (event, { x, y }) => {
  const template = [
    { label: 'New Tab', click: () => createTabAndSwitch('/home') },
    { type: 'separator' },
    { label: 'History', click: () => createTabAndSwitch('/history') },
    { label: 'Bookmarks', click: () => createTabAndSwitch('/bookmarks') },
    { type: 'separator' },
    {
      label: 'Extract Videos',
      click: async () => {
        if (activeViewId !== null && views.has(activeViewId)) {
          const { view } = views.get(activeViewId);
          try {
            const videoUrls = await view.webContents.executeJavaScript(`
                Array.from(document.querySelectorAll('video'))
                .map(v => v.src || v.querySelector('source')?.src)
                .filter(src => src && src.startsWith('http'))
                .filter((v, i, a) => a.indexOf(v) === i); // Unique
            `);

            // Open new tab with VideosPage
            const newTabId = createTabAndSwitch('/videos');

            // Store the videos in the NEW tab's data
            if (views.has(newTabId)) {
              views.get(newTabId).extractedVideos = videoUrls;
            }
          } catch (e) {
            console.error('Video extraction failed', e);
          }
        }
      }
    },
    {
      label: 'Extract Images',
      click: async () => {
        if (activeViewId !== null && views.has(activeViewId)) {
          const { view } = views.get(activeViewId);
          try {
            const imageUrls = await view.webContents.executeJavaScript(`
                Array.from(document.querySelectorAll('img'))
                .map(img => img.src)
                .filter(src => src && src && src.startsWith('http'))
                .filter((v, i, a) => a.indexOf(v) === i); // Unique
            `);

            // Open new tab with ImagesPage
            const newTabId = createTabAndSwitch('/images');

            // Store the images in the NEW tab's data
            if (views.has(newTabId)) {
              views.get(newTabId).extractedImages = imageUrls;
            }

          } catch (e) {
            console.error('Image extraction failed', e);
          }
        }
      }
    },
    { type: 'separator' },
    { label: 'Exit', click: () => app.quit() }
  ];
  const menu = Menu.buildFromTemplate(template);
  menu.popup({ window: BrowserWindow.fromWebContents(event.sender), x, y });
});

// Remove address-bar-blur/focus visibility logic as it's no longer needed
ipcMain.on('address-bar-blur', () => { });

// ... Rest of file (createWindow, etc)
// Ensure App.js doesn't break if it calls them.




app.whenReady().then(createWindow);
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
