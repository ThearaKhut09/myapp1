const crypto = require('crypto');
const { Logger } = require('./logger');

const logger = new Logger();

// Rate limiting store
const rateLimitStore = new Map();

// Enhanced rate limiting with different limits for different endpoints
const createRateLimit = (windowMs, maxRequests, skipSuccessfulRequests = false) => {
    return (req, res, next) => {
        const key = `${req.ip}:${req.path}`;
        const now = Date.now();
        const windowStart = now - windowMs;

        // Clean old entries
        if (rateLimitStore.has(key)) {
            const requests = rateLimitStore.get(key).filter(time => time > windowStart);
            rateLimitStore.set(key, requests);
        } else {
            rateLimitStore.set(key, []);
        }

        const requests = rateLimitStore.get(key);

        if (requests.length >= maxRequests) {
            logger.warn('Rate limit exceeded', {
                ip: req.ip,
                path: req.path,
                requests: requests.length,
                limit: maxRequests
            });

            return res.status(429).json({
                error: 'Too many requests',
                message: 'Rate limit exceeded. Please try again later.',
                retryAfter: Math.ceil(windowMs / 1000)
            });
        }

        // Add current request
        if (!skipSuccessfulRequests || res.statusCode >= 400) {
            requests.push(now);
        }

        // Add rate limit headers
        res.set({
            'X-RateLimit-Limit': maxRequests,
            'X-RateLimit-Remaining': Math.max(0, maxRequests - requests.length),
            'X-RateLimit-Reset': new Date(now + windowMs).toISOString()
        });

        next();
    };
};

// IP whitelist/blacklist
const ipWhitelist = new Set();
const ipBlacklist = new Set();

const ipFilter = (req, res, next) => {
    const clientIP = req.ip;

    if (ipBlacklist.has(clientIP)) {
        logger.warn('Blocked IP attempted access', { ip: clientIP });
        return res.status(403).json({ error: 'Access denied' });
    }

    if (ipWhitelist.size > 0 && !ipWhitelist.has(clientIP)) {
        logger.warn('Non-whitelisted IP attempted access', { ip: clientIP });
        return res.status(403).json({ error: 'Access denied' });
    }

    next();
};

// Request size limiter
const requestSizeLimit = (maxSize) => {
    return (req, res, next) => {
        const contentLength = parseInt(req.get('Content-Length') || '0');
        
        if (contentLength > maxSize) {
            logger.warn('Request size limit exceeded', {
                ip: req.ip,
                contentLength,
                maxSize
            });
            return res.status(413).json({
                error: 'Request too large',
                message: `Request size exceeds ${maxSize} bytes`
            });
        }

        next();
    };
};

// Security headers middleware
const securityHeaders = (req, res, next) => {
    res.set({
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'X-XSS-Protection': '1; mode=block',
        'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
        'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdnjs.cloudflare.com; font-src 'self' https://fonts.gstatic.com",
        'Referrer-Policy': 'strict-origin-when-cross-origin'
    });
    next();
};

// API key validation
const apiKeyAuth = (req, res, next) => {
    const apiKey = req.get('X-API-Key');
    const validApiKeys = process.env.API_KEYS ? process.env.API_KEYS.split(',') : [];

    if (validApiKeys.length > 0 && !validApiKeys.includes(apiKey)) {
        logger.warn('Invalid API key used', { ip: req.ip });
        return res.status(401).json({ error: 'Invalid API key' });
    }

    next();
};

// Honeypot middleware to catch bots
const honeypot = (req, res, next) => {
    const honeypotField = req.body?.honeypot;
    
    if (honeypotField) {
        logger.warn('Honeypot triggered - potential bot', {
            ip: req.ip,
            userAgent: req.get('User-Agent')
        });
        // Silently reject
        return res.status(200).json({ success: true });
    }

    next();
};

// Brute force protection
const bruteForceProtection = (req, res, next) => {
    const key = `brute:${req.ip}`;
    const maxAttempts = 10;
    const windowMs = 15 * 60 * 1000; // 15 minutes

    if (!rateLimitStore.has(key)) {
        rateLimitStore.set(key, []);
    }

    const attempts = rateLimitStore.get(key);
    const now = Date.now();
    const windowStart = now - windowMs;

    // Clean old attempts
    const recentAttempts = attempts.filter(time => time > windowStart);
    rateLimitStore.set(key, recentAttempts);

    if (recentAttempts.length >= maxAttempts) {
        logger.warn('Brute force attempt detected', {
            ip: req.ip,
            attempts: recentAttempts.length
        });
        return res.status(429).json({
            error: 'Too many failed attempts',
            message: 'Account temporarily locked. Try again later.'
        });
    }

    next();
};

module.exports = {
    createRateLimit,
    ipFilter,
    requestSizeLimit,
    securityHeaders,
    apiKeyAuth,
    honeypot,
    bruteForceProtection,
    ipWhitelist,
    ipBlacklist
};
