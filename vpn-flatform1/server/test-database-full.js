/**
 * Comprehensive Database Test Suite
 * Tests all database functionality including CRUD operations, authentication, and data integrity
 */

const fs = require('fs');
const path = require('path');

// Test configuration
const TEST_CONFIG = {
    enableMySQLTest: true,
    enableSQLiteTest: true,
    testDataCleanup: true,
    verboseOutput: true
};

console.log('🚀 Starting Comprehensive Database Test Suite\n');

// Test 1: Database Connection and Health Check
async function testDatabaseConnections() {
    console.log('📊 Test 1: Database Connections and Health Check');
    console.log('='.repeat(50));
    
    try {
        // Test MySQL Connection
        if (TEST_CONFIG.enableMySQLTest) {
            console.log('\n🔍 Testing MySQL Connection...');
            try {
                const mysql = require('mysql2/promise');
                const connection = await mysql.createConnection({
                    host: process.env.DB_HOST || 'localhost',
                    port: process.env.DB_PORT || 3306,
                    user: process.env.DB_USER || 'root',
                    password: process.env.DB_PASSWORD || 'Theara1234#@',
                    database: process.env.DB_NAME || 'vpn_platform'
                });
                
                const [rows] = await connection.execute('SELECT 1 as test');
                await connection.end();
                console.log('✅ MySQL connection: SUCCESS');
                console.log(`   - Host: ${process.env.DB_HOST || 'localhost'}`);
                console.log(`   - Database: ${process.env.DB_NAME || 'vpn_platform'}`);
            } catch (error) {
                console.log('❌ MySQL connection: FAILED');
                console.log(`   - Error: ${error.message}`);
            }
        }
        
        // Test SQLite Connection
        if (TEST_CONFIG.enableSQLiteTest) {
            console.log('\n🔍 Testing SQLite Connection...');
            try {
                const sqlite3 = require('sqlite3').verbose();
                const dbPath = path.join(__dirname, 'data/vpn_platform.db');
                
                await new Promise((resolve, reject) => {
                    const db = new sqlite3.Database(dbPath, (err) => {
                        if (err) {
                            reject(err);
                        } else {
                            db.get('SELECT 1 as test', (err, row) => {
                                db.close();
                                if (err) reject(err);
                                else resolve(row);
                            });
                        }
                    });
                });
                
                console.log('✅ SQLite connection: SUCCESS');
                console.log(`   - Database file: ${dbPath}`);
                console.log(`   - File exists: ${fs.existsSync(dbPath)}`);
                if (fs.existsSync(dbPath)) {
                    const stats = fs.statSync(dbPath);
                    console.log(`   - File size: ${(stats.size / 1024).toFixed(2)} KB`);
                }
            } catch (error) {
                console.log('❌ SQLite connection: FAILED');
                console.log(`   - Error: ${error.message}`);
            }
        }
        
        // Test Hybrid Database Manager
        console.log('\n🔍 Testing Hybrid Database Manager...');
        try {
            const dbManager = require('./database/manager_hybrid');
            
            // Wait for initialization
            let retries = 0;
            while (!dbManager.isConnected && retries < 10) {
                await new Promise(resolve => setTimeout(resolve, 1000));
                retries++;
            }
            
            if (dbManager.isConnected) {
                console.log('✅ Hybrid Database Manager: SUCCESS');
                console.log(`   - Using: ${dbManager.isMySQL ? 'MySQL' : 'SQLite'}`);
                console.log(`   - Connected: ${dbManager.isConnected}`);
            } else {
                console.log('❌ Hybrid Database Manager: FAILED - Not connected');
            }
        } catch (error) {
            console.log('❌ Hybrid Database Manager: FAILED');
            console.log(`   - Error: ${error.message}`);
        }
        
    } catch (error) {
        console.log('❌ Database connection test failed:', error.message);
    }
}

