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
    <div style={{ padding: '20px' }}>
      <h1>History</h1>
      <button onClick={handleClearHistory}>Clear History</button>
      <ul style={{ listStyle: 'none', padding: 0 }}>
        {history.map((entry, index) => (
          <li key={index} style={{ marginBottom: '10px', borderBottom: '1px solid #eee', paddingBottom: '5px' }}>
            <a href="#" onClick={() => handleNavigateToUrl(entry.url)} style={{ color: 'blue', textDecoration: 'underline' }}>
              {entry.title || entry.url}
            </a>
            <p style={{ fontSize: '0.8em', color: '#666' }}>{entry.url}</p>
            <p style={{ fontSize: '0.7em', color: '#999' }}>{new Date(entry.timestamp).toLocaleString()}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default HistoryPage;