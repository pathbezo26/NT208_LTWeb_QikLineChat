const startedAt = Date.now();

const metrics = {
    http: {
        total: 0,
        totalDurationMs: 0,
        maxDurationMs: 0,
        byMethod: {},
        byStatusClass: {},
        byPath: {},
    },
    process: {
        unhandledRejections: 0,
        uncaughtExceptions: 0,
    },
};

const increment = (target, key) => {
    target[key] = (target[key] || 0) + 1;
};

const recordHttpRequest = ({ method, path, statusCode, durationMs }) => {
    const statusClass = `${Math.floor(statusCode / 100)}xx`;
    const roundedDuration = Math.round(durationMs);

    metrics.http.total += 1;
    metrics.http.totalDurationMs += roundedDuration;
    metrics.http.maxDurationMs = Math.max(metrics.http.maxDurationMs, roundedDuration);
    increment(metrics.http.byMethod, method);
    increment(metrics.http.byStatusClass, statusClass);
    increment(metrics.http.byPath, path);
};

const recordProcessError = (type) => {
    if (type === 'unhandledRejection') {
        metrics.process.unhandledRejections += 1;
    }

    if (type === 'uncaughtException') {
        metrics.process.uncaughtExceptions += 1;
    }
};

const getRuntimeMetrics = () => {
    const averageDurationMs = metrics.http.total
        ? Math.round(metrics.http.totalDurationMs / metrics.http.total)
        : 0;

    return {
        startedAt: new Date(startedAt).toISOString(),
        uptimeSeconds: Math.round((Date.now() - startedAt) / 1000),
        pid: process.pid,
        memory: process.memoryUsage(),
        http: {
            ...metrics.http,
            averageDurationMs,
        },
        process: metrics.process,
    };
};

module.exports = {
    getRuntimeMetrics,
    recordHttpRequest,
    recordProcessError,
};
