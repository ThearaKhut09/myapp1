const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const http = require('http');
const rateLimit = require('express-rate-limit');

// Load environment variables
require('dotenv').config();

// Enhanced middleware and services
const logger = require('./middleware/logger');
const security = require('./middleware/security');
const errorHandler = require('./middleware/errorHandler');

// Database connection
const dbManager = require('./database/manager');
const { getDatabase } = require('./database/connection');

// Services
const websocketService = require('./services/websocket');
const analytics = require('./services/analytics');
const connectionMonitor = require('./services/connectionMonitor');
const notifications = require('./services/notifications');
const backup = require('./services/backup');
const payment = require('./services/payment');

// Import routes
const authRoutes = require('./routes/auth');
const vpnRoutes = require('./routes/vpn');
const paymentRoutes = require('./routes/payment');
const adminRoutes = require('./routes/admin');

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3000;

// Initialize services
async function initializeServices() {
    try {
        // Initialize database
        await dbManager.initialize();
        logger.info('Database initialized successfully');

        // Initialize analytics
        await analytics.initialize();
        logger.info('Analytics service initialized');

        // Initialize notifications
        await notifications.initialize();
        logger.info('Notification service initialized');

        // Initialize backup service
        await backup.initialize();
        logger.info('Backup service initialized');

        // Initialize payment service
        await payment.initialize();
        logger.info('Payment service initialized');

        // Initialize connection monitor
        connectionMonitor.initialize();
        logger.info('Connection monitor initialized');

        // Initialize WebSocket service
        websocketService.initialize(server);
        logger.info('WebSocket service initialized');

        logger.info('All services initialized successfully');
    } catch (error) {
        logger.error('Failed to initialize services:', error);
        process.exit(1);
    }
}

// Initialize WebSocket service
websocketService.initialize(server);

// Enhanced logging middleware
app.use(logger.middleware());

// Enhanced security middleware
app.use(security.middleware());

// CORS configuration
const corsOptions = {
    origin: process.env.NODE_ENV === 'production' 
        ? process.env.ALLOWED_ORIGINS?.split(',') || ['https://your-domain.com'] 
        : ['http://localhost:3000', 'http://127.0.0.1:3000', 'http://localhost:8080'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept']
};

// Trust proxy for proper IP detection
app.set('trust proxy', process.env.NODE_ENV === 'production' ? 1 : false);

// Middleware setup
app.use(cors(corsOptions));

// Enhanced logging middleware (must be first)
app.use(logger.middleware());

// Enhanced security middleware
app.use(security.middleware());

// Body parsing middleware
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.json({ limit: '10mb' }));

// Analytics tracking middleware
app.use(analytics.middleware());

// Request ID middleware for tracking
app.use((req, res, next) => {
    req.id = require('crypto').randomBytes(16).toString('hex');
    res.setHeader('X-Request-ID', req.id);
    next();
});

// Serve static files from client directory
app.use(express.static(path.join(__dirname, '../client')));
app.use('/public', express.static(path.join(__dirname, '../client/public')));
app.use('/scr', express.static(path.join(__dirname, '../client/scr')));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/vpn', vpnRoutes);
app.use('/api/payment', paymentRoutes);
app.use('/api/admin', adminRoutes);

// System monitoring endpoints
app.get('/api/system/health', (req, res) => {
    const health = {
        status: 'OK',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        environment: process.env.NODE_ENV || 'development',
        version: process.env.npm_package_version || '1.0.0',
        database: 'connected', // This should check actual DB status
        services: {
            analytics: analytics.isHealthy(),
            websocket: websocketService.isHealthy(),
            notifications: notifications.isHealthy(),
            backup: backup.isHealthy()
        }
    };
    
    analytics.track('system.health_check', { ip: req.ip });
    res.json(health);
});

app.get('/api/system/stats', (req, res) => {
    const stats = connectionMonitor.getSystemStats();
    analytics.track('system.stats_viewed', { ip: req.ip });
    res.json(stats);
});

// WebSocket status endpoint
app.get('/api/websocket/status', (req, res) => {
    const status = websocketService.getStatus();
    res.json(status);
});

// Serve HTML files
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/public/index.html'));
});

app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/public/login.html'));
});

app.get('/register', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/public/register.html'));
});

app.get('/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/public/dashboard.html'));
});

app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/public/admin-dashboard.html'));
});

app.get('/docs', (req, res) => {
    res.sendFile(path.join(__dirname, '../docs/api-docs.html'));
});

