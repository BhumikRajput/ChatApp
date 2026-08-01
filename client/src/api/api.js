const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

function getHeaders(token) {
  return {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` }),
  };
}

export async function signup(username, password) {
  const res = await fetch(`${BASE_URL}/auth/signup`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ username, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Signup failed');
  return data;
}

export async function login(username, password) {
  const res = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ username, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Login failed');
  return data;
}

export async function getConversations(token) {
  const res = await fetch(`${BASE_URL}/conversations`, {
    headers: getHeaders(token),
  });
  if (!res.ok) throw new Error('Failed to fetch conversations');
  return res.json();
}

export async function createConversation(token, otherUserId) {
  const res = await fetch(`${BASE_URL}/conversations`, {
    method: 'POST',
    headers: getHeaders(token),
    body: JSON.stringify({ otherUserId }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Failed to create conversation');
  return data;
}

export async function getMessages(token, conversationId) {
  const res = await fetch(`${BASE_URL}/conversations/${conversationId}/messages`, {
    headers: getHeaders(token),
  });
  if (!res.ok) throw new Error('Failed to fetch messages');
  return res.json();
}

export async function sendMessageRest(token, conversationId, content) {
  const res = await fetch(`${BASE_URL}/conversations/${conversationId}/messages`, {
    method: 'POST',
    headers: getHeaders(token),
    body: JSON.stringify({ content }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Failed to send message');
  return data;
}

export async function searchUsers(token, query) {
  const res = await fetch(`${BASE_URL}/users/search?q=${encodeURIComponent(query)}`, {
    headers: getHeaders(token),
  });
  if (!res.ok) throw new Error('Failed to search users');
  return res.json();
}

export async function getPendingRequests(token) {
  const res = await fetch(`${BASE_URL}/conversations/pending`, {
    headers: getHeaders(token),
  });
  if (!res.ok) throw new Error('Failed to fetch pending requests');
  return res.json();
}

export async function acceptRequest(token, conversationId) {
  const res = await fetch(`${BASE_URL}/conversations/${conversationId}/accept`, {
    method: 'POST',
    headers: getHeaders(token),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Failed to accept');
  return data;
}

export async function rejectRequest(token, conversationId) {
  const res = await fetch(`${BASE_URL}/conversations/${conversationId}/reject`, {
    method: 'POST',
    headers: getHeaders(token),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Failed to reject');
  return data;
}

export async function deleteConversation(token, conversationId) {
  const res = await fetch(`${BASE_URL}/conversations/${conversationId}`, {
    method: 'DELETE',
    headers: getHeaders(token),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Failed to delete conversation');
  return data;
}

export async function getSentRequests(token) {
  const res = await fetch(`${BASE_URL}/conversations/sent`, {
    headers: getHeaders(token),
  });
  if (!res.ok) throw new Error('Failed to fetch sent requests');
  return res.json();
}