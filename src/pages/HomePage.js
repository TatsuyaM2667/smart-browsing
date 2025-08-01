import React, { useState } from 'react';

function HomePage({ onSearch }) {
  const [searchInputValue, setSearchInputValue] = useState(''); // ローカルな入力状態

  const handleNavigate = (e) => {
    e.preventDefault();
    if (searchInputValue) {
      onSearch(searchInputValue); // ローカルな値を親に渡す
    }
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      height: 'calc(100vh - 60px)', // ナビゲーションバーの高さを考慮
      backgroundColor: '#f5f5f5',
    }}>
      <h1 style={{ marginBottom: '30px', color: '#333' }}>Smart Browser</h1>
      <form onSubmit={handleNavigate} style={{
        width: '80%',
        maxWidth: '600px',
      }}>
        <input
          type="text"
          value={searchInputValue}
          onChange={(e) => setSearchInputValue(e.target.value)}
          style={{
            width: '100%',
            padding: '10px 15px',
            fontSize: '1.2em',
            border: '1px solid #ccc',
            borderRadius: '25px',
            boxShadow: '0 2px 5px rgba(0,0,0,0.1)',
            outline: 'none',
            textAlign: 'center',
          }}
          placeholder="Search or type URL"
        />
      </form>
    </div>
  );
}

export default HomePage;