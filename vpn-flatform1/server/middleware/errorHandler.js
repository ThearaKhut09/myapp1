// Enhanced Error Handling System
const fs = require('fs');
const path = require('path');
const { Logger } = require('./logger');
const logger = new Logger();

class ErrorHandler {
    constructor() {
        this.errorCodes = {
            // Authentication Errors (1000-1099)
            INVALID_CREDENTIALS: { code: 1001, status: 401, message: 'Invalid email or password' },
            TOKEN_EXPIRED: { code: 1002, status: 401, message: 'Authentication token has expired' },
            TOKEN_INVALID: { code: 1003, status: 401, message: 'Invalid authentication token' },
            ACCESS_DENIED: { code: 1004, status: 403, message: 'Access denied' },
            ACCOUNT_LOCKED: { code: 1005, status: 423, message: 'Account is temporarily locked' },
            ACCOUNT_SUSPENDED: { code: 1006, status: 403, message: 'Account has been suspended' },

            // User Management Errors (1100-1199)
            USER_NOT_FOUND: { code: 1101, status: 404, message: 'User not found' },
            USER_ALREADY_EXISTS: { code: 1102, status: 409, message: 'User already exists' },
            INVALID_USER_DATA: { code: 1103, status: 400, message: 'Invalid user data provided' },
            EMAIL_NOT_VERIFIED: { code: 1104, status: 403, message: 'Email address not verified' },
            WEAK_PASSWORD: { code: 1105, status: 400, message: 'Password does not meet security requirements' },

            // VPN Connection Errors (1200-1299)
            SERVER_NOT_FOUND: { code: 1201, status: 404, message: 'VPN server not found' },
            SERVER_UNAVAILABLE: { code: 1202, status: 503, message: 'VPN server is currently unavailable' },
            CONNECTION_FAILED: { code: 1203, status: 500, message: 'Failed to establish VPN connection' },
            CONNECTION_LIMIT_EXCEEDED: { code: 1204, status: 429, message: 'Connection limit exceeded' },
            INVALID_PROTOCOL: { code: 1205, status: 400, message: 'Invalid VPN protocol specified' },
            SERVER_OVERLOADED: { code: 1206, status: 503, message: 'VPN server is overloaded' },

            // Subscription Errors (1300-1399)
            SUBSCRIPTION_EXPIRED: { code: 1301, status: 403, message: 'Subscription has expired' },
            SUBSCRIPTION_NOT_FOUND: { code: 1302, status: 404, message: 'Subscription not found' },
            INVALID_PLAN: { code: 1303, status: 400, message: 'Invalid subscription plan' },
            PAYMENT_REQUIRED: { code: 1304, status: 402, message: 'Payment required to access this feature' },
            SUBSCRIPTION_CANCELLED: { code: 1305, status: 403, message: 'Subscription has been cancelled' },

            // Payment Errors (1400-1499)
            PAYMENT_FAILED: { code: 1401, status: 402, message: 'Payment processing failed' },
            INVALID_PAYMENT_METHOD: { code: 1402, status: 400, message: 'Invalid payment method' },
            INSUFFICIENT_FUNDS: { code: 1403, status: 402, message: 'Insufficient funds' },
            PAYMENT_DECLINED: { code: 1404, status: 402, message: 'Payment was declined' },
            REFUND_FAILED: { code: 1405, status: 500, message: 'Refund processing failed' },

            // System Errors (1500-1599)
            INTERNAL_ERROR: { code: 1501, status: 500, message: 'Internal server error occurred' },
            DATABASE_ERROR: { code: 1502, status: 500, message: 'Database operation failed' },
            NETWORK_ERROR: { code: 1503, status: 500, message: 'Network error occurred' },
            SERVICE_UNAVAILABLE: { code: 1504, status: 503, message: 'Service temporarily unavailable' },
            MAINTENANCE_MODE: { code: 1505, status: 503, message: 'System is under maintenance' },

            // Validation Errors (1600-1699)
            INVALID_INPUT: { code: 1601, status: 400, message: 'Invalid input data' },
            MISSING_REQUIRED_FIELD: { code: 1602, status: 400, message: 'Required field is missing' },
            INVALID_FORMAT: { code: 1603, status: 400, message: 'Invalid data format' },
            VALUE_TOO_LONG: { code: 1604, status: 400, message: 'Value exceeds maximum length' },
            VALUE_TOO_SHORT: { code: 1605, status: 400, message: 'Value is below minimum length' },

            // Rate Limiting Errors (1700-1799)
            RATE_LIMIT_EXCEEDED: { code: 1701, status: 429, message: 'Rate limit exceeded' },
            TOO_MANY_REQUESTS: { code: 1702, status: 429, message: 'Too many requests' },
            CONCURRENT_LIMIT_EXCEEDED: { code: 1703, status: 429, message: 'Concurrent request limit exceeded' },

            // File/Upload Errors (1800-1899)
            FILE_NOT_FOUND: { code: 1801, status: 404, message: 'File not found' },
            FILE_TOO_LARGE: { code: 1802, status: 413, message: 'File size exceeds limit' },
            INVALID_FILE_TYPE: { code: 1803, status: 400, message: 'Invalid file type' },
            UPLOAD_FAILED: { code: 1804, status: 500, message: 'File upload failed' },

            // Security Errors (1900-1999)
            SUSPICIOUS_ACTIVITY: { code: 1901, status: 403, message: 'Suspicious activity detected' },
            IP_BLOCKED: { code: 1902, status: 403, message: 'IP address is blocked' },
            CSRF_TOKEN_INVALID: { code: 1903, status: 403, message: 'CSRF token is invalid' },
            HONEYPOT_TRIGGERED: { code: 1904, status: 403, message: 'Security check failed' }
        };

        this.setupUncaughtExceptionHandlers();
        this.loadErrorTemplates();
    }

