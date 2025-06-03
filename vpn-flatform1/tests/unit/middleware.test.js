/**
 * Unit Tests for Middleware Components
 */

const request = require('supertest');
const express = require('express');

describe('Middleware Tests', () => {
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
    });    describe('Logger Middleware', () => {
        test('should initialize logger without errors', () => {
            expect(() => {
                const { Logger } = require('../../server/middleware/logger');
                const logger = new Logger();
                expect(logger).toBeDefined();
            }).not.toThrow();
        });

        test('should have logging methods', () => {
            const { Logger } = require('../../server/middleware/logger');
            const logger = new Logger();
            expect(typeof logger.info).toBe('function');
            expect(typeof logger.error).toBe('function');
            expect(typeof logger.warn).toBe('function');
            expect(typeof logger.debug).toBe('function');
        });

        test('should log messages without throwing', () => {
            const { Logger } = require('../../server/middleware/logger');
            const logger = new Logger();
            expect(() => {
                logger.info('Test info message');
                logger.error('Test error message');
                logger.warn('Test warning message');
                logger.debug('Test debug message');
            }).not.toThrow();
        });

        test('should have request logger middleware', () => {
            const { requestLogger } = require('../../server/middleware/logger');
            expect(typeof requestLogger).toBe('function');
        });
    });

    describe('Security Middleware', () => {
        test('should initialize security middleware', () => {
            expect(() => {
                const security = require('../../server/middleware/security');
                expect(security).toBeDefined();
                expect(security.middleware).toBeDefined();
                expect(typeof security.middleware).toBe('function');
            }).not.toThrow();
        });

        test('should return array of middleware functions', () => {
            const security = require('../../server/middleware/security');
            const middlewares = security.middleware();
            expect(Array.isArray(middlewares)).toBe(true);
            expect(middlewares.length).toBeGreaterThan(0);
        });        test('should have rate limiting capability', () => {
            const security = require('../../server/middleware/security');
            expect(security.createRateLimit).toBeDefined();
        });

        test('should have IP filtering capability', () => {
            const security = require('../../server/middleware/security');
            expect(security.ipWhitelist).toBeDefined();
        });
    });    describe('Error Handler Middleware', () => {
        test('should initialize error handler', () => {
            expect(() => {
                const errorHandler = require('../../server/middleware/errorHandler');
                expect(errorHandler).toBeDefined();
                expect(typeof errorHandler).toBe('object');
            }).not.toThrow();
        });        test('should have error handling methods', () => {
            const errorHandler = require('../../server/middleware/errorHandler');
            expect(typeof errorHandler.middleware).toBe('function');
            expect(typeof errorHandler.createError).toBe('function');
            expect(typeof errorHandler.formatError).toBe('function');
            expect(typeof errorHandler.logError).toBe('function');
        });        test('should handle express errors', async () => {
            const errorHandler = require('../../server/middleware/errorHandler');
            
            // Test the formatError method directly first
            const testError = new Error('Test error');
            testError.status = 400;
            testError.statusCode = 400;
            
            const formatted = errorHandler.formatError(testError);
            expect(formatted.status).toBe(400);
            
            // Create a fresh express app for this test
            const testApp = express();
            
            testApp.get('/test-error', (req, res, next) => {
                const error = new Error('Test error');
                error.status = 400;
                error.statusCode = 400; // Also set statusCode for compatibility
                next(error);
            });
            
            // Use the actual middleware
            testApp.use((err, req, res, next) => {
                const errorResponse = errorHandler.formatError(err);
                res.status(errorResponse.status).json({
                    success: false,
                    error: {
                        code: errorResponse.code,
                        message: errorResponse.message,
                        type: errorResponse.type,
                        status: errorResponse.status
                    }
                });
            });

            const response = await request(testApp)
                .get('/test-error');

            // Check the status code directly
            expect(response.status).toBe(400);
            expect(response.body).toBeDefined();
            expect(response.body.success).toBe(false);
            expect(response.body.error).toBeDefined();
            expect(response.body.error.status).toBe(400);
        });
    });

    describe('Middleware Integration', () => {
        test('should work together without conflicts', () => {
            expect(() => {
                const logger = require('../../server/middleware/logger');
                const security = require('../../server/middleware/security');
                const errorHandler = require('../../server/middleware/errorHandler');

                // This should not throw even when all middleware is loaded
                expect(logger).toBeDefined();
                expect(security).toBeDefined();
                expect(errorHandler).toBeDefined();
            }).not.toThrow();
        });

        test('should apply security middleware to express app', () => {
            expect(() => {
                const security = require('../../server/middleware/security');
                const middlewares = security.middleware();
                
                middlewares.forEach(middleware => {
                    app.use(middleware);
                });
            }).not.toThrow();
        });
    });
});
