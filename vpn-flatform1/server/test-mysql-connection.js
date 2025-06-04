// Test MySQL connection with XAMPP
const mysql = require('mysql2/promise');

async function testMySQLConnection() {
    console.log('🔍 Testing MySQL Connection with XAMPP...');
    
    const configs = [
        {
            name: 'Default XAMPP (no password)',
            config: {
                host: 'localhost',
                user: 'root',
                password: '',
                port: 3306
            }
        },
        {
            name: 'Alternative localhost',
            config: {
                host: '127.0.0.1',
                user: 'root',
                password: '',
                port: 3306
            }
        },
        {
            name: 'With default password',
            config: {
                host: 'localhost',
                user: 'root',
                password: 'root',
                port: 3306
            }
        }
    ];
    
    for (const testConfig of configs) {
        try {
            console.log(`\n🧪 Testing: ${testConfig.name}`);
            console.log(`   Host: ${testConfig.config.host}:${testConfig.config.port}`);
            console.log(`   User: ${testConfig.config.user}`);
            console.log(`   Password: ${testConfig.config.password ? '***' : '(empty)'}`);
            
            const connection = await mysql.createConnection(testConfig.config);
            await connection.execute('SELECT 1');
            console.log('✅ Connection successful!');
            
            // Try to create database if it doesn't exist
            try {
                await connection.execute('CREATE DATABASE IF NOT EXISTS vpn_platform');
                console.log('✅ Database vpn_platform ready');
            } catch (dbError) {
                console.log('⚠️ Database creation failed:', dbError.message);
            }
            
            await connection.end();
            
            // Update .env file with working config
            console.log('📝 Updating .env file with working configuration...');
            const envContent = `# VPN Platform Environment Configuration

# Server Configuration
PORT=3001
NODE_ENV=development

# Database Configuration - Working MySQL
DB_TYPE=mysql
DB_HOST=${testConfig.config.host}
DB_PORT=${testConfig.config.port}
DB_NAME=vpn_platform
DB_USER=${testConfig.config.user}
DB_PASSWORD=${testConfig.config.password}

# JWT Configuration
JWT_SECRET=your_super_secure_jwt_secret_key_here_change_in_production
JWT_REFRESH_SECRET=your_super_secure_refresh_secret_key_here_change_in_production
JWT_EXPIRE=24h
JWT_REFRESH_EXPIRE=7d

# VPN Configuration
VPN_SERVER_HOST=localhost
VPN_SERVER_PORT=1194
VPN_PROTOCOL=udp

# API Configuration
API_RATE_LIMIT=100
API_TIMEOUT=30000

# Security Configuration
BCRYPT_ROUNDS=12
SESSION_SECRET=your_session_secret_here
CORS_ORIGIN=http://localhost:3001

# Email Configuration (for notifications)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your_email@gmail.com
EMAIL_PASSWORD=your_app_password

# Storage Configuration
UPLOAD_PATH=./uploads
MAX_FILE_SIZE=10485760

# Logging Configuration
LOG_LEVEL=info
LOG_FILE=./logs/app.log

# Backup Configuration
BACKUP_INTERVAL=86400000
BACKUP_PATH=./backups
`;
            
            const fs = require('fs');
            fs.writeFileSync('c:\\xampp\\htdocs\\myapp1\\vpn-flatform1\\server\\.env', envContent);
            console.log('✅ .env file updated successfully!');
            
            return true;
            
        } catch (error) {
            console.log('❌ Connection failed:', error.message);
        }
    }
    
    console.log('\n⚠️ All MySQL connection attempts failed.');
    console.log('💡 Recommendations:');
    console.log('   1. Make sure XAMPP MySQL service is running');
    console.log('   2. Check MySQL port (default 3306)');
    console.log('   3. Verify root user permissions');
    console.log('   4. The application will continue using SQLite as fallback');
    
    return false;
}

testMySQLConnection();
