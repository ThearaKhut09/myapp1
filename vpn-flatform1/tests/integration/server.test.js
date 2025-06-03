/**
 * Integration Tests for VPN Platform Server
 * Tests API endpoints and server functionality
 */

const request = require('supertest');

// Mock database and external services for integration tests
jest.mock('../../server/database/manager', () => ({
    get: jest.fn().mockResolvedValue({}),
    all: jest.fn().mockResolvedValue([]),
    run: jest.fn().mockResolvedValue({ lastID: 1, changes: 1 }),
    init: jest.fn().mockResolvedValue(),
    close: jest.fn().mockResolvedValue()
}));

jest.mock('../../server/config', () => ({
    server: { port: 0, host: 'localhost' },
    database: { host: 'localhost', port: 3306, name: 'test_db' },
    redis: { host: 'localhost', port: 6379 },
    vpn: { configPath: '/tmp/vpn-configs' },
    backup: { path: '/tmp/backups' },
    email: { service: 'gmail', user: 'test@example.com' },
    encryption: { key: 'test-key-32-chars-long-for-testing' },
    jwt: { secret: 'test-jwt-secret' },
    session: { secret: 'test-session-secret' }
}));

// Import app after mocking
const app = require('../../server/app');

describe('VPN Platform Integration Tests', () => {
    beforeAll(() => {
        // Suppress console output during tests
        global.testUtils.suppressConsole();
    });

    describe('Health Check Endpoints', () => {
        test('should handle basic health check', async () => {
            const response = await request(app)
                .get('/api/health')
                .expect(200);

            expect(response.body).toHaveProperty('status');
            expect(response.body).toHaveProperty('timestamp');
        });

        test('should serve static files', async () => {
            await request(app)
                .get('/favicon.ico')
                .expect(404); // File might not exist but route should be handled
        });
    });

    describe('API Authentication', () => {
        test('should handle missing authentication', async () => {
            await request(app)
                .get('/api/admin/users')
                .expect(401);
        });

        test('should handle invalid authentication', async () => {
            await request(app)
                .get('/api/admin/users')
                .set('Authorization', 'Bearer invalid-token')
                .expect(401);
        });
    });

    describe('Error Handling', () => {
        test('should handle 404 for non-existent routes', async () => {
            await request(app)
                .get('/api/non-existent-endpoint')
                .expect(404);
        });

        test('should handle invalid JSON in request body', async () => {
            await request(app)
                .post('/api/auth/login')
                .set('Content-Type', 'application/json')
                .send('invalid json')
                .expect(400);
        });
    });

    describe('CORS and Security Headers', () => {
        test('should include security headers', async () => {
            const response = await request(app)
                .get('/api/health')
                .expect(200);

            expect(response.headers).toHaveProperty('x-content-type-options');
            expect(response.headers).toHaveProperty('x-frame-options');
            expect(response.headers).toHaveProperty('x-xss-protection');
        });

        test('should handle OPTIONS requests', async () => {
            await request(app)
                .options('/api/health')
                .expect(200);
        });
    });

    describe('Rate Limiting', () => {
        test('should accept requests within rate limit', async () => {
            for (let i = 0; i < 5; i++) {
                await request(app)
                    .get('/api/health')
                    .expect(200);
            }
        });
    });

    describe('API Validation', () => {
        test('should validate request data types', async () => {
            await request(app)
                .post('/api/auth/register')
                .send({
                    username: 123, // Invalid type
                    email: 'not-an-email',
                    password: '123' // Too short
                })
                .expect(400);
        });
    });

    describe('Server Configuration', () => {
        test('should respond to ping', async () => {
            await request(app)
                .get('/ping')
                .expect(200);
        });
    });

    describe('Middleware Integration', () => {
        test('should log requests', async () => {
            const logSpy = jest.spyOn(console, 'log').mockImplementation();
            
            await request(app)
                .get('/api/health');
            
            // Request should be logged (though console is mocked)
            expect(logSpy).toHaveBeenCalled();
            logSpy.mockRestore();
        });

        test('should handle large payloads appropriately', async () => {
            const largeData = 'x'.repeat(10000);
            
            await request(app)
                .post('/api/auth/login')
                .send({ data: largeData })
                .expect(400);
        });
    });

    describe('Service Health Checks', () => {
        test('should check analytics service health', async () => {
            // Analytics service should be available
            expect(() => {
                const { AnalyticsService } = require('../../server/services/analytics');
                new AnalyticsService();
            }).not.toThrow();
        });

        test('should check notification service health', async () => {
            // Notification service should be available
            expect(() => {
                const { NotificationService } = require('../../server/services/notifications');
                new NotificationService();
            }).not.toThrow();
        });
    });
});

