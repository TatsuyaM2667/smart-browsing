import React, { useState, useEffect, useRef } from 'react';
import { Routes, Route, Link, useLocation } from 'react-router-dom';
import './App.css';
import HistoryPage from './pages/HistoryPage';
import HomePage from './pages/HomePage';
import TabHeader from './components/TabHeader';

// プリロードスクリプト経由で公開されたAPIを使用
const { electronAPI } = window;

function BrowserContent({ inputValue, setInputValue, handleNavigate, canGoBack, handleGoBack, canGoForward, handleGoForward, handleReload, showHomePage, isBookmarked, handleBookmarkToggle, setIsTyping, typingTimeoutRef }) {
  const handleSubmit = (e) => {
    e.preventDefault();
    if (typeof setIsTyping === 'function') {
      setIsTyping(false); // 入力終了
    } else {
      console.error("setIsTyping is not a function in handleSubmit!");
    }
    handleNavigate(inputValue);
  };


  const handleInputChange = (e) => {
    if (typeof setIsTyping === 'function') {
      setIsTyping(true); // 入力開始
      // Clear any existing timeout
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      // Set a new timeout to set isTyping to false after a delay
      typingTimeoutRef.current = setTimeout(() => {
        setIsTyping(false);
      }, 500); // Adjust delay as needed
    } else {
      console.error("setIsTyping is not a function in handleInputChange!");
    }
    setInputValue(e.target.value);
  };

  return (
    <div className="browser-content-container">
      <div className="nav-bar">
        <div className="nav-buttons">
          <button onClick={handleGoBack} disabled={!canGoBack}>
            ←
          </button>
          <button onClick={handleGoForward} disabled={!canGoForward}>
            →
          </button>
          <button onClick={handleReload}>↻</button>
        </div>
        <form onSubmit={handleSubmit} className="address-bar-form">
          <input
            type="text"
            value={inputValue}
            onChange={handleInputChange}
            className="address-bar"
            placeholder="https:// or search on Google"
          />
        </form>
        <button onClick={handleBookmarkToggle} className="bookmark-button">
          {isBookmarked ? '★' : '☆'} {/* ブックマークの状態に応じて表示を切り替え */}
        </button>
        <Link to="/history" className="history-button">History</Link>
      </div>
      {showHomePage && <HomePage onSearch={(value) => handleNavigate(value)} />} {/* HomePageにonSearchを渡す */}
    </div>
  );
}

