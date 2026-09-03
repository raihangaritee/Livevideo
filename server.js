const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = socketIO(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/rvideo', express.static(path.join(__dirname, 'rvideo')));
app.use(cors());

// In-memory storage
const users = new Map();
const activeRooms = new Map();
const callHistory = new Map();
const activeChats = new Map();
const videoCache = new Map();

// Load videos from /rvideo folder
function loadVideosFromFolder() {
  const videoFolder = path.join(__dirname, 'rvideo');
  
  if (!fs.existsSync(videoFolder)) {
    fs.mkdirSync(videoFolder, { recursive: true });
    console.log('Created video folder:', videoFolder);
    return [];
  }

  const files = fs.readdirSync(videoFolder);
  const videoFiles = files.filter(file => {
    const ext = path.extname(file).toLowerCase();
    return ['.mp4', '.webm', '.avi', '.mov', '.mkv'].includes(ext);
  });

  const videos = videoFiles.map((file, index) => ({
    id: index + 1,
    name: file,
    file: file,
    path: `/rvideo/${file}`,
    used: false
  }));

  console.log(`Loaded ${videos.length} videos from rvideo folder`);
  return videos;
}

// Admin settings (can be modified via admin_setting.js)
let adminSettings = {
  maxCallsPerUser: 10,
  rewardMode: 'random', // 'random' or 'serial'
  shuffleVideos: true,
  callDuration: 30, // seconds
  rewardAmount: 10, // points per call
  enableLiveChat: true,
  enableVideoCall: true,
  enableFakeCall: true,
  videos: loadVideosFromFolder(),
  videoQueue: [],
  lastVideoIndex: -1
};

// Initialize video queue
function initializeVideoQueue() {
  adminSettings.videoQueue = adminSettings.videos.map(v => v.id);
  if (adminSettings.shuffleVideos) {
    shuffleArray(adminSettings.videoQueue);
  }
}

function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}

// Get next video based on reward mode
function getNextVideo() {
  if (adminSettings.videos.length === 0) {
    return null;
  }

  if (adminSettings.rewardMode === 'random') {
    const availableVideos = adminSettings.videos.filter(v => !v.used);
    if (availableVideos.length === 0) {
      // Reset if all videos used
      adminSettings.videos.forEach(v => v.used = false);
      return getNextVideo();
    }
    const randomIndex = Math.floor(Math.random() * availableVideos.length);
    const video = availableVideos[randomIndex];
    video.used = true;
    return video;
  } else {
    // Serial mode
    adminSettings.lastVideoIndex++;
    if (adminSettings.lastVideoIndex >= adminSettings.videos.length) {
      adminSettings.lastVideoIndex = 0;
    }
    return adminSettings.videos[adminSettings.lastVideoIndex];
  }
}

// Initialize queue
initializeVideoQueue();

// Authentication middleware
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key', (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid token' });
    }
    req.user = user;
    next();
  });
}

// Routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// Login API
app.post('/api/login', async (req, res) => {
  try {
    const { email, password, googleAuth } = req.body;

    if (googleAuth) {
      // Google login (simulated)
      const userId = `google_${Date.now()}`;
      const token = jwt.sign({ userId, email }, process.env.JWT_SECRET || 'your-secret-key');
      
      if (!users.has(userId)) {
        users.set(userId, {
          id: userId,
          email: email,
          name: email.split('@')[0],
          callsRemaining: adminSettings.maxCallsPerUser,
          totalRewards: 0,
          createdAt: Date.now()
        });
      }

      res.json({ token, user: users.get(userId) });
    } else {
      // Email/Password login
      const userId = `user_${Date.now()}`;
      const hashedPassword = await bcrypt.hash(password, 10);
      const token = jwt.sign({ userId, email }, process.env.JWT_SECRET || 'your-secret-key');

      if (!users.has(userId)) {
        users.set(userId, {
          id: userId,
          email: email,
          password: hashedPassword,
          name: email.split('@')[0],
          callsRemaining: adminSettings.maxCallsPerUser,
          totalRewards: 0,
          createdAt: Date.now()
        });
      }

      const user = users.get(userId);
      delete user.password;
      res.json({ token, user });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get admin settings
app.get('/api/admin/settings', authenticateToken, (req, res) => {
  res.json(adminSettings);
});

// Update admin settings
app.post('/api/admin/settings', authenticateToken, (req, res) => {
  const newSettings = req.body;
  adminSettings = { ...adminSettings, ...newSettings };
  
  if (newSettings.shuffleVideos !== undefined) {
    initializeVideoQueue();
  }
  
  res.json({ success: true, settings: adminSettings });
});

// Get user info
app.get('/api/user/:userId', authenticateToken, (req, res) => {
  const user = users.get(req.params.userId);
  if (user) {
    const userCopy = { ...user };
    delete userCopy.password;
    res.json(userCopy);
  } else {
    res.status(404).json({ error: 'User not found' });
  }
});

// Socket.IO handling
io.on('connection', (socket) => {
  console.log('New client connected:', socket.id);

  // User authentication for socket
  socket.on('authenticate', (token) => {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
      socket.userId = decoded.userId;
      socket.email = decoded.email;
      socket.emit('authenticated', { success: true });
    } catch (error) {
      socket.emit('authenticated', { success: false, error: 'Invalid token' });
    }
  });

  // Handle video call
  socket.on('start-call', (data) => {
    if (!socket.userId) {
      socket.emit('call-error', { message: 'Not authenticated' });
      return;
    }

    const user = users.get(socket.userId);
    if (!user) {
      socket.emit('call-error', { message: 'User not found' });
      return;
    }

    if (user.callsRemaining <= 0) {
      socket.emit('call-error', { message: 'Call limit reached' });
      return;
    }

    // Create room for the call
    const roomId = `call_${Date.now()}_${socket.id}`;
    socket.join(roomId);
    activeRooms.set(roomId, {
      id: roomId,
      userId: socket.userId,
      socketId: socket.id,
      startTime: Date.now()
    });

    // Get next video
    const video = getNextVideo();
    
    // Decrease call count
    user.callsRemaining--;
    user.totalRewards += adminSettings.rewardAmount;

    socket.emit('call-started', {
      roomId: roomId,
      video: video,
      reward: adminSettings.rewardAmount,
      callsRemaining: user.callsRemaining
    });

    // Set timer to end call
    setTimeout(() => {
      if (activeRooms.has(roomId)) {
        socket.emit('call-ended', {
          message: 'Call duration ended',
          reward: adminSettings.rewardAmount
        });
        socket.leave(roomId);
        activeRooms.delete(roomId);
      }
    }, adminSettings.callDuration * 1000);
  });

  // Handle live chat
  socket.on('join-chat', (data) => {
    if (!socket.userId) {
      socket.emit('chat-error', { message: 'Not authenticated' });
      return;
    }

    const chatRoom = data.roomId || 'global';
    socket.join(`chat_${chatRoom}`);
    
    if (!activeChats.has(chatRoom)) {
      activeChats.set(chatRoom, new Set());
    }
    activeChats.get(chatRoom).add(socket.id);

    socket.emit('chat-joined', { roomId: chatRoom });
    
    // Broadcast to others in the chat
    socket.to(`chat_${chatRoom}`).emit('user-joined-chat', {
      userId: socket.userId,
      email: socket.email
    });
  });

  socket.on('send-message', (data) => {
    if (!socket.userId) {
      socket.emit('chat-error', { message: 'Not authenticated' });
      return;
    }

    const chatRoom = data.roomId || 'global';
    const message = {
      userId: socket.userId,
      email: socket.email,
      text: data.text,
      timestamp: Date.now()
    };

    io.to(`chat_${chatRoom}`).emit('new-message', message);
  });

  socket.on('leave-chat', (data) => {
    const chatRoom = data.roomId || 'global';
    socket.leave(`chat_${chatRoom}`);
    
    if (activeChats.has(chatRoom)) {
      activeChats.get(chatRoom).delete(socket.id);
    }

    socket.to(`chat_${chatRoom}`).emit('user-left-chat', {
      userId: socket.userId,
      email: socket.email
    });
  });

  // Handle disconnect
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
    
    // Clean up rooms
    for (const [roomId, room] of activeRooms.entries()) {
      if (room.socketId === socket.id) {
        activeRooms.delete(roomId);
      }
    }

    // Clean up chats
    for (const [chatRoom, participants] of activeChats.entries()) {
      participants.delete(socket.id);
      if (participants.size === 0) {
        activeChats.delete(chatRoom);
      }
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Video folder: ${path.join(__dirname, 'rvideo')}`);
  console.log(`Loaded ${adminSettings.videos.length} videos`);
});
