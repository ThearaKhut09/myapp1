/**
 * MySQL Database Manager
 * Provides MySQL database connections with connection pooling,
 * error handling, migrations, and query optimization
 */

const mysql = require('mysql2/promise');
const path = require('path');
const fs = require('fs').promises;
const crypto = require('crypto');
require('dotenv').config();

class DatabaseManager {
    constructor() {
        this.pool = null;
        this.queryCache = new Map();
        this.cacheMaxSize = 1000;
        this.isConnected = false;
        
        this.init();
    }

    /**
     * Initialize database connection and setup
     */
    async init() {
        try {
            await this.connect();
            await this.createTables();
            await this.seedDefaultData();
            
            console.log('✅ MySQL Database initialized successfully');
            this.isConnected = true;
        } catch (error) {
            console.error('❌ Database initialization failed:', error);
            throw error;
        }
    }    /**
     * Create database connection pool
     */
    async connect() {
        try {
            // First try to connect to the database
            this.pool = mysql.createPool({
                host: process.env.DB_HOST || 'localhost',
                port: process.env.DB_PORT || 3306,
                user: process.env.DB_USER || 'root',
                password: process.env.DB_PASSWORD || '',
                database: process.env.DB_NAME || 'vpn_platform',
                waitForConnections: true,
                connectionLimit: 10,
                queueLimit: 0,
                acquireTimeout: 60000,
                timeout: 60000
            });

            // Test the connection
            const connection = await this.pool.getConnection();
            console.log('✅ Connected to MySQL database');
            connection.release();
        } catch (err) {
            console.error('❌ Error connecting to MySQL:', err.message);
            
            // If database doesn't exist, create it
            if (err.code === 'ER_BAD_DB_ERROR') {
                await this.createDatabase();
                await this.connect(); // Reconnect after creating database
            } else {
                throw err;
            }
        }
    }

    /**
     * Create database if it doesn't exist
     */
    async createDatabase() {
        try {
            const tempPool = mysql.createPool({
                host: process.env.DB_HOST || 'localhost',
                port: process.env.DB_PORT || 3306,
                user: process.env.DB_USER || 'root',
                password: process.env.DB_PASSWORD || 'Theara1234#@'
            });

            const connection = await tempPool.getConnection();
            await connection.execute(`CREATE DATABASE IF NOT EXISTS \`${process.env.DB_NAME || 'vpn_platform'}\``);
            console.log('✅ Database created successfully');
            connection.release();
            await tempPool.end();
        } catch (err) {
            console.error('❌ Error creating database:', err.message);
            throw err;
        }
    }

    /**
     * Create database tables using schema
     */
    async createTables() {
        try {
            const schemaPath = path.join(__dirname, 'schema_mysql.sql');
            const schemaContent = await fs.readFile(schemaPath, 'utf8');
            
            // Split by semicolon and execute each statement
            const statements = schemaContent
                .split(';')
                .map(stmt => stmt.trim())
                .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));

            for (const statement of statements) {
                if (statement.trim()) {
                    await this.pool.execute(statement);
                }
            }
            
