import express from 'express';
import db from '../db.js';
import { authMiddleware } from '../auth.js';
import { randomUUID } from 'crypto';
import { io } from '../index.js';

const router = express.Router();

// ============================================
// GET /api/chats - Get all user's chats
// ============================================
router.get('/', authMiddleware, (req, res) => {
  try {
    const chats = db.prepare(`
      SELECT
        c.id,
        c.type,
        c.name,
        c.description,
        c.avatar,
        c.created_by,
        c.created_at,
        (
          SELECT json_object(
            'id', m.id,
            'type', m.type,
            'content', m.content,
            'sender_id', m.sender_id,
            'sender_name', u.display_name,
            'created_at', m.created_at
          )
          FROM messages m
          JOIN users u ON m.sender_id = u.id
          WHERE m.chat_id = c.id AND m.deleted = 0
          ORDER BY m.created_at DESC
          LIMIT 1
        ) as last_message,
        (
          SELECT COUNT(*)
          FROM messages m
          LEFT JOIN message_reads mr ON m.id = mr.message_id AND mr.user_id = ?
          WHERE m.chat_id = c.id AND m.sender_id != ? AND mr.id IS NULL AND m.deleted = 0
        ) as unread_count,
        (
          SELECT json_group_array(
            json_object(
              'id', u.id,
              'username', u.username,
              'display_name', u.display_name,
              'avatar', u.avatar,
              'emoji_avatar', u.emoji_avatar,
              'online', u.online,
              'role', cm.role
            )
          )
          FROM chat_members cm
          JOIN users u ON cm.user_id = u.id
          WHERE cm.chat_id = c.id
        ) as members
      FROM chats c
      JOIN chat_members cm ON c.id = cm.chat_id
      WHERE cm.user_id = ?
      ORDER BY (
        SELECT created_at FROM messages WHERE chat_id = c.id ORDER BY created_at DESC LIMIT 1
      ) DESC NULLS LAST
    `).all(req.userId, req.userId, req.userId);

    // Parse JSON fields
    const parsedChats = chats.map(chat => ({
      ...chat,
      last_message: chat.last_message ? JSON.parse(chat.last_message) : null,
      members: JSON.parse(chat.members || '[]')
    }));

    res.json({ chats: parsedChats });

  } catch (error) {
    console.error('Get chats error:', error);
    res.status(500).json({ error: 'Failed to get chats' });
  }
});

// ============================================
// GET /api/chats/saved - Get or create saved messages chat
// ============================================
router.get('/saved', authMiddleware, (req, res) => {
  try {
    // Check if saved messages chat already exists
    const existingChat = db.prepare(`
      SELECT c.id
      FROM chats c
      WHERE c.type = 'saved'
        AND c.created_by = ?
      LIMIT 1
    `).get(req.userId);

    if (existingChat) {
      // Return existing saved messages chat
      const chat = db.prepare(`
        SELECT
          c.*,
          (
            SELECT json_group_array(
              json_object(
                'id', u.id,
                'username', u.username,
                'display_name', u.display_name,
                'avatar', u.avatar,
                'emoji_avatar', u.emoji_avatar,
                'online', u.online,
                'role', cm.role
              )
            )
            FROM chat_members cm
            JOIN users u ON cm.user_id = u.id
            WHERE cm.chat_id = c.id
          ) as members
        FROM chats c
        WHERE c.id = ?
      `).get(existingChat.id);

      return res.json({
        chat: {
          ...chat,
          members: JSON.parse(chat.members || '[]')
        }
      });
    }

    // Create new saved messages chat
    const chatId = randomUUID();

    db.prepare(`
      INSERT INTO chats (id, type, name, created_by)
      VALUES (?, 'saved', 'Saved Messages', ?)
    `).run(chatId, req.userId);

    // Add user as only member
    db.prepare(`
      INSERT INTO chat_members (chat_id, user_id, role)
      VALUES (?, ?, 'owner')
    `).run(chatId, req.userId);

    // Get created chat with members
    const chat = db.prepare(`
      SELECT
        c.*,
        (
          SELECT json_group_array(
            json_object(
              'id', u.id,
              'username', u.username,
              'display_name', u.display_name,
              'avatar', u.avatar,
              'emoji_avatar', u.emoji_avatar,
              'online', u.online,
              'role', cm.role
            )
          )
          FROM chat_members cm
          JOIN users u ON cm.user_id = u.id
          WHERE cm.chat_id = c.id
        ) as members
      FROM chats c
      WHERE c.id = ?
    `).get(chatId);

    res.status(201).json({
      chat: {
        ...chat,
        members: JSON.parse(chat.members || '[]')
      }
    });

  } catch (error) {
    console.error('Get/create saved messages error:', error);
    res.status(500).json({ error: 'Failed to get saved messages' });
  }
});

