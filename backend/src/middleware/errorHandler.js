const logger = require('../utils/logger');

const notFoundHandler = (req, res) => {
    res.status(404).json({
        message: 'Route not found',
        requestId: req.id,
    });
};

const errorHandler = (error, req, res, next) => {
    logger.error('unhandled_request_error', {
        requestId: req.id,
        method: req.method,
        path: req.originalUrl,
        error,
    });

    if (res.headersSent) {
        next(error);
        return;
    }

    const statusCode = error.statusCode || error.status || 500;

    res.status(statusCode).json({
        message: statusCode >= 500 ? 'Server error' : error.message,
        requestId: req.id,
    });
};

module.exports = {
    errorHandler,
    notFoundHandler,
};
