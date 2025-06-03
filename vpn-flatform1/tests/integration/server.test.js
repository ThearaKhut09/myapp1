/**
 * Integration Tests for Server Components
 */

const request = require('supertest');
const express = require('express');

describe('Server Integration Tests', () => {
    let app;

    beforeEach(() => {
        app = express();
        // Suppress console output during tests
        jest.spyOn(console, 'log').mockImplementation(() => {});
        jest.spyOn(console, 'error').mockImplementation(() => {});
        jest.spyOn(console, 'warn').mockImplementation(() => {});
        jest.spyOn(console, 'info').mockImplementation(() => {});
    });

    afterEach(() => {
        // Restore console
        console.log.mockRestore?.();
        console.error.mockRestore?.();
        console.warn.mockRestore?.();
        console.info.mockRestore?.();
    });

    describe('Basic Server Functionality', () => {
        test('should create express app', () => {
            expect(app).toBeDefined();
            expect(typeof app.listen).toBe('function');
        });

        test('should handle basic routes', async () => {
            app.get('/test', (req, res) => {
                res.json({ message: 'test success' });
            });

            const response = await request(app)
                .get('/test')
                .expect(200);

            expect(response.body.message).toBe('test success');
        });

        test('should handle POST requests', async () => {
            app.use(express.json());
            app.post('/test', (req, res) => {
                res.json({ received: req.body });
            });

            const testData = { name: 'test' };
            const response = await request(app)
                .post('/test')
                .send(testData)
                .expect(200);

            expect(response.body.received).toEqual(testData);
        });
    });

    describe('Middleware Integration', () => {
        test('should apply middleware correctly', () => {
            let middlewareExecuted = false;
            
            app.use((req, res, next) => {
                middlewareExecuted = true;
                next();
            });

            app.get('/middleware-test', (req, res) => {
                res.json({ middlewareExecuted });
            });

            return request(app)
                .get('/middleware-test')
                .expect(200)
                .then(response => {
                    expect(response.body.middlewareExecuted).toBe(true);
                });
        });

        test('should handle error middleware', async () => {
            app.get('/error-test', (req, res, next) => {
                const error = new Error('Test error');
                next(error);
            });

            app.use((err, req, res, next) => {
                res.status(500).json({ error: err.message });
            });

            const response = await request(app)
                .get('/error-test')
                .expect(500);

            expect(response.body.error).toBe('Test error');
        });
    });

    describe('Service Dependencies', () => {
        test('should handle service initialization', () => {
            expect(() => {
                // Test that basic service imports don't throw
                const express = require('express');
                const bodyParser = require('body-parser');
                const cors = require('cors');
                
                expect(express).toBeDefined();
                expect(bodyParser).toBeDefined();
                expect(cors).toBeDefined();
            }).not.toThrow();
        });

        test('should configure CORS middleware', () => {
            const cors = require('cors');
            expect(() => {
                app.use(cors());
            }).not.toThrow();
        });

        test('should configure body parser', () => {
            const bodyParser = require('body-parser');
            expect(() => {
                app.use(bodyParser.json());
                app.use(bodyParser.urlencoded({ extended: true }));
            }).not.toThrow();
        });
    });
});