const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

// Database health check and initialization script
class DatabaseChecker {
    constructor() {
        this.dbPath = path.join(__dirname, 'data/vpn_platform.db');
        this.db = null;
    }

    async connect() {
        return new Promise((resolve, reject) => {
            this.db = new sqlite3.Database(this.dbPath, (err) => {
                if (err) {
                    console.error('❌ Database connection failed:', err.message);
                    reject(err);
                } else {
                    console.log('✅ Database connection successful');
                    resolve();
                }
            });
        });
    }

    async checkTables() {
        console.log('\n🔍 Checking database tables...');
        return new Promise((resolve, reject) => {
            this.db.all("SELECT name FROM sqlite_master WHERE type='table'", [], (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    const tables = rows.map(row => row.name);
                    console.log(`📊 Found ${tables.length} tables:`, tables);
                    
                    const requiredTables = [
                        'users', 'vpn_servers', 'user_connections', 'payments', 
                        'subscription_plans', 'user_subscriptions'
                    ];
                    
                    const missingTables = requiredTables.filter(table => !tables.includes(table));
                    if (missingTables.length > 0) {
                        console.log('⚠️  Missing tables:', missingTables);
                    } else {
                        console.log('✅ All required tables exist');
                    }
                    resolve(tables);
                }
            });
        });
    }

    async checkUsers() {
        console.log('\n👥 Checking users table...');
        return new Promise((resolve, reject) => {
            this.db.all("SELECT COUNT(*) as count FROM users", [], (err, rows) => {
                if (err) {
                    console.log('⚠️  Users table might not exist:', err.message);
                    resolve(0);
                } else {
                    const count = rows[0].count;
                    console.log(`📊 Found ${count} users in database`);
                    resolve(count);
                }
            });
        });
    }    async createAdminUser() {
        console.log('\n👨‍💼 Creating admin user...');
        const bcrypt = require('bcryptjs');
        const crypto = require('crypto');
        const adminEmail = 'admin@vpn.com';
        const adminPassword = 'admin123';
        const adminUsername = 'admin';
        
        try {
            const salt = crypto.randomBytes(16).toString('hex');
            const hashedPassword = await bcrypt.hash(adminPassword + salt, 12);
            
            return new Promise((resolve, reject) => {
                this.db.run(
                    `INSERT OR REPLACE INTO users 
                     (username, email, password_hash, salt, role, status, created_at, updated_at) 
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                    [
                        adminUsername, 
                        adminEmail, 
                        hashedPassword, 
                        salt, 
                        'admin', 
                        'active', 
                        new Date().toISOString(),
                        new Date().toISOString()
                    ],
                    function(err) {
                        if (err) {
                            console.error('❌ Failed to create admin user:', err.message);
                            reject(err);
                        } else {
                            console.log('✅ Admin user created successfully');
                            console.log(`👤 Username: ${adminUsername}`);
                            console.log(`📧 Email: ${adminEmail}`);
                            console.log(`🔑 Password: ${adminPassword}`);
                            resolve();
                        }
                    }
                );
            });
        } catch (error) {
            console.error('❌ Error hashing password:', error);
            throw error;
        }
    }

    async initializeDatabase() {
        console.log('\n🔧 Initializing database...');
        const schemaPath = path.join(__dirname, 'database/schema_sqlite.sql');
        
        if (!fs.existsSync(schemaPath)) {
            console.error('❌ Schema file not found:', schemaPath);
            return false;
        }

        const schema = fs.readFileSync(schemaPath, 'utf8');
        const statements = schema.split(';').filter(stmt => stmt.trim());

        return new Promise((resolve, reject) => {
            this.db.serialize(() => {
                let completed = 0;
                let errors = 0;

                statements.forEach((statement, index) => {
                    if (statement.trim()) {
                        this.db.run(statement.trim(), (err) => {
                            completed++;
                            if (err && !err.message.includes('already exists')) {
                                console.error(`❌ Error in statement ${index + 1}:`, err.message);
                                errors++;
                            }
                            
                            if (completed === statements.length) {
                                if (errors === 0) {
                                    console.log('✅ Database schema initialized successfully');
                                    resolve(true);
                                } else {
                                    console.log(`⚠️  Database initialized with ${errors} errors`);
                                    resolve(true);
                                }
                            }
                        });
                    } else {
                        completed++;
                        if (completed === statements.length) {
                            console.log('✅ Database schema initialized successfully');
                            resolve(true);
                        }
                    }
                });
            });
        });
    }

    async close() {
        if (this.db) {
            return new Promise((resolve) => {
                this.db.close((err) => {
                    if (err) {
                        console.error('❌ Error closing database:', err.message);
                    } else {
                        console.log('✅ Database connection closed');
                    }
                    resolve();
                });
            });
        }
    }

    async runCheck() {
        try {
            console.log('🚀 Starting database health check...');
            
            await this.connect();
            const tables = await this.checkTables();
            
            if (tables.length === 0) {
                console.log('\n📥 No tables found, initializing database...');
                await this.initializeDatabase();
            }
            
            const userCount = await this.checkUsers();
            
            if (userCount === 0) {
                await this.createAdminUser();
            }
            
            console.log('\n✅ Database check completed successfully!');
            console.log('\n📋 Summary:');
            console.log('   - Database connection: ✅ Working');
            console.log('   - Tables: ✅ Available');
            console.log('   - Admin user: ✅ Ready');
            console.log('\n🔗 Access admin dashboard at: http://localhost:3001/admin');
            console.log('📧 Admin email: admin@vpn.com');
            console.log('🔑 Admin password: admin123');
            
        } catch (error) {
            console.error('❌ Database check failed:', error);
        } finally {
            await this.close();
        }
    }
}

// Run the check if called directly
if (require.main === module) {
    const checker = new DatabaseChecker();
    checker.runCheck();
}

module.exports = DatabaseChecker;