export default function App() {
  const location = useLocation();
  const [tabs, setTabs] = useState([]);
  const [activeTabId, setActiveTabId] = useState(null);
  const [inputValue, setInputValue] = useState('');
  const [canGoBack, setCanGoBack] = useState(false);
  const [canGoForward, setCanGoForward] = useState(false);
  const [showHomePage, setShowHomePage] = useState(false); // HomePageの表示状態
  const [isBookmarked, setIsBookmarked] = useState(false); // ブックマーク状態
  const [isTyping, setIsTyping] = useState(false); // ユーザーがアドレスバーに入力中かどうか
  const typingTimeoutRef = useRef(null); // For debouncing isTyping
  const tabBarRef = useRef(null);
  const navBarRef = useRef(null);
  const [theme, setTheme] = useState(() => {
    // localStorageからテーマを読み込む。なければ'light'をデフォルトとする
    return localStorage.getItem('theme') || 'light';
  });

  // UI要素の高さを計算してメインプロセスに送信
  useEffect(() => {
    if (tabBarRef.current && navBarRef.current) {
      const totalHeight = tabBarRef.current.offsetHeight + navBarRef.current.offsetHeight;
      console.log(`App.js: UI total height: ${totalHeight}px`);
      electronAPI.send('set-ui-height', totalHeight);
    }
  }, [tabs, activeTabId, location.pathname]); // tabs, activeTabId, location.pathname の変更時に再計算

  // テーマが変更されたときにbodyにクラスを適用し、localStorageに保存
  useEffect(() => {
    document.body.className = theme;
    console.log(`App.js: Theme changed to ${theme}, body class set to ${document.body.className}`);
    localStorage.setItem('theme', theme);
  }, [theme]);

  // テーマを切り替える関数
  const toggleTheme = () => {
    setTheme((prevTheme) => (prevTheme === 'light' ? 'dark' : 'light'));
  };

  // 初期タブのロードとイベントリスナーの設定
  useEffect(() => {
    const fetchTabs = async () => {
      const fetchedTabs = await electronAPI.getTabs();
      setTabs(fetchedTabs);
      const active = fetchedTabs.find(tab => tab.isActive);
      if (active) {
        setActiveTabId(active.id);
        // about:blankの場合はinputValueを空にする
        setInputValue(active.url === 'about:blank' ? '' : active.url);
        setShowHomePage(active.url === 'about:blank');
        checkBookmarkStatus(active.url); // ブックマーク状態を確認
      }
    };

    fetchTabs();

    // メインプロセスからのイベントリスナー
    electronAPI.onTabUpdated((data) => {
      setTabs(prevTabs => prevTabs.map(tab => 
        tab.id === data.tabId ? { ...tab, title: data.title, url: data.url } : tab
      ));
      if (data.tabId === activeTabId) {
        // ユーザーが入力中の場合はinputValueを更新しない
        if (!isTyping) {
          setInputValue(data.url === 'about:blank' ? '' : data.url);
        }
        setShowHomePage(data.url === 'about:blank');
        checkBookmarkStatus(data.url); // ブックマーク状態を確認
      }
    });

    electronAPI.onActiveTabChanged((tabId) => {
      setActiveTabId(tabId);
      const active = tabs.find(tab => tab.id === tabId);
      if (active) {
        // ユーザーが入力中の場合はinputValueを更新しない
        if (!isTyping) {
          setInputValue(active.url === 'about:blank' ? '' : active.url);
        }
        setShowHomePage(active.url === 'about:blank');
        checkBookmarkStatus(active.url); // ブックマーク状態を確認
      }
    });

    electronAPI.onTabClosed((tabId) => {
      setTabs(prevTabs => prevTabs.filter(tab => tab.id !== tabId));
    });

    electronAPI.on('update-navigation-state', (navState) => {
      setCanGoBack(navState.canGoBack);
      setCanGoForward(navState.canGoForward);
      checkBookmarkStatus(navState.url); // ナビゲーション状態更新時にもブックマーク状態を確認
    });

    return () => {
      electronAPI.removeAllListeners('tab-updated');
      electronAPI.removeAllListeners('active-tab-changed');
      electronAPI.removeAllListeners('tab-closed');
      electronAPI.removeAllListeners('update-navigation-state');
    };
  }, [activeTabId, tabs, isTyping]);

  // ブックマーク状態を確認する関数
  const checkBookmarkStatus = async (url) => {
    const bookmarked = await electronAPI.isBookmarked(url);
    setIsBookmarked(bookmarked);
  };

  // ブックマークの追加/削除を切り替える関数
  const handleBookmarkToggle = async () => {
    const currentUrl = inputValue;
    const activeTab = tabs.find(tab => tab.id === activeTabId);
    const currentTitle = activeTab ? activeTab.title : currentUrl;

    if (isBookmarked) {
      await electronAPI.removeBookmark(currentUrl);
      setIsBookmarked(false);
    } else {
      await electronAPI.addBookmark(currentUrl, currentTitle);
      setIsBookmarked(true);
    }
  };

  // ルート変更時のBrowserView表示/非表示
  useEffect(() => {
    console.log(`App.js: location.pathname changed to ${location.pathname}`);
    console.log(`App.js: showHomePage is ${showHomePage}`);
    const isBrowserViewVisible = location.pathname !== '/history' && !showHomePage;
    console.log(`App.js: Setting BrowserView visibility to ${isBrowserViewVisible}`);
    electronAPI.setBrowserViewVisibility(isBrowserViewVisible);
  }, [location.pathname, showHomePage]);

  const handleNavigate = (urlToNavigate) => {
    console.log(`App.js: Sending navigation request for: ${urlToNavigate}`);
    electronAPI.send('navigate', urlToNavigate);
  };

  const handleGoBack = () => {
    electronAPI.send('go-back');
  };

  const handleGoForward = () => {
    electronAPI.send('go-forward');
  };

  const handleReload = () => {
    electronAPI.send('reload');
  };

  const handleNewTab = () => {
    electronAPI.newTab();
  };

  const handleSwitchTab = (tabId) => {
    electronAPI.switchTab(tabId);
  };

  const handleCloseTab = (tabId) => {
    electronAPI.closeTab(tabId);
  };

  return (
    <div className="main-container">
      <div className="tab-bar">
        {tabs.map(tab => (
          <TabHeader 
            key={tab.id} 
            tab={tab} 
            onSwitchTab={handleSwitchTab} 
            onCloseTab={handleCloseTab} 
          />
        ))}
        <button onClick={handleNewTab} className="new-tab-button">+</button>
        <button onClick={toggleTheme} className="theme-toggle-button">
          {theme === 'light' ? '🌙' : '☀️'}
        </button>
      </div>
      <Routes>
        <Route path="/" element={
          <BrowserContent 
            inputValue={inputValue}
            setInputValue={setInputValue}
            handleNavigate={handleNavigate}
            canGoBack={canGoBack}
            handleGoBack={handleGoBack}
            canGoForward={canGoForward}
            handleGoForward={handleGoForward}
            handleReload={handleReload}
            showHomePage={showHomePage}
            isBookmarked={isBookmarked}
            handleBookmarkToggle={handleBookmarkToggle}
            setIsTyping={setIsTyping}
            typingTimeoutRef={typingTimeoutRef}
          />
        } />
        <Route path="/history" element={<HistoryPage />} />
      </Routes>
    </div>
  );
}


