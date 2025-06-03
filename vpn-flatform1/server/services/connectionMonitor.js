const { Logger } = require('../middleware/logger');
const { AnalyticsService } = require('./analytics');

class ConnectionMonitorService {
    constructor() {
        this.logger = new Logger();
        this.analytics = new AnalyticsService();
        this.activeConnections = new Map();
        this.serverStats = new Map();
        this.monitoringInterval = null;
        this.healthCheckInterval = null;
    }

    // Start monitoring service
    start() {
        this.logger.info('Starting connection monitoring service');
        
        // Monitor connections every 30 seconds
        this.monitoringInterval = setInterval(() => {
            this.updateConnectionStats();
        }, 30000);

        // Health check every 5 minutes
        this.healthCheckInterval = setInterval(() => {
            this.performHealthChecks();
        }, 5 * 60 * 1000);
    }

    // Stop monitoring service
    stop() {
        if (this.monitoringInterval) {
            clearInterval(this.monitoringInterval);
            this.monitoringInterval = null;
        }
        
        if (this.healthCheckInterval) {
            clearInterval(this.healthCheckInterval);
            this.healthCheckInterval = null;
        }
        
        this.logger.info('Connection monitoring service stopped');
    }

    // Add new connection
    addConnection(connectionData) {
        const connectionId = this.generateConnectionId();
        const connection = {
            id: connectionId,
            userId: connectionData.userId,
            serverId: connectionData.serverId,
            deviceName: connectionData.deviceName,
            deviceId: connectionData.deviceId,
            protocol: connectionData.protocol,
            clientIP: connectionData.clientIP,
            serverIP: connectionData.serverIP,
            startTime: new Date(),
            lastActivity: new Date(),
            bytesTransferred: { upload: 0, download: 0 },
            isActive: true,
            quality: 'excellent',
            latency: 0
        };

        this.activeConnections.set(connectionId, connection);
        this.updateServerLoad(connectionData.serverId, 1);
        
        this.analytics.trackConnection(connectionData.userId, connectionData.serverId, true);
        this.logger.info('New connection established', { connectionId, userId: connectionData.userId });
        
        return connectionId;
    }

    // Remove connection
    removeConnection(connectionId) {
        const connection = this.activeConnections.get(connectionId);
        if (connection) {
            const duration = new Date() - connection.startTime;
            
            this.updateServerLoad(connection.serverId, -1);
            this.activeConnections.delete(connectionId);
            
            this.analytics.trackEvent('connection_ended', {
                connectionId,
                duration,
                bytesTransferred: connection.bytesTransferred
            }, connection.userId);
            
            this.logger.info('Connection terminated', { 
                connectionId, 
                duration: `${Math.round(duration / 1000)}s`,
                userId: connection.userId 
            });
        }
    }

    // Update connection activity
    updateConnectionActivity(connectionId, bytesUp = 0, bytesDown = 0) {
        const connection = this.activeConnections.get(connectionId);
        if (connection) {
            connection.lastActivity = new Date();
            connection.bytesTransferred.upload += bytesUp;
            connection.bytesTransferred.download += bytesDown;
            
            // Update connection quality based on activity
            this.updateConnectionQuality(connectionId);
        }
    }

    // Get active connections for a user
    getUserConnections(userId) {
        const userConnections = [];
        for (const [id, connection] of this.activeConnections) {
            if (connection.userId === userId) {
                userConnections.push({
                    id,
                    serverId: connection.serverId,
                    deviceName: connection.deviceName,
                    protocol: connection.protocol,
                    startTime: connection.startTime,
                    duration: new Date() - connection.startTime,
                    bytesTransferred: connection.bytesTransferred,
                    quality: connection.quality,
                    latency: connection.latency
                });
            }
        }
        return userConnections;
    }

    // Get server statistics
    getServerStats(serverId = null) {
        if (serverId) {
            return this.serverStats.get(serverId) || this.getDefaultServerStats();
        }
        
        const allStats = {};
        for (const [id, stats] of this.serverStats) {
            allStats[id] = stats;
        }
        return allStats;
    }

    // Get real-time dashboard data
    getDashboardData() {
        const now = new Date();
        const stats = {
            totalConnections: this.activeConnections.size,
            totalServers: this.serverStats.size,
            averageLatency: this.calculateAverageLatency(),
            topServers: this.getTopServers(),
            recentConnections: this.getRecentConnections(10),
            bandwidthUsage: this.calculateBandwidthUsage(),
            connectionsByProtocol: this.getConnectionsByProtocol(),
            connectionsByRegion: this.getConnectionsByRegion(),
            timestamp: now.toISOString()
        };

        return stats;
    }

    // Private methods
    generateConnectionId() {
        return 'conn_' + Math.random().toString(36).substr(2, 12);
    }

    updateServerLoad(serverId, change) {
        const stats = this.serverStats.get(serverId) || this.getDefaultServerStats();
        stats.activeConnections += change;
        stats.loadPercentage = Math.min(100, Math.max(0, 
            (stats.activeConnections / stats.maxCapacity) * 100
        ));
        stats.lastUpdated = new Date();
        this.serverStats.set(serverId, stats);
    }

    getDefaultServerStats() {
        return {
            activeConnections: 0,
            maxCapacity: 1000,
            loadPercentage: 0,
            avgLatency: 0,
            status: 'online',
            bandwidthUsage: { upload: 0, download: 0 },
            lastUpdated: new Date()
        };
    }

