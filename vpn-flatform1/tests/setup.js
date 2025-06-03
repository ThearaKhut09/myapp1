/**
 * Jest Test Setup Configuration
 * Sets up global test environment and utilities
 */

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.PORT = '0'; // Use random port for testing
process.env.DB_HOST = 'localhost';
process.env.DB_PORT = '3306';
process.env.DB_NAME = 'vpn_platform_test';
process.env.DB_USER = 'root';
process.env.DB_PASSWORD = '';
process.env.REDIS_HOST = 'localhost';
process.env.REDIS_PORT = '6379';
process.env.JWT_SECRET = 'test-jwt-secret-key-for-testing-only';
process.env.ENCRYPTION_KEY = 'test-encryption-key-32-chars-long';
process.env.SESSION_SECRET = 'test-session-secret-for-testing';

// Extend Jest matchers
expect.extend({
  toBeValidDate(received) {
    const pass = received instanceof Date && !isNaN(received);
    if (pass) {
      return {
        message: () => `expected ${received} not to be a valid date`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to be a valid date`,
        pass: false,
      };
    }
  },
  
  toBeValidUUID(received) {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    const pass = typeof received === 'string' && uuidRegex.test(received);
    if (pass) {
      return {
        message: () => `expected ${received} not to be a valid UUID`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to be a valid UUID`,
        pass: false,
      };
    }
  },
  
  toBeValidIP(received) {
    const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    const pass = typeof received === 'string' && ipRegex.test(received);
    if (pass) {
      return {
        message: () => `expected ${received} not to be a valid IP address`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to be a valid IP address`,
        pass: false,
      };
    }
  }
});

// Global test utilities
global.testUtils = {
  // Generate test user data
  generateTestUser: (overrides = {}) => ({
    username: 'testuser',
    email: 'test@example.com',
    password: 'TestPassword123!',
    firstName: 'Test',
    lastName: 'User',
    ...overrides
  }),
  
  // Generate test server data
  generateTestServer: (overrides = {}) => ({
    name: 'Test Server',
    hostname: 'test.example.com',
    ip: '192.168.1.100',
    port: 1194,
    protocol: 'openvpn',
    location: 'US',
    capacity: 100,
    ...overrides
  }),
  
  // Wait for async operations
  wait: (ms) => new Promise(resolve => setTimeout(resolve, ms)),
  
  // Generate random string
  randomString: (length = 10) => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  },
  
  // Generate random email
  randomEmail: () => `test${Math.random().toString(36).substring(7)}@example.com`,
  
  // Mock console methods for testing
  suppressConsole: () => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'info').mockImplementation(() => {});
  },
  
  // Restore console methods
  restoreConsole: () => {
    console.log.mockRestore?.();
    console.error.mockRestore?.();
    console.warn.mockRestore?.();
    console.info.mockRestore?.();
  }
};

// Global setup
beforeEach(() => {
  // Clear all timers
  jest.clearAllTimers();
  
  // Reset modules
  jest.resetModules();
  
  // Clear mocks
  jest.clearAllMocks();
});

afterEach(() => {
  // Restore console if it was suppressed
  global.testUtils.restoreConsole();
});

// Handle unhandled promise rejections in tests
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Increase timeout for async operations
jest.setTimeout(30000);

// Mock external services that shouldn't be called during testing
jest.mock('nodemailer', () => ({
  createTransport: jest.fn(() => ({
    sendMail: jest.fn().mockResolvedValue({ messageId: 'test-message-id' })
  }))
}));

// Mock file system operations
jest.mock('fs', () => ({
  existsSync: jest.fn().mockReturnValue(true),
  mkdirSync: jest.fn().mockReturnValue(undefined),
  readFileSync: jest.fn().mockReturnValue('mock file content'),
  writeFileSync: jest.fn().mockReturnValue(undefined),
  appendFileSync: jest.fn().mockReturnValue(undefined),
  statSync: jest.fn().mockReturnValue({ isDirectory: () => false, size: 1024 }),
  readdirSync: jest.fn().mockReturnValue([]),
  unlinkSync: jest.fn().mockReturnValue(undefined),
  promises: 