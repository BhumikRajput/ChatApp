import express from 'express';
import pool from '../config/db.js';
import authenticateToken from '../middleware/auth.js';

const router = express.Router();
router.use(authenticateToken);

// Get all ACCEPTED conversations for the logged-in user
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT c.id, c.is_group, c.name, c.created_at, c.status,
              other_user.id as other_user_id, other_user.username as other_username
       FROM conversations c
       JOIN conversation_participants cp ON cp.conversation_id = c.id
       JOIN conversation_participants other_cp ON other_cp.conversation_id = c.id AND other_cp.user_id != $1
       JOIN users other_user ON other_user.id = other_cp.user_id
       WHERE cp.user_id = $1 AND c.status = 'accepted'
       ORDER BY c.created_at DESC`,
      [req.user.userId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get incoming PENDING requests (someone wants to chat with me)
router.get('/pending', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT c.id, c.created_at, u.id as requester_id, u.username as requester_username
       FROM conversations c
       JOIN conversation_participants cp ON cp.conversation_id = c.id
       JOIN users u ON u.id = c.requested_by
       WHERE cp.user_id = $1 AND c.status = 'pending' AND c.requested_by != $1`,
      [req.user.userId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get outgoing PENDING requests (requests I sent that haven't been accepted yet)
router.get('/sent', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT c.id, c.created_at, other_user.id as recipient_id, other_user.username as recipient_username
       FROM conversations c
       JOIN conversation_participants cp ON cp.conversation_id = c.id AND cp.user_id = $1
       JOIN conversation_participants other_cp ON other_cp.conversation_id = c.id AND other_cp.user_id != $1
       JOIN users other_user ON other_user.id = other_cp.user_id
       WHERE c.status = 'pending' AND c.requested_by = $1`,
      [req.user.userId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Send a new chat request (or return existing conversation, any status)
router.post('/', async (req, res) => {
  const { otherUserId } = req.body;
  const myId = req.user.userId;

  if (!otherUserId) {
    return res.status(400).json({ message: 'otherUserId is required' });
  }

  // Fix: prevent a user from starting a conversation with themselves
  if (Number(otherUserId) === Number(myId)) {
    return res.status(400).json({ message: 'You cannot start a conversation with yourself' });
  }

  try {
    const existing = await pool.query(
      `SELECT c.id, c.status FROM conversations c
       JOIN conversation_participants p1 ON p1.conversation_id = c.id AND p1.user_id = $1
       JOIN conversation_participants p2 ON p2.conversation_id = c.id AND p2.user_id = $2
       WHERE c.is_group = FALSE`,
      [myId, otherUserId]
    );

    if (existing.rows.length > 0) {
      return res.json({
        id: existing.rows[0].id,
        status: existing.rows[0].status,
        existing: true,
      });
    }

    const convResult = await pool.query(
      `INSERT INTO conversations (is_group, status, requested_by)
       VALUES (FALSE, 'pending', $1) RETURNING id, status, created_at`,
      [myId]
    );
    const conversationId = convResult.rows[0].id;

    await pool.query(
      `INSERT INTO conversation_participants (conversation_id, user_id)
       VALUES ($1, $2), ($1, $3)`,
      [conversationId, myId, otherUserId]
    );

    // Live-notify the recipient
    const io = req.app.get('io');
    io.to(`user_${otherUserId}`).emit('new_conversation_request', {
      id: conversationId,
      created_at: convResult.rows[0].created_at,
      requester_id: myId,
      requester_username: req.user.username,
    });

    res.status(201).json({ id: conversationId, status: 'pending', existing: false });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Accept a pending request
router.post('/:id/accept', async (req, res) => {
  const conversationId = req.params.id;
  try {
    // Fix: previously this only checked `requested_by !== req.user.userId`,
    // which meant ANY authenticated user (not just the intended recipient)
    // could accept someone else's pending request. Now we require the
    // caller to actually be a participant of this conversation.
    const conv = await pool.query(
      `SELECT c.requested_by FROM conversations c
       JOIN conversation_participants cp ON cp.conversation_id = c.id
       WHERE c.id = $1 AND cp.user_id = $2`,
      [conversationId, req.user.userId]
    );
    if (conv.rows.length === 0) {
      return res.status(404).json({ message: 'Conversation not found' });
    }
    if (conv.rows[0].requested_by === req.user.userId) {
      return res.status(403).json({ message: 'You cannot accept your own request' });
    }

    await pool.query(
      `UPDATE conversations SET status = 'accepted' WHERE id = $1`,
      [conversationId]
    );

    // Live-notify the original requester
    const io = req.app.get('io');
    io.to(`user_${conv.rows[0].requested_by}`).emit('conversation_accepted', {
      id: Number(conversationId),
      accepter_id: req.user.userId,
      accepter_username: req.user.username,
    });

    res.json({ id: conversationId, status: 'accepted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Reject/delete a pending request
router.post('/:id/reject', async (req, res) => {
  const conversationId = req.params.id;
  try {
    // Fix: same participant check as accept — previously anyone could
    // reject (i.e. delete) any pending conversation by ID.
    const conv = await pool.query(
      `SELECT c.requested_by FROM conversations c
       JOIN conversation_participants cp ON cp.conversation_id = c.id
       WHERE c.id = $1 AND cp.user_id = $2`,
      [conversationId, req.user.userId]
    );
    if (conv.rows.length === 0) {
      return res.status(404).json({ message: 'Conversation not found' });
    }

    await pool.query(`DELETE FROM conversations WHERE id = $1`, [conversationId]);

    const io = req.app.get('io');
    io.to(`user_${conv.rows[0].requested_by}`).emit('conversation_rejected', {
      id: Number(conversationId),
    });

    res.json({ id: conversationId, status: 'rejected' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get messages — only allowed if conversation is accepted
router.get('/:id/messages', async (req, res) => {
  const conversationId = req.params.id;
  try {
    const check = await pool.query(
      `SELECT c.status FROM conversations c
       JOIN conversation_participants cp ON cp.conversation_id = c.id
       WHERE c.id = $1 AND cp.user_id = $2`,
      [conversationId, req.user.userId]
    );
    if (check.rows.length === 0) {
      return res.status(403).json({ message: 'Not a participant of this conversation' });
    }
    if (check.rows[0].status !== 'accepted') {
      return res.status(403).json({ message: 'Conversation not yet accepted' });
    }

    const result = await pool.query(
      `SELECT m.id, m.conversation_id, m.content, m.created_at, m.sender_id, u.username as sender_username
       FROM messages m
       JOIN users u ON u.id = m.sender_id
       WHERE m.conversation_id = $1
       ORDER BY m.created_at ASC`,
      [conversationId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Send message via REST — only allowed if accepted
router.post('/:id/messages', async (req, res) => {
  const conversationId = req.params.id;
  const { content } = req.body;

  if (!content || !content.trim()) {
    return res.status(400).json({ message: 'Message content is required' });
  }

  try {
    const check = await pool.query(
      `SELECT c.status FROM conversations c
       JOIN conversation_participants cp ON cp.conversation_id = c.id
       WHERE c.id = $1 AND cp.user_id = $2`,
      [conversationId, req.user.userId]
    );
    if (check.rows.length === 0) {
      return res.status(403).json({ message: 'Not a participant of this conversation' });
    }
    if (check.rows[0].status !== 'accepted') {
      return res.status(403).json({ message: 'Conversation not yet accepted' });
    }

    const result = await pool.query(
      `INSERT INTO messages (conversation_id, sender_id, content)
       VALUES ($1, $2, $3)
       RETURNING id, conversation_id, content, created_at, sender_id`,
      [conversationId, req.user.userId, content.trim()]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete/leave a conversation entirely
router.delete('/:id', async (req, res) => {
  const conversationId = req.params.id;
  try {
    const check = await pool.query(
      `SELECT 1 FROM conversation_participants WHERE conversation_id = $1 AND user_id = $2`,
      [conversationId, req.user.userId]
    );
    if (check.rows.length === 0) {
      return res.status(403).json({ message: 'Not a participant of this conversation' });
    }

    await pool.query(`DELETE FROM conversations WHERE id = $1`, [conversationId]);
    res.json({ id: conversationId, deleted: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;