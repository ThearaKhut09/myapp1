/**
 * Unit Tests for VPN Platform Services
 * Tests core functionality of all services with proper mocking
 */

// Mock external dependencies before requiring services
jest.mock('../../server/database/manager', () => ({
    get: jest.fn().mockResolvedValue({}),
    all: jest.fn().mockResolvedValue([]),
    run: jest.fn().mockResolvedValue({ lastID: 1, changes: 1 }),
    close: jest.fn().mockResolvedValue(),
    init: jest.fn().mockResolvedValue()
}));

jest.mock('../../server/config', () => ({
    database: { host: 'localhost', port: 3306, name: 'test_db' },
    redis: { host: 'localhost', port: 6379 },
    vpn: { configPath: '/tmp/vpn-configs' },
    backup: { path: '/tmp/backups' },
    email: { service: 'gmail', user: 'test@example.com' },
    encryption: { key: 'test-key-32-chars-long-for-testing' }
}));

jest.mock('fs', () => ({
    promises: {
        readdir: jest.fn().mockResolvedValue(['test-backup.sql']),
        readFile: jest.fn().mockResolvedValue('test file content'),
        writeFile: jest.fn().mockResolvedValue(),
        mkdir: jest.fn().mockResolvedValue(),
        stat: jest.fn().mockResolvedValue({ size: 1024 }),
        access: jest.fn().mockResolvedValue()
    }
}));

const { AnalyticsService } = require('../../server/services/analytics');
const { ConnectionMonitorService } = require('../../server/services/connectionMonitor');
const { BackupRecoveryService } = require('../../server/services/backup');
const { NotificationService } = require('../../server/services/notifications');
const { VPNProtocolManager } = require('../../server/services/vpnProtocols');
const { WebSocketService } = require('../../server/services/websocket');

