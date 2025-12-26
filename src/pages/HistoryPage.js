import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import '../App.css';

const { electronAPI } = window;

function HistoryPage() {
  const [history, setHistory] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    document.title = 'History';
    const loadHistory = async () => {
      const data = await electronAPI.getHistory();
      setHistory(data);
    };
    loadHistory();
  }, []);

  const handleClearHistory = () => {
    if (window.confirm('Are you sure you want to clear browsing history?')) {
      electronAPI.send('clear-history');
      setHistory([]);
    }
  };

  const handleNavigate = (url) => {
    electronAPI.send('navigate', url);
    // We also need to tell App we are leaving history, but since we are in a tab, navigate triggers tab update
    navigate('/');
  };

  const getRelativeDate = (dateString) => {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) return 'Today';
    if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
    return date.toLocaleDateString();
  };

  const formatTime = (dateString) => {
    return new Date(dateString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Group history by date
  const groupedHistory = history.reduce((groups, item) => {
    const dateLabel = getRelativeDate(item.timestamp);
    if (!groups[dateLabel]) groups[dateLabel] = [];
    groups[dateLabel].push(item);
    return groups;
  }, {});

  const sortedDates = Object.keys(groupedHistory).sort((a, b) => {
    if (a === 'Today') return -1;
    if (b === 'Today') return 1;
    if (a === 'Yesterday') return -1;
    if (b === 'Yesterday') return 1;
    return new Date(b) - new Date(a); // Sort descending
  });

  const handleDeleteItem = async (url) => {
    const updatedHistory = await electronAPI.deleteHistoryItem(url);
    setHistory(updatedHistory);
  };

  return (
    <div className="history-page-container">
      <div className="page-header">
        <h1>History</h1>
        <button style={{ marginLeft: 'auto' }} onClick={handleClearHistory} disabled={history.length === 0}>
          Clear History
        </button>
      </div>

      {history.length === 0 ? (
        <div className="empty-state">No history yet.</div>
      ) : (
        <div>
          {sortedDates.map(date => (
            <div key={date} className="history-section">
              <div className="history-date-header">{date}</div>
              <ul className="history-list">
                {groupedHistory[date].map((item, index) => (
                  <li key={index} className="history-list-item">
                    <span className="history-time">{formatTime(item.timestamp)}</span>
                    <button
                      className="history-link-button"
                      onClick={() => handleNavigate(item.url)}
                      title={`Go to ${item.url}`}
                    >
                      <div className="history-title">{item.title || item.url}</div>
                      <div className="history-url">{item.url}</div>
                    </button>
                    <button
                      className="delete-history-item"
                      onClick={() => handleDeleteItem(item.url)}
                      title="Delete from history"
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default HistoryPage;
