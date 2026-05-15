import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';
import db from '../db.js';
import { authMiddleware } from '../auth.js';

const router = express.Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============================================
// MULTER CONFIGURATION (audio only)
// ============================================
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../uploads'));
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const basename = path.basename(file.originalname, ext);
    const sanitized = basename.replace(/[^a-zA-Z0-9]/g, '_');
    cb(null, `${Date.now()}-${randomUUID()}-${sanitized}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('audio/')) {
      cb(null, true);
    } else {
      cb(new Error('Only audio files are allowed'));
    }
  }
});

// ============================================
// GET /api/music - List all songs
// ============================================
router.get('/', authMiddleware, (req, res) => {
  try {
    const songs = db.prepare(`
      SELECT
        s.id,
        s.title,
        s.artist,
        s.file_url,
        s.duration,
        s.uploaded_by,
        s.created_at,
        u.display_name as uploader_name,
        u.username as uploader_username
      FROM songs s
      LEFT JOIN users u ON s.uploaded_by = u.id
      ORDER BY s.created_at DESC
    `).all();

    res.json({ songs });
  } catch (error) {
    console.error('Get songs error:', error);
    res.status(500).json({ error: 'Failed to fetch songs' });
  }
});

// ============================================
// POST /api/music/upload - Upload a song
// ============================================
router.post('/upload', authMiddleware, upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const fileUrl = `/uploads/${req.file.filename}`;
    const title = (req.body.title && req.body.title.trim())
      || path.basename(req.file.originalname, path.extname(req.file.originalname))
      || 'Untitled';
    const artist = (req.body.artist && req.body.artist.trim()) || null;
    const durationRaw = req.body.duration ? parseInt(req.body.duration, 10) : null;
    const duration = Number.isFinite(durationRaw) ? durationRaw : null;
    const id = randomUUID();

    db.prepare(`
      INSERT INTO songs (id, title, artist, file_url, duration, uploaded_by)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, title, artist, fileUrl, duration, req.userId);

    const song = db.prepare(`
      SELECT
        s.id,
        s.title,
        s.artist,
        s.file_url,
        s.duration,
        s.uploaded_by,
        s.created_at,
        u.display_name as uploader_name,
        u.username as uploader_username
      FROM songs s
      LEFT JOIN users u ON s.uploaded_by = u.id
      WHERE s.id = ?
    `).get(id);

    res.json({ song });
  } catch (error) {
    console.error('Upload song error:', error);
    res.status(500).json({ error: 'Failed to upload song' });
  }
});

// ============================================
// DELETE /api/music/:id - Delete own song
// ============================================
router.delete('/:id', authMiddleware, (req, res) => {
  try {
    const song = db.prepare('SELECT * FROM songs WHERE id = ?').get(req.params.id);

    if (!song) {
      return res.status(404).json({ error: 'Song not found' });
    }

    if (song.uploaded_by !== req.userId) {
      return res.status(403).json({ error: 'You can only delete your own songs' });
    }

    db.prepare('DELETE FROM songs WHERE id = ?').run(req.params.id);

    // Best-effort remove file from disk
    if (song.file_url && song.file_url.startsWith('/uploads/')) {
      const filePath = path.join(__dirname, '..', song.file_url);
      fs.unlink(filePath, () => {});
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Delete song error:', error);
    res.status(500).json({ error: 'Failed to delete song' });
  }
});

export default router;
