import express from 'express';
import db from '../db.js';
import { authMiddleware } from '../auth.js';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';

const router = express.Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Multer configuration for avatar uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../uploads'));
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `avatar-${randomUUID()}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only images are allowed'));
    }
  }
});

// ============================================
// GET /api/users/search?q=query
// ============================================
router.get('/search', authMiddleware, (req, res) => {
  try {
    const { q } = req.query;

    if (!q || q.length < 2) {
      return res.json({ users: [] });
    }

    const users = db.prepare(`
      SELECT id, username, display_name, avatar, emoji_avatar, bio, online, last_seen
      FROM users
      WHERE (username LIKE ? OR display_name LIKE ?)
        AND id != ?
      LIMIT 20
    `).all(`%${q}%`, `%${q}%`, req.userId);

    res.json({ users });

  } catch (error) {
    console.error('Search users error:', error);
    res.status(500).json({ error: 'Search failed' });
  }
});

// ============================================
// GET /api/users/:id
// ============================================
router.get('/:id', authMiddleware, (req, res) => {
  try {
    const user = db.prepare(`
      SELECT id, username, display_name, avatar, emoji_avatar, bio, online, last_seen, created_at
      FROM users WHERE id = ?
    `).get(req.params.id);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user });

  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Failed to get user' });
  }
});

// ============================================
// PATCH /api/users/me
// ============================================
router.patch('/me', authMiddleware, (req, res) => {
  try {
    const { display_name, bio, emoji_avatar } = req.body;

    const updates = [];
    const values = [];

    if (display_name !== undefined) {
      updates.push('display_name = ?');
      values.push(display_name);
    }

    if (bio !== undefined) {
      updates.push('bio = ?');
      values.push(bio);
    }

    if (emoji_avatar !== undefined) {
      updates.push('emoji_avatar = ?');
      values.push(emoji_avatar);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    values.push(req.userId);

    db.prepare(`
      UPDATE users
      SET ${updates.join(', ')}
      WHERE id = ?
    `).run(...values);

    const user = db.prepare(`
      SELECT id, username, display_name, avatar, emoji_avatar, bio, online, last_seen, created_at
      FROM users WHERE id = ?
    `).get(req.userId);

    res.json({ user });

  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// ============================================
// POST /api/users/me/avatar
// ============================================
router.post('/me/avatar', authMiddleware, upload.single('avatar'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const avatarUrl = `/uploads/${req.file.filename}`;

    db.prepare('UPDATE users SET avatar = ? WHERE id = ?').run(avatarUrl, req.userId);

    const user = db.prepare(`
      SELECT id, username, display_name, avatar, emoji_avatar, bio, online, last_seen, created_at
      FROM users WHERE id = ?
    `).get(req.userId);

    res.json({ user });

  } catch (error) {
    console.error('Upload avatar error:', error);
    res.status(500).json({ error: 'Failed to upload avatar' });
  }
});

// ============================================
// GET /api/users/contacts
// ============================================
router.get('/contacts', authMiddleware, (req, res) => {
  try {
    const contacts = db.prepare(`
      SELECT
        c.id as contact_id,
        c.nickname,
        c.added_at,
        u.id, u.username, u.display_name, u.avatar, u.emoji_avatar, u.bio, u.online, u.last_seen
      FROM contacts c
      JOIN users u ON c.contact_id = u.id
      WHERE c.user_id = ?
      ORDER BY c.added_at DESC
    `).all(req.userId);

    res.json({ contacts });

  } catch (error) {
    console.error('Get contacts error:', error);
    res.status(500).json({ error: 'Failed to get contacts' });
  }
});

// ============================================
// POST /api/users/contacts/:id
// ============================================
router.post('/contacts/:id', authMiddleware, (req, res) => {
  try {
    const contactId = req.params.id;
    const { nickname } = req.body;

    // Check if user exists
    const user = db.prepare('SELECT id FROM users WHERE id = ?').get(contactId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check if already a contact
    const existing = db.prepare(`
      SELECT id FROM contacts WHERE user_id = ? AND contact_id = ?
    `).get(req.userId, contactId);

    if (existing) {
      return res.status(409).json({ error: 'Already in contacts' });
    }

    // Add contact
    db.prepare(`
      INSERT INTO contacts (user_id, contact_id, nickname)
      VALUES (?, ?, ?)
    `).run(req.userId, contactId, nickname || null);

    res.status(201).json({ message: 'Contact added' });

  } catch (error) {
    console.error('Add contact error:', error);
    res.status(500).json({ error: 'Failed to add contact' });
  }
});

// ============================================
// DELETE /api/users/contacts/:id
// ============================================
router.delete('/contacts/:id', authMiddleware, (req, res) => {
  try {
    const contactId = req.params.id;

    db.prepare(`
      DELETE FROM contacts WHERE user_id = ? AND contact_id = ?
    `).run(req.userId, contactId);

    res.json({ message: 'Contact removed' });

  } catch (error) {
    console.error('Remove contact error:', error);
    res.status(500).json({ error: 'Failed to remove contact' });
  }
});

export default router;
