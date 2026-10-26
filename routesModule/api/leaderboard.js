require('dotenv').config();
const { pool, findSessionByToken, getUserById } = require('../../../database');

async function leaderboardapi(req, res) {
  try {
    const result = await pool.query(
      `SELECT username, stats->>'robux' AS robux, stats->>'points' AS points, stats->>'revenue' AS revenue, profile_pic
       FROM users
       ORDER BY (stats->>'robux')::numeric DESC LIMIT 10`
    );

    const leaderboardData = result.rows.map((entry, index) => ({
      rank: index + 1,
      username: entry.username,
      robux: Number(entry.robux || 0),
      points: Number(entry.points || 0),
      revenue: Number(entry.revenue || 0),
      profile_pic: entry.profile_pic,
    }));

    return res.json({ leaderboard: leaderboardData });
  } catch (error) {
    console.error('Error retrieving leaderboard:', error);
    return res.status(500).json({ error: 'An error occurred while retrieving the leaderboard' });
  }
}

module.exports = leaderboardapi;