// ============================================
// POST /api/chats/direct - Create or get direct chat
// ============================================
router.post('/direct', authMiddleware, (req, res) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    if (userId === req.userId) {
      return res.status(400).json({ error: 'Cannot create chat with yourself' });
    }

    // Check if user exists
    const targetUser = db.prepare('SELECT id FROM users WHERE id = ?').get(userId);
    if (!targetUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check if direct chat already exists
    const existingChat = db.prepare(`
      SELECT c.id
      FROM chats c
      WHERE c.type = 'direct'
        AND c.id IN (
          SELECT chat_id FROM chat_members WHERE user_id = ?
        )
        AND c.id IN (
          SELECT chat_id FROM chat_members WHERE user_id = ?
        )
      LIMIT 1
    `).get(req.userId, userId);

    if (existingChat) {
      // Return existing chat
      const chat = db.prepare(`
        SELECT
          c.*,
          (
            SELECT json_group_array(
              json_object(
                'id', u.id,
                'username', u.username,
                'display_name', u.display_name,
                'avatar', u.avatar,
                'emoji_avatar', u.emoji_avatar,
                'online', u.online,
                'role', cm.role
              )
            )
            FROM chat_members cm
            JOIN users u ON cm.user_id = u.id
            WHERE cm.chat_id = c.id
          ) as members
        FROM chats c
        WHERE c.id = ?
      `).get(existingChat.id);

      return res.json({
        chat: {
          ...chat,
          members: JSON.parse(chat.members || '[]')
        }
      });
    }

    // Create new direct chat
    const chatId = randomUUID();

    db.prepare(`
      INSERT INTO chats (id, type, created_by)
      VALUES (?, 'direct', ?)
    `).run(chatId, req.userId);

    // Add both members
    const addMember = db.prepare(`
      INSERT INTO chat_members (chat_id, user_id, role)
      VALUES (?, ?, 'member')
    `);

    addMember.run(chatId, req.userId);
    addMember.run(chatId, userId);

    // Join all connected sockets of both users into the new chat room
    io.in(`user:${req.userId}`).socketsJoin(chatId);
    io.in(`user:${userId}`).socketsJoin(chatId);

    // Get created chat with members
    const chat = db.prepare(`
      SELECT
        c.*,
        (
          SELECT json_group_array(
            json_object(
              'id', u.id,
              'username', u.username,
              'display_name', u.display_name,
              'avatar', u.avatar,
              'emoji_avatar', u.emoji_avatar,
              'online', u.online,
              'role', cm.role
            )
          )
          FROM chat_members cm
          JOIN users u ON cm.user_id = u.id
          WHERE cm.chat_id = c.id
        ) as members
      FROM chats c
      WHERE c.id = ?
    `).get(chatId);

    const parsedChat = {
      ...chat,
      members: JSON.parse(chat.members || '[]'),
      last_message: null,
      unread_count: 0
    };

    // Notify recipient about the new chat
    io.to(`user:${userId}`).emit('chat_created', parsedChat);

    res.status(201).json({ chat: parsedChat });

  } catch (error) {
    console.error('Create direct chat error:', error);
    res.status(500).json({ error: 'Failed to create chat' });
  }
});

