const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

// Create database connection
const dbPath = path.join(__dirname, '../vpn_platform.db');
const db = new sqlite3.Database(dbPath);

// Read schema SQL file
const schemaPath = path.join(__dirname, 'schema_sqlite.sql');
const schema = fs.readFileSync(schemaPath, 'utf8');

// Initialize database with tables
function initializeDatabase() {
    return new Promise((resolve, reject) => {
        console.log('Initializing database...');
        
        // Split schema into individual statements
        const statements = schema.split(';').filter(stmt => stmt.trim());
        
        db.serialize(() => {
            statements.forEach((statement, index) => {
                if (statement.trim()) {
                    db.run(statement, (err) => {
                        if (err) {
                            console.error(`Error executing statement ${index + 1}:`, err.message);
                        } else {
                            console.log(`Statement ${index + 1} executed successfully`);
                        }
                    });
                }
            });
            
            // Insert sample admin user
            const adminInsert = `
                INSERT OR IGNORE INTO users (email, password, role, email_verified, created_at) 
                VALUES ('admin@vpn.com', '$2b$10$rXoK1KwQJrq0gQJ9YzQKme8KGZpZBNPGvXQJKrLzKGBrLzKGBrLzKG', 'admin', 1, datetime('now'))
            `;
            
            db.run(adminInsert, (err) => {
                if (err) {
                    console.error('Error creating admin user:', err.message);
                } else {
                    console.log('Admin user created successfully');
                }
                
                db.close((err) => {
                    if (err) {
                        console.error('Error closing database:', err.message);
                        reject(err);
                    } else {
                        console.log('Database initialized successfully!');
                        resolve();
                    }
                });
            });
        });
    });
}

// Run if called directly
if (require.main === module) {
    initializeDatabase()
        .then(() => {
            console.log('Database setup complete!');
            process.exit(0);
        })
        .catch((error) => {
            console.error('Database setup failed:', error);
            process.exit(1);
        });
}

module.exports = { initializeDatabase };
