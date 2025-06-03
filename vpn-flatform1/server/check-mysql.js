const mysql = require('mysql2/promise');
require('dotenv').config();

async function checkMySQLDatabase() {
    console.log('🔍 Checking MySQL database status...');
    
    try {
        const connection = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            port: process.env.DB_PORT || 3306,
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || 'Theara1234#@',
            database: process.env.DB_NAME || 'vpn_platform'
        });
        
        console.log('✅ Connected to MySQL database');
        
        // Check tables
        const [tables] = await connection.execute('SHOW TABLES');
        console.log('📊 Available tables:', tables.map(row => Object.values(row)[0]));
        
        // Check users table
        const [users] = await connection.execute('SELECT id, username, email, role, status FROM users LIMIT 5');
        console.log('👥 Users in database:', users);
        
        // Check if we need to create the admin user with proper password hash
        const [adminCheck] = await connection.execute('SELECT * FROM users WHERE email = ? AND role = ?', ['admin@vpn.com', 'admin']);
        
        if (adminCheck.length === 0) {
            console.log('👤 Creating admin user...');
            const bcrypt = require('bcryptjs');
            const salt = bcrypt.genSaltSync(10);
            const hash = bcrypt.hashSync('admin123', salt);
            
            await connection.execute(`
                INSERT INTO users (username, email, password_hash, salt, role, status, is_verified, is_active) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `, ['admin', 'admin@vpn.com', hash, salt, 'admin', 'active', true, true]);
            
            console.log('✅ Admin user created successfully');
        } else {
            console.log('✅ Admin user already exists');
        }
        
        // Check VPN servers
        const [servers] = await connection.execute('SELECT COUNT(*) as count FROM vpn_servers');
        console.log('🌐 VPN servers:', servers[0].count);
        
        await connection.end();
        console.log('✅ MySQL database check completed');
        
    } catch (error) {
        console.error('❌ Database check failed:', error.message);
    }
}

checkMySQLDatabase();