app.get('/api-docs', (req, res) => {
    res.sendFile(path.join(__dirname, '../docs/api-docs.html'));
});

// Serve error pages
app.get('/error/400', (req, res) => {
    res.status(400).sendFile(path.join(__dirname, './templates/errors/400.html'));
});

app.get('/error/404', (req, res) => {
    res.status(404).sendFile(path.join(__dirname, './templates/errors/404.html'));
});

app.get('/error/500', (req, res) => {
    res.status(500).sendFile(path.join(__dirname, './templates/errors/500.html'));
});

// 404 handler
app.use((req, res, next) => {
    const error = errorHandler.createError(1404, 'Resource not found', `The requested resource ${req.originalUrl} was not found`);
    analytics.track('error.404', { 
        url: req.originalUrl,
        ip: req.ip,
        userAgent: req.get('User-Agent')
    });
    
    if (req.accepts('html')) {
        res.status(404).sendFile(path.join(__dirname, './templates/errors/404.html'));
    } else if (req.accepts('json')) {
        res.status(404).json(error);
    } else {
        res.status(404).type('txt').send('Not found');
    }
});

// Enhanced error handling middleware
app.use(errorHandler.middleware());

// Global error handler
app.use((err, req, res, next) => {
    logger.error('Unhandled error:', {
        error: err.message,
        stack: err.stack,
        url: req.originalUrl,
        method: req.method,
        ip: req.ip,
        userAgent: req.get('User-Agent')
    });

    analytics.track('error.unhandled', {
        error: err.message,
        url: req.originalUrl,
        method: req.method,
        ip: req.ip
    });

    const statusCode = err.statusCode || 500;
    const errorResponse = errorHandler.createError(
        statusCode === 500 ? 1500 : statusCode,
        err.message || 'Internal Server Error',
        process.env.NODE_ENV === 'production' 
            ? 'An unexpected error occurred' 
            : err.stack
    );

    if (req.accepts('html')) {
        res.status(statusCode).sendFile(path.join(__dirname, `./templates/errors/${statusCode === 500 ? '500' : '400'}.html`));
    } else {
        res.status(statusCode).json(errorResponse);
    }
});

// Start server with initialization
async function startServer() {
    try {
        // Initialize all services first
        await initializeServices();
        
        // Start HTTP server
        server.listen(PORT, () => {
            logger.info(`VPN Platform Server started successfully`);
            logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
            logger.info(`Server URL: http://localhost:${PORT}`);
            logger.info(`Admin Dashboard: http://localhost:${PORT}/admin`);
            logger.info(`API Documentation: http://localhost:${PORT}/docs`);
            
            // Track server startup
            analytics.track('system.server_start', {
                port: PORT,
                environment: process.env.NODE_ENV || 'development',
                timestamp: new Date().toISOString()
            });

            // Schedule automated backups
            backup.scheduleBackups();
            
            // Start connection monitoring
            connectionMonitor.startMonitoring();
            
            logger.info('All systems operational');
        });
        
        server.on('error', (error) => {
            logger.error('Server error:', error);
            analytics.track('system.server_error', { error: error.message });
        });
        
    } catch (error) {
        logger.error('Failed to start server:', error);
        process.exit(1);
    }
}

// Graceful shutdown
async function gracefulShutdown(signal) {
    logger.info(`${signal} signal received: starting graceful shutdown`);
    
    try {
        // Stop accepting new connections
        server.close(async () => {
            logger.info('HTTP server closed');
            
            // Close WebSocket connections
            websocketService.close();
            logger.info('WebSocket connections closed');
            
            // Stop services
            connectionMonitor.stop();
            backup.stop();
            
            // Close database connections
            await dbManager.close();
            logger.info('Database connections closed');
            
            // Track shutdown
            analytics.track('system.server_shutdown', {
                signal,
                timestamp: new Date().toISOString()
            });
            
            logger.info('Graceful shutdown completed');
            process.exit(0);
        });
        
        // Force close after timeout
        setTimeout(() => {
            logger.error('Could not close connections in time, forcefully shutting down');
            process.exit(1);
        }, 10000);
        
    } catch (error) {
        logger.error('Error during shutdown:', error);
        process.exit(1);
    }
}

// Handle shutdown signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception:', error);
    analytics.track('system.uncaught_exception', { error: error.message });
    gracefulShutdown('UNCAUGHT_EXCEPTION');
});

process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
    analytics.track('system.unhandled_rejection', { reason: reason?.toString() });
    gracefulShutdown('UNHANDLED_REJECTION');
});

// Start the server
startServer();

module.exports = { app, server };