// ============================================
// POST /api/chats/group - Create group chat
// ============================================
router.post('/group', authMiddleware, (req, res) => {
  try {
    const { name, description, memberIds } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Group name is required' });
    }

    if (!memberIds || !Array.isArray(memberIds) || memberIds.length === 0) {
      return res.status(400).json({ error: 'At least one member is required' });
    }

    const chatId = randomUUID();

    // Create group
    db.prepare(`
      INSERT INTO chats (id, type, name, description, created_by)
      VALUES (?, 'group', ?, ?, ?)
    `).run(chatId, name, description || null, req.userId);

    // Add creator as owner
    db.prepare(`
      INSERT INTO chat_members (chat_id, user_id, role)
      VALUES (?, ?, 'owner')
    `).run(chatId, req.userId);

    // Add other members
    const addMember = db.prepare(`
      INSERT INTO chat_members (chat_id, user_id, role)
      VALUES (?, ?, 'member')
    `);

    for (const memberId of memberIds) {
      if (memberId !== req.userId) {
        try {
          addMember.run(chatId, memberId);
        } catch (err) {
          console.error(`Failed to add member ${memberId}:`, err);
        }
      }
    }

    // Join all connected sockets of all members into the new chat room
    io.in(`user:${req.userId}`).socketsJoin(chatId);
    for (const memberId of memberIds) {
      io.in(`user:${memberId}`).socketsJoin(chatId);
    }

    // Get created chat
    const chat = db.prepare(`
      SELECT
        c.*,
        (
          SELECT json_group_array(
            json_object(
              'id', u.id,
              'username', u.username,
              'display_name', u.display_name,
              'avatar', u.avatar,
              'emoji_avatar', u.emoji_avatar,
              'online', u.online,
              'role', cm.role
            )
          )
          FROM chat_members cm
          JOIN users u ON cm.user_id = u.id
          WHERE cm.chat_id = c.id
        ) as members
      FROM chats c
      WHERE c.id = ?
    `).get(chatId);

    res.status(201).json({
      chat: {
        ...chat,
        members: JSON.parse(chat.members || '[]')
      }
    });

  } catch (error) {
    console.error('Create group error:', error);
    res.status(500).json({ error: 'Failed to create group' });
  }
});

// ============================================
// POST /api/chats/channel - Create channel
// ============================================
router.post('/channel', authMiddleware, (req, res) => {
  try {
    const { name, description } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Channel name is required' });
    }

    const chatId = randomUUID();

    // Create channel
    db.prepare(`
      INSERT INTO chats (id, type, name, description, created_by)
      VALUES (?, 'channel', ?, ?, ?)
    `).run(chatId, name, description || null, req.userId);

    // Add creator as owner
    db.prepare(`
      INSERT INTO chat_members (chat_id, user_id, role)
      VALUES (?, ?, 'owner')
    `).run(chatId, req.userId);

    // Get created channel
    const chat = db.prepare(`
      SELECT
        c.*,
        (
          SELECT json_group_array(
            json_object(
              'id', u.id,
              'username', u.username,
              'display_name', u.display_name,
              'avatar', u.avatar,
              'emoji_avatar', u.emoji_avatar,
              'online', u.online,
              'role', cm.role
            )
          )
          FROM chat_members cm
          JOIN users u ON cm.user_id = u.id
          WHERE cm.chat_id = c.id
        ) as members
      FROM chats c
      WHERE c.id = ?
    `).get(chatId);

    res.status(201).json({
      chat: {
        ...chat,
        members: JSON.parse(chat.members || '[]')
      }
    });

  } catch (error) {
    console.error('Create channel error:', error);
    res.status(500).json({ error: 'Failed to create channel' });
  }
});

