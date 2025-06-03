/**
 * Database Manager with Fallback
 * Tries MySQL first, falls back to SQLite if MySQL fails
 */

const mysql = require('mysql2/promise');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
require('dotenv').config();

class DatabaseManager {
    constructor() {
        this.pool = null;
        this.sqliteDb = null;
        this.isMySQL = false;
        this.isConnected = false;
        
        this.init();
    }

    /**
     * Initialize database connection with fallback
     */
    async init() {
        try {
            // Try MySQL first
            await this.connectMySQL();
            this.isMySQL = true;
            console.log('✅ Connected to MySQL database');
        } catch (mysqlError) {
            console.log('⚠️ MySQL connection failed, falling back to SQLite');
            console.log('MySQL Error:', mysqlError.message);
            
            try {
                await this.connectSQLite();
                this.isMySQL = false;
                console.log('✅ Connected to SQLite database');
            } catch (sqliteError) {
                console.error('❌ Both MySQL and SQLite connections failed');
                throw sqliteError;
            }
        }
        
        await this.createTables();
        this.isConnected = true;
        console.log('✅ Database initialized successfully');
    }

    /**
     * Connect to MySQL
     */
    async connectMySQL() {
        this.pool = mysql.createPool({
            host: process.env.DB_HOST || 'localhost',
            port: process.env.DB_PORT || 3306,
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            database: process.env.DB_NAME || 'vpn_platform',
            waitForConnections: true,
            connectionLimit: 10,
            queueLimit: 0
        });

        // Test the connection
        const connection = await this.pool.getConnection();
        await connection.ping();
        connection.release();
    }

    /**
     * Connect to SQLite as fallback
     */
    async connectSQLite() {
        return new Promise((resolve, reject) => {
            const dbPath = path.join(__dirname, '../data/vpn_platform.db');
            this.sqliteDb = new sqlite3.Database(dbPath, (err) => {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
    }

    /**
     * Execute query with automatic database detection
     */
    async query(sql, params = []) {
        if (this.isMySQL) {
            const [rows] = await this.pool.execute(sql, params);
            return rows;
        } else {
            return new Promise((resolve, reject) => {
                this.sqliteDb.all(sql, params, (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows);
                });
            });
        }
    }

    /**
     * Create tables based on database type
     */
    async createTables() {
        if (this.isMySQL) {
            await this.createMySQLTables();
        } else {
            await this.createSQLiteTables();
        }
    }

    async createMySQLTables() {
        // Use existing MySQL schema creation logic
        console.log('Creating MySQL tables...');
        // Implementation would go here
    }

    async createSQLiteTables() {
        console.log('Creating SQLite tables...');
        // Use existing SQLite schema
        const createUsersTable = `
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                email TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                role TEXT DEFAULT 'user',
                subscription_plan TEXT DEFAULT 'free',
                subscription_status TEXT DEFAULT 'active',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `;
        
        await this.query(createUsersTable);
        
        // Create admin user if it doesn't exist
        const adminExists = await this.query('SELECT id FROM users WHERE email = ?', ['admin@vpn.com']);
        if (adminExists.length === 0) {
            const bcrypt = require('bcrypt');
            const hashedPassword = await bcrypt.hash('admin123', 12);
            await this.query(
                'INSERT INTO users (email, password_hash, role) VALUES (?, ?, ?)',
                ['admin@vpn.com', hashedPassword, 'admin']
            );
            console.log('✅ Admin user created');
        }
    }

    /**
     * User authentication methods
     */
    async findUserByEmail(email) {
        const users = await this.query('SELECT * FROM users WHERE email = ?', [email]);
        return users[0] || null;
    }

    async createUser(userData) {
        const { email, password_hash, role = 'user' } = userData;
        
        if (this.isMySQL) {
            await this.query(
                'INSERT INTO users (email, password_hash, role) VALUES (?, ?, ?)',
                [email, password_hash, role]
            );
        } else {
            await this.query(
                'INSERT INTO users (email, password_hash, role) VALUES (?, ?, ?)',
                [email, password_hash, role]
            );
        }
        
        return this.findUserByEmail(email);
    }

    /**
     * Close database connections
     */
    async close() {
        if (this.isMySQL && this.pool) {
            await this.pool.end();
        }
        if (this.sqliteDb) {
            this.sqliteDb.close();
        }
        this.isConnected = false;
    }
}

module.exports = new DatabaseManager();