describe('Service Unit Tests', () => {
    let analytics, connectionMonitor, backup, notifications, vpnProtocols, websocket;

    beforeAll(() => {
        // Suppress console output during tests
        global.testUtils.suppressConsole();
    });

    beforeEach(() => {
        // Create fresh instances for each test
        analytics = new AnalyticsService();
        connectionMonitor = new ConnectionMonitorService();
        backup = new BackupRecoveryService();
        notifications = new NotificationService();
        vpnProtocols = new VPNProtocolManager();
        websocket = new WebSocketService();
    });

    describe('Analytics Service', () => {
        test('should track events correctly', () => {
            const eventData = {
                name: 'user_login',
                properties: { username: 'testuser' },
                userId: 'user123'
            };

            analytics.trackEvent(eventData.name, eventData.properties, eventData.userId);
            
            expect(analytics.events.length).toBe(1);
            expect(analytics.events[0]).toMatchObject({
                name: eventData.name,
                properties: eventData.properties,
                userId: eventData.userId
            });
        });

        test('should generate analytics summary', () => {
            // Track some test events
            analytics.trackEvent('user_login', { username: 'user1' }, 'user1');
            analytics.trackEvent('vpn_connection', { serverId: 'server1' }, 'user1');
            analytics.trackAPIUsage('/api/servers', 'GET', 150, 200, 'user1');

            const summary = analytics.getAnalyticsSummary('1h');
            
            expect(summary).toHaveProperty('totalEvents');
            expect(summary).toHaveProperty('uniqueUsers');
            expect(summary).toHaveProperty('topEvents');
            expect(summary.totalEvents).toBe(3);
            expect(summary.uniqueUsers).toBe(1);
        });

        test('should track API usage', () => {
            analytics.trackAPIUsage('/api/test', 'GET', 100, 200, 'user1');
            
            const performanceMetrics = analytics.getPerformanceMetrics();
            expect(performanceMetrics).toHaveProperty('apiEndpoints');
            expect(performanceMetrics.apiEndpoints).toHaveProperty('GET /api/test');
        });

        test('should track payment events', () => {
            analytics.trackPayment('user1', 19.99, 'USD', 'premium', 'completed');
            
            const summary = analytics.getAnalyticsSummary('1h');
            expect(summary.revenue).toHaveProperty('USD');
            expect(summary.revenue.USD).toBe(19.99);
        });
    });

    describe('Connection Monitor Service', () => {
        test('should track server metrics', () => {
            const serverMetrics = {
                serverId: 'server1',
                activeConnections: 5,
                cpuUsage: 45.2,
                memoryUsage: 67.8,
                bandwidth: { upload: 1024, download: 2048 }
            };

            connectionMonitor.updateServerMetrics(serverMetrics.serverId, serverMetrics);
            
            const metrics = connectionMonitor.getServerMetrics(serverMetrics.serverId);
            expect(metrics).toMatchObject(serverMetrics);
        });

        test('should track connection events', () => {
            const connectionData = {
                userId: 'user1',
                serverId: 'server1',
                protocol: 'openvpn',
                status: 'connected'
            };

            connectionMonitor.trackConnection(connectionData);
            
            const connections = connectionMonitor.getActiveConnections();
            expect(Array.isArray(connections)).toBe(true);
        });

        test('should provide dashboard metrics', () => {
            const dashboardMetrics = connectionMonitor.getDashboardMetrics();
            
            expect(dashboardMetrics).toHaveProperty('totalServers');
            expect(dashboardMetrics).toHaveProperty('activeConnections');
            expect(dashboardMetrics).toHaveProperty('systemLoad');
        });
    });

    describe('Backup Service', () => {
        test('should create backup metadata', () => {
            const backupData = {
                type: 'database',
                filename: 'test-backup.sql',
                size: 1024,
                compressed: true
            };

            const result = backup.createBackupRecord(backupData);
            expect(result).toHaveProperty('id');
            expect(result).toHaveProperty('timestamp');
        });

        test('should validate backup data', () => {
            const validBackup = {
                type: 'database',
                filename: 'backup.sql',
                size: 1024
            };

            const invalidBackup = {
                type: 'invalid',
                filename: '',
                size: -1
            };

            expect(backup.validateBackupData(validBackup)).toBe(true);
            expect(backup.validateBackupData(invalidBackup)).toBe(false);
        });

        test('should list available backups', () => {
            const backups = backup.listBackups();
            expect(Array.isArray(backups)).toBe(true);
        });
    });

    describe('Notification Service', () => {
        test('should create notification', () => {
            const notification = {
                userId: 'user1',
                type: 'info',
                title: 'Test Notification',
                message: 'This is a test notification'
            };

            const result = notifications.createNotification(notification);
            expect(result).toHaveProperty('id');
            expect(result).toHaveProperty('timestamp');
            expect(result.read).toBe(false);
        });

        test('should validate notification data', () => {
            const validNotification = {
                userId: 'user1',
                type: 'info',
                title: 'Test',
                message: 'Test message'
            };

            const invalidNotification = {
                userId: '',
                type: 'invalid',
                title: '',
                message: ''
            };

            expect(notifications.validateNotificationData(validNotification)).toBe(true);
            expect(notifications.validateNotificationData(invalidNotification)).toBe(false);
        });

        test('should get user notifications', () => {
            // Create test notification
            notifications.createNotification({
                userId: 'user1',
                type: 'info',
                title: 'Test',
                message: 'Test message'
            });

            const userNotifications = notifications.getUserNotifications('user1');
            expect(Array.isArray(userNotifications)).toBe(true);
            expect(userNotifications.length).toBeGreaterThan(0);
        });
    });

    describe('VPN Protocols Service', () => {
        test('should return protocol status', () => {
            const status = vpnProtocols.getProtocolStatus();
            expect(status).toHaveProperty('protocols');
            expect(Array.isArray(status.protocols)).toBe(true);
        });

        test('should validate protocol configuration', () => {
            const config = {
                protocol: 'openvpn',
                port: 1194,
                encryption: 'AES-256-GCM'
            };

            const isValid = vpnProtocols.validateProtocolConfig(config);
            expect(typeof isValid).toBe('boolean');
        });

        test('should generate client configuration', () => {
            const clientConfig = {
                userId: 'user1',
                protocol: 'openvpn',
                serverId: 'server1'
            };

            const config = vpnProtocols.generateClientConfig(clientConfig);
            expect(config).toHaveProperty('config');
            expect(config).toHaveProperty('filename');
        });
    });

    describe('WebSocket Service', () => {
        test('should initialize with default settings', () => {
            expect(websocket.rooms).toBeDefined();
            expect(websocket.clients).toBeDefined();
        });

        test('should validate room names', () => {
            expect(websocket.isValidRoom('admin')).toBe(true);
            expect(websocket.isValidRoom('user-123')).toBe(true);
            expect(websocket.isValidRoom('')).toBe(false);
            expect(websocket.isValidRoom('invalid room name')).toBe(false);
        });

        test('should manage client connections', () => {
            const mockSocket = {
                id: 'socket123',
                userId: 'user1',
                join: jest.fn(),
                leave: jest.fn(),
                emit: jest.fn()
            };

            websocket.handleClientConnection(mockSocket);
            expect(websocket.clients.has('socket123')).toBe(true);
        });
    });

    describe('Service Integration', () => {
        test('services should initialize without errors', () => {
            expect(() => {
                new AnalyticsService();
                new ConnectionMonitorService();
                new BackupRecoveryService(); 
                new NotificationService();
                new VPNProtocolManager();
                new WebSocketService();
            }).not.toThrow();
        });

        test('services should handle invalid data gracefully', () => {
            expect(() => {
                analytics.trackEvent('', null, null);
                connectionMonitor.updateServerMetrics('', null);
                backup.validateBackupData(null);
                notifications.createNotification(null);
            }).not.toThrow();
        });
    });
});

