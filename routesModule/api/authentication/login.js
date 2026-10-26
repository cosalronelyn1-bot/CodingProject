require('dotenv').config();
const bcrypt = require('bcrypt');
const { getUserByUsername, getUserByEmail, createUser, createSession, findToken, markTokenUsed } = require('../../database');

function generateToken(length) {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let token = '';
  for (let i = 0; i < length; i++) {
    const randomIndex = Math.floor(Math.random() * characters.length);
    token += characters.charAt(randomIndex);
  }
  return token;
}

async function loginapi(req, res) {
  const { username, password } = req.body;

  const requiredFields = ['username', 'password'];
  const missingFields = requiredFields.filter((field) => !req.body[field]);

  if (missingFields.length > 0) {
    return res.status(400).json({ message: `Missing required fields: ${missingFields.join(', ')}` });
  }

  try {
    const user = await getUserByUsername(username);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      return res.status(401).json({ message: 'Incorrect Password' });
    }

    const sessionToken = generateToken(50);
    await createSession(user.id, sessionToken);

    const options = {
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60 * 1000,
    };

    res.cookie('Account_Session', sessionToken, options);
    return res.status(200).json({ message: 'Logged in successfully' });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ message: 'An error occurred' });
  }
}

module.exports = loginapi;
