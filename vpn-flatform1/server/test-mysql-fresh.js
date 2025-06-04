// Force reload database manager and test MySQL connection
console.log('🚀 MySQL Database Manager Fresh Test');
console.log('=' .repeat(50));

// First test environment variables
console.log('🔍 Environment Variables:');
require('dotenv').config();
console.log('DB_HOST:', process.env.DB_HOST);
console.log('DB_USER:', process.env.DB_USER);
console.log('DB_PASSWORD:', process.env.DB_PASSWORD ? '✅ Set' : '❌ Not set');
console.log('DB_NAME:', process.env.DB_NAME);

async function testFreshDatabaseManager() {
    try {
        console.log('\n🔍 Testing fresh database manager instance...');
        
        // Clear require cache to force fresh load
        const modulePath = require.resolve('./database/manager_mysql');
        delete require.cache[modulePath];
        
        // Also clear the hybrid manager cache
        const hybridPath = require.resolve('./database/manager_hybrid');
        delete require.cache[hybridPath];
        
        // Load fresh instance
        const dbManager = require('./database/manager_mysql');
        
        // Wait for initialization
        console.log('⏳ Waiting for database initialization...');
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        console.log('🔍 Database connection status:', dbManager.isConnected);
        
        if (dbManager.isConnected) {
            console.log('✅ MySQL Database Manager connected successfully!');
            
            // Test health check
            const health = await dbManager.healthCheck();
            console.log('✅ Health check passed:', health);
            
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
            
            console.log('🎉 MySQL Database Manager test PASSED!');
            return true;
            
        } else {
            console.log('❌ Database Manager not connected');
            return false;
        }
        
    } catch (error) {
        console.error('❌ Fresh database manager test failed:', error.message);
        return false;
    }
}

async function testHybridManager() {
    try {
        console.log('\n🔍 Testing hybrid manager with MySQL priority...');
        
        // Clear cache
        const hybridPath = require.resolve('./database/manager_hybrid');
        delete require.cache[hybridPath];
        
        const hybridManager = require('./database/manager_hybrid');
        
        // Wait for initialization
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        console.log('🔍 Hybrid manager connection status:', hybridManager.isConnected);
        console.log('🔍 Using database type:', hybridManager.dbType || 'Unknown');
        
        if (hybridManager.isConnected) {
            const health = await hybridManager.healthCheck();
            console.log('✅ Hybrid manager health:', health);
            
            return true;
        }
        
        return false;
        
    } catch (error) {
        console.error('❌ Hybrid manager test failed:', error.message);
        return false;
    }
}

async function runTests() {
    const mysqlResult = await testFreshDatabaseManager();
    const hybridResult = await testHybridManager();
    
    console.log('\n' + '='.repeat(50));
    console.log('📊 Final Results:');
    console.log('MySQL Manager:', mysqlResult ? '✅ PASSED' : '❌ FAILED');
    console.log('Hybrid Manager:', hybridResult ? '✅ PASSED' : '❌ FAILED');
    console.log('=' .repeat(50));
}

runTests().catch(console.error);
