// server.js - Final receive-only version
const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const { Pool } = require('pg');
const multer = require('multer');
const cors = require('cors');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] }
});

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const createTableQuery = `
  CREATE TABLE IF NOT EXISTS messages (
    id SERIAL PRIMARY KEY,
    phoneId VARCHAR(50) NOT NULL,
    sender VARCHAR(255) NOT NULL,
    body TEXT,
    imageUrl TEXT,
    timestamp TIMESTAMPTZ DEFAULT NOW()
  );
`;
pool.query(createTableQuery);

const storage = multer.diskStorage({
  destination: './public/uploads/',
  filename: (req, file, cb) => {
    cb(null, file.fieldname + '-' + Date.now() + path.extname(file.originalname));
  }
});
const upload = multer({ storage: storage }).single('mmsImage');

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
    const newMessageData = result.rows[0];
    const newMessage = {
      phoneId: newMessageData.phoneid,
      from: newMessageData.sender,
      body: newMessageData.body,
      imageUrl: newMessageData.imageurl,
      timestamp: newMessageData.timestamp
    };
    io.emit('new_message', newMessage);
    res.status(200).send('Message received and saved');
  } catch (err) {
    console.error("Error saving message:", err);
    res.status(500).send('Error saving message');
  }
});

io.on('connection', async (socket) => {
  console.log('A web client connected.');
  const sql = `SELECT phoneId, sender AS "from", body, imageUrl, timestamp FROM messages ORDER BY timestamp ASC`;
  try {
    const result = await pool.query(sql);
    const messagesByPhone = {};
    result.rows.forEach(msg => {
      const phoneId = msg.phoneid;
      if (!messagesByPhone[phoneId]) messagesByPhone[phoneId] = [];
      messagesByPhone[phoneId].push(msg);
    });
    socket.emit('all_messages', messagesByPhone);
  } catch (err) {
    console.error("Error fetching messages:", err);
  }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server listening on port ${PORT}`));
