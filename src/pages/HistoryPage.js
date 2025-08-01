import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const { electronAPI } = window;

function HistoryPage() {
  const [history, setHistory] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    const fetchedHistory = await electronAPI.getHistory();
    setHistory(fetchedHistory);
  };

  const handleClearHistory = async () => {
    await electronAPI.clearHistory();
    setHistory([]); // 履歴をクリアしたらUIも更新
  };

  const handleNavigateToUrl = (url) => {
    electronAPI.send('navigate', url);
    electronAPI.setBrowserViewVisibility(true); // BrowserViewを再表示
    navigate('/'); // ブラウザUIに戻る
  };

  return (
    <div className="history-page-container">
      <h1>History</h1>
      <button onClick={handleClearHistory}>Clear History</button>
      <ul className="history-list">
        {history.map((entry, index) => (
          <li key={index} className="history-list-item">
            <a href="#" onClick={() => handleNavigateToUrl(entry.url)}>
              {entry.title || entry.url}
            </a>
            <p>{entry.url}</p>
            <p>{new Date(entry.timestamp).toLocaleString()}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default HistoryPage;