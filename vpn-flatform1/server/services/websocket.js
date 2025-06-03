const WebSocket = require('ws');
const jwt = require('jsonwebtoken');
const { Logger } = require('../middleware/logger');
const { AnalyticsService } = require('../services/analytics');
const { ConnectionMonitorService } = require('../services/connectionMonitor');

class WebSocketService {
    constructor(server) {
        this.logger = new Logger();
        this.analytics = new AnalyticsService();
        this.connectionMonitor = new ConnectionMonitorService();
        this.clients = new Map();
        this.rooms = new Map();
        
        // Create WebSocket server
        this.wss = new WebSocket.Server({ 
            server,
            verifyClient: this.verifyClient.bind(this)
        });
        
        this.setupWebSocketServer();
        this.startPeriodicUpdates();
    }

    setupWebSocketServer() {
        this.wss.on('connection', (ws, req) => {
            const clientId = this.generateClientId();
            const userId = req.user?.userId;
            const userRole = req.user?.role || 'user';
            
            const client = {
                id: clientId,
                userId,
                userRole,
                ws,
                subscribedRooms: new Set(),
                lastActivity: new Date(),
                ip: req.socket.remoteAddress
            };
            
            this.clients.set(clientId, client);
            
            this.logger.info('WebSocket client connected', { 
                clientId, 
                userId,
                ip: client.ip 
            });

            // Set up message handlers
            ws.on('message', (data) => {
                this.handleMessage(clientId, data);
            });

            ws.on('close', () => {
                this.handleClientDisconnect(clientId);
            });

            ws.on('error', (error) => {
                this.logger.error('WebSocket error', { 
                    clientId, 
                    error: error.message 
                });
            });

            // Send welcome message
            this.sendToClient(clientId, {
                type: 'welcome',
                data: {
                    clientId,
                    serverTime: new Date().toISOString(),
                    availableRooms: this.getAvailableRooms(userRole)
                }
            });
        });
    }

    verifyClient(info) {
        try {
            const url = new URL(info.req.url, 'ws://localhost');
            const token = url.searchParams.get('token');
            
            if (!token) {
                this.logger.warn('WebSocket connection rejected: No token provided');
                return false;
            }

            const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production');
            info.req.user = decoded;
            
            return true;
        } catch (error) {
            this.logger.warn('WebSocket connection rejected: Invalid token', { 
                error: error.message 
            });
            return false;
        }
    }

    handleMessage(clientId, data) {
        const client = this.clients.get(clientId);
        if (!client) return;

        try {
            const message = JSON.parse(data.toString());
            client.lastActivity = new Date();

            this.logger.debug('WebSocket message received', { 
                clientId, 
                type: message.type 
            });

            switch (message.type) {
                case 'subscribe':
                    this.handleSubscription(clientId, message.data);
                    break;
                case 'unsubscribe':
                    this.handleUnsubscription(clientId, message.data);
                    break;
                case 'ping':
                    this.sendToClient(clientId, { type: 'pong', timestamp: new Date().toISOString() });
                    break;
                case 'get_status':
                    this.sendConnectionStatus(clientId);
                    break;
                case 'admin_command':
                    this.handleAdminCommand(clientId, message.data);
                    break;
                default:
                    this.logger.warn('Unknown WebSocket message type', { 
                        clientId, 
                        type: message.type 
                    });
            }
        } catch (error) {
            this.logger.error('Error parsing WebSocket message', { 
                clientId, 
                error: error.message 
            });
        }
    }

    handleSubscription(clientId, data) {
        const client = this.clients.get(clientId);
        if (!client) return;

        const { room } = data;
        
        // Check permissions
        if (!this.canAccessRoom(client, room)) {
            this.sendToClient(clientId, {
                type: 'error',
                data: { message: 'Access denied to room: ' + room }
            });
            return;
        }

        // Add client to room
        this.addClientToRoom(clientId, room);
        
        this.sendToClient(clientId, {
            type: 'subscribed',
            data: { room, timestamp: new Date().toISOString() }
        });

        this.logger.info('Client subscribed to room', { clientId, room });
    }

    handleUnsubscription(clientId, data) {
        const client = this.clients.get(clientId);
        if (!client) return;

        const { room } = data;
        this.removeClientFromRoom(clientId, room);
        
        this.sendToClient(clientId, {
            type: 'unsubscribed',
            data: { room, timestamp: new Date().toISOString() }
        });
    }

    handleAdminCommand(clientId, data) {
        const client = this.clients.get(clientId);
        if (!client || client.userRole !== 'admin') {
            this.sendToClient(clientId, {
                type: 'error',
                data: { message: 'Admin access required' }
            });
            return;
        }

        const { command, params } = data;
        
        switch (command) {
            case 'broadcast':
                this.broadcastToAll({
                    type: 'admin_announcement',
                    data: { message: params.message, timestamp: new Date().toISOString() }
                });
                break;
            case 'kick_user':
                this.kickUser(params.userId);
                break;
            case 'get_stats':
                this.sendSystemStats(clientId);
                break;
        }
    }

    handleClientDisconnect(clientId) {
        const client = this.clients.get(clientId);
        if (client) {
            // Remove from all rooms
            client.subscribedRooms.forEach(room => {
                this.removeClientFromRoom(clientId, room);
            });
            
            this.clients.delete(clientId);
            
            this.logger.info('WebSocket client disconnected', { 
                clientId, 
                userId: client.userId 
            });
        }
    }

    // Room management
    addClientToRoom(clientId, room) {
        const client = this.clients.get(clientId);
        if (!client) return;

        if (!this.rooms.has(room)) {
            this.rooms.set(room, new Set());
        }
        
        this.rooms.get(room).add(clientId);
        client.subscribedRooms.add(room);
    }

