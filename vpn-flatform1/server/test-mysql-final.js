// Test MySQL connection with correct credentials
const mysql = require('mysql2/promise');

async function testMySQLConnection() {
    console.log('🔍 Testing MySQL Connection with provided credentials...');
    
    try {
        // Test connection
        const connection = await mysql.createConnection({
            host: 'localhost',
            port: 3306,
            user: 'root',
            password: 'Theara1234#@'
        });
        
        console.log('✅ MySQL connection successful!');
        
        // Test database creation
        await connection.execute('CREATE DATABASE IF NOT EXISTS vpn_platform');
        console.log('✅ Database vpn_platform created/verified');
          // Test database selection  
        await connection.query('USE vpn_platform');
        console.log('✅ Database vpn_platform selected');
        
        // Test basic query
        const [rows] = await connection.query('SELECT 1 as test');
        console.log('✅ Basic query test passed:', rows[0]);
        
        await connection.end();
        console.log('✅ Connection closed properly');
        
        return true;
    } catch (error) {
        console.error('❌ MySQL connection failed:', error.message);
        return false;
    }
}

// Test the database manager
async function testDatabaseManager() {
    console.log('\n🔍 Testing Database Manager with MySQL...');
    
    try {
        const dbManager = require('./database/manager_mysql');
        
        // Wait a moment for initialization
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        if (dbManager.isConnected) {
            console.log('✅ Database Manager connected successfully');
            
            // Test health check
            const health = await dbManager.healthCheck();
            console.log('✅ Health check:', health);
            
            // Test admin user
            const admin = await dbManager.getUserByEmail('admin@vpn.com');
            if (admin) {
                console.log('✅ Admin user found:', {
                    id: admin.id,
                    username: admin.username,
                    email: admin.email,
                    role: admin.role
                });
            } else {
                console.log('⚠️ Admin user not found');
            }
            
        } else {
            console.log('❌ Database Manager not connected');
        }
    } catch (error) {
        console.error('❌ Database Manager test failed:', error.message);
    }
}

async function runTests() {
    console.log('🚀 MySQL Final Connection Test');
    console.log('=' .repeat(50));
    
    const mysqlWorking = await testMySQLConnection();
    
    if (mysqlWorking) {
        await testDatabaseManager();
    }
    
    console.log('\n' + '='.repeat(50));
    console.log('🎉 MySQL test completed!');
}

runTests().catch(console.error);
