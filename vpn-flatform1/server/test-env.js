require('dotenv').config();

console.log('Environment variables:');
console.log('DB_HOST:', process.env.DB_HOST);
console.log('DB_PORT:', process.env.DB_PORT);
console.log('DB_USER:', process.env.DB_USER);
console.log('DB_PASSWORD:', process.env.DB_PASSWORD ? '***[SET]***' : '[NOT SET]');
console.log('DB_NAME:', process.env.DB_NAME);

// Test MySQL connection directly
const mysql = require('mysql2/promise');

async function testConnection() {
    try {
        const connection = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            port: process.env.DB_PORT || 3306,
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            database: process.env.DB_NAME || 'vpn_platform'
        });
        
        console.log('✅ MySQL connection successful');
        await connection.end();
    } catch (error) {
        console.error('❌ MySQL connection failed:', error.message);
    }
}

testConnection();
