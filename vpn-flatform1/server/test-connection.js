require('dotenv').config();
const mysql = require('mysql2/promise');

async function testConnection() {
    try {
        // Try connecting without database first
        const connection = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            port: process.env.DB_PORT || 3306,
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || ''
        });
        
        console.log('✅ MySQL connection successful (without database)');
        
        // Check if database exists
        const [rows] = await connection.execute('SHOW DATABASES LIKE ?', ['vpn_platform']);
        if (rows.length > 0) {
            console.log('✅ Database vpn_platform exists');
            
            // Try to use the database
            await connection.execute('USE vpn_platform');
            console.log('✅ Successfully selected vpn_platform database');
        } else {
            console.log('❌ Database vpn_platform does not exist');
        }
        
        await connection.end();
    } catch (error) {
        console.error('❌ MySQL connection failed:', error.message);
        
        // Try with empty password
        try {
            const connection = await mysql.createConnection({
                host: process.env.DB_HOST || 'localhost',
                port: process.env.DB_PORT || 3306,
                user: process.env.DB_USER || 'root',
                password: ''
            });
            console.log('✅ MySQL connection successful with empty password');
            await connection.end();
        } catch (error2) {
            console.error('❌ MySQL connection with empty password also failed:', error2.message);
        }
    }
}

testConnection();
