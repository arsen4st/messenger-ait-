import express from 'express';
import db from '../db.js';
import { hashPassword, comparePassword, generateToken } from '../auth.js';
import { authMiddleware } from '../auth.js';
import { randomUUID } from 'crypto';

const router = express.Router();

// ============================================
// POST /api/auth/register
// ============================================
router.post('/register', async (req, res) => {
  try {
    const { username, password, display_name } = req.body;

    // Validation
    if (!username || !password || !display_name) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    if (username.length < 3 || username.length > 20) {
      return res.status(400).json({ error: 'Username must be 3-20 characters' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    // Check if username already exists
    const existingUser = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
    if (existingUser) {
      return res.status(409).json({ error: 'Username already taken' });
    }

    // Hash password
    const password_hash = await hashPassword(password);

    // Generate UUID
    const userId = randomUUID();

    // Insert user
    const stmt = db.prepare(`
      INSERT INTO users (id, username, display_name, password_hash)
      VALUES (?, ?, ?, ?)
    `);

    stmt.run(userId, username, display_name, password_hash);

    // Get created user
    const user = db.prepare(`
      SELECT id, username, display_name, avatar, emoji_avatar, bio, online, last_seen, created_at
      FROM users WHERE id = ?
    `).get(userId);

    // Generate token
    const token = generateToken(userId);

    res.status(201).json({
      token,
      user
    });

  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// ============================================
// POST /api/auth/login
// ============================================
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    // Validation
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    // Find user
    const user = db.prepare(`
      SELECT id, username, display_name, password_hash, avatar, emoji_avatar, bio, online, last_seen, created_at
      FROM users WHERE username = ?
    `).get(username);

    if (!user) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    // Compare password
    const isValidPassword = await comparePassword(password, user.password_hash);

    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    // Remove password_hash from response
    const { password_hash, ...userWithoutPassword } = user;

    // Generate token
    const token = generateToken(user.id);

    res.json({
      token,
      user: userWithoutPassword
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// ============================================
// GET /api/auth/me
// ============================================
router.get('/me', authMiddleware, (req, res) => {
  try {
    const user = db.prepare(`
      SELECT id, username, display_name, avatar, emoji_avatar, bio, online, last_seen, created_at
      FROM users WHERE id = ?
    `).get(req.userId);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user });

  } catch (error) {
    console.error('Get me error:', error);
    res.status(500).json({ error: 'Failed to get user' });
  }
});

export default router;