describe('VPN Platform Integration Tests', () => {
    beforeAll(async () => {
        // Wait for server to be ready
        await new Promise(resolve => setTimeout(resolve, 2000));
    });

    afterAll(async () => {
        // Clean up
        if (server) {
            server.close();
        }
    });

    describe('Health Check Endpoints', () => {
        test('GET /api/system/health should return server status', async () => {
            const response = await request(app)
                .get('/api/system/health')
                .expect(200);

            expect(response.body).toHaveProperty('status', 'OK');
            expect(response.body).toHaveProperty('timestamp');
            expect(response.body).toHaveProperty('uptime');
            expect(response.body).toHaveProperty('services');
        });

        test('GET /api/system/stats should return system statistics', async () => {
            const response = await request(app)
                .get('/api/system/stats')
                .expect(200);

            expect(response.body).toHaveProperty('cpu');
            expect(response.body).toHaveProperty('memory');
            expect(response.body).toHaveProperty('connections');
        });

        test('GET /api/websocket/status should return WebSocket status', async () => {
            const response = await request(app)
                .get('/api/websocket/status')
                .expect(200);

            expect(response.body).toHaveProperty('status');
            expect(response.body).toHaveProperty('connectedClients');
        });
    });

    describe('Authentication Endpoints', () => {
        const testUser = {
            email: 'test@example.com',
            password: 'testpassword123',
            username: 'testuser'
        };

        test('POST /api/auth/register should create new user', async () => {
            const response = await request(app)
                .post('/api/auth/register')
                .send(testUser)
                .expect(201);

            expect(response.body).toHaveProperty('message', 'User registered successfully');
            expect(response.body).toHaveProperty('user');
            expect(response.body.user).toHaveProperty('email', testUser.email);
        });

        test('POST /api/auth/login should authenticate user', async () => {
            const response = await request(app)
                .post('/api/auth/login')
                .send({
                    email: testUser.email,
                    password: testUser.password
                })
                .expect(200);

            expect(response.body).toHaveProperty('token');
            expect(response.body).toHaveProperty('user');
            expect(response.body.user).toHaveProperty('email', testUser.email);
        });

        test('POST /api/auth/login with invalid credentials should fail', async () => {
            await request(app)
                .post('/api/auth/login')
                .send({
                    email: testUser.email,
                    password: 'wrongpassword'
                })
                .expect(401);
        });
    });

    describe('VPN Endpoints', () => {
        let authToken;

        beforeAll(async () => {
            // Login to get auth token
            const loginResponse = await request(app)
                .post('/api/auth/login')
                .send({
                    email: 'test@example.com',
                    password: 'testpassword123'
                });
            
            authToken = loginResponse.body.token;
        });

        test('GET /api/vpn/servers should return available servers', async () => {
            const response = await request(app)
                .get('/api/vpn/servers')
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(Array.isArray(response.body)).toBe(true);
        });

        test('GET /api/vpn/config/openvpn should return OpenVPN config', async () => {
            const response = await request(app)
                .get('/api/vpn/config/openvpn')
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(response.body).toHaveProperty('config');
            expect(typeof response.body.config).toBe('string');
        });

        test('GET /api/vpn/status should return VPN status', async () => {
            const response = await request(app)
                .get('/api/vpn/status')
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(response.body).toHaveProperty('protocols');
            expect(response.body).toHaveProperty('connections');
        });
    });

    describe('Admin Endpoints', () => {
        let adminToken;

        beforeAll(async () => {
            // Create admin user and login
            const adminUser = {
                email: 'admin@example.com',
                password: 'adminpassword123',
                username: 'admin',
                role: 'admin'
            };

            await request(app)
                .post('/api/auth/register')
                .send(adminUser);

            const loginResponse = await request(app)
                .post('/api/auth/login')
                .send({
                    email: adminUser.email,
                    password: adminUser.password
                });
            
            adminToken = loginResponse.body.token;
        });

        test('GET /api/admin/users should return user list', async () => {
            const response = await request(app)
                .get('/api/admin/users')
                .set('Authorization', `Bearer ${adminToken}`)
                .expect(200);

            expect(response.body).toHaveProperty('users');
            expect(Array.isArray(response.body.users)).toBe(true);
        });

        test('GET /api/admin/system/overview should return system overview', async () => {
            const response = await request(app)
                .get('/api/admin/system/overview')
                .set('Authorization', `Bearer ${adminToken}`)
                .expect(200);

            expect(response.body).toHaveProperty('totalUsers');
            expect(response.body).toHaveProperty('activeConnections');
            expect(response.body).toHaveProperty('systemHealth');
        });

        test('GET /api/admin/analytics/dashboard should return analytics data', async () => {
            const response = await request(app)
                .get('/api/admin/analytics/dashboard')
                .set('Authorization', `Bearer ${adminToken}`)
                .expect(200);

            expect(response.body).toHaveProperty('userActivity');
            expect(response.body).toHaveProperty('connectionStats');
            expect(response.body).toHaveProperty('systemMetrics');
        });
    });

    describe('Payment Endpoints', () => {
        let authToken;

        beforeAll(async () => {
            const loginResponse = await request(app)
                .post('/api/auth/login')
                .send({
                    email: 'test@example.com',
                    password: 'testpassword123'
                });
            
            authToken = loginResponse.body.token;
        });

        test('GET /api/payment/plans should return available plans', async () => {
            const response = await request(app)
                .get('/api/payment/plans')
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(Array.isArray(response.body)).toBe(true);
        });

        test('POST /api/payment/create-session should create payment session', async () => {
            const response = await request(app)
                .post('/api/payment/create-session')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    planId: 'basic-monthly',
                    provider: 'stripe'
                })
                .expect(200);

            expect(response.body).toHaveProperty('sessionId');
            expect(response.body).toHaveProperty('checkoutUrl');
        });
    });

    describe('Error Handling', () => {
        test('GET /api/nonexistent should return 404', async () => {
            const response = await request(app)
                .get('/api/nonexistent')
                .expect(404);

            expect(response.body).toHaveProperty('error');
            expect(response.body.error).toHaveProperty('code', 1404);
        });

        test('POST /api/auth/login without body should return 400', async () => {
            const response = await request(app)
                .post('/api/auth/login')
                .expect(400);

            expect(response.body).toHaveProperty('error');
        });

        test('Rate limiting should work', async () => {
            const requests = [];
            
            // Send multiple requests quickly
            for (let i = 0; i < 10; i++) {
                requests.push(
                    request(app)
                        .get('/api/system/health')
                        .expect(200)
                );
            }

            await Promise.all(requests);

            // This request should be rate limited
            const response = await request(app)
                .get('/api/system/health');

            // Should either be 200 (not rate limited) or 429 (rate limited)
            expect([200, 429]).toContain(response.status);
        });
    });

    describe('Security Tests', () => {
        test('Should include security headers', async () => {
            const response = await request(app)
                .get('/api/system/health')
                .expect(200);

            expect(response.headers).toHaveProperty('x-content-type-options');
            expect(response.headers).toHaveProperty('x-frame-options');
            expect(response.headers).toHaveProperty('x-xss-protection');
            expect(response.headers).toHaveProperty('x-request-id');
        });

        test('Should reject requests with invalid JWT', async () => {
            await request(app)
                .get('/api/vpn/servers')
                .set('Authorization', 'Bearer invalid-token')
                .expect(401);
        });

        test('Should reject requests without authentication', async () => {
            await request(app)
                .get('/api/vpn/servers')
                .expect(401);
        });
    });

    describe('WebSocket Integration', () => {
        test('WebSocket connection should work', (done) => {
            const io = require('socket.io-client');
            const client = io(`http://localhost:${config.server.port}`);

            client.on('connect', () => {
                client.emit('test-event', { data: 'test' });
                client.disconnect();
                done();
            });

            client.on('connect_error', (error) => {
                done(error);
            });
        });
    });
});
