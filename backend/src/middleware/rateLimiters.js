const rateLimit = require('express-rate-limit');

const buildRateLimiter = ({ windowMs, max, message }) => rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message },
});

const loginLimiter = buildRateLimiter({
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: 'Too many login attempts. Please try again later.',
});

const searchLimiter = buildRateLimiter({
    windowMs: 60 * 1000,
    max: 30,
    message: 'Too many searches. Please slow down.',
});

const sendMessageLimiter = buildRateLimiter({
    windowMs: 60 * 1000,
    max: 60,
    message: 'Too many messages. Please slow down.',
});

const uploadLimiter = buildRateLimiter({
    windowMs: 15 * 60 * 1000,
    max: 30,
    message: 'Too many uploads. Please try again later.',
});

module.exports = {
    loginLimiter,
    searchLimiter,
    sendMessageLimiter,
    uploadLimiter,
};
