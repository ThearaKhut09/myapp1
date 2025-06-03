const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'data/vpn_platform.db');
const db = new sqlite3.Database(dbPath);

console.log('🔍 Checking users table structure...');

db.all("PRAGMA table_info(users)", [], (err, rows) => {
    if (err) {
        console.error('❌ Error:', err.message);
    } else {
        console.log('\n📊 Users table columns:');
        rows.forEach(row => {
            console.log(`  - ${row.name} (${row.type})`);
        });
    }
    
    db.close();
});
