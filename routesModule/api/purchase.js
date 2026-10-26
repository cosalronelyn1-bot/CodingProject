require('dotenv').config();
const axios = require('axios');
const nodemailer = require('nodemailer');
const { pool, findToken, markTokenUsed } = require('../../database');

function generateToken(length) {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let token = '';
  for (let i = 0; i < length; i++) {
    const randomIndex = Math.floor(Math.random() * characters.length);
    token += characters.charAt(randomIndex);
  }
  return token;
}

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT) || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USERNAME,
    pass: process.env.SMTP_PASSWORD,
  },
  tls: {
    ciphers: 'SSLv3',
  },
});

const CLOUD_API_BASE_URL = process.env.CLOUD_API_BASE_URL || 'https://users.roblox.com';

async function purchaseapi(req, res) {
  const { rbxusername, email } = req.body;
  const requiredFields = ['rbxusername', 'email'];
  const missingFields = requiredFields.filter((field) => !req.body[field]);

  if (missingFields.length > 0) {
    return res.status(400).json({
      message: `Missing required fields: ${missingFields.join(', ')}`,
    });
  }

  try {
    const userLookupUrl = `${CLOUD_API_BASE_URL}/v1/usernames/users`;
    const userInfoResponse = await axios.post(
      userLookupUrl,
      { usernames: [rbxusername], excludeBannedUsers: true },
      {
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        timeout: 15000,
      }
    );

    const userInfoData = userInfoResponse.data;
    if (!userInfoData || !Array.isArray(userInfoData.data) || userInfoData.data.length === 0) {
      return res.status(401).json({ message: 'Invalid Username' });
    }

    const rbxuserId = userInfoData.data[0].id;
    const shirtId = process.env.SHIRT_ID || '209995366';
    const inventoryOwnedUrl = `${CLOUD_API_BASE_URL}/v1/users/${rbxuserId}/items/Asset/${shirtId}/is-owned`;
    const inventoryOwnedInfoResponse = await axios.get(inventoryOwnedUrl, { timeout: 15000 });
    const inventoryOwnedInfoData = inventoryOwnedInfoResponse.data;

    if (!inventoryOwnedInfoData || inventoryOwnedInfoData.isOwned !== true) {
      return res.status(403).json({
        message: 'Please Purchase The Shirt',
      });
    }

    const existingToken = await pool.query(
      'SELECT * FROM tokens WHERE rbx_user_id = $1 LIMIT 1',
      [rbxuserId]
    );

    if (existingToken.rows[0]) {
      return res.status(409).json({ message: 'This Account Already Purchase to Site' });
    }

    const token = `${generateToken(7)}-${generateToken(7)}-${generateToken(7)}`;

    await pool.query(
      'INSERT INTO tokens (token, is_used, rbx_user_id) VALUES ($1, false, $2)',
      [token, rbxuserId]
    );

    const emailStyles = `
      <style>
      body {
        font-family: Arial, sans-serif;
        background-color: #f4f4f4;
        margin: 0;
        padding: 0;
      }
      .container {
        max-width: 600px;
        margin: 20px auto;
        background-color: #ffffff;
        padding: 20px;
        border-radius: 5px;
        box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
      }
      h2 {
        color: #333333;
        margin-bottom: 20px;
      }
      p {
        color: #555555;
        margin-bottom: 10px;
      }
      .button {
        display: inline-block;
        background-color: #3498db;
        color: #ffffff;
        padding: 10px 20px;
        border-radius: 4px;
        text-decoration: none;
      }
      </style>
    `;

    const emailTemplate = `
      <html>
      <head>
        ${emailStyles}
      </head>
      <body>
        <div class="container">
          <h2>Thank You for Your Purchase</h2>
          <p>Dear ${email},</p>
          <p>Thank you for your recent purchase on our site.</p>
          <p>The details of your purchase are as follows:</p>
          <p><strong>Purchase Type:</strong> Via Shirt</p>
          <p><strong>Token:</strong> ${token}</p>
          <p>If you have any questions or need further assistance, please feel free to contact us.</p>
          <p>Thank you again for choosing our service.</p>
        </div>
      </body>
      </html>
    `;

    await transporter.sendMail({
      from: process.env.SMTP_FROM,
      to: email,
      subject: 'Thank For Purchasing',
      html: emailTemplate,
    });

    return res.status(200).json({
      message: 'Successfully Purchase',
    });
  } catch (error) {
    console.error('Purchase API error:', error.response ? error.response.data : error.message);
    return res.status(500).json({
      error: 'Failed to Purchase',
    });
  }
}

module.exports = purchaseapi;
