import express from 'express';
import db from '../db.js';
import { authMiddleware } from '../auth.js';
import { randomUUID } from 'crypto';
import { io } from '../index.js';

const router = express.Router();

// ============================================
// GET /api/messages/:chatId - Get chat messages with pagination
// ============================================
router.get('/:chatId', authMiddleware, (req, res) => {
  try {
    const { chatId } = req.params;
    const { limit = 50, before } = req.query;

    // Check if user is member of chat
    const membership = db.prepare(`
      SELECT id FROM chat_members WHERE chat_id = ? AND user_id = ?
    `).get(chatId, req.userId);

    if (!membership) {
      return res.status(403).json({ error: 'Not a member of this chat' });
    }

    // Build query with cursor-based pagination
    let query = `
      SELECT
        m.id,
        m.chat_id,
        m.sender_id,
        m.type,
        m.content,
        m.file_url,
        m.file_name,
        m.file_size,
        m.reply_to,
        m.forwarded_from,
        m.edited,
        m.deleted,
        m.created_at,
        m.edited_at,
        json_object(
          'id', u.id,
          'username', u.username,
          'display_name', u.display_name,
          'avatar', u.avatar,
          'emoji_avatar', u.emoji_avatar
        ) as sender,
        (
          SELECT json_group_array(
            json_object(
              'emoji', mr.emoji,
              'user_id', mr.user_id,
              'username', u2.username
            )
          )
          FROM message_reactions mr
          JOIN users u2 ON mr.user_id = u2.id
          WHERE mr.message_id = m.id
        ) as reactions,
        (
          SELECT COUNT(*)
          FROM message_reads mr
          WHERE mr.message_id = m.id
        ) as read_count
      FROM messages m
      JOIN users u ON m.sender_id = u.id
      WHERE m.chat_id = ? AND m.deleted = 0
    `;

    const params = [chatId];

    if (before) {
      const beforeMessage = db.prepare('SELECT created_at FROM messages WHERE id = ?').get(before);
      if (beforeMessage) {
        query += ' AND m.created_at < ?';
        params.push(beforeMessage.created_at);
      }
    }

    query += ' ORDER BY m.created_at DESC LIMIT ?';
    params.push(parseInt(limit) + 1);

    const messages = db.prepare(query).all(...params);

    const hasMore = messages.length > parseInt(limit);
    if (hasMore) {
      messages.pop();
    }

    // Parse JSON fields and reverse to chronological order
    const parsedMessages = messages.reverse().map(msg => ({
      ...msg,
      sender: JSON.parse(msg.sender),
      reactions: JSON.parse(msg.reactions || '[]')
    }));

    res.json({
      messages: parsedMessages,
      hasMore
    });

  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({ error: 'Failed to get messages' });
  }
});

