import React from 'react';

function TabHeader({ tab, onSwitchTab, onCloseTab }) {
  return (
    <div
      className={`tab-header ${tab.isActive ? 'active' : ''}`}
      onClick={() => onSwitchTab(tab.id)}
    >
      <span className="tab-title">{tab.title || tab.url || 'New Tab'}</span>
      <button className="close-tab-button" onClick={(e) => {
        e.stopPropagation(); // 親要素へのイベント伝播を防ぐ
        onCloseTab(tab.id);
      }}>
        &times;
      </button>
    </div>
  );
}

export default TabHeader;
