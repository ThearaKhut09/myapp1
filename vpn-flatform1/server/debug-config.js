// Debug MySQL configuration values
require('dotenv').config();

console.log('🔍 Environment Debug:');
console.log('DB_HOST from env:', process.env.DB_HOST);
console.log('DB_USER from env:', process.env.DB_USER);
console.log('DB_PASSWORD from env:', process.env.DB_PASSWORD ? '***SET***' : 'NOT SET');
console.log('DB_NAME from env:', process.env.DB_NAME);

console.log('\n🔍 Fallback values:');
console.log('Host will be:', process.env.DB_HOST || '127.0.0.1');
console.log('User will be:', process.env.DB_USER || 'root');
console.log('Password will be:', process.env.DB_PASSWORD || 'Theara1234#@');
console.log('Database will be:', process.env.DB_NAME || 'vpn_platform');

// Test direct connection with these exact values
const mysql = require('mysql2/promise');

async function testDirectConnection() {
    console.log('\n🔍 Testing direct connection with resolved values...');
    
    const config = {
        host: process.env.DB_HOST || '127.0.0.1',
        port: process.env.DB_PORT || 3306,
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || 'Theara1234#@',
        database: process.env.DB_NAME || 'vpn_platform'
    };
    
    console.log('Config being used:', {
        host: config.host,
        port: config.port,
        user: config.user,
        password: config.password ? '***SET***' : 'NOT SET',
        database: config.database
    });
    
    try {
        const connection = await mysql.createConnection(config);
        console.log('✅ Direct connection successful!');
        await connection.end();
        return true;
    } catch (error) {
        console.error('❌ Direct connection failed:', error.message);
        return false;
    }
}

testDirectConnection().catch(console.error);
