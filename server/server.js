// server.js - Main server file for Socket.io chat application

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const multer = require('multer');
const fs = require('fs');

// Load environment variables
dotenv.config();

// Initialize Express app
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Ensure uploads directory exists
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

// Multer setup
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, unique + '-' + file.originalname);
  },
});
const upload = multer({ storage });

// Serve uploads statically
app.use('/uploads', express.static(uploadDir));

// File upload endpoint
app.post('/api/upload', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  const fileUrl = `/uploads/${req.file.filename}`;
  res.json({ url: fileUrl, originalName: req.file.originalname });
});

// Store connected users and messages
const users = {};
const messages = {}; // { roomName: [messages] }
const typingUsers = {}; // { roomName: { socketId: username } }
const messageLoves = {}; // { messageId: Set of userIds }
const matchmakingPool = [];

const DEFAULT_ROOM = 'General';

// Add mock rooms for testing/demo (ensure this is before any socket connections)
if (!messages['Sports']) messages['Sports'] = [];
if (!messages['Music']) messages['Music'] = [];
if (!messages['Movies']) messages['Movies'] = [];
console.log('Initial rooms:', Object.keys(messages));

// Socket.io connection handler
io.on('connection', (socket) => {
  // Track the current room for each socket
  socket.currentRoom = DEFAULT_ROOM;

  // Join default room
  socket.join(DEFAULT_ROOM);

  // Handle user joining
  socket.on('user_join', (profile) => {
    users[socket.id] = { ...profile, id: socket.id };
    const roomList = Object.keys(messages).length ? Object.keys(messages) : [DEFAULT_ROOM];
    console.log('Sending room list to client:', roomList);
    socket.emit('room_list', roomList);
    socket.emit('joined_room', DEFAULT_ROOM);
    io.to(DEFAULT_ROOM).emit('user_list', Object.values(users).filter(u => io.sockets.adapter.rooms.get(DEFAULT_ROOM)?.has(u.id)));
    io.to(DEFAULT_ROOM).emit('user_joined', { ...profile, id: socket.id });
    if (!messages[DEFAULT_ROOM]) messages[DEFAULT_ROOM] = [];
    if (!typingUsers[DEFAULT_ROOM]) typingUsers[DEFAULT_ROOM] = {};
  });

  // Handle room join
  socket.on('join_room', (room) => {
    socket.leave(socket.currentRoom);
    socket.join(room);
    socket.currentRoom = room;
    if (!messages[room]) messages[room] = [];
    if (!typingUsers[room]) typingUsers[room] = {};
    socket.emit('joined_room', room);
    socket.emit('room_messages', messages[room]);
    io.to(room).emit('user_list', Object.values(users).filter(u => io.sockets.adapter.rooms.get(room)?.has(u.id)));
  });

  // Handle creating a new room
  socket.on('create_room', (room) => {
    if (!messages[room]) {
      messages[room] = [];
      typingUsers[room] = {};
      io.emit('room_list', Object.keys(messages));
    }
  });

  // Handle chat messages
  socket.on('send_message', (messageData) => {
    const room = socket.currentRoom || DEFAULT_ROOM;
    const message = {
      ...messageData,
      id: Date.now() + Math.random(),
      sender: users[socket.id]?.username || 'Anonymous',
      senderPhoto: users[socket.id]?.photo || '',
      senderId: socket.id,
      timestamp: new Date().toISOString(),
      room,
    };
    messages[room].push(message);
    if (messages[room].length > 100) messages[room].shift();
    io.to(room).emit('receive_message', message);
  });

  // Handle typing indicator
  socket.on('typing', (isTyping) => {
    const room = socket.currentRoom || DEFAULT_ROOM;
    if (users[socket.id]) {
      const username = users[socket.id].username;
      if (isTyping) {
        typingUsers[room][socket.id] = username;
      } else {
        delete typingUsers[room][socket.id];
      }
      io.to(room).emit('typing_users', Object.values(typingUsers[room]));
    }
  });

  // Handle private messages (not room-scoped)
  socket.on('private_message', ({ to, message }) => {
    const messageData = {
      id: Date.now() + Math.random(),
      sender: users[socket.id]?.username || 'Anonymous',
      senderPhoto: users[socket.id]?.photo || '',
      senderId: socket.id,
      message,
      timestamp: new Date().toISOString(),
      isPrivate: true,
    };
    socket.to(to).emit('private_message', messageData);
    socket.emit('private_message', messageData);
  });

  // Handle love reaction (room-agnostic)
  socket.on('love_message', (messageId) => {
    if (!messageLoves[messageId]) {
      messageLoves[messageId] = new Set();
    }
    messageLoves[messageId].add(socket.id);
    io.emit('message_loved', { messageId, count: messageLoves[messageId].size });
  });

  // Handle matchmaking
  socket.on('find_match', () => {
    console.log('find_match received from', socket.id, users[socket.id]?.username);
    // If already in pool, ignore
    if (matchmakingPool.includes(socket.id)) return;
    matchmakingPool.push(socket.id);
    // If two users are waiting, match them
    if (matchmakingPool.length >= 2) {
      const [id1, id2] = matchmakingPool.splice(0, 2);
      const user1 = users[id1];
      const user2 = users[id2];
      if (user1 && user2) {
        const room = `match_${id1}_${id2}_${Date.now()}`;
        io.sockets.sockets.get(id1)?.leave(io.sockets.sockets.get(id1).currentRoom || DEFAULT_ROOM);
        io.sockets.sockets.get(id2)?.leave(io.sockets.sockets.get(id2).currentRoom || DEFAULT_ROOM);
        io.sockets.sockets.get(id1)?.join(room);
        io.sockets.sockets.get(id2)?.join(room);
        io.sockets.sockets.get(id1).currentRoom = room;
        io.sockets.sockets.get(id2).currentRoom = room;
        if (!messages[room]) messages[room] = [];
        if (!typingUsers[room]) typingUsers[room] = {};
        // Notify both users
        io.to(id1).emit('matched', { room, match: user2 });
        io.to(id2).emit('matched', { room, match: user1 });
        // Send user list for the room
        io.to(room).emit('user_list', [user1, user2]);
        // Send empty messages for the new room
        io.to(room).emit('room_messages', messages[room]);
      }
    }
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    const room = socket.currentRoom || DEFAULT_ROOM;
    if (users[socket.id]) {
      const { username } = users[socket.id];
      io.to(room).emit('user_left', { username, id: socket.id });
    }
    delete users[socket.id];
    Object.values(typingUsers).forEach(roomTyping => delete roomTyping[socket.id]);
    Object.values(messageLoves).forEach(set => set.delete(socket.id));
    io.to(room).emit('user_list', Object.values(users).filter(u => io.sockets.adapter.rooms.get(room)?.has(u.id)));
    io.to(room).emit('typing_users', Object.values(typingUsers[room] || {}));
    const idx = matchmakingPool.indexOf(socket.id);
    if (idx !== -1) matchmakingPool.splice(idx, 1);
  });
});

// API routes
app.get('/api/messages/:room', (req, res) => {
  const { room } = req.params;
  let { before, limit } = req.query;
  limit = parseInt(limit) || 20;
  let msgs = messages[room] || [];
  if (before) {
    msgs = msgs.filter(m => new Date(m.timestamp) < new Date(before));
  }
  msgs = msgs.slice(-limit);
  res.json(msgs);
});

app.get('/api/users/:room', (req, res) => {
  const { room } = req.params;
  const roomUsers = Object.values(users).filter(u => {
    const roomSet = io.sockets.adapter.rooms.get(room);
    return roomSet && roomSet.has(u.id);
  });
  res.json(roomUsers);
});

// Root route
app.get('/', (req, res) => {
  res.send('Socket.io Chat Server is running');
});

// Start server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

module.exports = { app, server, io }; 