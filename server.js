// server.js
const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const sqlite3 = require('sqlite3').verbose();
const multer = require('multer'); // For handling file uploads
const cors = require('cors'); // For handling connections
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// --- Middleware Setup ---
app.use(cors()); // Use CORS for all routes
app.use(express.json());
// This makes the 'public' folder (and our 'uploads' folder inside it) accessible to the web
app.use(express.static('public'));

// --- Database Setup ---
const db = new sqlite3.Database('./sms_database.db', (err) => {
    if (err) {
        console.error("Error opening database:", err.message);
    } else {
        console.log("Successfully connected to the database.");
        // UPDATE the messages table to include an imageUrl column
        db.run(`CREATE TABLE IF NOT EXISTS messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            phoneId TEXT NOT NULL,
            sender TEXT NOT NULL,
            body TEXT,
            imageUrl TEXT,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);
    }
});

// --- File Upload Configuration (Multer) ---
const storage = multer.diskStorage({
  destination: './public/uploads/',
  filename: function (req, file, cb) {
    // Create a unique filename: originalname-timestamp.extension
    cb(null, file.fieldname + '-' + Date.now() + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage
}).single('mmsImage'); // The Android app will send the image with the field name 'mmsImage'

// --- API Endpoints ---

// NEW: Endpoint for uploading an image
app.post('/upload', (req, res) => {
  upload(req, res, (err) => {
    if (err) {
      console.error("Error uploading file:", err);
      res.status(500).json({ error: err });
    } else {
      console.log("File uploaded successfully:", req.file.filename);
      // Send back the URL of the uploaded file
      res.status(200).json({
        imageUrl: `/uploads/${req.file.filename}`
      });
    }
  });
});

// UPDATED: Endpoint for saving the message data
app.post('/message', (req, res) => {
  // Now accepts an optional imageUrl
  const { phoneId, from, body, imageUrl } = req.body;

  if (!phoneId || !from) {
    return res.status(400).send('Missing required data');
  }

  const sql = `INSERT INTO messages (phoneId, sender, body, imageUrl) VALUES (?, ?, ?, ?)`;
  db.run(sql, [phoneId, from, body || '', imageUrl || null], function(err) {
      if (err) {
          console.error("Error saving message to database:", err.message);
          return res.status(500).send('Error saving message');
      }
      
      console.log(`Saved message from ${phoneId}`);
      
      const newMessage = {
          phoneId,
          from,
          body: body || '',
          imageUrl: imageUrl || null,
          timestamp: new Date().toISOString()
      };
      io.emit('new_message', newMessage);

      res.status(200).send('Message received and saved');
  });
});


// UPDATED: Fetch all messages for new web clients
io.on('connection', (socket) => {
  console.log('A web client connected.');
  const sql = `SELECT phoneId, sender AS "from", body, imageUrl, timestamp FROM messages ORDER BY timestamp ASC`;
  db.all(sql, [], (err, rows) => {
      if (err) {
          console.error("Error fetching messages:", err.message);
          return;
      }
      const messagesByPhone = {};
      rows.forEach(msg => {
          if (!messagesByPhone[msg.phoneId]) {
              messagesByPhone[msg.phoneId] = [];
          }
          messagesByPhone[msg.phoneId].push(msg);
      });
      socket.emit('all_messages', messagesByPhone);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server listening on port ${PORT}`));