    removeClientFromRoom(clientId, room) {
        const client = this.clients.get(clientId);
        if (client) {
            client.subscribedRooms.delete(room);
        }
        
        if (this.rooms.has(room)) {
            this.rooms.get(room).delete(clientId);
            
            // Clean up empty rooms
            if (this.rooms.get(room).size === 0) {
                this.rooms.delete(room);
            }
        }
    }

    canAccessRoom(client, room) {
        // Define room access rules
        const publicRooms = ['general', 'announcements'];
        const userRooms = ['user_updates', 'connection_status'];
        const adminRooms = ['admin_dashboard', 'system_alerts', 'user_activity'];

        if (publicRooms.includes(room)) return true;
        if (userRooms.includes(room) && client.userId) return true;
        if (adminRooms.includes(room) && client.userRole === 'admin') return true;
        
        return false;
    }

    getAvailableRooms(userRole) {
        const rooms = ['general', 'announcements'];
        
        if (userRole) {
            rooms.push('user_updates', 'connection_status');
        }
        
        if (userRole === 'admin') {
            rooms.push('admin_dashboard', 'system_alerts', 'user_activity');
        }
        
        return rooms;
    }

    // Broadcasting methods
    broadcastToRoom(room, message) {
        if (!this.rooms.has(room)) return;
        
        const clientIds = this.rooms.get(room);
        clientIds.forEach(clientId => {
            this.sendToClient(clientId, message);
        });
    }

    broadcastToAll(message) {
        this.clients.forEach((client, clientId) => {
            this.sendToClient(clientId, message);
        });
    }

    broadcastToUser(userId, message) {
        this.clients.forEach((client, clientId) => {
            if (client.userId === userId) {
                this.sendToClient(clientId, message);
            }
        });
    }

    sendToClient(clientId, message) {
        const client = this.clients.get(clientId);
        if (client && client.ws.readyState === WebSocket.OPEN) {
            try {
                client.ws.send(JSON.stringify(message));
            } catch (error) {
                this.logger.error('Error sending WebSocket message', { 
                    clientId, 
                    error: error.message 
                });
            }
        }
    }

    // Periodic updates
    startPeriodicUpdates() {
        // Send connection updates every 30 seconds
        setInterval(() => {
            this.sendConnectionUpdates();
        }, 30000);

        // Send server stats every 60 seconds to admin clients
        setInterval(() => {
            this.sendAdminUpdates();
        }, 60000);

        // Clean up inactive clients every 5 minutes
        setInterval(() => {
            this.cleanupInactiveClients();
        }, 5 * 60 * 1000);
    }

    sendConnectionUpdates() {
        const connectionData = this.connectionMonitor.getDashboardData();
        
        this.broadcastToRoom('connection_status', {
            type: 'connection_update',
            data: connectionData
        });
    }

    sendAdminUpdates() {
        const systemStats = {
            clients: this.clients.size,
            rooms: this.rooms.size,
            connections: this.connectionMonitor.getDashboardData(),
            analytics: this.analytics.getAnalyticsSummary('1h'),
            timestamp: new Date().toISOString()
        };

        this.broadcastToRoom('admin_dashboard', {
            type: 'system_stats',
            data: systemStats
        });
    }

    sendConnectionStatus(clientId) {
        const client = this.clients.get(clientId);
        if (!client || !client.userId) return;

        const userConnections = this.connectionMonitor.getUserConnections(client.userId);
        
        this.sendToClient(clientId, {
            type: 'connection_status',
            data: {
                connections: userConnections,
                timestamp: new Date().toISOString()
            }
        });
    }

    sendSystemStats(clientId) {
        const stats = {
            server: {
                uptime: process.uptime(),
                memory: process.memoryUsage(),
                connections: this.connectionMonitor.getDashboardData()
            },
            websocket: {
                connectedClients: this.clients.size,
                activeRooms: this.rooms.size
            },
            analytics: this.analytics.getAnalyticsSummary('24h')
        };

        this.sendToClient(clientId, {
            type: 'system_stats',
            data: stats
        });
    }

    cleanupInactiveClients() {
        const now = new Date();
        const timeout = 10 * 60 * 1000; // 10 minutes

        this.clients.forEach((client, clientId) => {
            if (now - client.lastActivity > timeout) {
                this.logger.info('Removing inactive WebSocket client', { clientId });
                client.ws.terminate();
                this.handleClientDisconnect(clientId);
            }
        });
    }

    kickUser(userId) {
        this.clients.forEach((client, clientId) => {
            if (client.userId === userId) {
                this.sendToClient(clientId, {
                    type: 'kicked',
                    data: { message: 'You have been disconnected by an administrator' }
                });
                
                setTimeout(() => {
                    client.ws.terminate();
                }, 1000);
            }
        });
    }

    generateClientId() {
        return 'ws_' + Math.random().toString(36).substr(2, 12);
    }

    // Public API methods
    notifyUserConnection(userId, connectionData) {
        this.broadcastToUser(userId, {
            type: 'connection_established',
            data: connectionData
        });
    }

    notifyUserDisconnection(userId, connectionId) {
        this.broadcastToUser(userId, {
            type: 'connection_terminated',
            data: { connectionId, timestamp: new Date().toISOString() }
        });
    }

    notifySystemAlert(level, message) {
        this.broadcastToRoom('system_alerts', {
            type: 'system_alert',
            data: { level, message, timestamp: new Date().toISOString() }
        });
    }

    getConnectionStats() {
        return {
            connectedClients: this.clients.size,
            activeRooms: this.rooms.size,
            roomDetails: Array.from(this.rooms.entries()).map(([room, clients]) => ({
                room,
                clientCount: clients.size
            }))
        };
    }
}

module.exports = { WebSocketService };
