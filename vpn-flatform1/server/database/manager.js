/**
 * Enhanced Database Connection Module
 * Provides improved database connections with connection pooling,
 * error handling, migrations, and query optimization
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs').promises;
const crypto = require('crypto');

class DatabaseManager {
    constructor() {
        this.db = null;
        this.dbPath = path.join(__dirname, '../data/vpn_platform.db');
        this.migrationPath = path.join(__dirname, '../migrations');
        this.connectionPool = [];
        this.maxConnections = 10;
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
            await this.ensureDataDirectory();
            await this.connect();
            await this.runMigrations();
            await this.setupTriggers();
            await this.createIndexes();
            
            console.log('✅ Database initialized successfully');
        } catch (error) {
            console.error('❌ Database initialization failed:', error);
            throw error;
        }
    }

    /**
     * Ensure data directory exists
     */
    async ensureDataDirectory() {
        const dataDir = path.dirname(this.dbPath);
        try {
            await fs.access(dataDir);
        } catch {
            await fs.mkdir(dataDir, { recursive: true });
        }
    }

    /**
     * Connect to database with retry logic
     */
    async connect(retries = 3) {
        return new Promise((resolve, reject) => {
            const attemptConnection = (attemptsLeft) => {
                this.db = new sqlite3.Database(this.dbPath, (err) => {
                    if (err) {
                        console.error(`Database connection attempt failed: ${err.message}`);
                        if (attemptsLeft > 0) {
                            console.log(`Retrying connection... (${attemptsLeft} attempts left)`);
                            setTimeout(() => attemptConnection(attemptsLeft - 1), 2000);
                        } else {
                            reject(err);
                        }
                    } else {
                        this.isConnected = true;
                        this.configurePragmas();
                        resolve();
                    }
                });
            };
            
            attemptConnection(retries);
        });
    }

    /**
     * Configure SQLite pragmas for better performance
     */
    configurePragmas() {
        const pragmas = [
            'PRAGMA foreign_keys = ON',
            'PRAGMA journal_mode = WAL',
            'PRAGMA synchronous = NORMAL',
            'PRAGMA cache_size = -2000',
            'PRAGMA temp_store = MEMORY',
            'PRAGMA mmap_size = 268435456' // 256MB
        ];

        pragmas.forEach(pragma => {
            this.db.run(pragma, (err) => {
                if (err) {
                    console.warn(`Failed to set pragma: ${pragma}`, err);
                }
            });
        });
    }

    /**
     * Run database migrations
     */
    async runMigrations() {
        try {
            // Create migrations table if it doesn't exist
            await this.run(`
                CREATE TABLE IF NOT EXISTS migrations (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    filename TEXT UNIQUE NOT NULL,
                    hash TEXT NOT NULL,
                    executed_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            `);

            // Check if migrations directory exists
            try {
                const migrationFiles = await fs.readdir(this.migrationPath);
                const sqlFiles = migrationFiles
                    .filter(file => file.endsWith('.sql'))
                    .sort();

                for (const file of sqlFiles) {
                    await this.runMigration(file);
                }
            } catch (error) {
                if (error.code === 'ENOENT') {
                    console.log('No migrations directory found, creating initial schema...');
                    await this.createInitialSchema();
                } else {
                    throw error;
                }
            }
        } catch (error) {
            console.error('Migration failed:', error);
            throw error;
        }
    }

    /**
     * Run a single migration file
     */
    async runMigration(filename) {
        const filePath = path.join(this.migrationPath, filename);
        const content = await fs.readFile(filePath, 'utf8');
        const hash = crypto.createHash('sha256').update(content).digest('hex');

        // Check if migration was already executed
        const existing = await this.get(
            'SELECT * FROM migrations WHERE filename = ?',
            [filename]
        );

        if (existing) {
            if (existing.hash !== hash) {
                console.warn(`Migration ${filename} has been modified but was already executed`);
            }
            return;
        }

        // Execute migration
        console.log(`Running migration: ${filename}`);
        await this.exec(content);
        
        // Record migration
        await this.run(
            'INSERT INTO migrations (filename, hash) VALUES (?, ?)',
            [filename, hash]
        );
    }

    /**
     * Create initial database schema
     */
    async createInitialSchema() {
        const schema = `
            -- Users table with enhanced security
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                email TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                salt TEXT NOT NULL,
                role TEXT DEFAULT 'user' CHECK (role IN ('admin', 'user', 'moderator')),
                status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended', 'banned')),
                two_factor_enabled BOOLEAN DEFAULT FALSE,
                two_factor_secret TEXT,
                last_login DATETIME,
                last_ip TEXT,
                failed_login_attempts INTEGER DEFAULT 0,
                locked_until DATETIME,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                profile_data TEXT -- JSON field for additional profile information
            );

            -- VPN servers table
            CREATE TABLE IF NOT EXISTS vpn_servers (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                hostname TEXT UNIQUE NOT NULL,
                ip_address TEXT NOT NULL,
                port INTEGER NOT NULL,
                protocol TEXT NOT NULL CHECK (protocol IN ('OpenVPN', 'WireGuard', 'IKEv2', 'L2TP')),
                location TEXT NOT NULL,
                country_code TEXT(2) NOT NULL,
                city TEXT NOT NULL,
                load_percentage REAL DEFAULT 0.0,
                max_connections INTEGER DEFAULT 1000,
                current_connections INTEGER DEFAULT 0,
                status TEXT DEFAULT 'active' CHECK (status IN ('active', 'maintenance', 'offline')),
                features TEXT, -- JSON array of features
                config_data TEXT, -- JSON configuration
                last_ping DATETIME,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );

            -- User connections table
            CREATE TABLE IF NOT EXISTS user_connections (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                server_id INTEGER NOT NULL,
                session_id TEXT UNIQUE NOT NULL,
                start_time DATETIME DEFAULT CURRENT_TIMESTAMP,
                end_time DATETIME,
                bytes_sent INTEGER DEFAULT 0,
                bytes_received INTEGER DEFAULT 0,
                client_ip TEXT,
                assigned_ip TEXT,
                status TEXT DEFAULT 'active' CHECK (status IN ('active', 'disconnected', 'timeout')),
                disconnect_reason TEXT,
                FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
                FOREIGN KEY (server_id) REFERENCES vpn_servers (id) ON DELETE CASCADE
            );

            -- Subscription plans table
            CREATE TABLE IF NOT EXISTS subscription_plans (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                description TEXT,
                price DECIMAL(10,2) NOT NULL,
                currency TEXT(3) DEFAULT 'USD',
                duration_days INTEGER NOT NULL,
                max_devices INTEGER DEFAULT 1,
                bandwidth_limit INTEGER, -- in GB, NULL for unlimited
                features TEXT, -- JSON array
                is_active BOOLEAN DEFAULT TRUE,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );

            -- User subscriptions table
            CREATE TABLE IF NOT EXISTS user_subscriptions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                plan_id INTEGER NOT NULL,
                start_date DATETIME DEFAULT CURRENT_TIMESTAMP,
                end_date DATETIME NOT NULL,
                status TEXT DEFAULT 'active' CHECK (status IN ('active', 'expired', 'cancelled', 'suspended')),
                auto_renew BOOLEAN DEFAULT TRUE,
                payment_method TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
                FOREIGN KEY (plan_id) REFERENCES subscription_plans (id)
            );

            -- Payment transactions table
            CREATE TABLE IF NOT EXISTS payment_transactions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                subscription_id INTEGER,
                transaction_id TEXT UNIQUE NOT NULL,
                amount DECIMAL(10,2) NOT NULL,
                currency TEXT(3) DEFAULT 'USD',
                payment_method TEXT NOT NULL,
                payment_provider TEXT NOT NULL,
                status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'refunded', 'cancelled')),
                provider_response TEXT, -- JSON response from payment provider
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
                FOREIGN KEY (subscription_id) REFERENCES user_subscriptions (id)
            );

            -- System logs table
            CREATE TABLE IF NOT EXISTS system_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                level TEXT NOT NULL CHECK (level IN ('error', 'warn', 'info', 'debug')),
                message TEXT NOT NULL,
                component TEXT NOT NULL,
                user_id INTEGER,
                ip_address TEXT,
                user_agent TEXT,
                additional_data TEXT, -- JSON field
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL
            );

            -- API rate limiting table
            CREATE TABLE IF NOT EXISTS rate_limits (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                identifier TEXT NOT NULL, -- IP address or user ID
                endpoint TEXT NOT NULL,
                requests INTEGER DEFAULT 0,
                window_start DATETIME DEFAULT CURRENT_TIMESTAMP,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );

            -- Security events table
            CREATE TABLE IF NOT EXISTS security_events (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                event_type TEXT NOT NULL,
                severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
                description TEXT NOT NULL,
                user_id INTEGER,
                ip_address TEXT,
                user_agent TEXT,
                blocked BOOLEAN DEFAULT FALSE,
                additional_data TEXT, -- JSON field
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL
            );

            -- Configuration settings table
            CREATE TABLE IF NOT EXISTS config_settings (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                key TEXT UNIQUE NOT NULL,
                value TEXT NOT NULL,
                description TEXT,
                category TEXT NOT NULL,
                is_encrypted BOOLEAN DEFAULT FALSE,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );

            -- Analytics events table
            CREATE TABLE IF NOT EXISTS analytics_events (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                event_name TEXT NOT NULL,
                user_id INTEGER,
                session_id TEXT,
                properties TEXT, -- JSON field
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                ip_address TEXT,
                user_agent TEXT,
                FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL
            );
        `;

        await this.exec(schema);
        
        // Insert default configuration
        await this.insertDefaultConfig();
        
        // Insert default subscription plans
        await this.insertDefaultPlans();
    }

    /**
     * Setup database triggers for automatic timestamps and logging
     */
    async setupTriggers() {
        const triggers = [
            // Update timestamps trigger for users
            `CREATE TRIGGER IF NOT EXISTS update_users_timestamp 
             AFTER UPDATE ON users 
             BEGIN 
                 UPDATE users SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
             END`,
             
            // Update timestamps trigger for vpn_servers
            `CREATE TRIGGER IF NOT EXISTS update_servers_timestamp 
             AFTER UPDATE ON vpn_servers 
             BEGIN 
                 UPDATE vpn_servers SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
             END`,
             
            // Log user creation
            `CREATE TRIGGER IF NOT EXISTS log_user_creation 
             AFTER INSERT ON users 
             BEGIN 
                 INSERT INTO system_logs (level, message, component, user_id)
                 VALUES ('info', 'New user registered: ' || NEW.username, 'auth', NEW.id);
             END`,
             
            // Log connection events
            `CREATE TRIGGER IF NOT EXISTS log_connection_start 
             AFTER INSERT ON user_connections 
             BEGIN 
                 INSERT INTO system_logs (level, message, component, user_id)
                 VALUES ('info', 'VPN connection started', 'connection', NEW.user_id);
             END`,
             
            // Clean up old rate limit entries
            `CREATE TRIGGER IF NOT EXISTS cleanup_rate_limits 
             AFTER INSERT ON rate_limits 
             BEGIN 
                 DELETE FROM rate_limits 
                 WHERE window_start < datetime('now', '-1 hour');
             END`
        ];

        for (const trigger of triggers) {
            await this.run(trigger);
        }
    }

    /**
     * Create database indexes for better performance
     */
    async createIndexes() {
        const indexes = [
            'CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)',
            'CREATE INDEX IF NOT EXISTS idx_users_username ON users(username)',
            'CREATE INDEX IF NOT EXISTS idx_users_status ON users(status)',
            'CREATE INDEX IF NOT EXISTS idx_users_last_login ON users(last_login)',
            'CREATE INDEX IF NOT EXISTS idx_connections_user_id ON user_connections(user_id)',
            'CREATE INDEX IF NOT EXISTS idx_connections_server_id ON user_connections(server_id)',
            'CREATE INDEX IF NOT EXISTS idx_connections_session_id ON user_connections(session_id)',
            'CREATE INDEX IF NOT EXISTS idx_connections_start_time ON user_connections(start_time)',
            'CREATE INDEX IF NOT EXISTS idx_servers_status ON vpn_servers(status)',
            'CREATE INDEX IF NOT EXISTS idx_servers_location ON vpn_servers(location)',
            'CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON user_subscriptions(user_id)',
            'CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON user_subscriptions(status)',
            'CREATE INDEX IF NOT EXISTS idx_subscriptions_end_date ON user_subscriptions(end_date)',
            'CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON payment_transactions(user_id)',
            'CREATE INDEX IF NOT EXISTS idx_transactions_status ON payment_transactions(status)',
            'CREATE INDEX IF NOT EXISTS idx_logs_level ON system_logs(level)',
            'CREATE INDEX IF NOT EXISTS idx_logs_component ON system_logs(component)',
            'CREATE INDEX IF NOT EXISTS idx_logs_created_at ON system_logs(created_at)',
            'CREATE INDEX IF NOT EXISTS idx_rate_limits_identifier ON rate_limits(identifier)',
            'CREATE INDEX IF NOT EXISTS idx_rate_limits_endpoint ON rate_limits(endpoint)',
            'CREATE INDEX IF NOT EXISTS idx_security_events_severity ON security_events(severity)',
            'CREATE INDEX IF NOT EXISTS idx_security_events_created_at ON security_events(created_at)',
            'CREATE INDEX IF NOT EXISTS idx_analytics_event_name ON analytics_events(event_name)',
            'CREATE INDEX IF NOT EXISTS idx_analytics_user_id ON analytics_events(user_id)',
            'CREATE INDEX IF NOT EXISTS idx_analytics_timestamp ON analytics_events(timestamp)'
        ];

        for (const index of indexes) {
            await this.run(index);
        }
    }

    /**
     * Insert default configuration settings
     */
    async insertDefaultConfig() {
        const defaultConfig = [
            ['max_failed_logins', '5', 'Maximum failed login attempts before account lockout', 'security'],
            ['lockout_duration', '30', 'Account lockout duration in minutes', 'security'],
            ['session_timeout', '1440', 'Session timeout in minutes', 'security'],
            ['password_min_length', '8', 'Minimum password length', 'security'],
            ['require_2fa', 'false', 'Require two-factor authentication for all users', 'security'],
            ['max_connections_per_user', '5', 'Maximum simultaneous VPN connections per user', 'limits'],
            ['default_bandwidth_limit', '100', 'Default bandwidth limit in GB per month', 'limits'],
            ['cleanup_logs_days', '30', 'Days to keep system logs', 'maintenance'],
            ['backup_retention_days', '7', 'Days to keep database backups', 'maintenance'],
            ['notification_email', 'admin@example.com', 'Admin notification email', 'notifications'],
            ['smtp_host', '', 'SMTP server hostname', 'email'],
            ['smtp_port', '587', 'SMTP server port', 'email'],
            ['smtp_username', '', 'SMTP username', 'email'],
            ['smtp_password', '', 'SMTP password', 'email'],
            ['payment_webhook_secret', '', 'Payment provider webhook secret', 'payments'],
            ['crypto_payment_enabled', 'false', 'Enable cryptocurrency payments', 'payments']
        ];

        for (const [key, value, description, category] of defaultConfig) {
            await this.run(
                `INSERT OR IGNORE INTO config_settings (key, value, description, category) 
                 VALUES (?, ?, ?, ?)`,
                [key, value, description, category]
            );
        }
    }

    /**
     * Insert default subscription plans
     */
    async insertDefaultPlans() {
        const defaultPlans = [
            {
                name: 'Basic',
                description: 'Perfect for casual users',
                price: 9.99,
                duration_days: 30,
                max_devices: 1,
                bandwidth_limit: 100,
                features: JSON.stringify(['Unlimited bandwidth', 'Basic support', '1 device'])
            },
            {
                name: 'Pro',
                description: 'Great for families and small teams',
                price: 19.99,
                duration_days: 30,
                max_devices: 5,
                bandwidth_limit: null,
                features: JSON.stringify(['Unlimited bandwidth', 'Priority support', '5 devices', 'Advanced features'])
            },
            {
                name: 'Enterprise',
                description: 'For businesses and large teams',
                price: 49.99,
                duration_days: 30,
                max_devices: 25,
                bandwidth_limit: null,
                features: JSON.stringify(['Unlimited bandwidth', '24/7 support', '25 devices', 'Advanced features', 'Dedicated servers'])
            }
        ];

        for (const plan of defaultPlans) {
            await this.run(
                `INSERT OR IGNORE INTO subscription_plans 
                 (name, description, price, duration_days, max_devices, bandwidth_limit, features) 
                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [plan.name, plan.description, plan.price, plan.duration_days, 
                 plan.max_devices, plan.bandwidth_limit, plan.features]
            );
        }
    }

    /**
     * Execute a query and return a promise
     */
    run(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.run(sql, params, function(err) {
                if (err) {
                    console.error('Database run error:', err);
                    reject(err);
                } else {
                    resolve({ id: this.lastID, changes: this.changes });
                }
            });
        });
    }

    /**
     * Get a single row
     */
    get(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.get(sql, params, (err, row) => {
                if (err) {
                    console.error('Database get error:', err);
                    reject(err);
                } else {
                    resolve(row);
                }
            });
        });
    }

    /**
     * Get all matching rows
     */
    all(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.all(sql, params, (err, rows) => {
                if (err) {
                    console.error('Database all error:', err);
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    }

    /**
     * Execute multiple SQL statements
     */
    exec(sql) {
        return new Promise((resolve, reject) => {
            this.db.exec(sql, (err) => {
                if (err) {
                    console.error('Database exec error:', err);
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
    }

    /**
     * Get cached query result or execute and cache
     */
    async getCached(sql, params = [], ttl = 300000) { // 5 minutes default TTL
        const cacheKey = this.generateCacheKey(sql, params);
        const cached = this.queryCache.get(cacheKey);
        
        if (cached && Date.now() - cached.timestamp < ttl) {
            return cached.data;
        }

        const result = await this.all(sql, params);
        
        // Implement cache size limit
        if (this.queryCache.size >= this.cacheMaxSize) {
            const firstKey = this.queryCache.keys().next().value;
            this.queryCache.delete(firstKey);
        }
        
        this.queryCache.set(cacheKey, {
            data: result,
            timestamp: Date.now()
        });

        return result;
    }

    /**
     * Generate cache key for query
     */
    generateCacheKey(sql, params) {
        return crypto.createHash('md5')
            .update(sql + JSON.stringify(params))
            .digest('hex');
    }

    /**
     * Clear query cache
     */
    clearCache() {
        this.queryCache.clear();
    }

    /**
     * Begin transaction
     */
    beginTransaction() {
        return this.run('BEGIN TRANSACTION');
    }

    /**
     * Commit transaction
     */
    commitTransaction() {
        return this.run('COMMIT');
    }

    /**
     * Rollback transaction
     */
    rollbackTransaction() {
        return this.run('ROLLBACK');
    }

    /**
     * Execute queries in a transaction
     */
    async transaction(queries) {
        await this.beginTransaction();
        
        try {
            const results = [];
            for (const query of queries) {
                const result = await this.run(query.sql, query.params);
                results.push(result);
            }
            
            await this.commitTransaction();
            return results;
        } catch (error) {
            await this.rollbackTransaction();
            throw error;
        }
    }

    /**
     * Get database statistics
     */
    async getStats() {
        const queries = [
            { name: 'users', sql: 'SELECT COUNT(*) as count FROM users' },
            { name: 'servers', sql: 'SELECT COUNT(*) as count FROM vpn_servers' },
            { name: 'connections', sql: 'SELECT COUNT(*) as count FROM user_connections WHERE status = "active"' },
            { name: 'subscriptions', sql: 'SELECT COUNT(*) as count FROM user_subscriptions WHERE status = "active"' }
        ];

        const stats = {};
        for (const query of queries) {
            const result = await this.get(query.sql);
            stats[query.name] = result.count;
        }

        return stats;
    }

    /**
     * Optimize database (VACUUM and ANALYZE)
     */
    async optimize() {
        console.log('Optimizing database...');
        await this.exec('VACUUM');
        await this.exec('ANALYZE');
        console.log('Database optimization completed');
    }

    /**
     * Create database backup
     */
    async backup() {
        const backupPath = path.join(
            path.dirname(this.dbPath),
            `backup_${Date.now()}.db`
        );
        
        return new Promise((resolve, reject) => {
            const backup = this.db.backup(backupPath);
            backup.step(-1, (err) => {
                if (err) {
                    reject(err);
                } else {
                    backup.finish((err) => {
                        if (err) {
                            reject(err);
                        } else {
                            console.log(`Database backup created: ${backupPath}`);
                            resolve(backupPath);
                        }
                    });
                }
            });
        });
    }

    /**
     * Close database connection
     */
    close() {
        return new Promise((resolve, reject) => {
            if (this.db) {
                this.db.close((err) => {
                    if (err) {
                        reject(err);
                    } else {
                        this.isConnected = false;
                        resolve();
                    }
                });
            } else {
                resolve();
            }
        });
    }

    /**
     * Health check
     */
    async healthCheck() {
        try {
            await this.get('SELECT 1');
            return { status: 'healthy', connected: this.isConnected };
        } catch (error) {
            return { status: 'unhealthy', error: error.message };
        }
    }
}

// Export singleton instance
module.exports = new DatabaseManager();