// ============================================
// GET /api/chats/:id - Get chat details
// ============================================
router.get('/:id', authMiddleware, (req, res) => {
  try {
    const chatId = req.params.id;

    // Check if user is member
    const membership = db.prepare(`
      SELECT id FROM chat_members WHERE chat_id = ? AND user_id = ?
    `).get(chatId, req.userId);

    if (!membership) {
      return res.status(403).json({ error: 'Not a member of this chat' });
    }

    // Get chat with members
    const chat = db.prepare(`
      SELECT
        c.*,
        (
          SELECT json_group_array(
            json_object(
              'id', u.id,
              'username', u.username,
              'display_name', u.display_name,
              'avatar', u.avatar,
              'emoji_avatar', u.emoji_avatar,
              'online', u.online,
              'last_seen', u.last_seen,
              'role', cm.role
            )
          )
          FROM chat_members cm
          JOIN users u ON cm.user_id = u.id
          WHERE cm.chat_id = c.id
        ) as members
      FROM chats c
      WHERE c.id = ?
    `).get(chatId);

    if (!chat) {
      return res.status(404).json({ error: 'Chat not found' });
    }

    res.json({
      chat: {
        ...chat,
        members: JSON.parse(chat.members || '[]')
      }
    });

  } catch (error) {
    console.error('Get chat error:', error);
    res.status(500).json({ error: 'Failed to get chat' });
  }
});

