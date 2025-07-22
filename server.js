// server.js - Final version with Firebase integration
const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const { Pool } = require('pg');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const admin = require('firebase-admin'); // Firebase Admin SDK

// --- Firebase Initialization ---
// The SDK will automatically find the credentials file we added on Render
try {
  admin.initializeApp({
    credential: admin.credential.applicationDefault()
  });
  console.log("Firebase Admin SDK initialized successfully.");
} catch (error) {
  console.error("Firebase Admin SDK initialization error:", error);
}


const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] }
});

// --- Middleware Setup ---
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// --- Database Setup ---
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Create tables for messages and device tokens
const createTablesQuery = `
  CREATE TABLE IF NOT EXISTS messages (
    id SERIAL PRIMARY KEY,
    phoneId VARCHAR(50) NOT NULL,
    sender VARCHAR(255) NOT NULL,
    body TEXT,
    imageUrl TEXT,
    timestamp TIMESTAMPTZ DEFAULT NOW()
  );
  CREATE TABLE IF NOT EXISTS devices (
    phoneId VARCHAR(50) PRIMARY KEY,
    token TEXT NOT NULL
  );
`;
pool.query(createTablesQuery)
  .then(() => console.log("Tables are ready."))
  .catch(err => console.error("Error creating tables:", err));

// --- File Upload Configuration ---
const storage = multer.diskStorage({
  destination: './public/uploads/',
  filename: (req, file, cb) => {
    cb(null, file.fieldname + '-' + Date.now() + path.extname(file.originalname));
  }
});
const upload = multer({ storage: storage }).single('mmsImage');

// --- API Endpoints ---
app.post('/upload', (req, res) => {
  upload(req, res, (err) => {
    if (err) return res.status(500).json({ error: err });
    res.status(200).json({ imageUrl: `/uploads/${req.file.filename}` });
  });
});

app.post('/message', async (req, res) => {
  const { phoneId, from, body, imageUrl } = req.body;
  if (!phoneId || !from) return res.status(400).send('Missing required data');

  const sql = `INSERT INTO messages (phoneId, sender, body, imageUrl) VALUES ($1, $2, $3, $4) RETURNING *`;
  try {
    const result = await pool.query(sql, [phoneId, from, body || '', imageUrl || null]);
    const newMessage = { ...result.rows[0], from: result.rows[0].sender };
    io.emit('new_message', newMessage);
    res.status(200).send('Message received and saved');
  } catch (err) {
    console.error("Error saving message:", err);
    res.status(500).send('Error saving message');
  }
});

// NEW: Endpoint for Android app to register its token
app.post('/register-phone', async (req, res) => {
  const { phoneId, token } = req.body;
  if (!phoneId || !token) return res.status(400).send('Missing data');

  // Use an "UPSERT" query to insert a new device or update the token if it already exists
  const sql = `
    INSERT INTO devices (phoneId, token) VALUES ($1, $2)
    ON CONFLICT (phoneId) DO UPDATE SET token = $2;
  `;
  try {
    await pool.query(sql, [phoneId, token]);
    console.log(`Registered or updated token for ${phoneId}`);
    res.status(200).send('Token registered');
  } catch (err) {
    console.error("Error registering token:", err);
    res.status(500).send('Error registering token');
  }
});

// NEW: Endpoint for the web dashboard to send an SMS
app.post('/send-message', async (req, res) => {
  const { phoneId, recipientNumber, messageBody } = req.body;
  if (!phoneId || !recipientNumber || !messageBody) return res.status(400).send('Missing data');

  try {
    // 1. Find the token for the requested phoneId
    const result = await pool.query('SELECT token FROM devices WHERE phoneId = $1', [phoneId]);
    if (result.rows.length === 0) {
      return res.status(404).send('Phone not found or not registered');
    }
    const token = result.rows[0].token;

    // 2. Create the command payload to send to the phone
    const payload = {
      data: {
        recipientNumber: recipientNumber,
        messageBody: messageBody,
        phoneId: phoneId
      }
    };

    // 3. Use Firebase to send the command to the specific device
    await admin.messaging().sendToDevice(token, payload);
    console.log(`Sent 'send SMS' command to ${phoneId}`);
    res.status(200).send('Send command issued');
  } catch (err) {
    console.error("Error sending FCM message:", err);
    res.status(500).send('Error sending command');
  }
});


// --- Socket.IO Connection ---
io.on('connection', async (socket) => {
  console.log('A web client connected.');
  const sql = `SELECT phoneId, sender AS "from", body, imageUrl, timestamp FROM messages ORDER BY timestamp ASC`;
  try {
    const result = await pool.query(sql);
    const messagesByPhone = {};
    result.rows.forEach(msg => {
      if (!messagesByPhone[msg.phoneId]) messagesByPhone[msg.phoneId] = [];
      messagesByPhone[msg.phoneId].push(msg);
    });
    socket.emit('all_messages', messagesByPhone);
  } catch (err) {
    console.error("Error fetching messages:", err);
  }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server listening on port ${PORT}`));
