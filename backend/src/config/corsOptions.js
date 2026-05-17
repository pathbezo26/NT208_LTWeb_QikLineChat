const DEFAULT_ALLOWED_ORIGINS = [
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'https://nt208-qikline.vercel.app',
];

const parseAllowedOrigins = () => {
    const configuredOrigins = process.env.CORS_ORIGINS || process.env.CLIENT_URL;

    if (!configuredOrigins) return DEFAULT_ALLOWED_ORIGINS;

    return configuredOrigins
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean);
};

const allowedOrigins = parseAllowedOrigins();

const isAllowedOrigin = (origin) => {
    return !origin || allowedOrigins.includes(origin);
};

const corsOptions = {
    origin(origin, callback) {
        if (isAllowedOrigin(origin)) {
            return callback(null, true);
        }

        return callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
};

module.exports = {
    allowedOrigins,
    corsOptions,
};
