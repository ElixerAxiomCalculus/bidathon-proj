import { useState } from 'react';
import './ChatSidebar.css';

const ChatSidebar = ({ isOpen, chats, activeChat, onNewChat, onSelectChat, onDeleteChat, onClose }) => {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredChats = chats.filter((c) =>
    c.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatDate = (dateStr) => {
    const d = new Date(dateStr);
    const today = new Date();
    const diff = Math.floor((today - d) / (1000 * 60 * 60 * 24));
    if (diff === 0) return 'Today';
    if (diff === 1) return 'Yesterday';
    if (diff < 7) return `${diff}d ago`;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <>
      {isOpen && (
        <div className="sidebar-backdrop" onClick={onClose} />
      )}

      <aside className={`chat-sidebar ${isOpen ? 'chat-sidebar--open' : ''}`}>
        <div className="chat-sidebar__header">
          <button className="chat-sidebar__new-btn" onClick={onNewChat}>
            + New Chat
          </button>
          <button
            className="chat-sidebar__close-mobile"
            onClick={onClose}
            aria-label="Close sidebar"
          >
            &#10005;
          </button>
        </div>

        <div className="chat-sidebar__search">
          <input
            type="text"
            className="chat-sidebar__search-input"
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="chat-sidebar__tabs">
          <button className="chat-sidebar__tab chat-sidebar__tab--active">
            Conversations
          </button>
        </div>

        <div className="chat-sidebar__content">
          <div className="chat-sidebar__list">
            {filteredChats.length === 0 ? (
              <div className="chat-sidebar__empty">
                <p className="chat-sidebar__empty-text">
                  {searchQuery ? 'No matching chats' : 'No conversations yet'}
                </p>
                {!searchQuery && (
                  <button className="chat-sidebar__empty-btn" onClick={onNewChat}>
                    Start your first chat
                  </button>
                )}
              </div>
            ) : (
              filteredChats.map((chat) => (
                <div
                  key={chat.id}
                  className={`chat-sidebar__item ${activeChat === chat.id ? 'chat-sidebar__item--active' : ''}`}
                >
                  <button
                    className="chat-sidebar__item-main"
                    onClick={() => onSelectChat(chat.id)}
                  >
                    <div className="chat-sidebar__item-top">
                      <span className="chat-sidebar__item-title">{chat.title}</span>
                      <span className="chat-sidebar__item-date">{formatDate(chat.date)}</span>
                    </div>
                    {chat.preview && (
                      <p className="chat-sidebar__item-preview">{chat.preview}</p>
                    )}
                  </button>
                  {onDeleteChat && (
                    <button
                      className="chat-sidebar__item-delete"
                      title="Delete conversation"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteChat(chat.id);
                      }}
                    >
                      &#10005;
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        <div className="chat-sidebar__footer">
          <div className="chat-sidebar__usage">
            <div className="chat-sidebar__usage-header">
              <span className="chat-sidebar__usage-label">Daily Usage</span>
              <span className="chat-sidebar__usage-value">18 / 50 queries</span>
            </div>
            <div className="chat-sidebar__usage-bar">
              <div className="chat-sidebar__usage-fill" style={{ width: '36%' }} />
            </div>
          </div>
        </div>
      </aside>
    </>
  );
};

export default ChatSidebar;