// ============================================
// PATCH /api/chats/:id - Update chat
// ============================================
router.patch('/:id', authMiddleware, (req, res) => {
  try {
    const chatId = req.params.id;
    const { name, description, avatar } = req.body;

    // Check if user is owner or admin
    const membership = db.prepare(`
      SELECT role FROM chat_members WHERE chat_id = ? AND user_id = ?
    `).get(chatId, req.userId);

    if (!membership || (membership.role !== 'owner' && membership.role !== 'admin')) {
      return res.status(403).json({ error: 'Only owner or admin can update chat' });
    }

    const updates = [];
    const values = [];

    if (name !== undefined) {
      updates.push('name = ?');
      values.push(name);
    }

    if (description !== undefined) {
      updates.push('description = ?');
      values.push(description);
    }

    if (avatar !== undefined) {
      updates.push('avatar = ?');
      values.push(avatar);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    values.push(chatId);

    db.prepare(`
      UPDATE chats
      SET ${updates.join(', ')}
      WHERE id = ?
    `).run(...values);

    // Get updated chat
    const chat = db.prepare(`
      SELECT
        c.*,
        (
          SELECT json_group_array(
            json_object(
              'id', u.id,
              'username', u.username,
              'display_name', u.display_name,
              'avatar', u.avatar,
              'emoji_avatar', u.emoji_avatar,
              'online', u.online,
              'role', cm.role
            )
          )
          FROM chat_members cm
          JOIN users u ON cm.user_id = u.id
          WHERE cm.chat_id = c.id
        ) as members
      FROM chats c
      WHERE c.id = ?
    `).get(chatId);

    res.json({
      chat: {
        ...chat,
        members: JSON.parse(chat.members || '[]')
      }
    });

  } catch (error) {
    console.error('Update chat error:', error);
    res.status(500).json({ error: 'Failed to update chat' });
  }
});

// ============================================
// POST /api/chats/:id/members - Add members
// ============================================
router.post('/:id/members', authMiddleware, (req, res) => {
  try {
    const chatId = req.params.id;
    const { memberIds } = req.body;

    if (!memberIds || !Array.isArray(memberIds) || memberIds.length === 0) {
      return res.status(400).json({ error: 'memberIds array is required' });
    }

    // Check if user is owner or admin
    const membership = db.prepare(`
      SELECT role FROM chat_members WHERE chat_id = ? AND user_id = ?
    `).get(chatId, req.userId);

    if (!membership || (membership.role !== 'owner' && membership.role !== 'admin')) {
      return res.status(403).json({ error: 'Only owner or admin can add members' });
    }

    const addMember = db.prepare(`
      INSERT OR IGNORE INTO chat_members (chat_id, user_id, role)
      VALUES (?, ?, 'member')
    `);

    for (const memberId of memberIds) {
      addMember.run(chatId, memberId);
    }

    res.json({ message: 'Members added' });

  } catch (error) {
    console.error('Add members error:', error);
    res.status(500).json({ error: 'Failed to add members' });
  }
});

// ============================================
// DELETE /api/chats/:id/members/:userId - Remove member
// ============================================
router.delete('/:id/members/:userId', authMiddleware, (req, res) => {
  try {
    const chatId = req.params.id;
    const targetUserId = req.params.userId;

    // Check if user is owner or admin, or removing themselves
    const membership = db.prepare(`
      SELECT role FROM chat_members WHERE chat_id = ? AND user_id = ?
    `).get(chatId, req.userId);

    if (!membership) {
      return res.status(403).json({ error: 'Not a member of this chat' });
    }

    const isSelf = targetUserId === req.userId;
    const isAdmin = membership.role === 'owner' || membership.role === 'admin';

    if (!isSelf && !isAdmin) {
      return res.status(403).json({ error: 'Only owner or admin can remove members' });
    }

    db.prepare(`
      DELETE FROM chat_members WHERE chat_id = ? AND user_id = ?
    `).run(chatId, targetUserId);

    res.json({ message: 'Member removed' });

  } catch (error) {
    console.error('Remove member error:', error);
    res.status(500).json({ error: 'Failed to remove member' });
  }
});

// ============================================
// PATCH /api/chats/:id/members/:userId - Update member role
// ============================================
router.patch('/:id/members/:userId', authMiddleware, (req, res) => {
  try {
    const chatId = req.params.id;
    const targetUserId = req.params.userId;
    const { role } = req.body;

    if (!role || !['member', 'admin'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    // Check if user is owner
    const membership = db.prepare(`
      SELECT role FROM chat_members WHERE chat_id = ? AND user_id = ?
    `).get(chatId, req.userId);

    if (!membership || membership.role !== 'owner') {
      return res.status(403).json({ error: 'Only owner can change roles' });
    }

    db.prepare(`
      UPDATE chat_members SET role = ? WHERE chat_id = ? AND user_id = ?
    `).run(role, chatId, targetUserId);

    res.json({ message: 'Role updated' });

  } catch (error) {
    console.error('Update role error:', error);
    res.status(500).json({ error: 'Failed to update role' });
  }
});

// ============================================
// GET /api/chats/:chatId - Get single chat
// ============================================
router.get('/:chatId', authMiddleware, (req, res) => {
  try {
    const { chatId } = req.params;

    const membership = db.prepare(
      'SELECT id FROM chat_members WHERE chat_id = ? AND user_id = ?'
    ).get(chatId, req.userId);

    if (!membership) {
      return res.status(403).json({ error: 'Not a member of this chat' });
    }

    const chat = db.prepare(`
      SELECT
        c.*,
        (
          SELECT json_group_array(
            json_object(
              'id', u.id,
              'username', u.username,
              'display_name', u.display_name,
              'avatar', u.avatar,
              'emoji_avatar', u.emoji_avatar,
              'online', u.online,
              'role', cm.role
            )
          )
          FROM chat_members cm
          JOIN users u ON cm.user_id = u.id
          WHERE cm.chat_id = c.id
        ) as members
      FROM chats c
      WHERE c.id = ?
    `).get(chatId);

    res.json({
      chat: {
        ...chat,
        members: JSON.parse(chat.members || '[]'),
        last_message: null,
        unread_count: 0
      }
    });
  } catch (error) {
    console.error('Get chat error:', error);
    res.status(500).json({ error: 'Failed to get chat' });
  }
});

export default router;
