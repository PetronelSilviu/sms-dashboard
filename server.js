/**
 * Minimal SMS/MMS Dashboard server
 * - Express HTTP server
 * - Socket.io for real-time updates
 * - PostgreSQL storage
 * - Multer for image uploads (MMS)
 *
 * Use environment variables (see .env.example)
 */

require('dotenv').config();
const express = require('express');
const http = require('http');
const path = require('path');
const helmet = require('helmet');
const cors = require('cors');
const multer = require('multer');
const { Pool } = require('pg');
const fs = require('fs');
const { RateLimiterMemory } = require('rate-limiter-flexible');
const xss = require('xss-clean');

const app = express();
const server = http.createServer(app);
const io = require('socket.io')(server, { cors: { origin: "*" } });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

// Security middleware
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(xss());

// Basic in-memory rate limiter
const rateLimiter = new RateLimiterMemory({
  points: 100, // number of points
  duration: 60 // per 60 seconds by IP
});
app.use((req, res, next) => {
  const ip = req.ip || req.connection.remoteAddress;
  rateLimiter.consume(ip)
    .then(() => next())
    .catch(() => res.status(429).json({ error: 'Too many requests' }));
});

// Serve static files
app.use('/', express.static(path.join(__dirname, 'public')));

// Ensure uploads dir exists but is not browsable via directory listing
const UPLOAD_DIR = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// Multer config: store in uploads with safe filenames
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    // sanitize filename: use timestamp + random suffix + ext
    const timestamp = Date.now();
    const ext = path.extname(file.originalname).slice(0, 10);
    const safe = `${timestamp}-${Math.random().toString(36).substring(2,8)}${ext}`;
    cb(null, safe);
  }
});

// Accept only common image mime types for MMS
function fileFilter (req, file, cb) {
  if (!file.mimetype.startsWith('image/')) {
    return cb(new Error('Only image uploads allowed'), false);
  }
  cb(null, true);
}

const upload = multer({ storage, fileFilter, limits: { fileSize: 5 * 1024 * 1024 } }); // 5MB

// API: Fetch messages (paginated)
app.get('/api/messages', async (req, res) => {
  const limit = Math.min(100, parseInt(req.query.limit) || 50);
  const offset = parseInt(req.query.offset) || 0;
  try {
    const q = 'SELECT id, phone_number, body, media_path, created_at FROM messages ORDER BY created_at DESC LIMIT $1 OFFSET $2';
    const { rows } = await pool.query(q, [limit, offset]);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'DB error' });
  }
});

// API: Receive an incoming SMS/MMS from a phone (POST)
// Expected JSON fields: phone_number, body (optional), optionally an image upload 'media'
app.post('/api/incoming', upload.single('media'), async (req, res) => {
  // Simple validation
  const phone_number = (req.body.phone_number || '').trim();
  const body = (req.body.body || '').trim();

  if (!phone_number) return res.status(400).json({ error: 'phone_number required' });

  const media_path = req.file ? path.posix.join('uploads', path.basename(req.file.path)) : null;

  try {
    const insert = `INSERT INTO messages (phone_number, body, media_path) VALUES ($1, $2, $3) RETURNING id, created_at`;
    const { rows } = await pool.query(insert, [phone_number, body || null, media_path]);
    const message = {
      id: rows[0].id,
      phone_number,
      body,
      media_path,
      created_at: rows[0].created_at
    };

    // emit to connected clients
    io.emit('message', message);

    res.json({ ok: true, message });
  } catch (err) {
    console.error('insert error', err);
    res.status(500).json({ error: 'DB insert error' });
  }
});

// Simple healthcheck
app.get('/health', (req, res) => res.json({ ok: true }));

// socket.io connection logging
io.on('connection', (socket) => {
  console.log('ws client connected', socket.id);
  socket.on('disconnect', () => console.log('ws client disconnected', socket.id));
});

// start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server listening on ${PORT}`);
});