// ============================================
// POST /api/messages/:chatId - Send message
// ============================================
router.post('/:chatId', authMiddleware, (req, res) => {
  try {
    const { chatId } = req.params;
    const { type, content, reply_to, file_url, file_name, file_size, geo_lat, geo_lng, poll } = req.body;

    // Check if user is member of chat
    const membership = db.prepare(`
      SELECT id FROM chat_members WHERE chat_id = ? AND user_id = ?
    `).get(chatId, req.userId);

    if (!membership) {
      return res.status(403).json({ error: 'Not a member of this chat' });
    }

    // Validate message type
    const validTypes = ['text', 'image', 'file', 'audio', 'video', 'geo', 'voice', 'poll', 'system'];
    if (!validTypes.includes(type)) {
      return res.status(400).json({ error: 'Invalid message type' });
    }

    const messageId = randomUUID();

    // Prepare content based on type
    let messageContent = content;
    if (type === 'geo' && geo_lat && geo_lng) {
      messageContent = JSON.stringify({ lat: geo_lat, lng: geo_lng });
    }

    // Insert message
    db.prepare(`
      INSERT INTO messages (id, chat_id, sender_id, type, content, file_url, file_name, file_size, reply_to)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      messageId,
      chatId,
      req.userId,
      type,
      messageContent,
      file_url || null,
      file_name || null,
      file_size || null,
      reply_to || null
    );

    // If poll, create poll record
    if (type === 'poll' && poll) {
      const pollId = randomUUID();
      db.prepare(`
        INSERT INTO polls (id, message_id, question, options, multiple_choice, anonymous, expires_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        pollId,
        messageId,
        poll.question,
        JSON.stringify(poll.options),
        poll.multiple_choice ? 1 : 0,
        poll.anonymous ? 1 : 0,
        poll.expires_at || null
      );
    }

    // Get created message with sender info
    const message = db.prepare(`
      SELECT
        m.*,
        json_object(
          'id', u.id,
          'username', u.username,
          'display_name', u.display_name,
          'avatar', u.avatar,
          'emoji_avatar', u.emoji_avatar
        ) as sender
      FROM messages m
      JOIN users u ON m.sender_id = u.id
      WHERE m.id = ?
    `).get(messageId);

    const parsedMessage = {
      ...message,
      sender: JSON.parse(message.sender),
      reactions: []
    };

    // Emit to all chat members via Socket.io
    io.to(chatId).emit('new_message', parsedMessage);

    res.status(201).json({ message: parsedMessage });

  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

// ============================================
// PATCH /api/messages/:messageId - Edit message
// ============================================
router.patch('/:messageId', authMiddleware, (req, res) => {
  try {
    const { messageId } = req.params;
    const { content } = req.body;

    if (!content) {
      return res.status(400).json({ error: 'Content is required' });
    }

    // Check if message exists and belongs to user
    const message = db.prepare(`
      SELECT id, chat_id, sender_id, type FROM messages WHERE id = ?
    `).get(messageId);

    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }

    if (message.sender_id !== req.userId) {
      return res.status(403).json({ error: 'Can only edit your own messages' });
    }

    if (message.type !== 'text') {
      return res.status(400).json({ error: 'Can only edit text messages' });
    }

    // Update message
    const now = Math.floor(Date.now() / 1000);
    db.prepare(`
      UPDATE messages
      SET content = ?, edited = 1, edited_at = ?
      WHERE id = ?
    `).run(content, now, messageId);

    // Get updated message
    const updatedMessage = db.prepare(`
      SELECT
        m.*,
        json_object(
          'id', u.id,
          'username', u.username,
          'display_name', u.display_name,
          'avatar', u.avatar,
          'emoji_avatar', u.emoji_avatar
        ) as sender
      FROM messages m
      JOIN users u ON m.sender_id = u.id
      WHERE m.id = ?
    `).get(messageId);

    const parsedMessage = {
      ...updatedMessage,
      sender: JSON.parse(updatedMessage.sender)
    };

    // Emit to chat
    io.to(message.chat_id).emit('message_edited', parsedMessage);

    res.json({ message: parsedMessage });

  } catch (error) {
    console.error('Edit message error:', error);
    res.status(500).json({ error: 'Failed to edit message' });
  }
});

// ============================================
// DELETE /api/messages/:messageId - Delete message
// ============================================
router.delete('/:messageId', authMiddleware, (req, res) => {
  try {
    const { messageId } = req.params;

    // Check if message exists and belongs to user
    const message = db.prepare(`
      SELECT id, chat_id, sender_id FROM messages WHERE id = ?
    `).get(messageId);

    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }

    if (message.sender_id !== req.userId) {
      return res.status(403).json({ error: 'Can only delete your own messages' });
    }

    // Soft delete
    db.prepare('UPDATE messages SET deleted = 1 WHERE id = ?').run(messageId);

    // Emit to chat
    io.to(message.chat_id).emit('message_deleted', { messageId, chatId: message.chat_id });

    res.json({ message: 'Message deleted' });

  } catch (error) {
    console.error('Delete message error:', error);
    res.status(500).json({ error: 'Failed to delete message' });
  }
});

// ============================================
// POST /api/messages/:messageId/pin - Pin message
// ============================================
router.post('/:messageId/pin', authMiddleware, (req, res) => {
  try {
    const { messageId } = req.params;

    // Get message and check membership
    const message = db.prepare(`
      SELECT m.id, m.chat_id
      FROM messages m
      JOIN chat_members cm ON m.chat_id = cm.chat_id
      WHERE m.id = ? AND cm.user_id = ?
    `).get(messageId, req.userId);

    if (!message) {
      return res.status(404).json({ error: 'Message not found or not a member' });
    }

    // Check if user is admin or owner
    const membership = db.prepare(`
      SELECT role FROM chat_members WHERE chat_id = ? AND user_id = ?
    `).get(message.chat_id, req.userId);

    if (membership.role !== 'owner' && membership.role !== 'admin') {
      return res.status(403).json({ error: 'Only owner or admin can pin messages' });
    }

    // Pin message
    db.prepare(`
      INSERT OR IGNORE INTO pinned_messages (chat_id, message_id, pinned_by)
      VALUES (?, ?, ?)
    `).run(message.chat_id, messageId, req.userId);

    res.json({ message: 'Message pinned' });

  } catch (error) {
    console.error('Pin message error:', error);
    res.status(500).json({ error: 'Failed to pin message' });
  }
});

// ============================================
// DELETE /api/messages/:messageId/pin - Unpin message
// ============================================
router.delete('/:messageId/pin', authMiddleware, (req, res) => {
  try {
    const { messageId } = req.params;

    // Get message and check membership
    const message = db.prepare(`
      SELECT m.id, m.chat_id
      FROM messages m
      JOIN chat_members cm ON m.chat_id = cm.chat_id
      WHERE m.id = ? AND cm.user_id = ?
    `).get(messageId, req.userId);

    if (!message) {
      return res.status(404).json({ error: 'Message not found or not a member' });
    }

    // Check if user is admin or owner
    const membership = db.prepare(`
      SELECT role FROM chat_members WHERE chat_id = ? AND user_id = ?
    `).get(message.chat_id, req.userId);

    if (membership.role !== 'owner' && membership.role !== 'admin') {
      return res.status(403).json({ error: 'Only owner or admin can unpin messages' });
    }

    // Unpin message
    db.prepare(`
      DELETE FROM pinned_messages WHERE chat_id = ? AND message_id = ?
    `).run(message.chat_id, messageId);

    res.json({ message: 'Message unpinned' });

  } catch (error) {
    console.error('Unpin message error:', error);
    res.status(500).json({ error: 'Failed to unpin message' });
  }
});

// ============================================
// POST /api/messages/:messageId/react - Toggle reaction
// ============================================
router.post('/:messageId/react', authMiddleware, (req, res) => {
  try {
    const { messageId } = req.params;
    const { emoji } = req.body;

    if (!emoji) {
      return res.status(400).json({ error: 'Emoji is required' });
    }

    // Check if message exists and user is member
    const message = db.prepare(`
      SELECT m.id, m.chat_id
      FROM messages m
      JOIN chat_members cm ON m.chat_id = cm.chat_id
      WHERE m.id = ? AND cm.user_id = ?
    `).get(messageId, req.userId);

    if (!message) {
      return res.status(404).json({ error: 'Message not found or not a member' });
    }

    // Check if reaction already exists
    const existing = db.prepare(`
      SELECT id FROM message_reactions WHERE message_id = ? AND user_id = ? AND emoji = ?
    `).get(messageId, req.userId, emoji);

    if (existing) {
      // Remove reaction
      db.prepare(`
        DELETE FROM message_reactions WHERE message_id = ? AND user_id = ? AND emoji = ?
      `).run(messageId, req.userId, emoji);
    } else {
      // Add reaction
      db.prepare(`
        INSERT INTO message_reactions (message_id, user_id, emoji)
        VALUES (?, ?, ?)
      `).run(messageId, req.userId, emoji);
    }

    // Get all reactions for this message
    const reactions = db.prepare(`
      SELECT
        mr.emoji,
        mr.user_id,
        u.username
      FROM message_reactions mr
      JOIN users u ON mr.user_id = u.id
      WHERE mr.message_id = ?
    `).all(messageId);

    // Emit to chat
    io.to(message.chat_id).emit('message_reaction', {
      messageId,
      reactions
    });

    res.json({ reactions });

  } catch (error) {
    console.error('React to message error:', error);
    res.status(500).json({ error: 'Failed to react to message' });
  }
});

// ============================================
// GET /api/messages/:chatId/pinned - Get pinned messages
// ============================================
router.get('/:chatId/pinned', authMiddleware, (req, res) => {
  try {
    const { chatId } = req.params;

    // Check if user is member
    const membership = db.prepare(`
      SELECT id FROM chat_members WHERE chat_id = ? AND user_id = ?
    `).get(chatId, req.userId);

    if (!membership) {
      return res.status(403).json({ error: 'Not a member of this chat' });
    }

    // Get pinned messages
    const pinnedMessages = db.prepare(`
      SELECT
        m.*,
        json_object(
          'id', u.id,
          'username', u.username,
          'display_name', u.display_name,
          'avatar', u.avatar,
          'emoji_avatar', u.emoji_avatar
        ) as sender,
        pm.pinned_at,
        pm.pinned_by
      FROM pinned_messages pm
      JOIN messages m ON pm.message_id = m.id
      JOIN users u ON m.sender_id = u.id
      WHERE pm.chat_id = ?
      ORDER BY pm.pinned_at DESC
    `).all(chatId);

    const parsed = pinnedMessages.map(msg => ({
      ...msg,
      sender: JSON.parse(msg.sender)
    }));

    res.json({ messages: parsed });

  } catch (error) {
    console.error('Get pinned messages error:', error);
    res.status(500).json({ error: 'Failed to get pinned messages' });
  }
});

export default router;
