import Database from 'better-sqlite3';
import { randomUUID } from 'crypto';

const db = new Database('messenger.db');

// Enable WAL mode for better concurrency
db.pragma('journal_mode = WAL');

// Enable foreign keys
db.pragma('foreign_keys = ON');

// ============================================
// USERS TABLE
// ============================================
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    username TEXT UNIQUE NOT NULL,
    display_name TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    avatar TEXT,
    emoji_avatar TEXT DEFAULT '😊',
    bio TEXT,
    online INTEGER DEFAULT 0,
    last_seen INTEGER DEFAULT (strftime('%s', 'now')),
    created_at INTEGER DEFAULT (strftime('%s', 'now'))
  )
`);

// ============================================
// CHATS TABLE
// ============================================
db.exec(`
  CREATE TABLE IF NOT EXISTS chats (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    type TEXT NOT NULL CHECK(type IN ('direct', 'group', 'channel')),
    name TEXT,
    description TEXT,
    avatar TEXT,
    created_by TEXT NOT NULL,
    created_at INTEGER DEFAULT (strftime('%s', 'now')),
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
  )
`);

// ============================================
// CHAT MEMBERS TABLE
// ============================================
db.exec(`
  CREATE TABLE IF NOT EXISTS chat_members (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    chat_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    role TEXT DEFAULT 'member' CHECK(role IN ('owner', 'admin', 'member')),
    joined_at INTEGER DEFAULT (strftime('%s', 'now')),
    muted INTEGER DEFAULT 0,
    FOREIGN KEY (chat_id) REFERENCES chats(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(chat_id, user_id)
  )
`);

// ============================================
// MESSAGES TABLE
// ============================================
db.exec(`
  CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    chat_id TEXT NOT NULL,
    sender_id TEXT NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('text', 'image', 'file', 'audio', 'video', 'geo', 'voice', 'poll', 'system')),
    content TEXT,
    file_url TEXT,
    file_name TEXT,
    file_size INTEGER,
    reply_to TEXT,
    forwarded_from TEXT,
    edited INTEGER DEFAULT 0,
    deleted INTEGER DEFAULT 0,
    created_at INTEGER DEFAULT (strftime('%s', 'now')),
    edited_at INTEGER,
    FOREIGN KEY (chat_id) REFERENCES chats(id) ON DELETE CASCADE,
    FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (reply_to) REFERENCES messages(id) ON DELETE SET NULL,
    FOREIGN KEY (forwarded_from) REFERENCES messages(id) ON DELETE SET NULL
  )
`);

// ============================================
// MESSAGE REACTIONS TABLE
// ============================================
db.exec(`
  CREATE TABLE IF NOT EXISTS message_reactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    message_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    emoji TEXT NOT NULL,
    created_at INTEGER DEFAULT (strftime('%s', 'now')),
    FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(message_id, user_id, emoji)
  )
`);

// ============================================
// MESSAGE READS TABLE
// ============================================
db.exec(`
  CREATE TABLE IF NOT EXISTS message_reads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    message_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    read_at INTEGER DEFAULT (strftime('%s', 'now')),
    FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(message_id, user_id)
  )
`);

// ============================================
// POLLS TABLE
// ============================================
db.exec(`
  CREATE TABLE IF NOT EXISTS polls (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    message_id TEXT UNIQUE NOT NULL,
    question TEXT NOT NULL,
    options TEXT NOT NULL,
    multiple_choice INTEGER DEFAULT 0,
    anonymous INTEGER DEFAULT 0,
    expires_at INTEGER,
    created_at INTEGER DEFAULT (strftime('%s', 'now')),
    FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE
  )
`);

// ============================================
// POLL VOTES TABLE
// ============================================
db.exec(`
  CREATE TABLE IF NOT EXISTS poll_votes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    poll_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    option_index INTEGER NOT NULL,
    voted_at INTEGER DEFAULT (strftime('%s', 'now')),
    FOREIGN KEY (poll_id) REFERENCES polls(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )
`);

// ============================================
// STORIES TABLE
// ============================================
db.exec(`
  CREATE TABLE IF NOT EXISTS stories (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    user_id TEXT NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('image', 'video', 'text')),
    file_url TEXT,
    content TEXT,
    background_color TEXT,
    expires_at INTEGER NOT NULL,
    created_at INTEGER DEFAULT (strftime('%s', 'now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )
`);

// ============================================
// STORY VIEWS TABLE
// ============================================
db.exec(`
  CREATE TABLE IF NOT EXISTS story_views (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    story_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    viewed_at INTEGER DEFAULT (strftime('%s', 'now')),
    FOREIGN KEY (story_id) REFERENCES stories(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(story_id, user_id)
  )
`);

// ============================================
// PINNED MESSAGES TABLE
// ============================================
db.exec(`
  CREATE TABLE IF NOT EXISTS pinned_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    chat_id TEXT NOT NULL,
    message_id TEXT NOT NULL,
    pinned_by TEXT NOT NULL,
    pinned_at INTEGER DEFAULT (strftime('%s', 'now')),
    FOREIGN KEY (chat_id) REFERENCES chats(id) ON DELETE CASCADE,
    FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE,
    FOREIGN KEY (pinned_by) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(chat_id, message_id)
  )
`);

// ============================================
// CONTACTS TABLE
// ============================================
db.exec(`
  CREATE TABLE IF NOT EXISTS contacts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    contact_id TEXT NOT NULL,
    nickname TEXT,
    added_at INTEGER DEFAULT (strftime('%s', 'now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (contact_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(user_id, contact_id)
  )
`);

// ============================================
// SAVED MESSAGES TABLE (like Telegram)
// ============================================
db.exec(`
  CREATE TABLE IF NOT EXISTS saved_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    message_id TEXT NOT NULL,
    saved_at INTEGER DEFAULT (strftime('%s', 'now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE,
    UNIQUE(user_id, message_id)
  )
`);

// ============================================
// SONGS TABLE
// ============================================
db.exec(`
  CREATE TABLE IF NOT EXISTS songs (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    artist TEXT,
    file_url TEXT NOT NULL,
    duration INTEGER,
    uploaded_by TEXT NOT NULL,
    created_at INTEGER DEFAULT (strftime('%s','now')),
    FOREIGN KEY (uploaded_by) REFERENCES users(id)
  )
`);

// ============================================
// INDEXES FOR PERFORMANCE
// ============================================
db.exec(`
  CREATE INDEX IF NOT EXISTS idx_messages_chat_id ON messages(chat_id);
  CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON messages(sender_id);
  CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);
  CREATE INDEX IF NOT EXISTS idx_chat_members_user_id ON chat_members(user_id);
  CREATE INDEX IF NOT EXISTS idx_chat_members_chat_id ON chat_members(chat_id);
  CREATE INDEX IF NOT EXISTS idx_message_reads_user_id ON message_reads(user_id);
  CREATE INDEX IF NOT EXISTS idx_stories_user_id ON stories(user_id);
  CREATE INDEX IF NOT EXISTS idx_stories_expires_at ON stories(expires_at);
  CREATE INDEX IF NOT EXISTS idx_contacts_user_id ON contacts(user_id);
`);

console.log('✅ Database schema initialized successfully');

export default db;
