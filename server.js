// server.js - Corrected with snake_case column names
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

const authMiddleware = (req, res, next) => { /* ... same as before ... */ };
app.use(cors());
app.use(express.json());
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
        await client.query(`
            CREATE TABLE IF NOT EXISTS devices (
                phone_number VARCHAR(50) PRIMARY KEY,
                country VARCHAR(10),
                carrier VARCHAR(100)
            );
        `);
        console.log("Database tables are ready.");
    } catch (err) {
        console.error("Error creating tables:", err);
    } finally {
        client.release();
    }
};
setupDatabase();

const storage = multer.diskStorage({ /* ... same as before ... */ });
const upload = multer({ storage: storage }).single('mmsImage');

app.post('/api/register-device', async (req, res) => {
    const { phoneNumber, country, carrier } = req.body;
    if (!phoneNumber || !country || !carrier) return res.status(400).json({ error: 'Missing info' });
    
    const sql = `
        INSERT INTO devices (phone_number, country, carrier)
        VALUES ($1, $2, $3)
        ON CONFLICT (phone_number) DO UPDATE
        SET country = $2, carrier = $3;
    `;
    try {
        await pool.query(sql, [phoneNumber, country, carrier]);
        res.status(200).json({ status: 'success' });
    } catch (err) {
        res.status(500).json({ error: 'Failed to register' });
    }
});

app.get('/api/phones', async (req, res) => {
    try {
        const result = await pool.query('SELECT phone_number, country, carrier FROM devices ORDER BY country, carrier');
        const groupedByCountry = result.rows.reduce((acc, device) => {
            const country = device.country;
            if (!acc[country]) acc[country] = [];
            acc[country].push({ phoneNumber: device.phone_number, carrier: device.carrier });
            return acc;
        }, {});
        res.json(groupedByCountry);
    } catch (err) {
        res.status(500).send('Server error');
    }
});

app.post('/upload', (req, res) => { /* ... same as before ... */ });

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
  } catch (err) { /* ... */ }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server listening on port ${PORT}`));
