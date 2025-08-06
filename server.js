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

const authMiddleware = (req, res, next) => {
  const user = auth(req);
  if (!user || !user.name || !user.pass || 
      user.name !== process.env.ADMIN_USERNAME || 
      user.pass !== process.env.ADMIN_PASSWORD) {
    res.setHeader('WWW-Authenticate', 'Basic realm="Dashboard"');
    return res.status(401).send('Authentication required.');
  }
  return next();
};

app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

app.use(authMiddleware);
app.use(express.static('public'));

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const setupDatabase = async () => {
    const client = await pool.connect();
    try {
        await client.query(`
            CREATE TABLE IF NOT EXISTS messages (
                id SERIAL PRIMARY KEY,
                phone_id VARCHAR(50) NOT NULL,
                sender VARCHAR(255) NOT NULL,
                body TEXT,
                image_url TEXT,
                timestamp TIMESTAMPTZ DEFAULT NOW()
            );
        `);
        console.log("Database table 'messages' is ready.");
    } catch (err) {
        console.error("Error creating table:", err);
    } finally {
        client.release();
    }
};
setupDatabase();

const storage = multer.diskStorage({
  destination: './public/uploads/',
  filename: (req, file, cb) => {
    cb(null, file.fieldname + '-' + Date.now() + path.extname(file.originalname));
  }
});
const upload = multer({ storage: storage }).single('mmsImage');

// This endpoint now just returns a flat list of unique phone numbers
app.get('/api/phones', async (req, res) => {
    try {
        const result = await pool.query('SELECT DISTINCT phone_id FROM messages ORDER BY phone_id ASC');
        const phoneIds = result.rows.map(row => row.phone_id);
        res.json(phoneIds);
    } catch (err) {
        console.error("Error fetching phone numbers:", err);
        res.status(500).send('Server error');
    }
});

app.post('/upload', (req, res) => {
    upload(req, res, (err) => {
        if (err) return res.status(500).json({ error: err });
        res.status(200).json({ imageUrl: `/uploads/${req.file.filename}` });
    });
});

app.post('/message', async (req, res) => {
  const { phoneId, from, body, imageUrl } = req.body;
  if (!phoneId || !from) return res.status(400).send('Missing data');

  const sql = `INSERT INTO messages (phone_id, sender, body, image_url) VALUES ($1, $2, $3, $4) RETURNING *`;
  try {
    const result = await pool.query(sql, [phoneId, from, body || '', imageUrl || null]);
    const newMessageData = result.rows[0];
    const newMessage = {
      phoneId: newMessageData.phone_id,
      from: newMessageData.sender,
      body: newMessageData.body,
      imageUrl: newMessageData.image_url,
      timestamp: newMessageData.timestamp
    };
    io.emit('new_message', newMessage);
    res.status(200).send('Message saved');
  } catch (err) {
    res.status(500).send('Error saving message');
  }
});

io.on('connection', async (socket) => {
  const sql = `SELECT phone_id AS "phoneId", sender AS "from", body, image_url AS "imageUrl", timestamp FROM messages ORDER BY timestamp ASC`;
  try {
    const result = await pool.query(sql);
    const messagesByPhone = {};
    result.rows.forEach(msg => {
      if (!messagesByPhone[msg.phoneId]) messagesByPhone[msg.phoneId] = [];
      messagesByPhone[msg.phoneId].push(msg);
    });
    socket.emit('all_messages', messagesByPhone);
  } catch (err) { /* Error fetching messages */ }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server listening on port ${PORT}`));