            console.log('✅ Database tables created successfully');
        } catch (err) {
            console.error('❌ Error creating tables:', err.message);
            // Don't throw error if tables already exist
            if (!err.message.includes('already exists')) {
                throw err;
            }
        }
    }

    /**
     * Seed default data
     */
    async seedDefaultData() {
        try {
            // Check if admin user already exists
            const adminExists = await this.get('SELECT id FROM users WHERE email = ? AND role = ?', ['admin@vpn.com', 'admin']);
            
            if (!adminExists) {
                // Create admin user with proper salt and hash
                const salt = crypto.randomBytes(16).toString('hex');
                const password = 'admin123';
                const hash = crypto.createHash('sha256').update(password + salt).digest('hex');
                
                await this.run(
                    'INSERT INTO users (username, email, password_hash, salt, role, status, is_verified, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
                    ['admin', 'admin@vpn.com', hash, salt, 'admin', 'active', true, true]
                );
                console.log('✅ Admin user created successfully');
            }
        } catch (err) {
            console.error('❌ Error seeding default data:', err.message);
        }
    }

    /**
     * Execute a query with parameters
     */
    async run(sql, params = []) {
        try {
            const [result] = await this.pool.execute(sql, params);
            return { 
                id: result.insertId || 0, 
                changes: result.affectedRows || 0,
                result: result
            };
        } catch (err) {
            console.error('Database run error:', err);
            throw err;
        }
    }

    /**
     * Get a single row
     */
    async get(sql, params = []) {
        try {
            const [rows] = await this.pool.execute(sql, params);
            return rows[0] || null;
        } catch (err) {
            console.error('Database get error:', err);
            throw err;
        }
    }

    /**
     * Get all rows
     */
    async all(sql, params = []) {
        try {
            const [rows] = await this.pool.execute(sql, params);
            return rows;
        } catch (err) {
            console.error('Database all error:', err);
            throw err;
        }
    }

    /**
     * Health check method
     */
    async healthCheck() {
        try {
            const connection = await this.pool.getConnection();
            const [rows] = await connection.execute('SELECT 1 as health');
            connection.release();
            
            // Get table count
            const [tables] = await this.pool.execute('SHOW TABLES');
            console.log(`✅ Database health check passed - ${tables.length} tables found`);
            
            return {
                status: 'healthy',
                tables: tables.length,
                connection: 'active'
            };
        } catch (err) {
            console.error('❌ Database health check failed:', err);
            return {
                status: 'unhealthy',
                error: err.message
            };
        }
    }

    /**
     * Close database connection
     */
    async close() {
        try {
            if (this.pool) {
                await this.pool.end();
                console.log('✅ Database connection closed');
                this.isConnected = false;
            }
        } catch (err) {
            console.error('❌ Error closing database:', err);
            throw err;
        }
    }

    /**
     * Begin transaction
     */
    async beginTransaction() {
        const connection = await this.pool.getConnection();
        await connection.beginTransaction();
        return connection;
    }

    /**
     * Commit transaction
     */
    async commit(connection) {
        await connection.commit();
        connection.release();
    }

    /**
     * Rollback transaction
     */
    async rollback(connection) {
        await connection.rollback();
        connection.release();
    }

    /**
     * Execute multiple statements in a transaction
     */
    async transaction(callback) {
        const connection = await this.beginTransaction();
        try {
            const result = await callback(connection);
            await this.commit(connection);
            return result;
        } catch (error) {
            await this.rollback(connection);
            throw error;
        }
    }

    /**
     * Get user by email (for authentication)
     */
    async getUserByEmail(email) {
        return await this.get('SELECT * FROM users WHERE email = ?', [email]);
    }

    /**
     * Get user by ID
     */
    async getUserById(id) {
        return await this.get('SELECT * FROM users WHERE id = ?', [id]);
    }

    /**
     * Create new user
     */
    async createUser(userData) {
        const { username, email, password, salt, role = 'user', status = 'pending' } = userData;
        
        const result = await this.run(
            'INSERT INTO users (username, email, password_hash, salt, role, status, is_verified, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [username, email, password, salt, role, status, false, true]
        );
        
        return result.id;
    }

    /**
     * Update user
     */
    async updateUser(id, updates) {
        const fields = Object.keys(updates).map(key => `${key} = ?`).join(', ');
        const values = Object.values(updates);
        values.push(id);
        
        return await this.run(`UPDATE users SET ${fields}, updated_at = NOW() WHERE id = ?`, values);
    }

    /**
     * Get all VPN servers
     */
    async getVpnServers() {
        return await this.all('SELECT * FROM vpn_servers WHERE status = ?', ['active']);
    }

    /**
     * Log security event
     */
    async logSecurityEvent(eventData) {
        const { user_id, event_type, description, ip_address, user_agent, severity = 'medium', metadata = {} } = eventData;
        
        return await this.run(
            'INSERT INTO security_events (user_id, event_type, description, ip_address, user_agent, severity, metadata) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [user_id, event_type, description, ip_address, user_agent, severity, JSON.stringify(metadata)]
        );
    }

    /**
     * Add rate limit entry
     */
    async addRateLimit(identifier, endpoint, resetTime) {
        return await this.run(
            'INSERT INTO rate_limits (identifier, endpoint, attempts, reset_time) VALUES (?, ?, 1, ?) ON DUPLICATE KEY UPDATE attempts = attempts + 1, reset_time = VALUES(reset_time)',
            [identifier, endpoint, resetTime]
        );
    }

    /**
     * Get rate limit
     */
    async getRateLimit(identifier, endpoint) {
        return await this.get(
            'SELECT * FROM rate_limits WHERE identifier = ? AND endpoint = ?',
            [identifier, endpoint]
        );
    }

    /**
     * Clear expired rate limits
     */
    async clearExpiredRateLimits() {
        return await this.run('DELETE FROM rate_limits WHERE reset_time < NOW()');
    }
}

// Create singleton instance
const dbManager = new DatabaseManager();

module.exports = dbManager;
