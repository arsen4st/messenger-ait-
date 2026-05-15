import express from 'express';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';
import { authMiddleware } from '../auth.js';

const router = express.Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============================================
// MULTER CONFIGURATION
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
    // Allow all common file types
    const allowedMimes = [
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'image/svg+xml',
      'video/mp4',
      'video/webm',
      'video/ogg',
      'video/quicktime',
      'audio/mpeg',
      'audio/mp3',
      'audio/wav',
      'audio/ogg',
      'audio/webm',
      'audio/mp4',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/zip',
      'application/x-rar-compressed',
      'text/plain',
      'text/csv'
    ];

    if (allowedMimes.includes(file.mimetype) || file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/') || file.mimetype.startsWith('audio/')) {
      cb(null, true);
    } else {
      cb(new Error('File type not allowed'));
    }
  }
});

// ============================================
// POST /api/files/upload - Upload file
// ============================================
router.post('/upload', authMiddleware, upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const fileUrl = `/uploads/${req.file.filename}`;
    const fileType = req.file.mimetype.split('/')[0]; // image, video, audio, application

    const response = {
      url: fileUrl,
      name: req.file.originalname,
      size: req.file.size,
      type: fileType,
      mimetype: req.file.mimetype
    };

    // For images, you could add width/height here using sharp or similar
    // For videos/audio, you could add duration using ffprobe
    // Keeping it simple for now

    res.json(response);

  } catch (error) {
    console.error('Upload file error:', error);
    res.status(500).json({ error: 'Failed to upload file' });
  }
});

// ============================================
// POST /api/files/voice - Upload voice message
// ============================================
router.post('/voice', authMiddleware, upload.single('voice'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No voice file uploaded' });
    }

    // Validate it's an audio file
    if (!req.file.mimetype.startsWith('audio/')) {
      return res.status(400).json({ error: 'File must be audio' });
    }

    const fileUrl = `/uploads/${req.file.filename}`;

    const response = {
      url: fileUrl,
      size: req.file.size,
      mimetype: req.file.mimetype,
      duration: null // Could be calculated with ffprobe
    };

    res.json(response);

  } catch (error) {
    console.error('Upload voice error:', error);
    res.status(500).json({ error: 'Failed to upload voice message' });
  }
});

// ============================================
// POST /api/files/multiple - Upload multiple files
// ============================================
router.post('/multiple', authMiddleware, upload.array('files', 10), (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    const files = req.files.map(file => ({
      url: `/uploads/${file.filename}`,
      name: file.originalname,
      size: file.size,
      type: file.mimetype.split('/')[0],
      mimetype: file.mimetype
    }));

    res.json({ files });

  } catch (error) {
    console.error('Upload multiple files error:', error);
    res.status(500).json({ error: 'Failed to upload files' });
  }
});

export default router;
