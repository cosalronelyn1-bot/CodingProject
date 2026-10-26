require('dotenv').config();
const express = require('express');
const path = require('path');
const router = express.Router();
const { findSessionByToken, getUserById, getUserByUsername } = require('./database');

async function requireNoSession(req, res, next) {
  const sessionToken = req.cookies.Account_Session;

  if (!sessionToken) {
    return next();
  }

  try {
    const session = await findSessionByToken(sessionToken);
    if (session) {
      return res.redirect('/index');
    }
    return next();
  } catch (error) {
    console.error('requireNoSession error:', error);
    return next();
  }
}

async function requireSession(req, res, next) {
  const sessionToken = req.cookies.Account_Session;

  if (!sessionToken) {
    return res.redirect('/login');
  }

  try {
    const session = await findSessionByToken(sessionToken);
    if (!session) {
      return res.redirect('/login');
    }

    const user = await getUserById(session.user_id);
    if (!user) {
      return res.redirect('/login');
    }

    const currentDirectory = req.path;
    const blacklistStatus = user.blacklist_status;

    if ((currentDirectory !== '/blacklist' && blacklistStatus) || (currentDirectory === '/blacklist' && !blacklistStatus)) {
      return res.redirect('/blacklist');
    }

    const discordId = user.discord_id;
    if ((currentDirectory !== '/discord-verification' && discordId === 'None') || (currentDirectory === '/discord-verification' && discordId !== 'None')) {
      return res.redirect('/discord-verification');
    }

    req.user = user;
    return next();
  } catch (error) {
    console.error('requireSession error:', error);
    return res.redirect('/login');
  }
}

async function getRefId(sessionToken) {
  const session = await findSessionByToken(sessionToken);
  if (!session) {
    return null;
  }
  return session.user_id;
}

async function getUserData(refid) {
  const user = await getUserById(refid);
  return { data: [{ user_id: user.id, membership: user.membership }] };
}

router.get('/', requireSession, (req, res) => {
  res.redirect('/index');
});

router.use(express.static('public'));

router.get('/admin', requireSession, async (req, res) => {
  try {
    const sessionToken = req.cookies.Account_Session;
    const refid = await getRefId(sessionToken);
    const userData = await getUserData(refid);
    const membership = userData.data[0].membership;

    if (membership === 'Admin' || membership === 'Owner') {
      return res.sendFile(path.join(__dirname, 'view', 'admin.html'));
    }
    return res.redirect('/403');
  } catch (error) {
    console.error(error);
    return res.status(500).send('Internal Server Error');
  }
});

router.get('/index', requireSession, (req, res) => {
  res.sendFile(path.join(__dirname, 'view', 'index.html'));
});

router.get('/login', requireNoSession, (req, res) => {
  res.sendFile(path.join(__dirname, 'view', 'login.html'));
});

router.get('/discordlogin', (req, res) => {
  const discordAuthUrl = `https://discord.com/api/oauth2/authorize?client_id=${process.env.CLIENT_ID}&redirect_uri=${process.env.REDIRECT_URI_LOGIN}&response_type=code&scope=identify`;
  return res.redirect(discordAuthUrl);
});

router.get('/forgot', requireNoSession, (req, res) => {
  res.sendFile(path.join(__dirname, 'view', 'forgot.html'));
});

router.get('/register', requireNoSession, (req, res) => {
  res.sendFile(path.join(__dirname, 'view', 'register.html'));
});

router.get('/purchase', requireNoSession, (req, res) => {
  res.sendFile(path.join(__dirname, 'view', 'purchase.html'));
});

router.get('/reset-password', requireNoSession, async (req, res) => {
  const key = req.query.key;

  try {
    const { pool } = require('./database');
    const tokenResult = await pool.query('SELECT * FROM password_reset_tokens WHERE token = $1 LIMIT 1', [key]);
    if (!tokenResult.rows[0]) {
      return res.redirect('/404');
    }
    return res.sendFile(path.join(__dirname, 'view', 'reset.html'));
  } catch (error) {
    console.error('Error during password reset token lookup:', error);
    return res.status(500).send('Internal Server Error');
  }
});

router.get('/discord-verification', requireSession, (req, res) => {
  res.sendFile(path.join(__dirname, 'view', 'discordverification.html'));
});

router.get('/verified-discord-account', (req, res) => {
  const discordAuthUrl = `https://discord.com/api/oauth2/authorize?client_id=${process.env.CLIENT_ID}&redirect_uri=${process.env.REDIRECT_URI_VERIFICATION}&response_type=code&scope=identify`;
  return res.redirect(discordAuthUrl);
});

router.get('/addgame', requireSession, (req, res) => {
  res.sendFile(path.join(__dirname, 'view', 'addgame.html'));
});

router.get('/games', requireSession, (req, res) => {
  res.sendFile(path.join(__dirname, 'view', 'games.html'));
});

router.get('/download', requireSession, (req, res) => {
  res.sendFile(path.join(__dirname, 'view', 'download.html'));
});

router.get('/settings', requireSession, (req, res) => {
  res.sendFile(path.join(__dirname, 'view', 'settings.html'));
});

router.get('/configure', requireSession, async (req, res) => {
  const game_id = req.query.gameId;

  if (!game_id) {
    return res.redirect('/404');
  }

  const sessionToken = req.cookies.Account_Session;
  const refid = await getRefId(sessionToken);
  const userData = await getUserData(refid);
  const user_id = userData.data[0].user_id;

  const { pool } = require('./database');
  const gameResult = await pool.query('SELECT * FROM users_games WHERE game_id = $1 LIMIT 1', [game_id]);
  if (!gameResult.rows[0]) {
    return res.redirect('/404');
  }

  if (gameResult.rows[0].user_id !== user_id) {
    return res.redirect('/404');
  }

  return res.sendFile(path.join(__dirname, 'view', 'configure.html'));
});

router.get('/cookies', requireSession, (req, res) => {
  res.sendFile(path.join(__dirname, 'view', 'cookies.html'));
});

router.get('/accounts', requireSession, (req, res) => {
  res.sendFile(path.join(__dirname, 'view', 'accounts.html'));
});

router.get('/lc', requireSession, (req, res) => {
  res.sendFile(path.join(__dirname, 'view', 'loginchecker.html'));
});

router.get('/blacklist', requireSession, async (req, res) => {
  res.sendFile(path.join(__dirname, 'view', 'blacklist.html'));
});

module.exports = router;