    // Create custom error class
    createError(errorType, customMessage = null, details = null) {
        const errorInfo = this.errorCodes[errorType];
        if (!errorInfo) {
            throw new Error(`Unknown error type: ${errorType}`);
        }

        const error = new Error(customMessage || errorInfo.message);
        error.name = errorType;
        error.code = errorInfo.code;
        error.status = errorInfo.status;
        error.details = details;
        error.timestamp = new Date().toISOString();
        
        return error;
    }

    // Express error handling middleware
    middleware() {
        return (err, req, res, next) => {
            // Log the error
            this.logError(err, req);

            // Extract error information
            const errorResponse = this.formatError(err);

            // Send appropriate response
            res.status(errorResponse.status).json({
                success: false,
                error: {
                    code: errorResponse.code,
                    message: errorResponse.message,
                    type: errorResponse.type,
                    timestamp: errorResponse.timestamp,
                    ...(errorResponse.details && { details: errorResponse.details }),
                    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
                }
            });
        };
    }    // Format error for response
    formatError(err) {
        let status = err.status || err.statusCode || 500;
        let code = err.code || 1501;
        let message = err.message || 'Internal server error';
        let type = err.name || 'INTERNAL_ERROR';
        let details = err.details || null;

        // Handle different error types
        if (err.name === 'ValidationError') {
            status = 400;
            code = 1601;
            type = 'INVALID_INPUT';
            message = this.formatValidationError(err);
        } else if (err.name === 'CastError') {
            status = 400;
            code = 1603;
            type = 'INVALID_FORMAT';
            message = 'Invalid data format provided';
        } else if (err.code === 'LIMIT_FILE_SIZE') {
            status = 413;
            code = 1802;
            type = 'FILE_TOO_LARGE';
            message = 'File size exceeds the allowed limit';
        } else if (err.code === 'ECONNREFUSED') {
            status = 503;
            code = 1504;
            type = 'SERVICE_UNAVAILABLE';
            message = 'Unable to connect to external service';
        }

        return {
            status,
            code,
            message,
            type,
            details,
            timestamp: new Date().toISOString()
        };
    }

    // Format validation errors
    formatValidationError(err) {
        if (err.errors) {
            const messages = Object.values(err.errors).map(e => e.message);
            return `Validation failed: ${messages.join(', ')}`;
        }
        return err.message;
    }

