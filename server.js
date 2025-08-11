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
    res.setHeader('WWW-Authenticate', 'Basic realm="Dashboard"');
    return res.status(401).send('Authentication required.');
  }
  return next();
};

// --- Middleware Setup ---
app.use(cors());
app.use(express.json());

// Unprotected Health Check Route for Render
app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

// Apply Authentication to all routes below this line
app.use(authMiddleware);
app.use(express.static('public'));

// --- Database Setup ---
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

// --- File Upload Configuration ---
const storage = multer.diskStorage({
  destination: './public/uploads/',
  filename: (req, file, cb) => {
    cb(null, file.fieldname + '-' + Date.now() + path.extname(file.originalname));
  }
});
const upload = multer({ storage: storage }).single('mmsImage');

// --- API Endpoints ---

// Endpoint for Android app to register/update its details
app.post('/api/register-device', async (req, res) => {
    const { phoneNumber, country, carrier } = req.body;
    if (!phoneNumber || !country || !carrier) {
        return res.status(400).json({ error: 'Missing device information' });
    }
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
        res.status(500).json({ error: 'Failed to register device' });
    }
});

// Endpoint that returns devices grouped by country
app.get('/api/phones', async (req, res) => {
    try {
        const result = await pool.query('SELECT phone_number, country, carrier FROM devices ORDER BY country, carrier');
        
        const groupedByCountry = result.rows.reduce((acc, device) => {
            const country = device.country || 'Unknown';
            if (!acc[country]) {
                acc[country] = [];
            }
            acc[country].push({ phoneNumber: device.phone_number, carrier: device.carrier });
            return acc;
        }, {});
        
        res.json(groupedByCountry);
    } catch (err) {
        console.error("Error fetching phone data:", err);
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
  let { phoneId, from, body, imageUrl } = req.body;
  if (!from) {
      return res.status(400).send('Missing sender ("from") data');
  }
  if (!phoneId || phoneId.trim() === "") {
      phoneId = "Unknown Phone";
  }

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
    console.error("Error saving message:", err);
    res.status(500).send('Error saving message');
  }
});

// --- Socket.IO Connection ---
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
  } catch (err) { 
      console.error("Error fetching messages for socket connection:", err);
  }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server listening on port ${PORT}`));
