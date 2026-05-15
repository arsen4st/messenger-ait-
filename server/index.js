import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Initialize environment variables
dotenv.config();

// Initialize database
import db from './db.js';

// Import middleware
import { socketAuthMiddleware } from './auth.js';

// Import routes
import authRoutes from './routes/auth.js';
import usersRoutes from './routes/users.js';
import chatsRoutes from './routes/chats.js';
import messagesRoutes from './routes/messages.js';
import filesRoutes from './routes/files.js';
import storiesRoutes from './routes/stories.js';
import pollsRoutes from './routes/polls.js';
import musicRoutes from './routes/music.js';

// Import socket handlers
import registerSocketHandlers from './socket/handlers.js';

// ES module __dirname equivalent
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Express app
const app = express();
const httpServer = createServer(app);

const corsOrigin = process.env.NODE_ENV === 'production'
  ? (process.env.CLIENT_URL || 'http://localhost:5173')
  : (origin, cb) => cb(null, true);

// Initialize Socket.io with CORS
const io = new Server(httpServer, {
  cors: {
    origin: corsOrigin,
    credentials: true
  }
});

// Middleware
app.use(cors({
  origin: corsOrigin,
  credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static files for uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/chats', chatsRoutes);
app.use('/api/messages', messagesRoutes);
app.use('/api/files', filesRoutes);
app.use('/api/stories', storiesRoutes);
app.use('/api/polls', pollsRoutes);
app.use('/api/music', musicRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

// Socket.io authentication middleware
io.use(socketAuthMiddleware);

// Socket.io connection handler
io.on('connection', (socket) => {
  console.log(`✅ User connected: ${socket.userId} (socket: ${socket.id})`);

  // Register all socket event handlers
  registerSocketHandlers(io, socket);

  socket.on('disconnect', () => {
    console.log(`❌ User disconnected: ${socket.userId} (socket: ${socket.id})`);
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error'
  });
});

// Start server
const PORT = process.env.PORT || 3001;

httpServer.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════╗
║   🚀 Messenger Server Running          ║
║   📡 Port: ${PORT}                        ║
║   🔌 Socket.io: Ready                  ║
║   💾 Database: Connected               ║
╚════════════════════════════════════════╝
  `);
});

// Export io for use in routes
export { io };
