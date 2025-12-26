import React, { useState, useEffect, useRef } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import './App.css';
import HistoryPage from './pages/HistoryPage';
import BookmarksPage from './pages/BookmarksPage';
import ImagesPage from './pages/ImagesPage';
import VideosPage from './pages/VideosPage';
import HomePage from './pages/HomePage';
import TabHeader from './components/TabHeader';
import { auth } from './firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import Auth from './components/Auth';
import AccountSettings from './components/AccountSettings';
import PasswordManager from './components/PasswordManager';

const { electronAPI } = window;


function BrowserContent({ handleNavigate, canGoBack, handleGoBack, canGoForward, handleGoForward, handleReload, isBookmarked, handleBookmarkToggle, navBarRef, activeTabUrl, activeTabIsHistory, detectedVideos, handleDownloadClick, blockedCount, onToggleSidebar, onToggleReader, readerActive, onPiP, user, onSignInClick, onLogout }) {
  const [inputValue, setInputValue] = useState('');

  useEffect(() => {
    if (!activeTabIsHistory && activeTabUrl !== '/home') {
      setInputValue(activeTabUrl);
    } else if (activeTabIsHistory) {
      setInputValue('History');
    } else {
      setInputValue('');
    }
  }, [activeTabUrl, activeTabIsHistory]);

  const handleSubmit = (e) => {
    e.preventDefault();
    handleNavigate(inputValue);
  };

  const handleInputChange = (e) => {
    setInputValue(e.target.value);
  };

  return (
    <div className="browser-content-container">
      <div className="nav-bar" ref={navBarRef}>
        <div className="nav-buttons">
          <button onClick={handleGoBack} disabled={!canGoBack}>←</button>
          <button onClick={handleGoForward} disabled={!canGoForward}>→</button>
          <button onClick={handleReload}>↻</button>
        </div>
        <form onSubmit={handleSubmit} className="address-bar-form">
          <input
            type="text"
            value={inputValue}
            onChange={handleInputChange}
            onFocus={() => electronAPI.send('address-bar-focus')}
            onBlur={() => electronAPI.send('address-bar-blur')}
            className="address-bar"
            placeholder="Search on Google or enter URL"
          />
          {blockedCount > 0 && (
            <div className="adblock-badge" title={`${blockedCount} ads blocked`}>
              🛡️ {blockedCount}
            </div>
          )}
        </form>
        {detectedVideos && detectedVideos.length > 0 && (
          <>
            <button onClick={onPiP} className="pip-button" title="Picture in Picture">📺</button>
            <button
              onClick={handleDownloadClick}
              className="download-icon-button"
              title="Download Video"
              style={{ marginRight: '8px', fontSize: '1.2rem', cursor: 'pointer', background: 'none', border: 'none' }}
            >
              ⬇️
            </button>
          </>
        )}
        <button
          onClick={onToggleReader}
          className={`reader-toggle-btn ${readerActive ? 'active' : ''}`}
          title="Reader Mode"
        >
          📖
        </button>
        <button
          onClick={handleBookmarkToggle}
          className={`bookmark-button ${isBookmarked ? 'active' : ''}`}
        >
          {isBookmarked ? '★' : '☆'}
        </button>

        <div className="sidebar-toggles">
          <button onClick={() => onToggleSidebar('history')} title="History" className="sidebar-toggle-btn">🕒</button>
          <button onClick={() => onToggleSidebar('bookmarks')} title="Bookmarks" className="sidebar-toggle-btn">🔖</button>
          <button onClick={() => onToggleSidebar('account')} title="Account" className="sidebar-toggle-btn">👤</button>
          <button onClick={() => onToggleSidebar('passwords')} title="Passwords" className="sidebar-toggle-btn">🔑</button>
        </div>

        <div className="user-auth-section" style={{ marginLeft: '8px' }}>
          {user ? (
            <div className="user-profile" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className="user-email" style={{ fontSize: '0.8rem', opacity: 0.8, maxWidth: '100px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {user.email}
              </span>
              <button onClick={onLogout} className="auth-btn logout" title="Logout" style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.1rem' }}>🚪</button>
            </div>
          ) : (
            <button onClick={onSignInClick} className="auth-btn login" title="Sign In" style={{ background: 'var(--color-accent)', color: 'white', border: 'none', borderRadius: '4px', padding: '4px 8px', cursor: 'pointer', fontSize: '0.85rem' }}>Login</button>
          )}
        </div>

        <div className="menu-container">
          <button className="menu-trigger-button" onClick={(e) => {
            const rect = e.target.getBoundingClientRect();
            electronAPI.openMenu(Math.round(rect.left), Math.round(rect.bottom));
          }}>
            ⋮
          </button>
        </div>
      </div>
    </div>

  );
}

function App() {
  const [tabs, setTabs] = useState([]);
  const [activeTabId, setActiveTabId] = useState(null);
  const [canGoBack, setCanGoBack] = useState(false);
  const [canGoForward, setCanGoForward] = useState(false);
  const [isBookmarked, setIsBookmarked] = useState(false);
  const tabBarRef = useRef(null);
  const navBarRef = useRef(null);
  const [theme, setTheme] = useState(() => {
    // Try to get theme from main process synchronously first, then fallback to localStorage
    const mainTheme = window.electronAPI?.getThemeSync?.();
    return mainTheme || localStorage.getItem('theme') || 'light';
  });
  const [uiHeight, setUiHeight] = useState(88); // Initial approximate height to match main.js
  const [detectedVideos, setDetectedVideos] = useState([]);
  const [showVideoModal, setShowVideoModal] = useState(false);
  const [isIncognito, setIsIncognito] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);
  const [sidebarContent, setSidebarContent] = useState('none'); // 'history', 'bookmarks', 'account', 'passwords', 'none'
  const [blockedCount, setBlockedCount] = useState(0);
  const [historyItems, setHistoryItems] = useState([]);
  const [bookmarksItems, setBookmarksItems] = useState([]);
  const [readerModeActive, setReaderModeActive] = useState(false);
  const [readerContent, setReaderContent] = useState(null);
  const [user, setUser] = useState(null);
  const [showAuthModal, setShowAuthModal] = useState(false);

  // Detect "Browser View Mode" (Content Only)
  const isBrowserViewMode = new URLSearchParams(window.location.search).get('mode') === 'browser-view';

  const isExternalUpdateRef = useRef(false);

  // Use useLayoutEffect to apply theme BEFORE first paint, avoiding flicker
  React.useLayoutEffect(() => {
    document.body.className = theme === 'dark' ? 'dark-mode' : 'light-mode';
    localStorage.setItem('theme', theme);

    if (!isExternalUpdateRef.current) {
      // Notify main process ONLY if this was an internal change (e.g. toggle button)
      electronAPI.send('theme-updated', theme);
    }
    isExternalUpdateRef.current = false;
  }, [theme]);

  useEffect(() => {
    const handleThemeUpdate = (newTheme) => {
      setTheme(prev => {
        if (prev !== newTheme) {
          isExternalUpdateRef.current = true;
          return newTheme;
        }
        return prev;
      });
    };
    electronAPI.on('theme-updated', handleThemeUpdate);

    const handleIncognitoUpdate = (isActive) => {
      setIsIncognito(isActive);
    };
    electronAPI.on('incognito-changed', handleIncognitoUpdate);

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });

    electronAPI.on('adblock-stats', (count) => {
      setBlockedCount(count);
    });

    return () => {
      if (electronAPI.removeAllListeners) {
        electronAPI.removeAllListeners('theme-updated');
        electronAPI.removeAllListeners('incognito-changed');
        electronAPI.removeAllListeners('adblock-stats');
      }
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!isBrowserViewMode && window.location.pathname !== '/') {
      window.history.replaceState({}, '', '/');
      window.location.reload();
    }
  }, [isBrowserViewMode]);

  useEffect(() => {
    if (isBrowserViewMode) return;
    electronAPI.send('ui-state-changed', {
      sidebarOpen: showSidebar,
      readerModeActive: readerModeActive,
      authModalOpen: showAuthModal,
      videoModalOpen: showVideoModal
    });
  }, [showSidebar, readerModeActive, showAuthModal, showVideoModal, isBrowserViewMode]);


  useEffect(() => {
    if (tabBarRef.current && navBarRef.current) {
      const height = tabBarRef.current.offsetHeight + navBarRef.current.offsetHeight;
      if (Math.abs(height - uiHeight) > 1) { // Only update if significant change
        setUiHeight(height);
        electronAPI.setUiHeight(height);
      }
    }
  }, [tabs.length, showSidebar]); // Reduced frequency

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    if (theme !== newTheme) {
      setTheme(newTheme);
      electronAPI.send('theme-updated', newTheme);
    }
  };

  const toggleIncognito = () => {
    const nextValue = !isIncognito;
    setIsIncognito(nextValue);
    electronAPI.setIncognito(nextValue);
  };


  useEffect(() => {
    if (isBrowserViewMode) return;

    const fetchTabs = async () => {
      const initialTabs = await electronAPI.getTabs();
      setTabs(initialTabs);
      const active = initialTabs.find(t => t.isActive);
      if (active) {
        setActiveTabId(active.id);
        checkBookmarkStatus(active.url);
      }
    };
    fetchTabs();

    electronAPI.onTabUpdated((data) => {
      setTabs(prevTabs => prevTabs.map(tab => {
        if (tab.id === data.tabId) {
          let title = data.title;
          if (!title || data.url === '/home') title = 'New Tab';
          if (data.url === '/history') title = 'History';
          if (data.url === '/bookmarks') title = 'Bookmarks';
          return { ...tab, title: title, url: data.url };
        }
        return tab;
      }));
      if (data.tabId === activeTabId) {
        checkBookmarkStatus(data.url);
      }
    });

    electronAPI.on('active-tab-changed', async (tabId) => {
      setActiveTabId(tabId);
      const tabs = await electronAPI.getTabs();
      const active = tabs.find(t => t.id === tabId);
      if (active) {
        checkBookmarkStatus(active.url);
      }
    });

    electronAPI.onTabClosed((tabId) => {
      setTabs(prevTabs => prevTabs.filter(tab => tab.id !== tabId));
    });

    electronAPI.on('update-navigation-state', (navState) => {
      setCanGoBack(navState.canGoBack);
      setCanGoForward(navState.canGoForward);
      checkBookmarkStatus(navState.url);
    });

    electronAPI.onVideoDetected((urls) => {
      setDetectedVideos(urls);
    });

    electronAPI.onDownloadStatus((data) => {
      if (data.status === 'success') {
        alert(`Download Completed: ${data.filename}`);
      } else {
        alert(`Download Failed: ${data.filename} (${data.state})`);
      }
    });

    return () => {
      electronAPI.removeAllListeners('tab-updated');
      electronAPI.removeAllListeners('active-tab-changed');
      electronAPI.removeAllListeners('tab-closed');
      electronAPI.removeAllListeners('update-navigation-state');
      electronAPI.removeAllListeners('navigate-internal');
      electronAPI.removeAllListeners('video-detected');
      electronAPI.removeAllListeners('download-status');
    };
  }, [activeTabId, tabs, isBrowserViewMode]);

  const handleDownloadVideo = (url) => {
    electronAPI.downloadVideo(url);
    alert('Download started...');
  };

  const checkBookmarkStatus = async (url) => {
    const bookmarked = await electronAPI.isBookmarked(url);
    setIsBookmarked(bookmarked);
  };

  const handleBookmarkToggle = async () => {
    const activeTab = tabs.find(tab => tab.id === activeTabId);
    const currentUrl = activeTab ? activeTab.url : '';
    const currentTitle = activeTab ? activeTab.title : currentUrl;

    if (!currentUrl) return;

    if (isBookmarked) {
      await electronAPI.removeBookmark(currentUrl);
      setIsBookmarked(false);
    } else {
      await electronAPI.addBookmark(currentUrl, currentTitle);
      setIsBookmarked(true);
    }
  };

  const handleNavigate = (urlToNavigate) => {
    electronAPI.send('navigate', urlToNavigate);
  };

  const toggleSidebar = async (content) => {
    if (sidebarContent === content && showSidebar) {
      setShowSidebar(false);
    } else {
      setSidebarContent(content);
      setShowSidebar(true);
      if (content === 'history') {
        const history = await electronAPI.getHistory();
        setHistoryItems(history);
      } else if (content === 'bookmarks') {
        const bookmarks = await electronAPI.getBookmarks();
        setBookmarksItems(bookmarks);
      }
    }
  };

  const toggleReaderMode = async () => {
    if (readerModeActive) {
      setReaderModeActive(false);
      return;
    }
    const content = await electronAPI.extractPageContent();
    if (content) {
      setReaderContent(content);
      setReaderModeActive(true);
    } else {
      alert('Could not extract content for reader mode.');
    }
  };

  const handlePiP = () => {
    electronAPI.triggerPiP();
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (err) {
      console.error('Logout failed', err);
    }
  };

  // Sync UI visibility with main process to adjust BrowserView
  useEffect(() => {
    if (isBrowserViewMode) return; // Don't sync from internal pages (home, history, etc.)
    electronAPI.send('ui-state-changed', {
      sidebarOpen: showSidebar,
      readerModeActive: readerModeActive,
      authModalOpen: showAuthModal,
      videoModalOpen: showVideoModal
    });
  }, [showSidebar, readerModeActive, showAuthModal, showVideoModal, isBrowserViewMode]);

  const handleGoBack = () => { electronAPI.send('go-back'); };
  const handleGoForward = () => { electronAPI.send('go-forward'); };
  const handleReload = () => { electronAPI.send('reload'); };
  const handleNewTab = () => { electronAPI.newTab(); };

  const handleSwitchTab = (tabId) => {
    electronAPI.switchTab(tabId);
  };

  const handleCloseTab = (tabId) => {
    electronAPI.closeTab(tabId);
  };

  const renderSidebarContent = () => {
    if (sidebarContent === 'history') {
      return (
        <div className="sidebar-list">
          <h3>History</h3>
          {historyItems.slice(0, 50).map((item, i) => (
            <div key={i} className="sidebar-item" onClick={() => handleNavigate(item.url)}>
              <span className="sidebar-item-title">{item.title || item.url}</span>
            </div>
          ))}
        </div>
      );
    } else if (sidebarContent === 'bookmarks') {
      return (
        <div className="sidebar-list">
          <h3>Bookmarks</h3>
          {bookmarksItems.map((item, i) => (
            <div key={i} className="sidebar-item" onClick={() => handleNavigate(item.url)}>
              <span className="sidebar-item-title">{item.title || item.url}</span>
            </div>
          ))}
        </div>
      );
    } else if (sidebarContent === 'account') {
      return <AccountSettings />;
    } else if (sidebarContent === 'passwords') {
      return <PasswordManager />;
    }
    return null;
  };

  const activeTab = tabs.find(tab => tab.id === activeTabId);
  const activeTabUrl = activeTab ? activeTab.url : '';
  const activeTabIsHistory = activeTab ? activeTab.isHistory : false;

  if (isBrowserViewMode) {
    return (
      <div className="browser-view-content">
        <Routes>
          <Route path="/home" element={<HomePage onSearch={(url) => electronAPI.send('navigate', url)} />} />
          <Route path="/history" element={<HistoryPage />} />
          <Route path="/bookmarks" element={<BookmarksPage />} />
          <Route path="/images" element={<ImagesPage />} />
          <Route path="/videos" element={<VideosPage />} />
          <Route path="/account" element={<AccountSettings />} />
          <Route path="/passwords" element={<PasswordManager />} />
        </Routes>
      </div>
    );
  }

  return (
    <div className={`main-container ${isIncognito ? 'incognito-mode' : ''}`}>
      <div className="tab-bar" ref={tabBarRef}>
        {tabs.map(tab => (
          <TabHeader
            key={tab.id}
            tab={tab}
            onSwitchTab={handleSwitchTab}
            onCloseTab={handleCloseTab}
          />
        ))}
        <button onClick={handleNewTab} className="new-tab-button" title="New Tab">+</button>
        <button onClick={toggleTheme} className="theme-toggle-button" title="Toggle Theme">
          {theme === 'light' ? '🌙' : '☀️'}
        </button>
        <button
          onClick={toggleIncognito}
          className={`incognito-toggle-button ${isIncognito ? 'active' : ''}`}
          title="Toggle Incognito Mode"
        >
          🕵️
        </button>
      </div>

      <div className={`app-main-layout ${showSidebar ? 'sidebar-open' : ''}`}>
        {showSidebar && (
          <aside className="app-sidebar">
            <header className="sidebar-header">
              <button className="close-sidebar" onClick={() => setShowSidebar(false)}>&times;</button>
            </header>
            <div className="sidebar-content">
              {renderSidebarContent()}
            </div>
          </aside>
        )}

        <div className="content-area">
          <BrowserContent
            key={activeTabId}
            handleNavigate={handleNavigate}
            canGoBack={canGoBack}
            handleGoBack={handleGoBack}
            canGoForward={canGoForward}
            handleGoForward={handleGoForward}
            handleReload={handleReload}
            isBookmarked={isBookmarked}
            handleBookmarkToggle={handleBookmarkToggle}
            navBarRef={navBarRef}
            activeTabUrl={activeTabUrl}
            activeTabIsHistory={activeTabIsHistory}
            detectedVideos={detectedVideos}
            blockedCount={blockedCount}
            onToggleSidebar={toggleSidebar}
            onToggleReader={toggleReaderMode}
            readerActive={readerModeActive}
            onPiP={handlePiP}
            user={user}
            onSignInClick={() => setShowAuthModal(true)}
            onLogout={handleLogout}
            handleDownloadClick={() => {
              if (detectedVideos.length === 1) {
                electronAPI.downloadVideo(detectedVideos[0]);
                alert('Download started...');
              } else if (detectedVideos.length > 1) {
                setShowVideoModal(true);
              }
            }}
          />
        </div>
      </div>

      {readerModeActive && readerContent && (
        <div className="reader-mode-overlay">
          <div className="reader-mode-content">
            <header className="reader-header">
              <button className="close-reader" onClick={() => setReaderModeActive(false)}>&times; Close Reader</button>
            </header>
            <article>
              <h1>{readerContent.title}</h1>
              <div dangerouslySetInnerHTML={{ __html: readerContent.content }} />
            </article>
          </div>
        </div>
      )}

      {showAuthModal && (
        <Auth onLogin={() => { }} onClose={() => setShowAuthModal(false)} />
      )}

      {showVideoModal && (
        <div className="video-modal-overlay">
          <div className="video-modal">
            <h3>Detected Videos</h3>
            {detectedVideos.length === 0 ? (
              <p>No videos found on this page.</p>
            ) : (
              <ul className="video-list">
                {detectedVideos.map((url, i) => (
                  <li key={i} className="video-item">
                    <span className="video-url">{url}</span>
                    <button className="download-button" onClick={() => handleDownloadVideo(url)}>Download</button>
                  </li>
                ))}
              </ul>
            )}
            <button className="close-modal-button" onClick={() => setShowVideoModal(false)}>Close</button>
          </div>
        </div>
      )}
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
