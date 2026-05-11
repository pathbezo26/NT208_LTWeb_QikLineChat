require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const connectDB = require('./src/config/db');
const authRoutes = require('./src/routes/authRoutes');
const messageRoutes = require('./src/routes/messageRoutes');
const conversationRoutes = require('./src/routes/conversationRoutes');
const userRoutes = require('./src/routes/userRoutes');
const socketHandler = require('./src/socket/socketHandler');

// ─── Kết nối MongoDB ──────────────────────────────────────────────────────────
connectDB();

// ─── Khởi tạo Express ─────────────────────────────────────────────────────────
const app = express();

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(cors({
    origin: [
        "http://localhost:5173", // Để bạn tiếp tục code trên máy không bị lỗi
        "https://nt208-qikline.vercel.app" // Cho phép Vercel truy cập
    ],
    credentials: true,
}));
app.use(express.json()); // Parse JSON body

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/conversations', conversationRoutes);
app.use('/api/users', userRoutes);

// Route kiểm tra server còn sống
app.get('/api/health', (req, res) => {
    res.json({ status: 'OK', message: 'QikLine Chat server is running 🚀' });
});

// ─── HTTP Server + Socket.IO ──────────────────────────────────────────────────
const httpServer = http.createServer(app);

const io = new Server(httpServer, {
    cors: {
        origin: 'http://localhost:5173',
        methods: ['GET', 'POST'],
        credentials: true,
    },
});

socketHandler(io);

// ─── Khởi động server ─────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
httpServer.listen(PORT, () => {
    console.log(`🚀 Server đang chạy tại http://localhost:${PORT}`);
});
