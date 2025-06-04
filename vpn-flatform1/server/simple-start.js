// Simple server startup for debugging
const express = require('express');
const path = require('path');
const cors = require('cors');

console.log('Starting server...');

async function startServer() {
    try {
        // Initialize database first
        console.log('Initializing database...');
        const dbManager = require('./database/manager_hybrid');
        
        // Wait for database to be ready
        let retries = 0;
        while (!dbManager.isConnected && retries < 10) {
            await new Promise(resolve => setTimeout(resolve, 1000));
            retries++;
        }
        
        if (!dbManager.isConnected) {
            throw new Error('Database failed to initialize after 10 seconds');
        }
        
        const app = express();
        const PORT = process.env.PORT || 3000;

        // Basic middleware
        app.use(cors());
        app.use(express.json());
        app.use(express.static(path.join(__dirname, '../client')));
        app.use('/public', express.static(path.join(__dirname, '../client/public')));
        app.use('/scr', express.static(path.join(__dirname, '../client/scr')));        // Add auth routes
        const authRoutes = require('./routes/auth');
        app.use('/api', authRoutes);

        // Add admin routes
        const adminRoutes = require('./routes/admin');
        app.use('/api/admin', adminRoutes);

        // HTML page routes
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/public/index.html'));
});

app.get('/home', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/public/index.html'));
});

app.get('/index.html', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/public/index.html'));
});

app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/public/login.html'));
});

app.get('/login.html', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/public/login.html'));
});

app.get('/register', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/public/register.html'));
});

app.get('/register.html', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/public/register.html'));
});

app.get('/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/public/dashboard.html'));
});

app.get('/dashboard.html', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/public/dashboard.html'));
});

app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/public/admin-dashboard.html'));
});

app.get('/admin.html', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/public/admin-dashboard.html'));
});

app.get('/admin-dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/public/admin-dashboard.html'));
});

app.get('/admin-dashboard.html', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/public/admin-dashboard.html'));
});

app.get('/payment', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/public/payment.html'));
});

app.get('/payment.html', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/public/payment.html'));
});

app.get('/test', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/public/test-dashboard.html'));
});

app.get('/test.html', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/public/test-dashboard.html'));
});

app.get('/test-dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/public/test-dashboard.html'));
});

app.get('/test-dashboard.html', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/public/test-dashboard.html'));
});

app.get('/nav-test', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/public/nav-test.html'));
});

app.get('/nav-test.html', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/public/nav-test.html'));
});

app.get('/docs', (req, res) => {
    res.sendFile(path.join(__dirname, '../docs/api-docs.html'));
});

app.get('/api-docs', (req, res) => {
    res.sendFile(path.join(__dirname, '../docs/api-docs.html'));
});

app.get('/api-docs.html', (req, res) => {
    res.sendFile(path.join(__dirname, '../docs/api-docs.html'));
});

// Handle section navigation (redirect to home with hash)
app.get('/features', (req, res) => {
    res.redirect('/#features');
});

app.get('/pricing', (req, res) => {
    res.redirect('/#pricing');
});

app.get('/servers', (req, res) => {
    res.redirect('/#servers');
});

app.get('/support', (req, res) => {
    res.redirect('/#support');
});

// 404 handler for any missing pages
app.get('/404', (req, res) => {
    res.status(404).sendFile(path.join(__dirname, '../client/public/404.html'));
});

app.get('/404.html', (req, res) => {
    res.status(404).sendFile(path.join(__dirname, '../client/public/404.html'));
});

// API routes
app.get('/api/health', (req, res) => {
    res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

        // Catch-all handler for unknown routes
        app.get('*', (req, res) => {
            // If it looks like an API request, return JSON 404
            if (req.path.startsWith('/api/')) {
                res.status(404).json({ error: 'API endpoint not found', path: req.path });
            } else {
                // For HTML requests, show 404 page or redirect to home
                res.status(404).sendFile(path.join(__dirname, '../client/public/404.html'));
            }
        });

        // Start server
        app.listen(PORT, () => {
            console.log(`✅ VPN Platform Server started successfully`);
            console.log(`🌐 Server URL: http://localhost:${PORT}`);
            console.log(`📊 Admin Dashboard: http://localhost:${PORT}/admin`);
            console.log(`📖 API Documentation: http://localhost:${PORT}/docs`);
        });
        
    } catch (error) {
        console.error('❌ Server startup failed:', error);
        process.exit(1);
    }
}

// Start the server
startServer();
