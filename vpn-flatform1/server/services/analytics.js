const { Logger } = require('../middleware/logger');

class AnalyticsService {
    constructor() {
        this.logger = new Logger();
        this.metrics = new Map();
        this.events = [];
        this.maxEvents = 10000; // Keep last 10k events in memory
    }

    // Track custom events
    trackEvent(eventName, properties = {}, userId = null) {
        const event = {
            id: this.generateId(),
            name: eventName,
            properties,
            userId,
            timestamp: new Date().toISOString(),
            sessionId: properties.sessionId || null
        };

        this.events.push(event);

        // Keep only recent events
        if (this.events.length > this.maxEvents) {
            this.events = this.events.slice(-this.maxEvents);
        }

        this.logger.info('Event tracked', { event: eventName, userId, properties });
    }

    // Track user actions
    trackUserAction(action, userId, metadata = {}) {
        this.trackEvent('user_action', {
            action,
            ...metadata
        }, userId);
    }

    // Track server connections
    trackConnection(userId, serverId, successful = true) {
        this.trackEvent('vpn_connection', {
            serverId,
            successful,
            connectionType: 'vpn'
        }, userId);

        // Update connection metrics
        const key = `connections:${serverId}`;
        const current = this.metrics.get(key) || { total: 0, successful: 0, failed: 0 };
        current.total++;
        
        if (successful) {
            current.successful++;
        } else {
            current.failed++;
        }
        
        this.metrics.set(key, current);
    }

    // Track payment events
    trackPayment(userId, amount, currency, planId, status) {
        this.trackEvent('payment', {
            amount,
            currency,
            planId,
            status
        }, userId);

        // Update revenue metrics
        if (status === 'completed') {
            const revenueKey = `revenue:${currency}`;
            const current = this.metrics.get(revenueKey) || 0;
            this.metrics.set(revenueKey, current + amount);
        }
    }

    // Track API usage
    trackAPIUsage(endpoint, method, responseTime, statusCode, userId = null) {
        this.trackEvent('api_call', {
            endpoint,
            method,
            responseTime,
            statusCode
        }, userId);

        // Update endpoint metrics
        const key = `api:${method}:${endpoint}`;
        const current = this.metrics.get(key) || { 
            count: 0, 
            totalResponseTime: 0, 
            errorCount: 0 
        };
        
        current.count++;
        current.totalResponseTime += responseTime;
        
        if (statusCode >= 400) {
            current.errorCount++;
        }
        
        this.metrics.set(key, current);
    }

    // Track errors
    trackError(error, context = {}) {
        this.trackEvent('error', {
            message: error.message,
            stack: error.stack,
            ...context
        });
    }

    // Get analytics summary
    getAnalyticsSummary(timeRange = '24h') {
        const now = new Date();
        const timeRangeMs = this.parseTimeRange(timeRange);
        const startTime = new Date(now.getTime() - timeRangeMs);

        const recentEvents = this.events.filter(event => 
            new Date(event.timestamp) >= startTime
        );

        const summary = {
            totalEvents: recentEvents.length,
            uniqueUsers: new Set(recentEvents.map(e => e.userId).filter(Boolean)).size,
            topEvents: this.getTopEvents(recentEvents),
            errorRate: this.calculateErrorRate(recentEvents),
            averageResponseTime: this.calculateAverageResponseTime(recentEvents),
            connectionSuccess: this.calculateConnectionSuccessRate(),
            revenue: this.calculateRevenue(recentEvents)
        };

        return summary;
    }

    // Get user behavior analysis
    getUserBehaviorAnalysis(userId, timeRange = '7d') {
        const now = new Date();
        const timeRangeMs = this.parseTimeRange(timeRange);
        const startTime = new Date(now.getTime() - timeRangeMs);

        const userEvents = this.events.filter(event => 
            event.userId === userId && new Date(event.timestamp) >= startTime
        );

        return {
            totalEvents: userEvents.length,
            sessionCount: new Set(userEvents.map(e => e.properties.sessionId).filter(Boolean)).size,
            favoriteServers: this.getUserFavoriteServers(userId),
            activityPattern: this.getUserActivityPattern(userEvents),
            deviceUsage: this.getUserDeviceUsage(userEvents)
        };
    }

