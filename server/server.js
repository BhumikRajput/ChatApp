import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
dotenv.config();
import { createServer } from 'http';
import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';

import pool from './config/db.js';
import authRoutes from './routes/auth.js';
import conversationRoutes from './routes/conversations.js';
import userRoutes from './routes/users.js';

const allowedOrigin = process.env.CLIENT_URL || 'http://localhost:5173';

const app = express();
app.use(cors({ origin: allowedOrigin, credentials: true }));
app.use(express.json());

app.get('/api/health', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW()');
    res.json({ status: 'ok', dbTime: result.rows[0].now });
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: 'error', message: err.message });
  }
});

app.use('/api/auth', authRoutes);
app.use('/api/conversations', conversationRoutes);
app.use('/api/users', userRoutes);

// --- Socket.io setup ---
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: allowedOrigin }, // tighten this to your frontend URL later
});

// Make io reachable from REST routes via req.app.get('io')
app.set('io', io);

// Auth middleware for sockets — runs on every connection attempt
io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token) return next(new Error('No token provided'));

  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) return next(new Error('Invalid token'));
    socket.user = decoded; // { userId, username }
    next();
  });
});

// --- Presence tracking ---
// Maps a userId to the set of socket ids they currently have open
// (a user can have multiple tabs/devices connected at once).
const onlineUsers = new Map();

io.on('connection', (socket) => {
  const userId = socket.user.userId;
  console.log(`User connected: ${socket.user.username} (${socket.id})`);

  // Personal room — lets REST routes push events straight to this user
  socket.join(`user_${userId}`);

  // Track this connection for presence purposes
  if (!onlineUsers.has(userId)) onlineUsers.set(userId, new Set());
  const wasOffline = onlineUsers.get(userId).size === 0;
  onlineUsers.get(userId).add(socket.id);

  // Only broadcast "came online" the first time this user connects
  // (not on every extra tab/device).
  if (wasOffline) {
    socket.broadcast.emit('user_online', { userId });
  }

  // Send the full online list to the newly connected client
  socket.emit('online_users', Array.from(onlineUsers.keys()));

  // Allow a client to explicitly re-request the current online list
  // (e.g. after PresenceProvider mounts)
  socket.on('request_online_users', () => {
    socket.emit('online_users', Array.from(onlineUsers.keys()));
  });

  // Join a conversation room
  socket.on('join_conversation', (conversationId) => {
    socket.join(`conversation_${conversationId}`);
  });

  // Handle sending a message
  socket.on('send_message', async ({ conversationId, content }) => {
    // Fix: reject blank/whitespace-only messages (REST route already did this,
    // the socket path previously did not).
    if (!content || !content.trim()) return;

    try {
      const check = await pool.query(
        `SELECT c.status FROM conversations c
       JOIN conversation_participants cp ON cp.conversation_id = c.id
       WHERE c.id = $1 AND cp.user_id = $2`,
        [conversationId, userId]
      );
      if (check.rows.length === 0 || check.rows[0].status !== 'accepted') return;

      const result = await pool.query(
        `INSERT INTO messages (conversation_id, sender_id, content)
       VALUES ($1, $2, $3)
       RETURNING id, conversation_id, content, created_at, sender_id`,
        [conversationId, userId, content.trim()]
      );

      const message = {
        ...result.rows[0],
        sender_username: socket.user.username,
      };

      io.to(`conversation_${conversationId}`).emit('new_message', message);
    } catch (err) {
      console.error(err);
    }
  });

  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.user.username}`);

    const sockets = onlineUsers.get(userId);
    if (sockets) {
      sockets.delete(socket.id);
      // Only broadcast "went offline" once their last connection drops
      if (sockets.size === 0) {
        onlineUsers.delete(userId);
        io.emit('user_offline', { userId });
      }
    }
  });
});

const PORT = process.env.PORT || 5000;
httpServer.listen(PORT, () => console.log(`Server running on port ${PORT}`));