import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';

const db = new Database('messenger.db');

// Create test user
const testUserId = randomUUID();
const passwordHash = bcrypt.hashSync('test123', 10);

try {
  // Insert test user
  db.prepare(`
    INSERT INTO users (id, username, display_name, password_hash, emoji_avatar, bio, online)
    VALUES (?, ?, ?, ?, ?, ?, 1)
  `).run(
    testUserId,
    'testuser',
    'Test User',
    passwordHash,
    '🤖',
    'I am a test user for testing the messenger app'
  );

  console.log('✅ Test user created:');
  console.log('   Username: testuser');
  console.log('   Password: test123');
  console.log('   Display Name: Test User');
  console.log('   ID:', testUserId);

  // Get all existing users to create chats with
  const users = db.prepare('SELECT id, username FROM users WHERE id != ?').all(testUserId);

  if (users.length > 0) {
    console.log('\n✅ Creating direct chats with existing users...');

    for (const user of users) {
      const chatId = randomUUID();

      // Create direct chat
      db.prepare(`
        INSERT INTO chats (id, type, created_by)
        VALUES (?, 'direct', ?)
      `).run(chatId, testUserId);

      // Add both members
      db.prepare(`
        INSERT INTO chat_members (chat_id, user_id, role)
        VALUES (?, ?, 'member')
      `).run(chatId, testUserId);

      db.prepare(`
        INSERT INTO chat_members (chat_id, user_id, role)
        VALUES (?, ?, 'member')
      `).run(chatId, user.id);

      // Add a welcome message
      const messageId = randomUUID();
      db.prepare(`
        INSERT INTO messages (id, chat_id, sender_id, type, content)
        VALUES (?, ?, ?, 'text', ?)
      `).run(
        messageId,
        chatId,
        testUserId,
        `Hey! I'm a test user. Feel free to send me messages to test the app! 🚀`
      );

      console.log(`   ✓ Chat created with ${user.username}`);
    }
  }

  console.log('\n🎉 Test data seeded successfully!');
  console.log('\nYou can now login with:');
  console.log('   Username: testuser');
  console.log('   Password: test123');

} catch (error) {
  if (error.message.includes('UNIQUE constraint failed')) {
    console.log('⚠️  Test user already exists. Skipping...');
  } else {
    console.error('❌ Error seeding test data:', error);
  }
} finally {
  db.close();
}