    // Performance monitoring
    getPerformanceMetrics() {
        const apiMetrics = {};
        
        for (const [key, value] of this.metrics.entries()) {
            if (key.startsWith('api:')) {
                const [, method, endpoint] = key.split(':');
                apiMetrics[`${method} ${endpoint}`] = {
                    totalRequests: value.count,
                    averageResponseTime: value.count > 0 ? value.totalResponseTime / value.count : 0,
                    errorRate: value.count > 0 ? (value.errorCount / value.count) * 100 : 0
                };
            }
        }

        return {
            apiEndpoints: apiMetrics,
            memoryUsage: process.memoryUsage(),
            uptime: process.uptime(),
            activeConnections: this.getActiveConnectionsCount()
        };
    }

    // Helper methods
    generateId() {
        return Math.random().toString(36).substr(2, 9);
    }

    parseTimeRange(timeRange) {
        const units = {
            h: 60 * 60 * 1000,
            d: 24 * 60 * 60 * 1000,
            w: 7 * 24 * 60 * 60 * 1000
        };

        const match = timeRange.match(/^(\d+)([hdw])$/);
        if (!match) return 24 * 60 * 60 * 1000; // Default to 24 hours

        const [, number, unit] = match;
        return parseInt(number) * units[unit];
    }

    getTopEvents(events) {
        const eventCounts = {};
        events.forEach(event => {
            eventCounts[event.name] = (eventCounts[event.name] || 0) + 1;
        });

        return Object.entries(eventCounts)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 10)
            .map(([name, count]) => ({ name, count }));
    }

    calculateErrorRate(events) {
        const apiCalls = events.filter(e => e.name === 'api_call');
        if (apiCalls.length === 0) return 0;

        const errors = apiCalls.filter(e => e.properties.statusCode >= 400);
        return (errors.length / apiCalls.length) * 100;
    }

    calculateAverageResponseTime(events) {
        const apiCalls = events.filter(e => e.name === 'api_call' && e.properties.responseTime);
        if (apiCalls.length === 0) return 0;

        const totalTime = apiCalls.reduce((sum, e) => sum + e.properties.responseTime, 0);
        return totalTime / apiCalls.length;
    }

    calculateConnectionSuccessRate() {
        let totalConnections = 0;
        let successfulConnections = 0;

        for (const [key, value] of this.metrics.entries()) {
            if (key.startsWith('connections:')) {
                totalConnections += value.total;
                successfulConnections += value.successful;
            }
        }

        return totalConnections > 0 ? (successfulConnections / totalConnections) * 100 : 0;
    }

    calculateRevenue(events) {
        const payments = events.filter(e => 
            e.name === 'payment' && e.properties.status === 'completed'
        );

        const revenue = {};
        payments.forEach(payment => {
            const currency = payment.properties.currency;
            revenue[currency] = (revenue[currency] || 0) + payment.properties.amount;
        });

        return revenue;
    }

    getUserFavoriteServers(userId) {
        const connections = this.events.filter(e => 
            e.name === 'vpn_connection' && e.userId === userId
        );

        const serverCounts = {};
        connections.forEach(conn => {
            const serverId = conn.properties.serverId;
            serverCounts[serverId] = (serverCounts[serverId] || 0) + 1;
        });

        return Object.entries(serverCounts)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 5)
            .map(([serverId, count]) => ({ serverId, connectionCount: count }));
    }

    getUserActivityPattern(events) {
        const hourlyActivity = Array(24).fill(0);
        
        events.forEach(event => {
            const hour = new Date(event.timestamp).getHours();
            hourlyActivity[hour]++;
        });

        return hourlyActivity;
    }

    getUserDeviceUsage(events) {
        const devices = {};
        events.forEach(event => {
            if (event.properties.deviceName) {
                devices[event.properties.deviceName] = (devices[event.properties.deviceName] || 0) + 1;
            }
        });

        return devices;
    }

    getActiveConnectionsCount() {
        // This would typically query the database or connection pool
        // For now, return a simulated count
        return Math.floor(Math.random() * 100);
    }
}

// Middleware to track API calls
const analyticsMiddleware = (analyticsService) => {
    return (req, res, next) => {
        const startTime = Date.now();

        res.on('finish', () => {
            const responseTime = Date.now() - startTime;
            const userId = req.user ? req.user.userId : null;
            
            analyticsService.trackAPIUsage(
                req.path,
                req.method,
                responseTime,
                res.statusCode,
                userId
            );
        });

        next();
    };
};

module.exports = { AnalyticsService, analyticsMiddleware };
