const isProduction = process.env.NODE_ENV === 'production';

const serializeError = (error) => {
    if (!(error instanceof Error)) return error;

    return {
        name: error.name,
        message: error.message,
        stack: isProduction ? undefined : error.stack,
    };
};

const normalizeMeta = (value) => {
    if (value instanceof Error) return serializeError(value);
    if (!value || typeof value !== 'object') return value;

    return Object.fromEntries(
        Object.entries(value).map(([key, item]) => [key, normalizeMeta(item)])
    );
};

const write = (level, args) => {
    if (!isProduction) {
        const consoleMethod = level === 'debug' ? 'info' : level;
        console[consoleMethod](...args);
        return;
    }

    const [message, meta = {}] = args;
    const entry = {
        level,
        timestamp: new Date().toISOString(),
        message: typeof message === 'string' ? message : 'log',
        meta: normalizeMeta(typeof message === 'string' ? meta : message),
    };
    const output = JSON.stringify(entry);

    if (level === 'error') {
        console.error(output);
        return;
    }

    if (level === 'warn') {
        console.warn(output);
        return;
    }

    console.log(output);
};

const logger = {
    info(...args) {
        write('info', args);
    },
    warn(...args) {
        write('warn', args);
    },
    error(...args) {
        write('error', args);
    },
    debug(...args) {
        if (!isProduction) {
            write('debug', args);
        }
    },
};

module.exports = logger;