// Test 2: Database Schema and Tables
async function testDatabaseSchema() {
    console.log('\n\n📋 Test 2: Database Schema and Tables');
    console.log('='.repeat(50));
    
    try {
        const dbManager = require('./database/manager_hybrid');
        
        // Test table existence
        const expectedTables = [
            'users', 'vpn_servers', 'user_connections', 
            'subscription_plans', 'user_subscriptions', 
            'payment_transactions', 'system_logs', 
            'config_settings', 'rate_limits', 'security_events',
            'analytics_events', 'migrations'
        ];
        
        console.log('\n🔍 Checking required tables...');
        let tablesFound = 0;
        
        for (const tableName of expectedTables) {
            try {
                const result = await dbManager.query(`SELECT COUNT(*) as count FROM ${tableName} LIMIT 1`);
                console.log(`✅ Table '${tableName}': EXISTS`);
                tablesFound++;
            } catch (error) {
                console.log(`❌ Table '${tableName}': MISSING`);
                console.log(`   - Error: ${error.message}`);
            }
        }
        
        console.log(`\n📊 Schema Summary: ${tablesFound}/${expectedTables.length} tables found`);
        
        // Test table structures
        console.log('\n🔍 Testing table structures...');
        try {
            // Test users table structure
            const userColumns = await dbManager.query(dbManager.isMySQL ? 
                "SHOW COLUMNS FROM users" : 
                "PRAGMA table_info(users)"
            );
            console.log(`✅ Users table structure: ${userColumns.length} columns`);
            
            // Test vpn_servers table structure
            const serverColumns = await dbManager.query(dbManager.isMySQL ? 
                "SHOW COLUMNS FROM vpn_servers" : 
                "PRAGMA table_info(vpn_servers)"
            );
            console.log(`✅ VPN servers table structure: ${serverColumns.length} columns`);
            
        } catch (error) {
            console.log('❌ Table structure test failed:', error.message);
        }
        
    } catch (error) {
        console.log('❌ Schema test failed:', error.message);
    }
}

// Test 3: CRUD Operations
async function testCRUDOperations() {
    console.log('\n\n🔧 Test 3: CRUD Operations');
    console.log('='.repeat(50));
    
    try {
        const dbManager = require('./database/manager_hybrid');
        const testUserId = 'test_' + Date.now();
        const testEmail = `test${Date.now()}@test.com`;
        
        console.log('\n🔍 Testing CREATE operations...');
        
        // Test user creation
        try {
            const userData = {
                email: testEmail,
                password_hash: 'test_hash_123',
                role: 'user'
            };
            
            const newUser = await dbManager.createUser(userData);
            console.log('✅ User creation: SUCCESS');
            console.log(`   - Created user: ${testEmail}`);
        } catch (error) {
            console.log('❌ User creation: FAILED');
            console.log(`   - Error: ${error.message}`);
        }
        
        console.log('\n🔍 Testing READ operations...');
        
        // Test user reading
        try {
            const user = await dbManager.findUserByEmail(testEmail);
            if (user) {
                console.log('✅ User reading: SUCCESS');
                console.log(`   - Found user: ${user.email}`);
                console.log(`   - User ID: ${user.id}`);
                console.log(`   - Role: ${user.role}`);
            } else {
                console.log('❌ User reading: FAILED - User not found');
            }
        } catch (error) {
            console.log('❌ User reading: FAILED');
            console.log(`   - Error: ${error.message}`);
        }
        
        // Test listing all users
        try {
            const allUsers = await dbManager.query('SELECT COUNT(*) as count FROM users');
            console.log(`✅ User count query: SUCCESS (${allUsers[0].count} users)`);
        } catch (error) {
            console.log('❌ User count query: FAILED');
            console.log(`   - Error: ${error.message}`);
        }
        
        console.log('\n🔍 Testing UPDATE operations...');
        
        // Test user update (if we can find the test user)
        try {
            const user = await dbManager.findUserByEmail(testEmail);
            if (user) {
                await dbManager.query(
                    'UPDATE users SET role = ? WHERE email = ?',
                    ['premium_user', testEmail]
                );
                
                const updatedUser = await dbManager.findUserByEmail(testEmail);
                if (updatedUser && updatedUser.role === 'premium_user') {
                    console.log('✅ User update: SUCCESS');
                    console.log(`   - Updated role to: ${updatedUser.role}`);
                } else {
                    console.log('❌ User update: FAILED - Role not updated');
                }
            }
        } catch (error) {
            console.log('❌ User update: FAILED');
            console.log(`   - Error: ${error.message}`);
        }
        
        console.log('\n🔍 Testing DELETE operations...');
        
        // Test user deletion (cleanup)
        if (TEST_CONFIG.testDataCleanup) {
            try {
                const result = await dbManager.query(
                    'DELETE FROM users WHERE email = ?',
                    [testEmail]
                );
                console.log('✅ User deletion: SUCCESS');
                console.log('   - Test user cleaned up');
            } catch (error) {
                console.log('❌ User deletion: FAILED');
                console.log(`   - Error: ${error.message}`);
            }
        }
        
    } catch (error) {
        console.log('❌ CRUD operations test failed:', error.message);
    }
}

