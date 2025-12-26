import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import '../App.css'; // Ensure app css is loaded

const { electronAPI } = window;

function BookmarksPage() {
    const [bookmarks, setBookmarks] = useState([]);
    const [editingBookmark, setEditingBookmark] = useState(null); // { oldUrl, url, title }
    const navigate = useNavigate();

    const fetchBookmarks = async () => {
        const data = await electronAPI.getBookmarks();
        setBookmarks(data);
    };

    useEffect(() => {
        document.title = 'Bookmarks';
        fetchBookmarks();
    }, []);

    const getDomain = (url) => {
        try {
            return new URL(url).hostname;
        } catch (e) {
            return '';
        }
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

    const handleNavigateToUrl = (url) => {
        if (editingBookmark) return; // Prevent navigation while editing
        electronAPI.send('navigate', url);
        electronAPI.setBrowserViewVisibility(true);
        navigate('/');
    };

    return (
        <div className="bookmarks-page-container">
            <div className="page-header">
                <button className="back-button" onClick={() => navigate(-1)}>← Back</button>
                <h1>Bookmarks</h1>
            </div>

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

            {bookmarks.length === 0 ? (
                <div className="empty-state">No bookmarks yet.</div>
            ) : (
                <div className="bookmarks-grid">
                    {bookmarks.map((bookmark, index) => (
                        <div key={index} className="bookmark-card" onClick={() => handleNavigateToUrl(bookmark.url)}>
                            <img
                                src={`https://www.google.com/s2/favicons?domain=${getDomain(bookmark.url)}&sz=64`}
                                alt="icon"
                                className="bookmark-favicon"
                            />
                            <div className="bookmark-info">
                                <div className="bookmark-title">{bookmark.title || bookmark.url}</div>
                                <div className="bookmark-url">{bookmark.url}</div>
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
                    ))}
                </div>
            )}
        </div>
    );
}

export default BookmarksPage;
