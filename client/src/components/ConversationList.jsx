import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { useIsOnline } from '../context/PresenceContext.jsx';
import * as api from '../api/api.js';

function ConversationRow({ conv, isActive, onSelect, onDelete }) {
  const isOnline = useIsOnline(conv.other_user_id);
  const label = conv.is_group
    ? conv.name || 'Group Chat'
    : conv.other_username || `Conversation #${conv.id}`;

  return (
    <li
      className={isActive ? 'conv-item active' : 'conv-item'}
      onClick={() => onSelect(conv.id, label, conv.other_user_id)}
    >
      <div className="conv-avatar-wrap">
        <div className="conv-avatar">{label.charAt(0).toUpperCase()}</div>
        {!conv.is_group && (
          <span className={`presence-dot ${isOnline ? 'online' : 'offline'}`} />
        )}
      </div>
      <span className="conv-name">{label}</span>
      <button
        className="conv-delete-btn"
        onClick={(e) => onDelete(e, conv.id)}
        title="Delete conversation"
      >
        ×
      </button>
    </li>
  );
}

export default function ConversationList({ onSelectConversation, activeConversationId, refreshTrigger }) {
  const { token } = useAuth();
  const [conversations, setConversations] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    async function loadConversations() {
      try {
        const data = await api.getConversations(token);
        setConversations(data);
      } catch (err) {
        setError(err.message);
      }
    }
    loadConversations();
  }, [token, refreshTrigger]);

  async function handleDelete(e, convId) {
    e.stopPropagation();
    if (!window.confirm('Delete this conversation? This cannot be undone.')) return;
    try {
      await api.deleteConversation(token, convId);
      setConversations((prev) => prev.filter((c) => c.id !== convId));
      if (activeConversationId === convId) {
        onSelectConversation(null);
      }
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="conversation-list">
      <h3 className="section-title">Conversations</h3>
      {error && <p className="error">{error}</p>}
      {conversations.length === 0 && <p className="empty-state">No conversations yet</p>}
      <ul>
        {conversations.map((conv) => (
          <ConversationRow
            key={conv.id}
            conv={conv}
            isActive={conv.id === activeConversationId}
            onSelect={onSelectConversation}
            onDelete={handleDelete}
          />
        ))}
      </ul>
    </div>
  );
}