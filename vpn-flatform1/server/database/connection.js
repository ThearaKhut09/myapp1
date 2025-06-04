const mysql = require('mysql2/promise');
const path = require('path');

class Database {
    constructor() {
        this.pool = null;
        this.init();
    }

    async init() {
        try {
            // Create connection pool for better performance
            this.pool = mysql.createPool({
                host: process.env.DB_HOST || 'localhost',
                port: process.env.DB_PORT || 3306,
                user: process.env.DB_USER || 'root',
                password: process.env.DB_PASSWORD || 'Theara1234#@',
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
            console.error('❌ Error connecting to MySQL database:', err.message);
            
            // Try to create database if it doesn't exist
            if (err.code === 'ER_BAD_DB_ERROR') {
                await this.createDatabase();
            } else {
                throw err;
            }
        }
    }

    async createDatabase() {
        try {
            // Connect without specifying database
            const tempPool = mysql.createPool({
                host: process.env.DB_HOST || 'localhost',
                port: process.env.DB_PORT || 3306,
                user: process.env.DB_USER || 'root',
                password: process.env.DB_PASSWORD || 'Theara1234#@',
                waitForConnections: true,
                connectionLimit: 10,
                queueLimit: 0
            });

            const connection = await tempPool.getConnection();
            await connection.execute(`CREATE DATABASE IF NOT EXISTS \`${process.env.DB_NAME || 'vpn_platform'}\``);
            console.log('✅ Database created successfully');
            connection.release();
            await tempPool.end();

            // Now reconnect to the created database
            await this.init();
        } catch (err) {
            console.error('❌ Error creating database:', err.message);
            throw err;
        }
    }

    // Execute a query with parameters
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

    // Get a single row
    async get(sql, params = []) {
        try {
            const [rows] = await this.pool.execute(sql, params);
            return rows[0] || null;
        } catch (err) {
            console.error('Database get error:', err);
            throw err;
        }
    }

    // Get all rows
    async all(sql, params = []) {
        try {
            const [rows] = await this.pool.execute(sql, params);
            return rows;
        } catch (err) {
            console.error('Database all error:', err);
            throw err;
        }
    }

    // Close database connection
    async close() {
        try {
            if (this.pool) {
                await this.pool.end();
                console.log('✅ Database connection closed');
            }
        } catch (err) {
            console.error('❌ Error closing database:', err);
            throw err;
        }
    }

    // Begin transaction
    async beginTransaction() {
        const connection = await this.pool.getConnection();
        await connection.beginTransaction();
        return connection;
    }

    // Commit transaction
    async commit(connection) {
        await connection.commit();
        connection.release();
    }

    // Rollback transaction
    async rollback(connection) {
        await connection.rollback();
        connection.release();
    }

    // Execute multiple statements in a transaction
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

    // Health check method
    async healthCheck() {
        try {
            const connection = await this.pool.getConnection();
            await connection.execute('SELECT 1');
            connection.release();
            return true;
        } catch (err) {
            console.error('❌ Database health check failed:', err);
            return false;
        }
    }
}

// Singleton instance
let instance = null;

function getDatabase() {
    if (!instance) {
        instance = new Database();
    }
    return instance;
}

module.exports = { Database, getDatabase };
