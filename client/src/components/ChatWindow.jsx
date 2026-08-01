import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { useIsOnline } from '../context/PresenceContext.jsx';
import * as api from '../api/api.js';
import { getSocket } from '../socket/socket.js';

function formatTime(isoString) {
  return new Date(isoString).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

export default function ChatWindow({ conversationId, conversationLabel, otherUserId, onBack }) {
  const { token, user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [error, setError] = useState('');
  const messagesEndRef = useRef(null);
  const isOnline = useIsOnline(otherUserId);

  useEffect(() => {
    if (!conversationId) return;
    setMessages([]);
    setError('');

    async function loadMessages() {
      try {
        const data = await api.getMessages(token, conversationId);
        setMessages(data);
      } catch (err) {
        setError(err.message);
      }
    }
    loadMessages();

    const socket = getSocket();
    if (socket) {
      socket.emit('join_conversation', conversationId);
    }
  }, [conversationId, token]);

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    function handleNewMessage(message) {
      if (String(message.conversation_id) === String(conversationId)) {
        setMessages((prev) => [...prev, message]);
      }
    }

    socket.on('new_message', handleNewMessage);
    return () => socket.off('new_message', handleNewMessage);
  }, [conversationId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  function handleSend(e) {
    e.preventDefault();
    if (!input.trim()) return;

    const socket = getSocket();
    if (!socket) {
      // Fix: previously this crashed with "Cannot read properties of null"
      // if the socket failed to connect (e.g. expired token).
      setError('Not connected — try refreshing the page.');
      return;
    }
    socket.emit('send_message', { conversationId, content: input.trim() });
    setInput('');
  }

  if (!conversationId) {
    return (
      <div className="chat-window chat-window-empty">
        <div className="empty-chat-message">
          <p>Select a conversation to start chatting</p>
        </div>
      </div>
    );
  }

  return (
    <div className="chat-window">
      <div className="chat-header">
        <button className="mobile-back-btn" onClick={onBack} aria-label="Back to conversations">
          ‹
        </button>
        <div className="conv-avatar-wrap">
          <div className="conv-avatar">{(conversationLabel || '?').charAt(0).toUpperCase()}</div>
          {otherUserId != null && (
            <span className={`presence-dot ${isOnline ? 'online' : 'offline'}`} />
          )}
        </div>
        <div className="chat-header-info">
          <span>{conversationLabel}</span>
          {otherUserId != null && (
            <span className="chat-header-status">{isOnline ? 'Online' : 'Offline'}</span>
          )}
        </div>
      </div>
      <div className="messages">
        {error && <p className="error">{error}</p>}
        {messages.length === 0 && !error && (
          <p className="empty-state">No messages yet. Say hello!</p>
        )}
        {messages.map((msg) => (
          <div key={msg.id} className={`message ${msg.sender_id === user.id ? 'own' : ''}`}>
            <div className="message-bubble">
              <p>{msg.content}</p>
              <span className="message-time">{formatTime(msg.created_at)}</span>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>
      <form onSubmit={handleSend} className="message-form">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type a message..."
        />
        <button type="submit">Send</button>
      </form>
    </div>
  );
}