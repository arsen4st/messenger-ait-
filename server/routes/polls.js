import express from 'express';
import db from '../db.js';
import { authMiddleware } from '../auth.js';
import { io } from '../index.js';

const router = express.Router();

// ============================================
// POST /api/polls/:pollId/vote - Vote in poll
// ============================================
router.post('/:pollId/vote', authMiddleware, (req, res) => {
  try {
    const { pollId } = req.params;
    const { optionIndexes } = req.body;

    if (!optionIndexes || !Array.isArray(optionIndexes) || optionIndexes.length === 0) {
      return res.status(400).json({ error: 'optionIndexes array is required' });
    }

    // Get poll details
    const poll = db.prepare(`
      SELECT
        p.*,
        m.chat_id
      FROM polls p
      JOIN messages m ON p.message_id = m.id
      WHERE p.id = ?
    `).get(pollId);

    if (!poll) {
      return res.status(404).json({ error: 'Poll not found' });
    }

    // Check if user is member of chat
    const membership = db.prepare(`
      SELECT id FROM chat_members WHERE chat_id = ? AND user_id = ?
    `).get(poll.chat_id, req.userId);

    if (!membership) {
      return res.status(403).json({ error: 'Not a member of this chat' });
    }

    // Check if poll is expired
    if (poll.expires_at) {
      const now = Math.floor(Date.now() / 1000);
      if (now > poll.expires_at) {
        return res.status(400).json({ error: 'Poll has expired' });
      }
    }

    // Parse options
    const options = JSON.parse(poll.options);

    // Validate option indexes
    for (const index of optionIndexes) {
      if (index < 0 || index >= options.length) {
        return res.status(400).json({ error: 'Invalid option index' });
      }
    }

    // Check multiple choice
    if (!poll.multiple_choice && optionIndexes.length > 1) {
      return res.status(400).json({ error: 'This poll does not allow multiple choices' });
    }

    // Remove existing votes from this user
    db.prepare('DELETE FROM poll_votes WHERE poll_id = ? AND user_id = ?').run(pollId, req.userId);

    // Add new votes
    const insertVote = db.prepare(`
      INSERT INTO poll_votes (poll_id, user_id, option_index)
      VALUES (?, ?, ?)
    `);

    for (const index of optionIndexes) {
      insertVote.run(pollId, req.userId, index);
    }

    // Get updated results
    const results = getPollResults(pollId, poll.anonymous);

    // Emit poll update to chat
    io.to(poll.chat_id).emit('poll_updated', {
      pollId,
      messageId: poll.message_id,
      results
    });

    res.json({ results });

  } catch (error) {
    console.error('Vote poll error:', error);
    res.status(500).json({ error: 'Failed to vote in poll' });
  }
});

// ============================================
// GET /api/polls/:pollId - Get poll results
// ============================================
router.get('/:pollId', authMiddleware, (req, res) => {
  try {
    const { pollId } = req.params;

    // Get poll details
    const poll = db.prepare(`
      SELECT
        p.*,
        m.chat_id
      FROM polls p
      JOIN messages m ON p.message_id = m.id
      WHERE p.id = ?
    `).get(pollId);

    if (!poll) {
      return res.status(404).json({ error: 'Poll not found' });
    }

    // Check if user is member of chat
    const membership = db.prepare(`
      SELECT id FROM chat_members WHERE chat_id = ? AND user_id = ?
    `).get(poll.chat_id, req.userId);

    if (!membership) {
      return res.status(403).json({ error: 'Not a member of this chat' });
    }

    // Get results
    const results = getPollResults(pollId, poll.anonymous);

    res.json({
      poll: {
        id: poll.id,
        message_id: poll.message_id,
        question: poll.question,
        options: JSON.parse(poll.options),
        multiple_choice: poll.multiple_choice === 1,
        anonymous: poll.anonymous === 1,
        expires_at: poll.expires_at,
        created_at: poll.created_at
      },
      results
    });

  } catch (error) {
    console.error('Get poll error:', error);
    res.status(500).json({ error: 'Failed to get poll' });
  }
});

// ============================================
// HELPER: Get poll results
// ============================================
function getPollResults(pollId, anonymous) {
  const poll = db.prepare('SELECT options FROM polls WHERE id = ?').get(pollId);
  const options = JSON.parse(poll.options);

  // Get vote counts per option
  const voteCounts = db.prepare(`
    SELECT option_index, COUNT(*) as count
    FROM poll_votes
    WHERE poll_id = ?
    GROUP BY option_index
  `).all(pollId);

  // Get total votes
  const totalVotes = db.prepare(`
    SELECT COUNT(DISTINCT user_id) as total
    FROM poll_votes
    WHERE poll_id = ?
  `).get(pollId).total;

  // Build results
  const results = options.map((option, index) => {
    const voteData = voteCounts.find(v => v.option_index === index);
    const count = voteData ? voteData.count : 0;
    const percentage = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;

    const result = {
      option,
      count,
      percentage
    };

    // If not anonymous, include voters
    if (!anonymous) {
      const voters = db.prepare(`
        SELECT
          json_object(
            'id', u.id,
            'username', u.username,
            'display_name', u.display_name,
            'avatar', u.avatar,
            'emoji_avatar', u.emoji_avatar
          ) as user
        FROM poll_votes pv
        JOIN users u ON pv.user_id = u.id
        WHERE pv.poll_id = ? AND pv.option_index = ?
      `).all(pollId, index);

      result.voters = voters.map(v => JSON.parse(v.user));
    }

    return result;
  });

  return {
    options: results,
    totalVotes
  };
}

export default router;
