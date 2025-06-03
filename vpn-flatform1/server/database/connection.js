const sqlite3 = require('sqlite3').verbose();
const path = require('path');

class Database {
    constructor() {
        const dbPath = path.join(__dirname, '../vpn_platform.db');
        this.db = new sqlite3.Database(dbPath, (err) => {
            if (err) {
                console.error('Error connecting to SQLite database:', err.message);
            } else {
                console.log('Connected to SQLite database');
            }
        });
    }

    // Execute a query with parameters
    run(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.run(sql, params, function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve({ id: this.lastID, changes: this.changes });
                }
            });
        });
    }

    // Get a single row
    get(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.get(sql, params, (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(row);
                }
            });
        });
    }

    // Get all rows
    all(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.all(sql, params, (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    }

    // Close database connection
    close() {
        return new Promise((resolve, reject) => {
            this.db.close((err) => {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
    }

    // Begin transaction
    beginTransaction() {
        return this.run('BEGIN TRANSACTION');
    }

    // Commit transaction
    commit() {
        return this.run('COMMIT');
    }

    // Rollback transaction
    rollback() {
        return this.run('ROLLBACK');
    }

    // Execute multiple statements in a transaction
    async transaction(callback) {
        await this.beginTransaction();
        try {
            const result = await callback(this);
            await this.commit();
            return result;
        } catch (error) {
            await this.rollback();
            throw error;
        }
    }
}

// Singleton instance
let instance = null;

function getDatabase() {
    if (!instance) {
        instance = new Database();
    }
    return instance;
}

module.exports = { Database, getDatabase };
