const express = require('express');
const { Logger } = require('../middleware/logger');
const { AnalyticsService } = require('../services/analytics');
const { ConnectionMonitorService } = require('../services/connectionMonitor');
const { authenticateToken } = require('./auth');

const router = express.Router();
const logger = new Logger();
const analytics = new AnalyticsService();
const connectionMonitor = new ConnectionMonitorService();

// Middleware to check admin role
const requireAdmin = (req, res, next) => {
    if (req.user.role !== 'admin') {
        logger.warn('Unauthorized admin access attempt', { userId: req.user.userId });
        return res.status(403).json({ error: 'Admin access required' });
    }
    next();
};

// Get admin dashboard overview
router.get('/dashboard', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const analytics_summary = analytics.getAnalyticsSummary('24h');
        const performance_metrics = analytics.getPerformanceMetrics();
        const connection_data = connectionMonitor.getDashboardData();
        
        const dashboard_data = {
            overview: {
                totalUsers: 1250, // Would query from database
                activeConnections: connection_data.totalConnections,
                totalRevenue: analytics_summary.revenue,
                systemUptime: performance_metrics.uptime
            },
            analytics: analytics_summary,
            performance: performance_metrics,
            connections: connection_data,
            recentActivity: await getRecentActivity(),
            alerts: await getSystemAlerts()
        };

        res.json({ data: dashboard_data });
    } catch (error) {
        logger.error('Error fetching admin dashboard', { error: error.message });
        res.status(500).json({ error: 'Failed to fetch dashboard data' });
    }
});

// User management endpoints
router.get('/users', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 25;
        const search = req.query.search || '';
        const status = req.query.status || 'all';

        // Simulate user data (would query from database)
        const users = generateMockUsers(page, limit, search, status);
        
        res.json({
            data: users,
            pagination: {
                page,
                limit,
                total: 1250,
                pages: Math.ceil(1250 / limit)
            }
        });
    } catch (error) {
        logger.error('Error fetching users', { error: error.message });
        res.status(500).json({ error: 'Failed to fetch users' });
    }
});

// Get specific user details
router.get('/users/:userId', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { userId } = req.params;
        
        // Simulate user details (would query from database)
        const userDetails = {
            id: userId,
            email: 'user@example.com',
            firstName: 'John',
            lastName: 'Doe',
            subscriptionStatus: 'active',
            subscriptionPlan: 'premium',
            subscriptionExpiry: '2025-12-31',
            deviceCount: 3,
            deviceLimit: 10,
            totalDataUsed: '125.6 GB',
            accountCreated: '2024-01-15',
            lastLogin: '2025-06-02',
            connections: connectionMonitor.getUserConnections(userId),
            behavior: analytics.getUserBehaviorAnalysis(userId)
        };

        res.json({ data: userDetails });
    } catch (error) {
        logger.error('Error fetching user details', { error: error.message, userId: req.params.userId });
        res.status(500).json({ error: 'Failed to fetch user details' });
    }
});

// Update user status
router.put('/users/:userId/status', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { userId } = req.params;
        const { status, reason } = req.body;

        // Validate status
        const validStatuses = ['active', 'suspended', 'banned', 'inactive'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({ error: 'Invalid status' });
        }

        // Update user status (would update database)
        logger.info('User status updated', { 
            userId, 
            newStatus: status, 
            reason,
            adminId: req.user.userId 
        });

        analytics.trackEvent('user_status_changed', {
            targetUserId: userId,
            newStatus: status,
            reason
        }, req.user.userId);

        res.json({ 
            message: 'User status updated successfully',
            data: { userId, status, updatedAt: new Date().toISOString() }
        });
    } catch (error) {
        logger.error('Error updating user status', { error: error.message });
        res.status(500).json({ error: 'Failed to update user status' });
    }
});

// Server management endpoints
router.get('/servers', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const serverStats = connectionMonitor.getServerStats();
        const servers = [];

        // Generate server list with stats
        const serverIds = ['us-east-1', 'us-west-1', 'uk-london-1', 'de-frankfurt-1', 'jp-tokyo-1'];
        
        serverIds.forEach(serverId => {
            const stats = serverStats[serverId] || connectionMonitor.getServerStats(serverId);
            servers.push({
                id: serverId,
                name: getServerName(serverId),
                location: getServerLocation(serverId),
                status: stats.status,
                activeConnections: stats.activeConnections,
                loadPercentage: stats.loadPercentage,
                avgLatency: Math.round(stats.avgLatency),
                maxCapacity: stats.maxCapacity,
                lastUpdated: stats.lastUpdated
            });
        });

        res.json({ data: servers });
    } catch (error) {
        logger.error('Error fetching servers', { error: error.message });
        res.status(500).json({ error: 'Failed to fetch servers' });
    }
});

// Add new server
router.post('/servers', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { name, location, ipAddress, port, maxCapacity } = req.body;

        // Validate input
        if (!name || !location || !ipAddress || !port) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const serverId = generateServerId(location);
        
        // Add server (would insert into database)
        logger.info('New server added', { 
            serverId, 
            name, 
            location,
            adminId: req.user.userId 
        });

        analytics.trackEvent('server_added', {
            serverId,
            name,
            location
        }, req.user.userId);

        res.status(201).json({
            message: 'Server added successfully',
            data: { 
                id: serverId,
                name,
                location,
                status: 'pending',
                createdAt: new Date().toISOString()
            }
        });
    } catch (error) {
        logger.error('Error adding server', { error: error.message });
        res.status(500).json({ error: 'Failed to add server' });
    }
});

