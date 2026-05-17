require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');

const connectDB = require('./src/config/db');
const { allowedOrigins, corsOptions } = require('./src/config/corsOptions');
const authRoutes = require('./src/routes/authRoutes');
const messageRoutes = require('./src/routes/messageRoutes');
const conversationRoutes = require('./src/routes/conversationRoutes');
const userRoutes = require('./src/routes/userRoutes');
const socketHandler = require('./src/socket/socketHandler');
const logger = require('./src/utils/logger');

connectDB();

const app = express();

app.set('trust proxy', 1);
app.use(helmet());
app.use(cors(corsOptions));
app.use(express.json({ limit: '1mb' }));

app.use('/api/auth', authRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/conversations', conversationRoutes);
app.use('/api/users', userRoutes);

app.get('/api/health', (req, res) => {
    res.json({ status: 'OK', message: 'QikLine Chat server is running' });
});

const httpServer = http.createServer(app);

const io = new Server(httpServer, {
    cors: {
        origin: allowedOrigins,
        methods: ['GET', 'POST'],
        credentials: true,
    },
});

app.set('io', io);
socketHandler(io);

const PORT = process.env.PORT || 5000;
httpServer.listen(PORT, () => {
    logger.info(`Server is running at http://localhost:${PORT}`);
});
