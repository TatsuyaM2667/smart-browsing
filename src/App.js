import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import './App.css';
import HistoryPage from './pages/HistoryPage';
import HomePage from './pages/HomePage';
import TabHeader from './components/TabHeader';

// プリロードスクリプト経由で公開されたAPIを使用
const { electronAPI } = window;

function BrowserContent({ inputValue, setInputValue, handleNavigate, canGoBack, handleGoBack, canGoForward, handleGoForward, handleReload, showHomePage, isBookmarked, handleBookmarkToggle }) {
  const handleSubmit = (e) => {
    e.preventDefault();
    handleNavigate(inputValue);
  };

  return (
    <div className="browser-content-container">
      <div className="nav-bar">
        <div className="nav-buttons">
          <button onClick={handleGoBack} disabled={!canGoBack}>
            Back
          </button>
          <button onClick={handleGoForward} disabled={!canGoForward}>
            Forward
          </button>
          <button onClick={handleReload}>Reload</button>
        </div>
        <form onSubmit={handleSubmit} className="address-bar-form">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
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

function App() {
  const location = useLocation();
  const [tabs, setTabs] = useState([]);
  const [activeTabId, setActiveTabId] = useState(null);
  const [inputValue, setInputValue] = useState('');
  const [canGoBack, setCanGoBack] = useState(false);
  const [canGoForward, setCanGoForward] = useState(false);
  const [showHomePage, setShowHomePage] = useState(false); // HomePageの表示状態
  const [isBookmarked, setIsBookmarked] = useState(false); // ブックマーク状態

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
        // about:blankの場合はinputValueを空にする
        setInputValue(data.url === 'about:blank' ? '' : data.url);
        setShowHomePage(data.url === 'about:blank');
        checkBookmarkStatus(data.url); // ブックマーク状態を確認
      }
    });

    electronAPI.onActiveTabChanged((tabId) => {
      setActiveTabId(tabId);
      const active = tabs.find(tab => tab.id === tabId);
      if (active) {
        // about:blankの場合はinputValueを空にする
        setInputValue(active.url === 'about:blank' ? '' : active.url);
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
  }, [activeTabId, tabs]);

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
    if (location.pathname === '/history') {
      electronAPI.setBrowserViewVisibility(false); // 履歴ページでは非表示
    } else {
      // ホームページ表示中はBrowserViewを非表示
      electronAPI.setBrowserViewVisibility(!showHomePage);
    }
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
          />
        } />
        <Route path="/history" element={<HistoryPage />} />
      </Routes>
    </div>
  );
}

export default function AppWrapper() {
  return (
    <Router>
      <App />
    </Router>
  );
}