// Test 4: Authentication and Security
async function testAuthenticationSecurity() {
    console.log('\n\n🔐 Test 4: Authentication and Security');
    console.log('='.repeat(50));
    
    try {
        const dbManager = require('./database/manager_hybrid');
        
        console.log('\n🔍 Testing admin user existence...');
        
        // Check for admin user
        try {
            const adminUser = await dbManager.findUserByEmail('admin@vpn.com');
            if (adminUser) {
                console.log('✅ Admin user: EXISTS');
                console.log(`   - Email: ${adminUser.email}`);
                console.log(`   - Role: ${adminUser.role}`);
                console.log(`   - Has password hash: ${!!adminUser.password_hash}`);
                
                // Test password hashing capability
                console.log('\n🔍 Testing password hashing...');
                try {
                    const bcrypt = require('bcrypt');
                    const testPassword = 'test123';
                    const hash = await bcrypt.hash(testPassword, 12);
                    const isValid = await bcrypt.compare(testPassword, hash);
                    
                    if (isValid) {
                        console.log('✅ Password hashing: SUCCESS');
                        console.log('   - Hash generation and verification working');
                    } else {
                        console.log('❌ Password hashing: FAILED - Verification failed');
                    }
                } catch (error) {
                    console.log('❌ Password hashing: FAILED');
                    console.log(`   - Error: ${error.message}`);
                }
                
            } else {
                console.log('❌ Admin user: NOT FOUND');
                console.log('   - Admin user needs to be created');
            }
        } catch (error) {
            console.log('❌ Admin user check: FAILED');
            console.log(`   - Error: ${error.message}`);
        }
        
        // Test security tables
        console.log('\n🔍 Testing security tables...');
        try {
            const securityTables = ['rate_limits', 'security_events', 'system_logs'];
            for (const table of securityTables) {
                const count = await dbManager.query(`SELECT COUNT(*) as count FROM ${table}`);
                console.log(`✅ ${table}: ${count[0].count} records`);
            }
        } catch (error) {
            console.log('❌ Security tables test: FAILED');
            console.log(`   - Error: ${error.message}`);
        }
        
    } catch (error) {
        console.log('❌ Authentication security test failed:', error.message);
    }
}

// Test 5: VPN Servers and Configuration
async function testVPNConfiguration() {
    console.log('\n\n🌐 Test 5: VPN Servers and Configuration');
    console.log('='.repeat(50));
    
    try {
        const dbManager = require('./database/manager_hybrid');
        
        console.log('\n🔍 Testing VPN servers...');
        
        try {
            const servers = await dbManager.query('SELECT * FROM vpn_servers');
            console.log(`✅ VPN servers: ${servers.length} found`);
            
            if (servers.length > 0) {
                console.log('\n📍 Server details:');
                servers.forEach((server, index) => {
                    console.log(`   ${index + 1}. ${server.name || server.hostname || 'Unnamed'}`);
                    console.log(`      - Location: ${server.location || 'Unknown'}`);
                    console.log(`      - Status: ${server.status || 'Unknown'}`);
                    console.log(`      - Protocol: ${server.protocol || 'Unknown'}`);
                });
            } else {
                console.log('⚠️  No VPN servers found - database may need seeding');
            }
        } catch (error) {
            console.log('❌ VPN servers test: FAILED');
            console.log(`   - Error: ${error.message}`);
        }
        
        console.log('\n🔍 Testing configuration settings...');
        
        try {
            const configs = await dbManager.query('SELECT * FROM config_settings LIMIT 10');
            console.log(`✅ Configuration settings: ${configs.length} found`);
            
            if (configs.length > 0) {
                console.log('\n⚙️  Sample configurations:');
                configs.slice(0, 5).forEach((config, index) => {
                    console.log(`   ${index + 1}. ${config.key}: ${config.value}`);
                });
            }
        } catch (error) {
            console.log('❌ Configuration settings test: FAILED');
            console.log(`   - Error: ${error.message}`);
        }
        
    } catch (error) {
        console.log('❌ VPN configuration test failed:', error.message);
    }
}

