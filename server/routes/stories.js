import express from 'express';
import db from '../db.js';
import { authMiddleware } from '../auth.js';
import { randomUUID } from 'crypto';

const router = express.Router();

// ============================================
// GET /api/stories - Get active stories
// ============================================
router.get('/', authMiddleware, (req, res) => {
  try {
    const now = Math.floor(Date.now() / 1000);

    // Get stories from contacts and self (not expired)
    const stories = db.prepare(`
      SELECT
        s.id,
        s.user_id,
        s.type,
        s.file_url,
        s.content,
        s.background_color,
        s.expires_at,
        s.created_at,
        json_object(
          'id', u.id,
          'username', u.username,
          'display_name', u.display_name,
          'avatar', u.avatar,
          'emoji_avatar', u.emoji_avatar
        ) as user,
        (
          SELECT COUNT(*)
          FROM story_views sv
          WHERE sv.story_id = s.id AND sv.user_id = ?
        ) as viewed
      FROM stories s
      JOIN users u ON s.user_id = u.id
      WHERE s.expires_at > ?
        AND (
          s.user_id = ?
          OR s.user_id IN (
            SELECT contact_id FROM contacts WHERE user_id = ?
          )
          OR s.user_id IN (
            SELECT cm2.user_id FROM chat_members cm1
            JOIN chat_members cm2 ON cm1.chat_id = cm2.chat_id
            WHERE cm1.user_id = ? AND cm2.user_id != ?
          )
        )
      ORDER BY s.created_at DESC
    `).all(req.userId, now, req.userId, req.userId, req.userId, req.userId);

    // Group by user
    const groupedStories = {};

    stories.forEach(story => {
      const user = JSON.parse(story.user);
      const userId = story.user_id;

      if (!groupedStories[userId]) {
        groupedStories[userId] = {
          user,
          stories: []
        };
      }

      groupedStories[userId].stories.push({
        id: story.id,
        type: story.type,
        file_url: story.file_url,
        content: story.content,
        background_color: story.background_color,
        expires_at: story.expires_at,
        created_at: story.created_at,
        viewed: story.viewed > 0
      });
    });

    res.json({ stories: Object.values(groupedStories) });

  } catch (error) {
    console.error('Get stories error:', error);
    res.status(500).json({ error: 'Failed to get stories' });
  }
});

// ============================================
// POST /api/stories - Create story
// ============================================
router.post('/', authMiddleware, (req, res) => {
  try {
    const { type, content, file_url, background_color } = req.body;

    // Validate type
    const validTypes = ['image', 'video', 'text'];
    if (!validTypes.includes(type)) {
      return res.status(400).json({ error: 'Invalid story type' });
    }

    // Validate content based on type
    if (type === 'text' && !content) {
      return res.status(400).json({ error: 'Text stories require content' });
    }

    if ((type === 'image' || type === 'video') && !file_url) {
      return res.status(400).json({ error: 'Image/video stories require file_url' });
    }

    const storyId = randomUUID();
    const now = Math.floor(Date.now() / 1000);
    const expiresAt = now + (24 * 60 * 60); // 24 hours from now

    // Insert story
    db.prepare(`
      INSERT INTO stories (id, user_id, type, file_url, content, background_color, expires_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      storyId,
      req.userId,
      type,
      file_url || null,
      content || null,
      background_color || null,
      expiresAt
    );

    // Get created story
    const story = db.prepare(`
      SELECT
        s.*,
        json_object(
          'id', u.id,
          'username', u.username,
          'display_name', u.display_name,
          'avatar', u.avatar,
          'emoji_avatar', u.emoji_avatar
        ) as user
      FROM stories s
      JOIN users u ON s.user_id = u.id
      WHERE s.id = ?
    `).get(storyId);

    res.status(201).json({
      story: {
        ...story,
        user: JSON.parse(story.user)
      }
    });

  } catch (error) {
    console.error('Create story error:', error);
    res.status(500).json({ error: 'Failed to create story' });
  }
});

// ============================================
// POST /api/stories/:id/view - Mark story as viewed
// ============================================
router.post('/:id/view', authMiddleware, (req, res) => {
  try {
    const storyId = req.params.id;

    // Check if story exists and not expired
    const now = Math.floor(Date.now() / 1000);
    const story = db.prepare(`
      SELECT id, user_id FROM stories WHERE id = ? AND expires_at > ?
    `).get(storyId, now);

    if (!story) {
      return res.status(404).json({ error: 'Story not found or expired' });
    }

    // Don't record view if it's user's own story
    if (story.user_id === req.userId) {
      return res.json({ message: 'Own story, view not recorded' });
    }

    // Insert or ignore view
    db.prepare(`
      INSERT OR IGNORE INTO story_views (story_id, user_id)
      VALUES (?, ?)
    `).run(storyId, req.userId);

    res.json({ message: 'Story viewed' });

  } catch (error) {
    console.error('View story error:', error);
    res.status(500).json({ error: 'Failed to mark story as viewed' });
  }
});

// ============================================
// GET /api/stories/:id/views - Get story views (own stories only)
// ============================================
router.get('/:id/views', authMiddleware, (req, res) => {
  try {
    const storyId = req.params.id;

    // Check if story belongs to user
    const story = db.prepare(`
      SELECT id, user_id FROM stories WHERE id = ?
    `).get(storyId);

    if (!story) {
      return res.status(404).json({ error: 'Story not found' });
    }

    if (story.user_id !== req.userId) {
      return res.status(403).json({ error: 'Can only view own story views' });
    }

    // Get views
    const views = db.prepare(`
      SELECT
        sv.viewed_at,
        json_object(
          'id', u.id,
          'username', u.username,
          'display_name', u.display_name,
          'avatar', u.avatar,
          'emoji_avatar', u.emoji_avatar
        ) as user
      FROM story_views sv
      JOIN users u ON sv.user_id = u.id
      WHERE sv.story_id = ?
      ORDER BY sv.viewed_at DESC
    `).all(storyId);

    const parsed = views.map(view => ({
      ...view,
      user: JSON.parse(view.user)
    }));

    res.json({ views: parsed });

  } catch (error) {
    console.error('Get story views error:', error);
    res.status(500).json({ error: 'Failed to get story views' });
  }
});

// ============================================
// DELETE /api/stories/:id - Delete own story
// ============================================
router.delete('/:id', authMiddleware, (req, res) => {
  try {
    const storyId = req.params.id;

    // Check if story belongs to user
    const story = db.prepare(`
      SELECT id, user_id FROM stories WHERE id = ?
    `).get(storyId);

    if (!story) {
      return res.status(404).json({ error: 'Story not found' });
    }

    if (story.user_id !== req.userId) {
      return res.status(403).json({ error: 'Can only delete own stories' });
    }

    // Delete story (cascade will delete views)
    db.prepare('DELETE FROM stories WHERE id = ?').run(storyId);

    res.json({ message: 'Story deleted' });

  } catch (error) {
    console.error('Delete story error:', error);
    res.status(500).json({ error: 'Failed to delete story' });
  }
});

export default router;