describe('Service Unit Tests', () => {
    describe('Analytics Service', () => {
        beforeAll(async () => {
            await analytics.initialize();
        });

        test('should track events', () => {
            expect(() => {
                analytics.track('test.event', { data: 'test' });
            }).not.toThrow();
        });

        test('should generate reports', async () => {
            const report = await analytics.generateReport('daily', new Date());
            expect(report).toHaveProperty('events');
            expect(report).toHaveProperty('users');
            expect(report).toHaveProperty('period');
        });

        test('should validate event data', () => {
            expect(() => {
                analytics.track('', {}); // Invalid event name
            }).toThrow();

            expect(() => {
                analytics.track('test.event', null); // Invalid data
            }).toThrow();
        });

        test('should be healthy', () => {
            expect(analytics.isHealthy()).toBe(true);
        });
    });

    describe('Connection Monitor Service', () => {
        beforeAll(() => {
            connectionMonitor.initialize();
        });

        test('should track server metrics', () => {
            const metrics = connectionMonitor.getSystemStats();
            expect(metrics).toHaveProperty('cpu');
            expect(metrics).toHaveProperty('memory');
            expect(metrics).toHaveProperty('uptime');
        });

        test('should handle connection events', () => {
            const connection = {
                id: 'test-connection',
                userId: 'test-user',
                protocol: 'openvpn',
                serverIP: '192.168.1.1',
                clientIP: '10.8.0.2'
            };

            expect(() => {
                connectionMonitor.addConnection(connection);
            }).not.toThrow();

            expect(() => {
                connectionMonitor.removeConnection('test-connection');
            }).not.toThrow();
        });

        test('should provide connection statistics', () => {
            const stats = connectionMonitor.getConnectionStats();
            expect(stats).toHaveProperty('total');
            expect(stats).toHaveProperty('active');
            expect(stats).toHaveProperty('protocols');
        });
    });

    describe('Backup Service', () => {
        beforeAll(async () => {
            await backup.initialize();
        });

        test('should create database backup', async () => {
            const result = await backup.createDatabaseBackup();
            expect(result).toHaveProperty('success', true);
            expect(result).toHaveProperty('filename');
            expect(result).toHaveProperty('size');
        });

        test('should create file backup', async () => {
            const result = await backup.createFileBackup();
            expect(result).toHaveProperty('success', true);
            expect(result).toHaveProperty('filename');
        });

        test('should list backups', async () => {
            const backups = await backup.listBackups();
            expect(Array.isArray(backups)).toBe(true);
        });

        test('should validate backup integrity', async () => {
            const backups = await backup.listBackups();
            if (backups.length > 0) {
                const isValid = await backup.verifyBackup(backups[0].filename);
                expect(typeof isValid).toBe('boolean');
            }
        });
    });

    describe('Notification Service', () => {
        beforeAll(async () => {
            await notifications.initialize();
        });

        test('should send email notification', async () => {
            const result = await notifications.sendEmail({
                to: 'test@example.com',
                subject: 'Test Email',
                template: 'welcome',
                data: { username: 'Test User' }
            });

            expect(result).toHaveProperty('success');
        });

        test('should create in-app notification', async () => {
            const notification = await notifications.createNotification({
                userId: 'test-user',
                type: 'info',
                title: 'Test Notification',
                message: 'This is a test notification',
                data: { test: true }
            });

            expect(notification).toHaveProperty('id');
            expect(notification).toHaveProperty('userId', 'test-user');
        });

        test('should validate notification data', () => {
            expect(() => {
                notifications.validateNotificationData({
                    userId: '', // Invalid
                    type: 'info',
                    title: 'Test',
                    message: 'Test'
                });
            }).toThrow();
        });

        test('should get user notifications', async () => {
            const notifications_list = await notifications.getUserNotifications('test-user');
            expect(Array.isArray(notifications_list)).toBe(true);
        });
    });

    describe('VPN Protocols Service', () => {
        beforeAll(async () => {
            await vpnProtocols.initialize();
        });

        test('should return protocol status', () => {
            const status = vpnProtocols.getAllProtocolsStatus();
            expect(status).toHaveProperty('openvpn');
            expect(status.openvpn).toHaveProperty('status');
            expect(status.openvpn).toHaveProperty('port');
        });

        test('should generate client config', async () => {
            const config = await vpnProtocols.generateClientConfig('openvpn', 'test-client', {
                id: 'test-user',
                email: 'test@example.com'
            });

            expect(typeof config).toBe('string');
            expect(config).toContain('client');
            expect(config).toContain('proto');
        });

        test('should handle connection management', async () => {
            const connection = await vpnProtocols.addConnection('openvpn', {
                id: 'test-conn',
                clientIP: '10.8.0.2',
                serverIP: '192.168.1.1',
                userId: 'test-user'
            });

            expect(connection).toHaveProperty('id', 'test-conn');
            expect(connection).toHaveProperty('protocol', 'openvpn');

            await vpnProtocols.removeConnection('test-conn');
        });

        test('should provide active connections', () => {
            const connections = vpnProtocols.getActiveConnections();
            expect(Array.isArray(connections)).toBe(true);
        });
    });

    describe('WebSocket Service', () => {
        test('should provide status', () => {
            const status = websocket.getStatus();
            expect(status).toHaveProperty('status');
            expect(status).toHaveProperty('connectedClients');
        });

        test('should validate room names', () => {
            expect(websocket.isValidRoom('admin')).toBe(true);
            expect(websocket.isValidRoom('user-123')).toBe(true);
            expect(websocket.isValidRoom('')).toBe(false);
            expect(websocket.isValidRoom('invalid room name')).toBe(false);
        });

        test('should be healthy', () => {
            expect(websocket.isHealthy()).toBe(true);
        });
    });

    describe('Service Integration', () => {
        test('all services should be healthy', () => {
            expect(analytics.isHealthy()).toBe(true);
            expect(notifications.isHealthy()).toBe(true);
            expect(backup.isHealthy()).toBe(true);
            expect(vpnProtocols.isHealthy()).toBe(true);
            expect(websocket.isHealthy()).toBe(true);
        });

        test('services should handle graceful shutdown', async () => {
            // Test that services can be stopped without errors
            expect(() => {
                connectionMonitor.stop();
                backup.stop();
            }).not.toThrow();
        });
    });
});
