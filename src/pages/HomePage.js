import React, { useState, useEffect } from 'react';

const { electronAPI } = window;

function HomePage({ onSearch }) {
  const [searchInputValue, setSearchInputValue] = useState(''); // ローカルな入力状態
  const [bookmarks, setBookmarks] = useState([]);

  useEffect(() => {
    const fetchBookmarks = async () => {
      const fetchedBookmarks = await electronAPI.getBookmarks();
      setBookmarks(fetchedBookmarks);
    };
    fetchBookmarks();
  }, []);

  const handleNavigate = (e) => {
    e.preventDefault();
    if (searchInputValue) {
      onSearch(searchInputValue); // ローカルな値を親に渡す
    }
  };

  const handleBookmarkClick = (url) => {
    onSearch(url);
  };

  return (
    <div className="homepage-container">
      <h1 className="homepage-title">Smart Browser</h1>
      <form onSubmit={handleNavigate} className="homepage-form">
        <input
          type="text"
          value={searchInputValue}
          onChange={(e) => setSearchInputValue(e.target.value)}
          className="homepage-input"
          placeholder="Search or type URL"
        />
      </form>

      {bookmarks.length > 0 && (
        <div className="bookmarks-section">
          <h2>Bookmarks</h2>
          <div className="bookmarks-grid">
            {bookmarks.map((bookmark, index) => (
              <div key={index} className="bookmark-item" onClick={() => handleBookmarkClick(bookmark.url)}>
                <p className="bookmark-title">{bookmark.title || bookmark.url}</p>
                <p className="bookmark-url">{bookmark.url}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default HomePage;