    updateConnectionStats() {
        const now = new Date();
        const staleThreshold = 5 * 60 * 1000; // 5 minutes

        // Remove stale connections
        for (const [connectionId, connection] of this.activeConnections) {
            if (now - connection.lastActivity > staleThreshold) {
                this.logger.warn('Removing stale connection', { connectionId });
                this.removeConnection(connectionId);
            }
        }

        // Update server statistics
        this.updateServerStatistics();
    }

    updateServerStatistics() {
        // Simulate server statistics updates
        for (const [serverId, stats] of this.serverStats) {
            // Simulate latency variations
            stats.avgLatency = Math.max(10, stats.avgLatency + (Math.random() - 0.5) * 20);
            
            // Simulate bandwidth usage
            const connections = this.getServerConnections(serverId);
            let totalUpload = 0, totalDownload = 0;
            
            connections.forEach(conn => {
                totalUpload += conn.bytesTransferred.upload;
                totalDownload += conn.bytesTransferred.download;
            });
            
            stats.bandwidthUsage = { upload: totalUpload, download: totalDownload };
            stats.lastUpdated = new Date();
        }
    }

    updateConnectionQuality(connectionId) {
        const connection = this.activeConnections.get(connectionId);
        if (!connection) return;

        // Simple quality calculation based on latency and activity
        const timeSinceActivity = new Date() - connection.lastActivity;
        
        if (timeSinceActivity < 30000 && connection.latency < 100) {
            connection.quality = 'excellent';
        } else if (timeSinceActivity < 60000 && connection.latency < 200) {
            connection.quality = 'good';
        } else if (timeSinceActivity < 120000 && connection.latency < 400) {
            connection.quality = 'fair';
        } else {
            connection.quality = 'poor';
        }
    }

    performHealthChecks() {
        this.logger.info('Performing server health checks');
        
        for (const [serverId, stats] of this.serverStats) {
            // Simulate health check
            const isHealthy = Math.random() > 0.05; // 95% uptime
            
            if (!isHealthy && stats.status === 'online') {
                stats.status = 'degraded';
                this.logger.warn('Server health degraded', { serverId });
                
                // Notify admin about server issues
                this.notifyServerIssue(serverId, 'Health check failed');
            } else if (isHealthy && stats.status === 'degraded') {
                stats.status = 'online';
                this.logger.info('Server health restored', { serverId });
            }
        }
    }

    getServerConnections(serverId) {
        const connections = [];
        for (const connection of this.activeConnections.values()) {
            if (connection.serverId === serverId) {
                connections.push(connection);
            }
        }
        return connections;
    }

    calculateAverageLatency() {
        if (this.activeConnections.size === 0) return 0;
        
        let totalLatency = 0;
        for (const connection of this.activeConnections.values()) {
            totalLatency += connection.latency;
        }
        
        return Math.round(totalLatency / this.activeConnections.size);
    }

    getTopServers() {
        const serverConnections = {};
        
        for (const connection of this.activeConnections.values()) {
            serverConnections[connection.serverId] = 
                (serverConnections[connection.serverId] || 0) + 1;
        }
        
        return Object.entries(serverConnections)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 5)
            .map(([serverId, count]) => ({ serverId, connections: count }));
    }

    getRecentConnections(limit = 10) {
        return Array.from(this.activeConnections.values())
            .sort((a, b) => b.startTime - a.startTime)
            .slice(0, limit)
            .map(conn => ({
                id: conn.id,
                userId: conn.userId,
                serverId: conn.serverId,
                startTime: conn.startTime,
                quality: conn.quality
            }));
    }

    calculateBandwidthUsage() {
        let totalUpload = 0, totalDownload = 0;
        
        for (const connection of this.activeConnections.values()) {
            totalUpload += connection.bytesTransferred.upload;
            totalDownload += connection.bytesTransferred.download;
        }
        
        return {
            upload: this.formatBytes(totalUpload),
            download: this.formatBytes(totalDownload),
            total: this.formatBytes(totalUpload + totalDownload)
        };
    }

    getConnectionsByProtocol() {
        const protocols = {};
        
        for (const connection of this.activeConnections.values()) {
            protocols[connection.protocol] = (protocols[connection.protocol] || 0) + 1;
        }
        
        return protocols;
    }

    getConnectionsByRegion() {
        // This would typically query server location data
        // For now, simulate based on server IDs
        const regions = {};
        
        for (const connection of this.activeConnections.values()) {
            const region = this.getServerRegion(connection.serverId);
            regions[region] = (regions[region] || 0) + 1;
        }
        
        return regions;
    }

    getServerRegion(serverId) {
        // Simple mapping based on server ID patterns
        if (serverId.includes('us-')) return 'North America';
        if (serverId.includes('eu-') || serverId.includes('uk-')) return 'Europe';
        if (serverId.includes('ap-') || serverId.includes('jp-')) return 'Asia Pacific';
        return 'Other';
    }

    formatBytes(bytes) {
        if (bytes === 0) return '0 Bytes';
        
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    notifyServerIssue(serverId, issue) {
        // This would send notifications to administrators
        this.analytics.trackEvent('server_issue', {
            serverId,
            issue,
            severity: 'warning'
        });
    }
}

module.exports = { ConnectionMonitorService };
