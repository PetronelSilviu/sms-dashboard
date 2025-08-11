const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const { Pool } = require('pg');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const auth = require('basic-auth');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] }
});

// --- Authentication Middleware ---
const authMiddleware = (req, res, next) => {
  const user = auth(req);
  if (!user || !user.name || !user.pass || 
      user.name !== process.env.ADMIN_USERNAME || 
      user.pass !== process.env.ADMIN_PASSWORD) {
    res.setHeader('WWW-Authenticate', 'Basic realm="example"');
    return res.status(401).send('Authentication required.');
  }
  return next();
};

// --- Middleware Setup ---
app.use(cors());
app.use(express.json());

// --- Apply Authentication to all routes below this line ---
app.use(authMiddleware);
app.use(express.static('public'));

// --- Database Setup ---
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
pool.query(createTableQuery)
  .then(() => console.log("Table 'messages' is ready."))
  .catch(err => console.error("Error creating table:", err));

// --- File Upload Configuration ---
const storage = multer.diskStorage({
  destination: './public/uploads/',
  filename: (req, file, cb) => {
    cb(null, file.fieldname + '-' + Date.now() + path.extname(file.originalname));
  }
});
const upload = multer({ storage: storage }).single('mmsImage');

// --- API Endpoints ---

// NEW: Endpoint to get a list of all unique phone numbers
app.get('/api/phones', async (req, res) => {
    try {
        const result = await pool.query('SELECT DISTINCT phoneId FROM messages ORDER BY phoneId ASC');
        const phoneIds = result.rows.map(row => row.phoneid);
        res.json(phoneIds);
    } catch (err) {
        console.error("Error fetching phone numbers:", err);
        res.status(500).send('Server error');
    }
});

// Endpoint for uploading an image
app.post('/upload', (req, res) => {
  upload(req, res, (err) => {
    if (err) return res.status(500).json({ error: err });
    res.status(200).json({ imageUrl: `/uploads/${req.file.filename}` });
  });
});

// Endpoint for receiving message data
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

// --- Socket.IO Connection ---
io.on('connection', async (socket) => {
  console.log('A web client connected.');
  const sql = `SELECT phoneid AS "phoneId", sender AS "from", body, image_url AS "imageUrl", timestamp FROM messages ORDER BY timestamp ASC`;
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