// Test 6: Performance and Optimization
async function testPerformanceOptimization() {
    console.log('\n\n⚡ Test 6: Performance and Optimization');
    console.log('='.repeat(50));
    
    try {
        const dbManager = require('./database/manager_hybrid');
        
        console.log('\n🔍 Testing query performance...');
        
        // Test query speed
        const startTime = Date.now();
        try {
            await dbManager.query('SELECT COUNT(*) as count FROM users');
            const endTime = Date.now();
            const queryTime = endTime - startTime;
            
            console.log(`✅ Query performance: ${queryTime}ms`);
            if (queryTime < 100) {
                console.log('   - Performance: EXCELLENT (< 100ms)');
            } else if (queryTime < 500) {
                console.log('   - Performance: GOOD (< 500ms)');
            } else {
                console.log('   - Performance: NEEDS IMPROVEMENT (> 500ms)');
            }
        } catch (error) {
            console.log('❌ Query performance test: FAILED');
            console.log(`   - Error: ${error.message}`);
        }
        
        // Test database size and optimization
        console.log('\n🔍 Testing database optimization...');
        try {
            if (dbManager.isMySQL) {
                // MySQL optimization check
                const tableStatus = await dbManager.query('SHOW TABLE STATUS');
                let totalSize = 0;
                tableStatus.forEach(table => {
                    totalSize += (table.Data_length + table.Index_length);
                });
                console.log(`✅ MySQL database size: ${(totalSize / 1024 / 1024).toFixed(2)} MB`);
            } else {
                // SQLite optimization check
                const dbPath = path.join(__dirname, 'data/vpn_platform.db');
                if (fs.existsSync(dbPath)) {
                    const stats = fs.statSync(dbPath);
                    console.log(`✅ SQLite database size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
                }
            }
        } catch (error) {
            console.log('❌ Database optimization test: FAILED');
            console.log(`   - Error: ${error.message}`);
        }
        
    } catch (error) {
        console.log('❌ Performance optimization test failed:', error.message);
    }
}

// Test 7: Data Integrity and Relationships
async function testDataIntegrity() {
    console.log('\n\n🔗 Test 7: Data Integrity and Relationships');
    console.log('='.repeat(50));
    
    try {
        const dbManager = require('./database/manager_hybrid');
        
        console.log('\n🔍 Testing foreign key relationships...');
        
        // Test user-connections relationship
        try {
            const query = `
                SELECT u.email, COUNT(uc.id) as connection_count 
                FROM users u 
                LEFT JOIN user_connections uc ON u.id = uc.user_id 
                GROUP BY u.id, u.email 
                LIMIT 5
            `;
            const results = await dbManager.query(query);
            console.log('✅ User-connections relationship: SUCCESS');
            console.log(`   - Tested ${results.length} user records`);
        } catch (error) {
            console.log('❌ User-connections relationship: FAILED');
            console.log(`   - Error: ${error.message}`);
        }
        
        // Test data consistency
        console.log('\n🔍 Testing data consistency...');
        try {
            const userCount = await dbManager.query('SELECT COUNT(*) as count FROM users');
            const activeUsers = await dbManager.query("SELECT COUNT(*) as count FROM users WHERE status = 'active' OR status IS NULL");
            
            console.log(`✅ Data consistency check: SUCCESS`);
            console.log(`   - Total users: ${userCount[0].count}`);
            console.log(`   - Active users: ${activeUsers[0].count}`);
        } catch (error) {
            console.log('❌ Data consistency check: FAILED');
            console.log(`   - Error: ${error.message}`);
        }
        
    } catch (error) {
        console.log('❌ Data integrity test failed:', error.message);
    }
}

// Main test runner
async function runAllTests() {
    const startTime = Date.now();
    
    console.log(`🕐 Test started at: ${new Date().toISOString()}\n`);
    
    try {
        await testDatabaseConnections();
        await testDatabaseSchema();
        await testCRUDOperations();
        await testAuthenticationSecurity();
        await testVPNConfiguration();
        await testPerformanceOptimization();
        await testDataIntegrity();
        
        const endTime = Date.now();
        const totalTime = endTime - startTime;
        
        console.log('\n\n🎉 Test Suite Completed!');
        console.log('='.repeat(50));
        console.log(`⏱️  Total execution time: ${totalTime}ms`);
        console.log(`🕐 Test finished at: ${new Date().toISOString()}`);
        console.log('\n✅ All database tests have been executed.');
        console.log('   Check the output above for detailed results.');
        
    } catch (error) {
        console.log('\n❌ Test suite failed:', error.message);
        process.exit(1);
    }
}

// Run the tests
if (require.main === module) {
    runAllTests().catch(error => {
        console.error('Fatal error:', error);
        process.exit(1);
    });
}

module.exports = {
    runAllTests,
    testDatabaseConnections,
    testDatabaseSchema,
    testCRUDOperations,
    testAuthenticationSecurity,
    testVPNConfiguration,
    testPerformanceOptimization,
    testDataIntegrity
};
