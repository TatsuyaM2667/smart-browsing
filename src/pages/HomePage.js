import React, { useState, useEffect } from 'react';

const { electronAPI } = window;

function HomePage({ onSearch }) {
  const [searchInputValue, setSearchInputValue] = useState('');
  const [bookmarks, setBookmarks] = useState([]);
  const [editingBookmark, setEditingBookmark] = useState(null);
  const [wallpaper, setWallpaper] = useState(localStorage.getItem('wallpaper') || '');
  const [showSettings, setShowSettings] = useState(false);
  const [searchEngine, setSearchEngine] = useState(localStorage.getItem('searchEngine') || 'google');
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    document.title = 'New Tab';
    fetchBookmarks();
  }, []);

  const fetchBookmarks = async () => {
    const fetchedBookmarks = await electronAPI.getBookmarks();
    setBookmarks(fetchedBookmarks);
  };

  const getDomain = (url) => {
    try {
      return new URL(url).hostname;
    } catch (e) {
      return '';
    }
  };

  const handleNavigate = (e) => {
    e.preventDefault();
    if (searchInputValue) {
      let url = searchInputValue;
      if (!url.includes('.') || url.includes(' ')) {
        const engines = {
          google: 'https://www.google.com/search?q=',
          bing: 'https://www.bing.com/search?q=',
          duckduckgo: 'https://duckduckgo.com/?q='
        };
        url = (engines[searchEngine] || engines.google) + encodeURIComponent(searchInputValue);
      } else if (!url.startsWith('http')) {
        url = 'https://' + url;
      }
      onSearch(url);
    }
  };

  const saveWallpaper = (url) => {
    setWallpaper(url);
    localStorage.setItem('wallpaper', url);
  };

  const handleLocalUpload = async () => {
    const dataUrl = await window.electronAPI.selectLocalImage();
    if (dataUrl) {
      saveWallpaper(dataUrl);
    }
  };

  const getGreeting = () => {
    const hour = currentTime.getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 18) return 'Good Afternoon';
    return 'Good Evening';
  };

  const handleBookmarkClick = (url) => {
    if (editingBookmark) return;
    onSearch(url);
  };

  const handleDeleteBookmark = async (url, e) => {
    e.stopPropagation();
    if (window.confirm('Delete this bookmark?')) {
      await electronAPI.removeBookmark(url);
      fetchBookmarks();
    }
  };

  const handleEditClick = (bookmark, e) => {
    e.stopPropagation();
    setEditingBookmark({ oldUrl: bookmark.url, url: bookmark.url, title: bookmark.title || bookmark.url });
  };

  const handleSaveEdit = async () => {
    if (editingBookmark) {
      await electronAPI.updateBookmark(editingBookmark.oldUrl, editingBookmark.url, editingBookmark.title);
      setEditingBookmark(null);
      fetchBookmarks();
    }
  };

  return (
    <div className={`homepage-container ${wallpaper ? 'has-wallpaper' : ''}`} style={wallpaper ? { backgroundImage: `url(${wallpaper})`, backgroundSize: 'cover', backgroundPosition: 'center' } : {}}>
      <div className="homepage-widgets">
        <h2 className="widget-clock">{currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</h2>
        <p className="widget-greeting">{getGreeting()}, User</p>
      </div>

      <h1 className="homepage-title">Smart Browser</h1>

      <div className="search-container">
        <div className="search-engine-selector">
          <button className={searchEngine === 'google' ? 'active' : ''} onClick={() => { setSearchEngine('google'); localStorage.setItem('searchEngine', 'google'); }}>G</button>
          <button className={searchEngine === 'bing' ? 'active' : ''} onClick={() => { setSearchEngine('bing'); localStorage.setItem('searchEngine', 'bing'); }}>B</button>
          <button className={searchEngine === 'duckduckgo' ? 'active' : ''} onClick={() => { setSearchEngine('duckduckgo'); localStorage.setItem('searchEngine', 'duckduckgo'); }}>D</button>
        </div>
        <form onSubmit={handleNavigate} className="homepage-form">
          <input
            type="text"
            value={searchInputValue}
            onChange={(e) => setSearchInputValue(e.target.value)}
            className="homepage-input"
            placeholder={`Search with ${searchEngine.charAt(0).toUpperCase() + searchEngine.slice(1)} or type URL`}
          />
        </form>
      </div>

      <button className="settings-toggle" onClick={() => setShowSettings(!showSettings)}>⚙️</button>

      {showSettings && (
        <div className="homepage-settings-panel">
          <h3>Settings</h3>
          <div className="settings-group">
            <label>Wallpaper:</label>
            <div className="wallpaper-input-row" style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
              <input
                type="text"
                value={wallpaper.startsWith('data:') ? 'Local Image (Base64)' : wallpaper}
                onChange={(e) => saveWallpaper(e.target.value)}
                placeholder="Paste image URL here"
                style={{ flex: 1 }}
              />
              <button
                className="upload-btn"
                onClick={handleLocalUpload}
                style={{ padding: '8px', cursor: 'pointer', background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', borderRadius: '4px' }}
              >
                📁 Upload
              </button>
            </div>
            {wallpaper && (
              <button
                className="clear-button"
                onClick={() => saveWallpaper('')}
                style={{ width: '100%', padding: '6px', cursor: 'pointer', background: '#ff4d4f', color: 'white', border: 'none', borderRadius: '4px' }}
              >
                Clear Background
              </button>
            )}
          </div>
          <button className="close-panel" onClick={() => setShowSettings(false)}>Close</button>
        </div>
      )}

      {editingBookmark && (
        <div className="edit-modal-overlay">
          <div className="edit-modal">
            <h3>Edit Bookmark</h3>
            <input
              type="text"
              placeholder="Title"
              value={editingBookmark.title}
              onChange={e => setEditingBookmark({ ...editingBookmark, title: e.target.value })}
            />
            <input
              type="text"
              placeholder="URL"
              value={editingBookmark.url}
              onChange={e => setEditingBookmark({ ...editingBookmark, url: e.target.value })}
            />
            <div className="edit-actions">
              <button onClick={() => setEditingBookmark(null)}>Cancel</button>
              <button onClick={handleSaveEdit}>Save</button>
            </div>
          </div>
        </div>
      )}

      {bookmarks.length > 0 && (
        <div className="bookmarks-section">
          <h2>Bookmarks</h2>
          <div className="bookmarks-grid">
            {bookmarks.map((bookmark, index) => {
              return (
                <div key={index} className="bookmark-card" onClick={() => handleBookmarkClick(bookmark.url)}>
                  <img
                    src={`https://www.google.com/s2/favicons?domain=${getDomain(bookmark.url)}&sz=64`}
                    alt="icon"
                    className="bookmark-favicon"
                  />
                  <div className="bookmark-info">
                    <p className="bookmark-title">{bookmark.title || bookmark.url}</p>
                    <p className="bookmark-url">{bookmark.url}</p>
                  </div>
                  <div className="bookmark-actions">
                    <button
                      className="edit-bookmark-button"
                      onClick={(e) => handleEditClick(bookmark, e)}
                      title="Edit"
                    >
                      ✎
                    </button>
                    <button
                      className="delete-bookmark-button-visible"
                      onClick={(e) => handleDeleteBookmark(bookmark.url, e)}
                      title="Delete"
                    >
                      &times;
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default HomePage;
