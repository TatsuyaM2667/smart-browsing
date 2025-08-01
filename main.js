const { app, BrowserWindow, BrowserView, ipcMain } = require('electron');
const path = require('path');
const url = require('url');
const fs = require('fs');

let mainWindow;
let views = new Map(); // Map to store BrowserView instances: Map<tabId, BrowserView>
let activeViewId = null;
let nextTabId = 0;

// 履歴ファイルのパス
const historyFilePath = path.join(app.getPath('userData'), 'history.json');

// 履歴データを読み込む関数
function loadHistory() {
  try {
    if (fs.existsSync(historyFilePath)) {
      const data = fs.readFileSync(historyFilePath, 'utf8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('Failed to load history:', error);
  }
  return [];
}

// 履歴データを保存する関数
function saveHistory(history) {
  try {
    fs.writeFileSync(historyFilePath, JSON.stringify(history, null, 2), 'utf8');
  } catch (error) {
    console.error('Failed to save history:', error);
  }
}

// ブックマークファイルのパス
const bookmarksFilePath = path.join(app.getPath('userData'), 'bookmarks.json');

// ブックマークデータを読み込む関数
function loadBookmarks() {
  try {
    if (fs.existsSync(bookmarksFilePath)) {
      const data = fs.readFileSync(bookmarksFilePath, 'utf8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('Failed to load bookmarks:', error);
  }
  return [];
}

// ブックマークデータを保存する関数
function saveBookmarks(bookmarks) {
  try {
    fs.writeFileSync(bookmarksFilePath, JSON.stringify(bookmarks, null, 2), 'utf8');
  } catch (error) {
    console.error('Failed to save bookmarks:', error);
  }
}

// ブックマークに新しいエントリを追加する関数
function addBookmarkEntry(url, title) {
  const bookmarks = loadBookmarks();
  // 既に存在する場合は追加しない
  if (!bookmarks.some(b => b.url === url)) {
    const newEntry = { url, title, timestamp: new Date().toISOString() };
    bookmarks.push(newEntry);
    saveBookmarks(bookmarks);
  }
}

// ブックマークからエントリを削除する関数
function removeBookmarkEntry(url) {
  let bookmarks = loadBookmarks();
  bookmarks = bookmarks.filter(b => b.url !== url);
  saveBookmarks(bookmarks);
}

// URLがブックマークされているか確認する関数
function isBookmarked(url) {
  const bookmarks = loadBookmarks();
  return bookmarks.some(b => b.url === url);
}

// 履歴に新しいエントリを追加する関数
function addHistoryEntry(url, title) {
  const history = loadHistory();
  const newEntry = { url, title, timestamp: new Date().toISOString() };
  history.unshift(newEntry); // 最新のものを先頭に追加
  const uniqueHistory = [];
  const seenUrls = new Set();
  for (const entry of history) {
    if (!seenUrls.has(entry.url)) {
      uniqueHistory.push(entry);
      seenUrls.add(entry.url);
    }
  }
  saveHistory(uniqueHistory.slice(0, 100)); // 最新100件を保持
}

// タブを作成する関数
function createTab(initialUrl = 'about:blank') { // 初期URLをabout:blankに変更
  const tabId = nextTabId++;
  const newView = new BrowserView();
  views.set(tabId, newView);

  // BrowserViewの初期設定
  const [width, height] = mainWindow.getSize();
  newView.setBounds({ x: 0, y: 60, width: width, height: height - 60 });
  newView.webContents.loadURL(initialUrl);

  // イベントリスナーを設定
  newView.webContents.on('did-finish-load', () => {
    const currentUrl = newView.webContents.getURL();
    const currentTitle = newView.webContents.getTitle();
    addHistoryEntry(currentUrl, currentTitle);
    if (activeViewId === tabId) {
      sendNavState();
    }
    sendTabUpdate(tabId, currentTitle, currentUrl);
  });

  newView.webContents.on('did-navigate', () => {
    if (activeViewId === tabId) {
      sendNavState();
    }
  });
  newView.webContents.on('did-navigate-in-page', () => {
    if (activeViewId === tabId) {
      sendNavState();
    }
  });
  newView.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
    console.error(`BrowserView ${tabId} failed to load: ${validatedURL}, Error: ${errorDescription} (${errorCode})`);
  });

  if (process.env.ELECTRON_START_URL) {
    // newView.webContents.openDevTools({ mode: 'detach' });
  }

  return tabId;
}

// タブを切り替える関数
function switchTab(tabId) {
  if (views.has(tabId)) {
    activeViewId = tabId;
    // BrowserViewの表示はレンダラープロセスに委ねるため、ここでは設定しない
    // mainWindow.setBrowserView(views.get(tabId));
    // サイズを再設定（ウィンドウリサイズイベントと同じロジック）
    const [width, height] = mainWindow.getSize();
    views.get(tabId).setBounds({ x: 0, y: 60, width: width, height: height - 60 });
    sendNavState();
    sendActiveTabChange(tabId);
  } else {
    console.warn(`Attempted to switch to non-existent tab: ${tabId}`);
  }
}

// タブを閉じる関数
function closeTab(tabId) {
  if (views.has(tabId)) {
    const viewToClose = views.get(tabId);
    views.delete(tabId);

    // 閉じようとしているタブがアクティブな場合
    if (activeViewId === tabId) {
      mainWindow.setBrowserView(null); // 現在のBrowserViewをウィンドウからデタッチ

      // BrowserViewを破棄
      if (viewToClose && typeof viewToClose.destroy === 'function') {
        viewToClose.destroy();
      } else {
        console.error(`Error: viewToClose is not a valid BrowserView object or destroy method is missing for tabId: ${tabId}`);
      }

      // アクティブタブの切り替えまたは新しいタブの作成
      if (views.size > 0) {
        const newActiveTabId = views.keys().next().value;
        switchTab(newActiveTabId);
      } else {
        activeViewId = null; // activeViewIdをリセット
        createTabAndSwitch('about:blank'); // 新しいタブは空白ページから開始
      }
    } else {
      // 閉じようとしているタブがアクティブでない場合、単に破棄
      if (viewToClose && typeof viewToClose.destroy === 'function') {
        viewToClose.destroy();
      } else {
        console.error(`Error: viewToClose is not a valid BrowserView object or destroy method is missing for tabId: ${tabId}`);
      }
    }
    sendTabClosed(tabId); // レンダラープロセスにタブが閉じたことを通知
  }
}

// 新しいタブを作成してアクティブにするヘルパー関数
function createTabAndSwitch(initialUrl) {
  const newTabId = createTab(initialUrl);
  switchTab(newTabId);
  return newTabId;
}

// レンダラープロセスにナビゲーション状態を送信
function sendNavState() {
  if (activeViewId !== null && views.has(activeViewId)) {
    const currentView = views.get(activeViewId);
    mainWindow.webContents.send('update-navigation-state', {
      url: currentView.webContents.getURL(),
      canGoBack: currentView.webContents.navigationHistory.canGoBack(),
      canGoForward: currentView.webContents.navigationHistory.canGoForward(),
    });
  }
}

// レンダラープロセスにタブのタイトルとURLの更新を送信
function sendTabUpdate(tabId, title, url) {
  mainWindow.webContents.send('tab-updated', { tabId, title, url });
}

// レンダラープロセスにアクティブタブの変更を送信
function sendActiveTabChange(tabId) {
  mainWindow.webContents.send('active-tab-changed', tabId);
}

// レンダラープロセスにタブが閉じたことを送信
function sendTabClosed(tabId) {
  mainWindow.webContents.send('tab-closed', tabId);
}

function createWindow() {
  console.log('main.js: createWindow called');
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(app.getAppPath(), 'public', 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  const startUrl =
    process.env.ELECTRON_START_URL ||
    url.format({
      pathname: path.join(__dirname, './build/index.html'),
      protocol: 'file:',
      slashes: true,
    });
  mainWindow.loadURL(startUrl);

  // アプリケーション起動時に最初のタブを作成
  createTabAndSwitch('about:blank'); // 初期タブは空白ページから開始

  // ウィンドウのリサイズに合わせてアクティブなBrowserViewのサイズを調整
  mainWindow.on('resize', () => {
    if (activeViewId !== null && views.has(activeViewId)) {
      const [width, height] = mainWindow.getSize();
      views.get(activeViewId).setBounds({ x: 0, y: 60, width: width, height: height - 60 });
    }
  });

  // IPCハンドラー
  ipcMain.on('new-tab', (event, initialUrl) => {
    createTabAndSwitch(initialUrl);
  });

  ipcMain.on('switch-tab', (event, tabId) => {
    switchTab(tabId);
  });

  ipcMain.on('close-tab', (event, tabId) => {
    closeTab(tabId);
  });

  ipcMain.handle('get-tabs', async () => {
    const tabsInfo = [];
    for (const [id, view] of views.entries()) {
      tabsInfo.push({
        id: id,
        title: view.webContents.getTitle(),
        url: view.webContents.getURL(),
        isActive: id === activeViewId,
      });
    }
    return tabsInfo;
  });

  ipcMain.on('navigate', (event, targetUrl) => {
    if (activeViewId === null || !views.has(activeViewId)) {
      console.warn('No active BrowserView to navigate.');
      return;
    }
    const currentView = views.get(activeViewId);

    console.log(`main.js: Received navigation request for: ${targetUrl}`);
    // 厳密なURL正規表現 (http/httpsスキーム、またはドメインとTLDを含む)
    const strictUrlRegex = /^(https?:\/\/)?([a-zA-Z0-9-]+\.)+[a-zA-Z]{2,6}(?:\/[^\s]*)?$/;

    let finalUrl = targetUrl;
    let isUrl = false;

    console.log(`main.js: Checking targetUrl: ${targetUrl}`);
    console.log(`main.js: strictUrlRegex.test(targetUrl): ${strictUrlRegex.test(targetUrl)}`);
    console.log(`main.js: targetUrl.includes('.'): ${targetUrl.includes('.')}`);
    console.log(`main.js: targetUrl.startsWith('localhost'): ${targetUrl.startsWith('localhost')}`);
    console.log(`main.js: /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}(:\d+)?$/.test(targetUrl): ${/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}(:\d+)?$/.test(targetUrl)}`);

    if (strictUrlRegex.test(targetUrl)) {
      isUrl = true;
      console.log(`main.js: ${targetUrl} matches strict URL regex. Setting isUrl to true.`);
      if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
        finalUrl = `https://${targetUrl}`; 
        console.log(`main.js: Added https://. finalUrl: ${finalUrl}`);
      }
    } else if (targetUrl.startsWith('localhost') || /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}(:\d+)?$/.test(targetUrl)) {
      isUrl = true;
      console.log(`main.js: ${targetUrl} is localhost or IP. Setting isUrl to true. Treating as URL.`);
      if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
        finalUrl = `http://${targetUrl}`; // localhostやIPはhttpで試す
        console.log(`main.js: Added http://. finalUrl: ${finalUrl}`);
      }
    } else if (targetUrl.includes('.')) {
      // ドットを含むがstrictUrlRegexにマッチしない場合（例: example.com）
      isUrl = true;
      console.log(`main.js: ${targetUrl} contains a dot but not strict URL. Assuming it's a URL.`);
      if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
        finalUrl = `https://${targetUrl}`; // https:// を追加して試す
        console.log(`main.js: Added https://. finalUrl: ${finalUrl}`);
      }
    } else {
      // 上記のどれにもマッチしない場合、検索クエリとして扱う
      isUrl = false;
      console.log(`main.js: ${targetUrl} is treated as a search query.`);
    }

    console.log(`main.js: Final isUrl: ${isUrl}, Final finalUrl: ${finalUrl}`);

    if (isUrl) {
      currentView.webContents.loadURL(finalUrl);
    } else {
      console.log(`main.js: Loading Google search for: ${targetUrl}`);
      const searchQuery = encodeURIComponent(targetUrl);
      currentView.webContents.loadURL(`https://www.google.com/search?q=${searchQuery}`);
    }
  });

  ipcMain.on('go-back', () => {
    if (activeViewId !== null && views.has(activeViewId)) {
      const currentView = views.get(activeViewId);
      if (currentView.webContents.navigationHistory.canGoBack()) {
        currentView.webContents.navigationHistory.goBack();
      }
    }
  });

  ipcMain.on('go-forward', () => {
    if (activeViewId !== null && views.has(activeViewId)) {
      const currentView = views.get(activeViewId);
      if (currentView.webContents.navigationHistory.canGoForward()) {
        currentView.webContents.navigationHistory.goForward();
      }
    }
  });

  ipcMain.on('reload', () => {
    if (activeViewId !== null && views.has(activeViewId)) {
      views.get(activeViewId).webContents.reload();
    }
  });

  ipcMain.handle('get-history', async () => {
    return loadHistory();
  });

  ipcMain.on('clear-history', (event) => {
    saveHistory([]);
    event.sender.send('history-cleared');
  });

  ipcMain.handle('add-bookmark', async (event, url, title) => {
    addBookmarkEntry(url, title);
  });

  ipcMain.handle('remove-bookmark', async (event, url) => {
    removeBookmarkEntry(url);
  });

  ipcMain.handle('is-bookmarked', async (event, url) => {
    return isBookmarked(url);
  });

  ipcMain.handle('get-bookmarks', async () => {
    return loadBookmarks();
  });

  // BrowserViewの表示/非表示を切り替えるIPCハンドラー
  ipcMain.on('set-browser-view-visibility', (event, isVisible) => {
    if (isVisible) {
      if (activeViewId !== null && views.has(activeViewId)) {
        mainWindow.setBrowserView(views.get(activeViewId));
        const [width, height] = mainWindow.getSize();
        views.get(activeViewId).setBounds({ x: 0, y: 60, width: width, height: height - 60 });
      }
    } else {
      mainWindow.setBrowserView(null);
    }
  });

  if (process.env.ELECTRON_START_URL) {
    mainWindow.webContents.openDevTools();
  }
}

app.whenReady().then(() => {
  console.log('main.js: app.whenReady() called');
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
