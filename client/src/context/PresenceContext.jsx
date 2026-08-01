import { createContext, useContext, useEffect, useState } from 'react';
import { getSocket } from '../socket/socket.js';
import { useAuth } from './AuthContext.jsx';

const PresenceContext = createContext(new Set());

export function PresenceProvider({ children }) {
  const { user } = useAuth();
  const [onlineUsers, setOnlineUsers] = useState(new Set());

  useEffect(() => {
    if (!user) {
      setOnlineUsers(new Set());
      return;
    }

    const socket = getSocket();
    if (!socket) return;

    function handleList(ids) {
      setOnlineUsers(new Set(ids));
    }
    function handleOnline({ userId }) {
      setOnlineUsers((prev) => new Set(prev).add(userId));
    }
    function handleOffline({ userId }) {
      setOnlineUsers((prev) => {
        const next = new Set(prev);
        next.delete(userId);
        return next;
      });
    }

    socket.on('online_users', handleList);
    socket.on('user_online', handleOnline);
    socket.on('user_offline', handleOffline);

    // In case the socket connected before this provider mounted,
    // ask the server for a fresh snapshot.
    socket.emit('request_online_users');

    return () => {
      socket.off('online_users', handleList);
      socket.off('user_online', handleOnline);
      socket.off('user_offline', handleOffline);
    };
  }, [user]);

  return (
    <PresenceContext.Provider value={onlineUsers}>
      {children}
    </PresenceContext.Provider>
  );
}

/**
 * Returns true if the given userId is currently online.
 * Usage: const isOnline = useIsOnline(otherUserId);
 */
export function useIsOnline(userId) {
  const online = useContext(PresenceContext);
  return userId != null && online.has(Number(userId));
}