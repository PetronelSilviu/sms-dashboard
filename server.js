// server.js - With unprotected health check
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
  if (!user || user.name !== process.env.ADMIN_USERNAME || user.pass !== process.env.ADMIN_PASSWORD) {
    res.setHeader('WWW-Authenticate', 'Basic realm="Dashboard"');
    return res.status(401).send('Authentication required.');
  }
  return next();
};

// --- Middleware Setup ---
app.use(cors());
app.use(express.json());

// --- NEW: Unprotected Health Check Route ---
// This route is defined BEFORE the authentication middleware, so it's not password-protected.
app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

// --- Apply Authentication to all routes below this line ---
app.use(authMiddleware);
app.use(express.static('public'));

// --- The rest of your code remains exactly the same ---
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const setupDatabase = async () => { /* ... same as before ... */ };
setupDatabase();

const storage = multer.diskStorage({ /* ... same as before ... */ });
const upload = multer({ storage: storage }).single('mmsImage');

app.post('/api/register-device', async (req, res) => { /* ... same as before ... */ });
app.get('/api/phones', async (req, res) => { /* ... same as before ... */ });
app.post('/upload', (req, res) => { /* ... same as before ... */ });
app.post('/message', async (req, res) => { /* ... same as before ... */ });
io.on('connection', async (socket) => { /* ... same as before ... */ });

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server listening on port ${PORT}`));
