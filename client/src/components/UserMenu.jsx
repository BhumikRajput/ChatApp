import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import * as api from '../api/api.js';
import { getSocket } from '../socket/socket.js';

export default function UserMenu({ onConversationCreated, onConversationsChanged }) {
  const { user, token, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const [view, setView] = useState('menu'); // menu | newchat | pending | sent
  const [pending, setPending] = useState([]);
  const [sent, setSent] = useState([]);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [error, setError] = useState('');
  const menuRef = useRef(null);

  useEffect(() => {
    async function load() {
      try {
        const [p, s] = await Promise.all([
          api.getPendingRequests(token),
          api.getSentRequests(token),
        ]);
        setPending(p);
        setSent(s);
      } catch {
        // silent — will pick up live via sockets
      }
    }
    load();
  }, [token]);

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    function handleNewRequest(req) {
      setPending((prev) => (prev.some((r) => r.id === req.id) ? prev : [...prev, req]));
    }
    function handleAccepted(data) {
      setSent((prev) => prev.filter((r) => r.id !== data.id));
      onConversationsChanged?.();
    }
    function handleRejected(data) {
      setSent((prev) => prev.filter((r) => r.id !== data.id));
    }

    socket.on('new_conversation_request', handleNewRequest);
    socket.on('conversation_accepted', handleAccepted);
    socket.on('conversation_rejected', handleRejected);
    return () => {
      socket.off('new_conversation_request', handleNewRequest);
      socket.off('conversation_accepted', handleAccepted);
      socket.off('conversation_rejected', handleRejected);
    };
  }, [onConversationsChanged]);

  useEffect(() => {
    function handleClickOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setOpen(false);
        setView('menu');
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  async function handleSearch(e) {
    const value = e.target.value;
    setQuery(value);
    setError('');
    if (!value.trim()) {
      setResults([]);
      return;
    }
    try {
      const users = await api.searchUsers(token, value.trim());
      setResults(users);
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleStartChat(otherUserId, username) {
    try {
      const conv = await api.createConversation(token, otherUserId);
      setQuery('');
      setResults([]);
      if (conv.status === 'accepted') {
        onConversationCreated(conv.id, username, otherUserId);
        onConversationsChanged?.();
      } else if (!conv.existing) {
        setSent((prev) => [
          ...prev,
          { id: conv.id, recipient_username: username, created_at: new Date().toISOString() },
        ]);
      }
      // just collapse back to the menu, no confirmation message
      setView('menu');
      setOpen(false);
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleAccept(id, username, requesterId) {
    try {
      await api.acceptRequest(token, id);
      setPending((prev) => prev.filter((r) => r.id !== id));
      onConversationCreated(id, username, requesterId);
      onConversationsChanged?.();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleReject(id) {
    try {
      await api.rejectRequest(token, id);
      setPending((prev) => prev.filter((r) => r.id !== id));
    } catch (err) {
      setError(err.message);
    }
  }

  function handleLogout() {
    setOpen(false);
    logout();
  }

  return (
    <div className="user-menu" ref={menuRef}>
      <button className="user-menu-trigger" onClick={() => setOpen((o) => !o)}>
        <div className="user-avatar">{user.username.charAt(0).toUpperCase()}</div>
        <span className="user-menu-name">{user.username}</span>
        {(pending.length > 0) && <span className="menu-dot" />}
      </button>

      {open && (
        <div className="user-menu-dropdown">
          {view === 'menu' && (
            <>
              <button className="menu-item" onClick={() => setView('newchat')}>
                <span>+ New Chat</span>
              </button>
              <button className="menu-item" onClick={() => setView('pending')}>
                <span>Pending Requests</span>
                {pending.length > 0 && <span className="menu-badge">{pending.length}</span>}
              </button>
              <button className="menu-item" onClick={() => setView('sent')}>
                <span>Sent Requests</span>
                {sent.length > 0 && <span className="menu-badge muted">{sent.length}</span>}
              </button>
              <div className="menu-divider" />
              <button className="menu-item danger" onClick={handleLogout}>
                <span>Log out</span>
              </button>
            </>
          )}

          {view === 'newchat' && (
            <div className="menu-panel">
              <div className="menu-panel-header">
                <button
                  className="back-btn"
                  onClick={() => {
                    setView('menu');
                    setQuery('');
                    setResults([]);
                    setError('');
                  }}
                >
                  ←
                </button>
                <span>New Chat</span>
              </div>
              <input
                type="text"
                placeholder="Search username..."
                value={query}
                onChange={handleSearch}
                autoFocus
              />
              {error && <p className="error">{error}</p>}
              <ul className="menu-list">
                {results.map((u) => (
                  <li key={u.id} onClick={() => handleStartChat(u.id, u.username)}>
                    <div className="conv-avatar">{u.username.charAt(0).toUpperCase()}</div>
                    <span>{u.username}</span>
                  </li>
                ))}
                {query && results.length === 0 && (
                  <li className="empty-row">No users found</li>
                )}
              </ul>
            </div>
          )}

          {view === 'pending' && (
            <div className="menu-panel">
              <div className="menu-panel-header">
                <button className="back-btn" onClick={() => setView('menu')}>←</button>
                <span>Pending Requests</span>
              </div>
              {error && <p className="error">{error}</p>}
              {pending.length === 0 && <p className="empty-state">No pending requests</p>}
              <ul className="menu-list">
                {pending.map((r) => (
                  <li key={r.id} className="request-row">
                    <div className="conv-avatar">
                      {r.requester_username.charAt(0).toUpperCase()}
                    </div>
                    <span className="request-name">{r.requester_username}</span>
                    <div className="request-actions">
                      <button
                        className="accept-btn"
                        onClick={() => handleAccept(r.id, r.requester_username, r.requester_id)}
                      >
                        Accept
                      </button>
                      <button className="decline-btn" onClick={() => handleReject(r.id)}>
                        Decline
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {view === 'sent' && (
            <div className="menu-panel">
              <div className="menu-panel-header">
                <button className="back-btn" onClick={() => setView('menu')}>←</button>
                <span>Sent Requests</span>
              </div>
              {sent.length === 0 && <p className="empty-state">No sent requests</p>}
              <ul className="menu-list">
                {sent.map((r) => (
                  <li key={r.id} className="request-row">
                    <div className="conv-avatar">
                      {r.recipient_username.charAt(0).toUpperCase()}
                    </div>
                    <span className="request-name">{r.recipient_username}</span>
                    <span className="request-status">Pending</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}