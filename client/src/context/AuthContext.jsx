import { createContext, useContext, useState, useEffect } from 'react';
import * as api from '../api/api.js';
import { connectSocket, disconnectSocket } from '../socket/socket.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const savedToken = localStorage.getItem('token');
    const savedUser = localStorage.getItem('user');
    if (savedToken && savedUser) {
      setToken(savedToken);
      setUser(JSON.parse(savedUser));
      connectSocket(savedToken);
    }
    setLoading(false);
  }, []);

  async function handleLogin(username, password) {
    const data = await api.login(username, password);
    setUser(data.user);
    setToken(data.token);
    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data.user));
    connectSocket(data.token);
  }

  async function handleSignup(username, password) {
    const data = await api.signup(username, password);
    setUser(data.user);
    setToken(data.token);
    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data.user));
    connectSocket(data.token);
  }

  function handleLogout() {
    setUser(null);
    setToken(null);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    disconnectSocket();
  }

  return (
    <AuthContext.Provider
      value={{ user, token, loading, login: handleLogin, signup: handleSignup, logout: handleLogout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}