    // Log error with context
    logError(err, req = null) {
        const errorInfo = {
            name: err.name,
            message: err.message,
            code: err.code,
            status: err.status,
            stack: err.stack,
            timestamp: new Date().toISOString()
        };

        if (req) {
            errorInfo.request = {
                method: req.method,
                url: req.url,
                headers: req.headers,
                body: req.body,
                query: req.query,
                params: req.params,
                ip: req.ip,
                userAgent: req.get('User-Agent')
            };

            if (req.user) {
                errorInfo.user = {
                    id: req.user.id,
                    email: req.user.email
                };
            }
        }

        // Log based on severity
        if (err.status >= 500) {
            logger.error('Server Error:', errorInfo);
        } else if (err.status >= 400) {
            logger.warn('Client Error:', errorInfo);
        } else {
            logger.info('Error:', errorInfo);
        }

        // Store critical errors for analysis
        if (err.status >= 500) {
            this.storeCriticalError(errorInfo);
        }
    }

    // Store critical errors for analysis
    async storeCriticalError(errorInfo) {
        try {
            const errorFile = path.join(__dirname, '../logs/critical-errors.jsonl');
            
            // Ensure logs directory exists
            const logsDir = path.dirname(errorFile);
            if (!fs.existsSync(logsDir)) {
                fs.mkdirSync(logsDir, { recursive: true });
            }

            // Append error to file
            const errorLine = JSON.stringify(errorInfo) + '\n';
            fs.appendFileSync(errorFile, errorLine);

            // Notify admin for critical errors
            await this.notifyAdminOfCriticalError(errorInfo);
        } catch (logError) {
            console.error('Failed to store critical error:', logError);
        }
    }

    // Notify admin of critical errors
    async notifyAdminOfCriticalError(errorInfo) {
        try {
            const notifications = require('../services/notifications');
            
            await notifications.sendNotification({
                type: 'admin_alert',
                priority: 'high',
                title: 'Critical Error Detected',
                message: `A critical error occurred: ${errorInfo.message}`,
                data: {
                    error_code: errorInfo.code,
                    timestamp: errorInfo.timestamp,
                    url: errorInfo.request?.url,
                    user_id: errorInfo.user?.id
                }
            });
        } catch (notifyError) {
            console.error('Failed to notify admin of critical error:', notifyError);
        }
    }

    // Setup global error handlers
    setupUncaughtExceptionHandlers() {
        // Handle uncaught exceptions
        process.on('uncaughtException', (err) => {
            logger.error('Uncaught Exception:', {
                name: err.name,
                message: err.message,
                stack: err.stack,
                timestamp: new Date().toISOString()
            });

            this.storeCriticalError({
                name: err.name,
                message: err.message,
                stack: err.stack,
                type: 'uncaughtException',
                timestamp: new Date().toISOString()
            });

            // Graceful shutdown
            process.exit(1);
        });

        // Handle unhandled promise rejections
        process.on('unhandledRejection', (reason, promise) => {
            logger.error('Unhandled Rejection:', {
                reason: reason,
                stack: reason?.stack,
                promise: promise,
                timestamp: new Date().toISOString()
            });

            this.storeCriticalError({
                name: 'UnhandledRejection',
                message: reason?.message || String(reason),
                stack: reason?.stack,
                type: 'unhandledRejection',
                timestamp: new Date().toISOString()
            });
        });
    }

    // Load error page templates
    loadErrorTemplates() {
        this.errorTemplates = {
            400: this.loadTemplate('400.html'),
            401: this.loadTemplate('401.html'),
            403: this.loadTemplate('403.html'),
            404: this.loadTemplate('404.html'),
            429: this.loadTemplate('429.html'),
            500: this.loadTemplate('500.html'),
            503: this.loadTemplate('503.html')
        };
    }

    // Load HTML error template
    loadTemplate(filename) {
        try {
            const templatePath = path.join(__dirname, '../templates/errors', filename);
            if (fs.existsSync(templatePath)) {
                return fs.readFileSync(templatePath, 'utf8');
            }
        } catch (err) {
            logger.warn(`Failed to load error template ${filename}:`, err.message);
        }
        return null;
    }

    // Render error page
    renderErrorPage(status, req, res, errorData = {}) {
        const template = this.errorTemplates[status];
        
        if (template && req.accepts('html')) {
            // Replace template variables
            let html = template
                .replace(/{{status}}/g, status)
                .replace(/{{message}}/g, errorData.message || 'An error occurred')
                .replace(/{{timestamp}}/g, new Date().toISOString())
                .replace(/{{code}}/g, errorData.code || status);

            res.status(status).send(html);
        } else {
            // Fallback JSON response
            res.status(status).json({
                success: false,
                error: {
                    status,
                    message: errorData.message || 'An error occurred',
                    code: errorData.code || status,
                    timestamp: new Date().toISOString()
                }
            });
        }
    }

