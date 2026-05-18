require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const mongoose = require('mongoose');

const connectDB = require('./src/config/db');
const { allowedOrigins, corsOptions } = require('./src/config/corsOptions');
const authRoutes = require('./src/routes/authRoutes');
const messageRoutes = require('./src/routes/messageRoutes');
const conversationRoutes = require('./src/routes/conversationRoutes');
const userRoutes = require('./src/routes/userRoutes');
const socketHandler = require('./src/socket/socketHandler');
const logger = require('./src/utils/logger');
const requestLogger = require('./src/middleware/requestLogger');
const { errorHandler, notFoundHandler } = require('./src/middleware/errorHandler');
const { getRuntimeMetrics, recordProcessError } = require('./src/utils/runtimeMetrics');

connectDB();

const app = express();

app.set('trust proxy', 1);
app.use(helmet());
app.use(cors(corsOptions));
app.use(express.json({ limit: '1mb' }));
app.use(requestLogger);

app.use('/api/auth', authRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/conversations', conversationRoutes);
app.use('/api/users', userRoutes);

app.get('/api/health', (req, res) => {
    const isDatabaseConnected = mongoose.connection.readyState === 1;

    res.status(isDatabaseConnected ? 200 : 503).json({
        status: isDatabaseConnected ? 'OK' : 'DEGRADED',
        service: 'QikLine Chat server',
        timestamp: new Date().toISOString(),
        uptimeSeconds: Math.round(process.uptime()),
        database: {
            connected: isDatabaseConnected,
            readyState: mongoose.connection.readyState,
        },
        requestId: req.id,
    });
});

app.get('/api/metrics', (req, res) => {
    const monitoringToken = process.env.MONITORING_TOKEN;
    const authorization = req.headers.authorization || '';

    if (process.env.NODE_ENV === 'production' && !monitoringToken) {
        return res.status(503).json({
            message: 'Monitoring token is not configured',
            requestId: req.id,
        });
    }

    if (monitoringToken && authorization !== `Bearer ${monitoringToken}`) {
        return res.status(401).json({
            message: 'Unauthorized',
            requestId: req.id,
        });
    }

    return res.json({
        ...getRuntimeMetrics(),
        requestId: req.id,
    });
});

app.use(notFoundHandler);
app.use(errorHandler);

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
    logger.info('server_started', {
        port: PORT,
        nodeEnv: process.env.NODE_ENV || 'development',
    });
});

process.on('unhandledRejection', (reason) => {
    recordProcessError('unhandledRejection');
    logger.error('unhandled_rejection', { error: reason });
});

process.on('uncaughtException', (error) => {
    recordProcessError('uncaughtException');
    logger.error('uncaught_exception', { error });
    process.exit(1);
});
