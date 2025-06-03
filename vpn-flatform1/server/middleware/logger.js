// Enhanced logging middleware
const fs = require('fs');
const path = require('path');

// Create logs directory if it doesn't exist
const logsDir = path.join(__dirname, '../logs');
if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
}

// Log levels
const LOG_LEVELS = {
    ERROR: 0,
    WARN: 1,
    INFO: 2,
    DEBUG: 3
};

class Logger {
    constructor() {
        this.logLevel = process.env.LOG_LEVEL || 'INFO';
    }

    formatMessage(level, message, meta = {}) {
        return JSON.stringify({
            timestamp: new Date().toISOString(),
            level,
            message,
            meta,
            pid: process.pid
        }) + '\n';
    }

    writeToFile(filename, content) {
        const filepath = path.join(logsDir, filename);
        fs.appendFileSync(filepath, content);
    }

    log(level, message, meta = {}) {
        if (LOG_LEVELS[level] <= LOG_LEVELS[this.logLevel]) {
            const formattedMessage = this.formatMessage(level, message, meta);
            
            // Console output with colors
            const colors = {
                ERROR: '\x1b[31m',
                WARN: '\x1b[33m',
                INFO: '\x1b[36m',
                DEBUG: '\x1b[37m'
            };
            
            console.log(`${colors[level]}[${level}]\x1b[0m ${message}`, meta);
            
            // File output
            this.writeToFile(`app-${new Date().toISOString().split('T')[0]}.log`, formattedMessage);
            
            // Separate error log
            if (level === 'ERROR') {
                this.writeToFile(`error-${new Date().toISOString().split('T')[0]}.log`, formattedMessage);
            }
        }
    }

    error(message, meta) { this.log('ERROR', message, meta); }
    warn(message, meta) { this.log('WARN', message, meta); }
    info(message, meta) { this.log('INFO', message, meta); }
    debug(message, meta) { this.log('DEBUG', message, meta); }
}

// Request logging middleware
const requestLogger = (req, res, next) => {
    const startTime = Date.now();
    const logger = new Logger();
    
    logger.info('Incoming request', {
        method: req.method,
        url: req.url,
        ip: req.ip,
        userAgent: req.get('User-Agent')
    });

    // Override res.end to log response
    const originalEnd = res.end;
    res.end = function(...args) {
        const duration = Date.now() - startTime;
        logger.info('Request completed', {
            method: req.method,
            url: req.url,
            statusCode: res.statusCode,
            duration: `${duration}ms`
        });
        originalEnd.apply(this, args);
    };

    next();
};

module.exports = { Logger, requestLogger };
