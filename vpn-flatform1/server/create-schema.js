const mysql = require('mysql2/promise');
const fs = require('fs').promises;
const path = require('path');
require('dotenv').config();

async function createSchema() {
    console.log('🔍 Creating MySQL database schema...');
    
    try {
        // Connect to the database
        const connection = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            port: process.env.DB_PORT || 3306,
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || 'Theara1234#@',
            database: process.env.DB_NAME || 'vpn_platform',
            multipleStatements: true
        });
        
        console.log('✅ Connected to MySQL database');
        
        // Read the schema file
        const schemaPath = path.join(__dirname, 'database', 'schema_mysql.sql');
        const schema = await fs.readFile(schemaPath, 'utf8');
        
        console.log('📄 Schema file loaded');
        
        // Split schema into individual statements
        const statements = schema.split(';').filter(stmt => stmt.trim().length > 0);
        
        console.log(`📊 Executing ${statements.length} SQL statements...`);
        
        // Execute each statement
        for (let i = 0; i < statements.length; i++) {
            const statement = statements[i].trim();
            if (statement) {
                try {
                    await connection.execute(statement);
                    console.log(`✅ Statement ${i + 1}/${statements.length} executed`);
                } catch (error) {
                    if (!error.message.includes('already exists')) {
                        console.error(`❌ Error in statement ${i + 1}:`, error.message);
                    }
                }
            }
        }
        
        console.log('✅ Database schema created successfully');
        
        // Verify tables were created
        const [tables] = await connection.execute('SHOW TABLES');
        console.log('📊 Created tables:', tables.map(row => Object.values(row)[0]));
        
        // Check if admin user exists
        const [users] = await connection.execute('SELECT COUNT(*) as count FROM users WHERE role = "admin"');
        console.log('👤 Admin users:', users[0].count);
        
        await connection.end();
        return true;
    } catch (error) {
        console.error('❌ Schema creation failed:', error.message);
        return false;
    }
}

// Run the schema creation
createSchema();
