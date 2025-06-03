const mysql = require('mysql2/promise');
require('dotenv').config();

async function testMySQLConnection() {
    console.log('🔍 Testing MySQL connection...');
    
    try {
        // First test connection without database
        const connection = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            port: process.env.DB_PORT || 3306,
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || 'Theara1234#@'
        });
        
        console.log('✅ MySQL server connection successful');
          // Check if database exists
        const [databases] = await connection.execute(`SHOW DATABASES LIKE '${process.env.DB_NAME || 'vpn_platform'}'`);
        
        if (databases.length === 0) {
            console.log('📊 Creating database...');
            await connection.execute(`CREATE DATABASE \`${process.env.DB_NAME || 'vpn_platform'}\``);
            console.log('✅ Database created successfully');
        } else {
            console.log('✅ Database already exists');
        }
        
        await connection.end();
        
        // Test connection with database
        const dbConnection = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            port: process.env.DB_PORT || 3306,
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || 'Theara1234#@',
            database: process.env.DB_NAME || 'vpn_platform'
        });
        
        console.log('✅ Database connection successful');
        
        // Test a simple query
        const [result] = await dbConnection.execute('SELECT 1 as test');
        console.log('✅ Query test successful:', result);
        
        await dbConnection.end();
        console.log('✅ MySQL connection test completed successfully');
        
        return true;
    } catch (error) {
        console.error('❌ MySQL connection test failed:', error.message);
        return false;
    }
}

// Run the test
testMySQLConnection();