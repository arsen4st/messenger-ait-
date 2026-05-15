import db from '../db.js';

// Map to track online users: userId -> Set of socket IDs (for multi-tab support)
const onlineUsers = new Map();

// In-memory music listening sessions keyed by chatId
// Each session: { songId, position, isPlaying, hostId, song, startedAt }
const musicSessions = new Map();

function isChatMember(chatId, userId) {
  const membership = db.prepare(
    'SELECT id FROM chat_members WHERE chat_id = ? AND user_id = ?'
  ).get(chatId, userId);
  return !!membership;
}

function getSongById(songId) {
  return db.prepare(`
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
  `).get(songId);
}

// Compute current playback position (in seconds) taking into account elapsed time since startedAt
function computeCurrentPosition(session) {
  if (!session) return 0;
  if (!session.isPlaying) return session.position;
  const elapsed = (Date.now() - session.startedAt) / 1000;
  return session.position + elapsed;
}

// Helper to get all socket IDs for a user
function getUserSockets(userId) {
  return onlineUsers.get(userId) || new Set();
}

// Helper to get socket IDs for a specific user (returns array)
function getSocketIdsForUser(userId) {
  const sockets = getUserSockets(userId);
  return Array.from(sockets);
}

// ============================================
// REGISTER ALL SOCKET HANDLERS
// ============================================
export default function registerSocketHandlers(io, socket) {
  const userId = socket.userId;

  // ============================================
  // CONNECTION - Set user online
  // ============================================
  if (!onlineUsers.has(userId)) {
    onlineUsers.set(userId, new Set());
  }
  onlineUsers.get(userId).add(socket.id);

  // Personal room so server can target all sockets of a user
  socket.join(`user:${userId}`);

  // Update user online status in database
  db.prepare('UPDATE users SET online = 1 WHERE id = ?').run(userId);

  // Auto-join all chat rooms for this user
  const userChats = db.prepare(`
    SELECT chat_id FROM chat_members WHERE user_id = ?
  `).all(userId);
  userChats.forEach(({ chat_id }) => socket.join(chat_id));
  console.log(`User ${userId} auto-joined ${userChats.length} chat rooms`);

  // Notify contacts that user is online
  const contacts = db.prepare(`
    SELECT contact_id FROM contacts WHERE user_id = ?
    UNION
    SELECT user_id FROM contacts WHERE contact_id = ?
  `).all(userId, userId);

  contacts.forEach(contact => {
    const contactSockets = getSocketIdsForUser(contact.contact_id || contact.user_id);
    contactSockets.forEach(socketId => {
      io.to(socketId).emit('user_online', { userId });
    });
  });

  // ============================================
  // JOIN CHAT
  // ============================================
  socket.on('join_chat', ({ chatId }) => {
    // Verify user is member of chat
    const membership = db.prepare(`
      SELECT id FROM chat_members WHERE chat_id = ? AND user_id = ?
    `).get(chatId, userId);

    if (membership) {
      socket.join(chatId);
      console.log(`User ${userId} joined chat ${chatId}`);
    } else {
      socket.emit('error', { message: 'Not a member of this chat' });
    }
  });

  // ============================================
  // LEAVE CHAT
  // ============================================
  socket.on('leave_chat', ({ chatId }) => {
    socket.leave(chatId);
    console.log(`User ${userId} left chat ${chatId}`);
  });

  // ============================================
  // MARK CHAT AS READ
  // ============================================
  socket.on('mark_chat_read', ({ chatId }) => {
    try {
      const membership = db.prepare(
        'SELECT id FROM chat_members WHERE chat_id = ? AND user_id = ?'
      ).get(chatId, userId);
      if (!membership) return;

      const unread = db.prepare(`
        SELECT m.id FROM messages m
        LEFT JOIN message_reads mr ON m.id = mr.message_id AND mr.user_id = ?
        WHERE m.chat_id = ? AND m.sender_id != ? AND mr.id IS NULL AND m.deleted = 0
      `).all(userId, chatId, userId);

      if (unread.length === 0) return;

      const insert = db.prepare('INSERT OR IGNORE INTO message_reads (message_id, user_id) VALUES (?, ?)');
      unread.forEach(msg => insert.run(msg.id, userId));

      io.to(chatId).emit('messages_read', {
        chatId,
        userId,
        messageIds: unread.map(m => m.id)
      });
    } catch (error) {
      console.error('mark_chat_read error:', error);
    }
  });

  // ============================================
  // TYPING INDICATORS
  // ============================================
  socket.on('typing_start', ({ chatId }) => {
    socket.to(chatId).emit('user_typing', {
      userId,
      chatId
    });
  });

  socket.on('typing_stop', ({ chatId }) => {
    socket.to(chatId).emit('user_stop_typing', {
      userId,
      chatId
    });
  });

  // ============================================
  // MESSAGE READ
  // ============================================
  socket.on('message_read', ({ messageId, chatId }) => {
    try {
      // Insert read receipt
      db.prepare(`
        INSERT OR IGNORE INTO message_reads (message_id, user_id)
        VALUES (?, ?)
      `).run(messageId, userId);

      // Emit to chat for read receipt updates
      io.to(chatId).emit('message_read', {
        messageId,
        userId,
        chatId
      });
    } catch (error) {
      console.error('Message read error:', error);
    }
  });

  // ============================================
  // WEBRTC SIGNALING - Voice/Video Calls
  // ============================================

  // Initiate call
  socket.on('webrtc_offer', ({ to, offer, chatId, callType }) => {
    const targetSockets = getSocketIdsForUser(to);

    if (targetSockets.length > 0) {
      // Send to first available socket (or all for multi-device)
      targetSockets.forEach(socketId => {
        io.to(socketId).emit('incoming_call', {
          from: userId,
          offer,
          chatId,
          callType // 'voice' or 'video'
        });
      });
    } else {
      socket.emit('call_failed', { reason: 'User is offline' });
    }
  });

  // Answer call
  socket.on('webrtc_answer', ({ to, answer }) => {
    const targetSockets = getSocketIdsForUser(to);

    targetSockets.forEach(socketId => {
      io.to(socketId).emit('webrtc_answer', {
        from: userId,
        answer
      });
    });
  });

  // ICE candidate exchange
  socket.on('webrtc_ice_candidate', ({ to, candidate }) => {
    const targetSockets = getSocketIdsForUser(to);

    targetSockets.forEach(socketId => {
      io.to(socketId).emit('webrtc_ice_candidate', {
        from: userId,
        candidate
      });
    });
  });

  // Call ended
  socket.on('call_end', ({ to }) => {
    const targetSockets = getSocketIdsForUser(to);

    targetSockets.forEach(socketId => {
      io.to(socketId).emit('call_ended', {
        from: userId
      });
    });
  });

  // Call rejected
  socket.on('call_rejected', ({ to }) => {
    const targetSockets = getSocketIdsForUser(to);

    targetSockets.forEach(socketId => {
      io.to(socketId).emit('call_rejected', {
        from: userId
      });
    });
  });

  // Call accepted (for UI updates)
  socket.on('call_accepted', ({ to }) => {
    const targetSockets = getSocketIdsForUser(to);

    targetSockets.forEach(socketId => {
      io.to(socketId).emit('call_accepted', {
        from: userId
      });
    });
  });

  // ============================================
  // MUSIC - START / SWITCH SESSION
  // ============================================
  socket.on('music_start_session', ({ chatId, songId }) => {
    try {
      if (!chatId || !songId) return;
      if (!isChatMember(chatId, userId)) {
        socket.emit('error', { message: 'Not a member of this chat' });
        return;
      }

      const song = getSongById(songId);
      if (!song) {
        socket.emit('error', { message: 'Song not found' });
        return;
      }

      const session = {
        songId,
        position: 0,
        isPlaying: true,
        hostId: userId,
        song,
        startedAt: Date.now()
      };
      musicSessions.set(chatId, session);

      io.to(chatId).emit('music_session', {
        chatId,
        songId,
        position: session.position,
        isPlaying: session.isPlaying,
        hostId: session.hostId,
        song
      });
    } catch (error) {
      console.error('music_start_session error:', error);
    }
  });

  // ============================================
  // MUSIC - PLAY
  // ============================================
  socket.on('music_play', ({ chatId }) => {
    try {
      if (!chatId) return;
      if (!isChatMember(chatId, userId)) return;
      const session = musicSessions.get(chatId);
      if (!session) return;

      if (!session.isPlaying) {
        session.isPlaying = true;
        session.startedAt = Date.now();
        musicSessions.set(chatId, session);
      }

      io.to(chatId).emit('music_state', {
        chatId,
        isPlaying: true,
        position: session.position,
        hostId: session.hostId
      });
    } catch (error) {
      console.error('music_play error:', error);
    }
  });

  // ============================================
  // MUSIC - PAUSE
  // ============================================
  socket.on('music_pause', ({ chatId }) => {
    try {
      if (!chatId) return;
      if (!isChatMember(chatId, userId)) return;
      const session = musicSessions.get(chatId);
      if (!session) return;

      if (session.isPlaying) {
        session.position = computeCurrentPosition(session);
        session.isPlaying = false;
        musicSessions.set(chatId, session);
      }

      io.to(chatId).emit('music_state', {
        chatId,
        isPlaying: false,
        position: session.position,
        hostId: session.hostId
      });
    } catch (error) {
      console.error('music_pause error:', error);
    }
  });

  // ============================================
  // MUSIC - SEEK
  // ============================================
  socket.on('music_seek', ({ chatId, position }) => {
    try {
      if (!chatId || typeof position !== 'number') return;
      if (!isChatMember(chatId, userId)) return;
      const session = musicSessions.get(chatId);
      if (!session) return;

      session.position = Math.max(0, position);
      session.startedAt = Date.now();
      musicSessions.set(chatId, session);

      io.to(chatId).emit('music_state', {
        chatId,
        isPlaying: session.isPlaying,
        position: session.position,
        hostId: session.hostId
      });
    } catch (error) {
      console.error('music_seek error:', error);
    }
  });

  // ============================================
  // MUSIC - GET CURRENT SESSION (on chat join)
  // ============================================
  socket.on('music_get_session', ({ chatId }) => {
    try {
      if (!chatId) return;
      if (!isChatMember(chatId, userId)) return;
      const session = musicSessions.get(chatId);
      if (!session) return;

      const position = computeCurrentPosition(session);
      socket.emit('music_session', {
        chatId,
        songId: session.songId,
        position,
        isPlaying: session.isPlaying,
        hostId: session.hostId,
        song: session.song
      });
    } catch (error) {
      console.error('music_get_session error:', error);
    }
  });

  // ============================================
  // MUSIC - STOP SESSION
  // ============================================
  socket.on('music_stop_session', ({ chatId }) => {
    try {
      if (!chatId) return;
      if (!isChatMember(chatId, userId)) return;
      const session = musicSessions.get(chatId);
      if (!session) return;

      musicSessions.delete(chatId);
      io.to(chatId).emit('music_session_ended', { chatId });
    } catch (error) {
      console.error('music_stop_session error:', error);
    }
  });

  // ============================================
  // DISCONNECT - Set user offline
  // ============================================
  socket.on('disconnect', () => {
    // Remove this socket from user's socket set
    const userSockets = onlineUsers.get(userId);
    if (userSockets) {
      userSockets.delete(socket.id);

      // If no more sockets for this user, mark as offline
      if (userSockets.size === 0) {
        onlineUsers.delete(userId);

        // Update database
        const now = Math.floor(Date.now() / 1000);
        db.prepare(`
          UPDATE users SET online = 0, last_seen = ? WHERE id = ?
        `).run(now, userId);

        // Notify contacts that user is offline
        const contacts = db.prepare(`
          SELECT contact_id FROM contacts WHERE user_id = ?
          UNION
          SELECT user_id FROM contacts WHERE contact_id = ?
        `).all(userId, userId);

        contacts.forEach(contact => {
          const contactSockets = getSocketIdsForUser(contact.contact_id || contact.user_id);
          contactSockets.forEach(socketId => {
            io.to(socketId).emit('user_offline', {
              userId,
              lastSeen: now
            });
          });
        });
      }
    }

    console.log(`User ${userId} socket ${socket.id} disconnected`);
  });

  // ============================================
  // ERROR HANDLING
  // ============================================
  socket.on('error', (error) => {
    console.error(`Socket error for user ${userId}:`, error);
  });
}
