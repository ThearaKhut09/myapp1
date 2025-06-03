const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const rateLimit = require('express-rate-limit');

// Load environment variables
require('dotenv').config();

// Database connection
const { getDatabase } = require('./database/connection');

// Import routes
const authRoutes = require('./routes/auth');
const vpnRoutes = require('./routes/vpn');
const paymentRoutes = require('./routes/payment');

const app = express();
const PORT = process.env.PORT || 3000;

// CORS configuration
const corsOptions = {
    origin: process.env.NODE_ENV === 'production' 
        ? ['https://your-domain.com'] 
        : ['http://localhost:3000', 'http://127.0.0.1:3000'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
};

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: 'Too many requests from this IP, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
});

// Middleware
app.use(cors(corsOptions));
app.use(limiter);
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.json());

// Security headers
app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
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

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: process.env.NODE_ENV || 'development'
    });
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

app.get('/payment', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/public/payment.html'));
});

// 404 handler
app.use((req, res) => {
    res.status(404).sendFile(path.join(__dirname, '../client/public/404.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Error:', err.stack);
    
    if (process.env.NODE_ENV === 'production') {
        res.status(500).json({ 
            error: 'Internal server error',
            message: 'Something went wrong!'
        });
    } else {
        res.status(500).json({ 
            error: 'Internal server error',
            message: err.message,
            stack: err.stack
        });
    }
});

// Start server
app.listen(PORT, () => {
    console.log(`VPN Platform Server running on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`Server URL: http://localhost:${PORT}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM signal received: closing HTTP server');
    app.close(() => {
        console.log('HTTP server closed');
        process.exit(0);
    });
});

module.exports = app;