// System monitoring endpoints
router.get('/system/health', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const healthData = {
            status: 'healthy',
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
            memory: process.memoryUsage(),
            cpu: process.cpuUsage(),
            services: {
                database: 'healthy',
                vpnServices: 'healthy',
                paymentGateway: 'healthy',
                analytics: 'healthy'
            },
            metrics: {
                activeConnections: connectionMonitor.getDashboardData().totalConnections,
                requestsPerMinute: calculateRequestsPerMinute(),
                errorRate: analytics.getAnalyticsSummary('1h').errorRate,
                averageResponseTime: analytics.getAnalyticsSummary('1h').averageResponseTime
            }
        };

        res.json({ data: healthData });
    } catch (error) {
        logger.error('Error fetching system health', { error: error.message });
        res.status(500).json({ error: 'Failed to fetch system health' });
    }
});

// Analytics endpoints
router.get('/analytics/overview', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const timeRange = req.query.timeRange || '7d';
        const overview = analytics.getAnalyticsSummary(timeRange);
        
        res.json({ data: overview });
    } catch (error) {
        logger.error('Error fetching analytics overview', { error: error.message });
        res.status(500).json({ error: 'Failed to fetch analytics' });
    }
});

// Logs endpoint
router.get('/logs', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const level = req.query.level || 'INFO';
        const limit = parseInt(req.query.limit) || 100;
        
        // Read recent logs (would implement proper log reading)
        const logs = generateMockLogs(level, limit);
        
        res.json({ data: logs });
    } catch (error) {
        logger.error('Error fetching logs', { error: error.message });
        res.status(500).json({ error: 'Failed to fetch logs' });
    }
});

// Helper functions
async function getRecentActivity() {
    // Simulate recent activity data
    return [
        { type: 'user_login', message: 'User john@example.com logged in', timestamp: new Date() },
        { type: 'payment', message: 'Payment received: $19.99 USD', timestamp: new Date(Date.now() - 300000) },
        { type: 'connection', message: 'New VPN connection established', timestamp: new Date(Date.now() - 600000) }
    ];
}

async function getSystemAlerts() {
    // Simulate system alerts
    return [
        { level: 'warning', message: 'Server us-west-1 CPU usage at 85%', timestamp: new Date() },
        { level: 'info', message: 'Database backup completed successfully', timestamp: new Date(Date.now() - 3600000) }
    ];
}

function generateMockUsers(page, limit, search, status) {
    // Generate mock user data
    const users = [];
    const start = (page - 1) * limit;
    
    for (let i = start; i < start + limit; i++) {
        users.push({
            id: `user_${i + 1}`,
            email: `user${i + 1}@example.com`,
            firstName: 'User',
            lastName: `${i + 1}`,
            subscriptionStatus: ['active', 'inactive', 'suspended'][Math.floor(Math.random() * 3)],
            subscriptionPlan: ['basic', 'premium', 'enterprise'][Math.floor(Math.random() * 3)],
            joinDate: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000),
            lastLogin: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000),
            deviceCount: Math.floor(Math.random() * 5) + 1
        });
    }
    
    return users;
}

function getServerName(serverId) {
    const names = {
        'us-east-1': 'US East (New York)',
        'us-west-1': 'US West (Los Angeles)',
        'uk-london-1': 'UK (London)',
        'de-frankfurt-1': 'Germany (Frankfurt)',
        'jp-tokyo-1': 'Japan (Tokyo)'
    };
    return names[serverId] || serverId;
}

function getServerLocation(serverId) {
    const locations = {
        'us-east-1': 'New York, USA',
        'us-west-1': 'Los Angeles, USA',
        'uk-london-1': 'London, UK',
        'de-frankfurt-1': 'Frankfurt, Germany',
        'jp-tokyo-1': 'Tokyo, Japan'
    };
    return locations[serverId] || 'Unknown';
}

function generateServerId(location) {
    const cleaned = location.toLowerCase().replace(/[^a-z0-9]/g, '');
    return `${cleaned}-${Math.random().toString(36).substr(2, 4)}`;
}

function calculateRequestsPerMinute() {
    // Simulate requests per minute calculation
    return Math.floor(Math.random() * 500) + 100;
}

function generateMockLogs(level, limit) {
    const logs = [];
    const levels = ['ERROR', 'WARN', 'INFO', 'DEBUG'];
    const messages = [
        'User authentication successful',
        'VPN connection established',
        'Payment processed successfully',
        'Database query executed',
        'Server health check completed'
    ];
    
    for (let i = 0; i < limit; i++) {
        logs.push({
            timestamp: new Date(Date.now() - i * 60000),
            level: levels[Math.floor(Math.random() * levels.length)],
            message: messages[Math.floor(Math.random() * messages.length)],
            meta: { requestId: `req_${Math.random().toString(36).substr(2, 8)}` }
        });
    }
    
    return logs.filter(log => level === 'ALL' || log.level === level);
}

module.exports = router;