    // Validation helpers
    validateRequired(data, fields) {
        const missing = [];
        for (const field of fields) {
            if (!data[field]) {
                missing.push(field);
            }
        }
        if (missing.length > 0) {
            throw this.createError('MISSING_REQUIRED_FIELD', 
                `Required fields missing: ${missing.join(', ')}`);
        }
    }

    validateEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            throw this.createError('INVALID_FORMAT', 'Invalid email format');
        }
    }

    validatePassword(password) {
        if (!password || password.length < 8) {
            throw this.createError('WEAK_PASSWORD', 
                'Password must be at least 8 characters long');
        }
        
        if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(password)) {
            throw this.createError('WEAK_PASSWORD', 
                'Password must contain at least one uppercase letter, one lowercase letter, and one number');
        }
    }

    // Error recovery helpers
    async retryOperation(operation, maxRetries = 3, delay = 1000) {
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                return await operation();
            } catch (error) {
                if (attempt === maxRetries) {
                    throw error;
                }
                
                logger.warn(`Operation failed (attempt ${attempt}/${maxRetries}):`, error.message);
                await new Promise(resolve => setTimeout(resolve, delay * attempt));
            }
        }
    }

    // Circuit breaker pattern
    createCircuitBreaker(name, failureThreshold = 5, timeout = 60000) {
        return {
            name,
            failures: 0,
            failureThreshold,
            timeout,
            state: 'CLOSED', // CLOSED, OPEN, HALF_OPEN
            nextAttempt: Date.now(),
            
            async execute(operation) {
                if (this.state === 'OPEN') {
                    if (Date.now() < this.nextAttempt) {
                        throw new Error(`Circuit breaker is OPEN for ${name}`);
                    }
                    this.state = 'HALF_OPEN';
                }
                
                try {
                    const result = await operation();
                    this.onSuccess();
                    return result;
                } catch (error) {
                    this.onFailure();
                    throw error;
                }
            },
            
            onSuccess() {
                this.failures = 0;
                this.state = 'CLOSED';
            },
            
            onFailure() {
                this.failures++;
                if (this.failures >= this.failureThreshold) {
                    this.state = 'OPEN';
                    this.nextAttempt = Date.now() + this.timeout;
                }
            }
        };
    }

    // Get error statistics
    async getErrorStatistics(timeframe = '24h') {
        try {
            const errorFile = path.join(__dirname, '../logs/critical-errors.jsonl');
            if (!fs.existsSync(errorFile)) {
                return { total: 0, errors: [] };
            }

            const content = fs.readFileSync(errorFile, 'utf8');
            const lines = content.trim().split('\n').filter(line => line);
            
            const now = new Date();
            const timeframMs = this.parseTimeframe(timeframe);
            const cutoff = new Date(now.getTime() - timeframMs);
            
            const errors = lines
                .map(line => {
                    try {
                        return JSON.parse(line);
                    } catch {
                        return null;
                    }
                })
                .filter(error => error && new Date(error.timestamp) > cutoff);

            const stats = {
                total: errors.length,
                byType: {},
                byStatus: {},
                timeline: [],
                topErrors: []
            };

            // Aggregate statistics
            errors.forEach(error => {
                const type = error.name || 'Unknown';
                const status = error.status || 500;
                
                stats.byType[type] = (stats.byType[type] || 0) + 1;
                stats.byStatus[status] = (stats.byStatus[status] || 0) + 1;
            });

            // Sort top errors
            stats.topErrors = Object.entries(stats.byType)
                .sort(([,a], [,b]) => b - a)
                .slice(0, 10)
                .map(([type, count]) => ({ type, count }));

            return stats;
        } catch (err) {
            logger.error('Failed to get error statistics:', err);
            return { total: 0, errors: [] };
        }
    }

    parseTimeframe(timeframe) {
        const unit = timeframe.slice(-1);
        const value = parseInt(timeframe.slice(0, -1));
        
        switch (unit) {
            case 'h': return value * 60 * 60 * 1000;
            case 'd': return value * 24 * 60 * 60 * 1000;
            case 'w': return value * 7 * 24 * 60 * 60 * 1000;
            default: return 24 * 60 * 60 * 1000; // Default to 24 hours
        }
    }
}

module.exports = new ErrorHandler();
