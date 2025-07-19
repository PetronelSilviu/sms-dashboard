// server.js
const express = require('express');
const http = require('http');
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*", // This allows your web page to connect
    methods: ["GET", "POST"]
  }
});

// This is where we'll store messages.
// In a real app, you would use a database.
const messagesByPhone = {};

// This tells our server how to handle incoming JSON data
app.use(express.json());

// This tells our server to show the 'public' folder to the browser
app.use(express.static('public'));

// This is the API endpoint the Android app will send messages to
app.post('/message', (req, res) => {
  const { phoneId, from, body } = req.body;

  if (!phoneId || !from || !body) {
    return res.status(400).send({ status: 'error', message: 'Missing data' });
  }

  const newMessage = { from, body, timestamp: new Date() };

  // If this is the first message from a phone, create an array for it
  if (!messagesByPhone[phoneId]) {
    messagesByPhone[phoneId] = [];
  }
  messagesByPhone[phoneId].push(newMessage);

  console.log(`Received from ${phoneId}: ${body}`);

  // This sends the message in real-time to the web page
  io.emit('new_message', { phoneId, ...newMessage });

  res.status(200).send({ status: 'success' });
});

// This section handles web page connections
io.on('connection', (socket) => {
  console.log('A web client connected.');
  // When a new browser connects, send it all the messages we have so far
  socket.emit('all_messages', messagesByPhone);
});

// This makes the server work correctly on Render
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server listening on port ${PORT}`));
