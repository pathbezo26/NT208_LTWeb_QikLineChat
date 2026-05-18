const { randomUUID } = require('crypto');
const logger = require('../utils/logger');
const { recordHttpRequest } = require('../utils/runtimeMetrics');

const requestLogger = (req, res, next) => {
    const startedAt = process.hrtime.bigint();
    const requestId = req.headers['x-request-id'] || randomUUID();

    req.id = requestId;
    res.setHeader('x-request-id', requestId);

    res.on('finish', () => {
        const durationMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
        const routePath = req.route?.path || req.path;
        const logLevel = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info';

        recordHttpRequest({
            method: req.method,
            path: routePath,
            statusCode: res.statusCode,
            durationMs,
        });

        logger[logLevel]('http_request', {
            requestId,
            method: req.method,
            path: req.originalUrl,
            route: routePath,
            statusCode: res.statusCode,
            durationMs: Math.round(durationMs),
            ip: req.ip,
            userId: req.user?._id?.toString?.(),
        });
    });

    next();
};

module.exports = requestLogger;
