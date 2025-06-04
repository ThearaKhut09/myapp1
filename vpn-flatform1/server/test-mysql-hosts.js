// Test different MySQL host configurations
const mysql = require('mysql2/promise');

async function testDifferentHosts() {
    console.log('🔍 Testing different MySQL host configurations...');
    
    const configs = [
        { host: 'localhost', name: 'localhost' },
        { host: '127.0.0.1', name: '127.0.0.1' },
        { host: '::1', name: 'IPv6 localhost' }
    ];
    
    for (const config of configs) {
        try {
            console.log(`\n📡 Testing ${config.name}...`);
            
            const connection = await mysql.createConnection({
                host: config.host,
                port: 3306,
                user: 'root',
                password: 'Theara1234#@'
            });
            
            console.log(`✅ ${config.name} connection successful!`);
            
            // Test query
            const [rows] = await connection.query('SELECT 1 as test');
            console.log(`✅ Query test passed for ${config.name}`);
            
            await connection.end();
            
        } catch (error) {
            console.error(`❌ ${config.name} failed:`, error.message);
        }
    }
}

async function testXAMPPStatus() {
    console.log('\n🔍 Testing XAMPP MySQL status...');
    
    try {
        // Try to get MySQL version
        const connection = await mysql.createConnection({
            host: 'localhost',
            port: 3306,
            user: 'root',
            password: 'Theara1234#@'
        });
        
        const [rows] = await connection.query('SELECT VERSION() as version');
        console.log('✅ MySQL Version:', rows[0].version);
        
        // Test user permissions
        const [users] = await connection.query('SELECT user, host FROM mysql.user WHERE user = "root"');
        console.log('✅ Root user hosts:', users);
        
        await connection.end();
        
    } catch (error) {
        console.error('❌ XAMPP MySQL test failed:', error.message);
    }
}

async function runTests() {
    console.log('🚀 MySQL Host Configuration Test');
    console.log('=' .repeat(50));
    
    await testDifferentHosts();
    await testXAMPPStatus();
    
    console.log('\n' + '='.repeat(50));
    console.log('🎉 Host configuration test completed!');
}

runTests().catch(console.error);
