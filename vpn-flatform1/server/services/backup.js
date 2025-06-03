/**
 * Automated Backup and Recovery System
 * Handles database backups, file backups, automated scheduling,
 * recovery procedures, and backup monitoring
 */

const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const { spawn } = require('child_process');
const cron = require('node-cron');
const db = require('../database/manager');

class BackupRecoveryService {
    constructor() {
        this.backupPath = path.join(__dirname, '../backups');
        this.configPath = path.join(__dirname, '../config');
        this.logsPath = path.join(__dirname, '../logs');
        this.maxBackups = 10;
        this.backupSchedules = new Map();
        this.compressionEnabled = true;
        this.encryptionEnabled = true;
        this.encryptionKey = null;
        
        this.init();
    }

    /**
     * Initialize backup service
     */
    async init() {
        try {
            await this.ensureDirectories();
            await this.loadBackupConfig();
            await this.createBackupTables();
            await this.setupScheduledBackups();
            
            console.log('✅ Backup and recovery service initialized');
        } catch (error) {
            console.error('❌ Backup service initialization failed:', error);
        }
    }

    /**
     * Ensure backup directories exist
     */
    async ensureDirectories() {
        const directories = [
            this.backupPath,
            path.join(this.backupPath, 'database'),
            path.join(this.backupPath, 'files'),
            path.join(this.backupPath, 'config'),
            path.join(this.backupPath, 'logs')
        ];

        for (const dir of directories) {
            try {
                await fs.access(dir);
            } catch {
                await fs.mkdir(dir, { recursive: true });
            }
        }
    }

    /**
     * Load backup configuration
     */
    async loadBackupConfig() {
        try {
            const configs = await db.all(`
                SELECT key, value FROM config_settings 
                WHERE category = 'backup' OR key LIKE '%backup%'
            `);

            const config = {};
            configs.forEach(item => {
                config[item.key] = item.value;
            });

            this.maxBackups = parseInt(config.backup_retention_count) || 10;
            this.compressionEnabled = config.backup_compression === 'true';
            this.encryptionEnabled = config.backup_encryption === 'true';
            
            if (this.encryptionEnabled) {
                this.encryptionKey = config.backup_encryption_key || this.generateEncryptionKey();
            }
        } catch (error) {
            console.warn('Could not load backup config from database, using defaults');
        }
    }

    /**
     * Create backup tracking tables
     */
    async createBackupTables() {
        await db.exec(`
            CREATE TABLE IF NOT EXISTS backups (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                type TEXT NOT NULL CHECK (type IN ('database', 'files', 'config', 'full')),
                filename TEXT NOT NULL,
                file_path TEXT NOT NULL,
                file_size INTEGER,
                checksum TEXT,
                encrypted BOOLEAN DEFAULT FALSE,
                compressed BOOLEAN DEFAULT FALSE,
                status TEXT DEFAULT 'completed' CHECK (status IN ('running', 'completed', 'failed')),
                error_message TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                expires_at DATETIME
            );

            CREATE TABLE IF NOT EXISTS backup_schedules (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT UNIQUE NOT NULL,
                type TEXT NOT NULL,
                cron_expression TEXT NOT NULL,
                enabled BOOLEAN DEFAULT TRUE,
                last_run DATETIME,
                next_run DATETIME,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );

            CREATE INDEX IF NOT EXISTS idx_backups_type ON backups(type);
            CREATE INDEX IF NOT EXISTS idx_backups_created_at ON backups(created_at);
            CREATE INDEX IF NOT EXISTS idx_backup_schedules_enabled ON backup_schedules(enabled);
        `);

        // Insert default backup schedules
        await this.insertDefaultSchedules();
    }

    /**
     * Insert default backup schedules
     */
    async insertDefaultSchedules() {
        const defaultSchedules = [
            {
                name: 'daily_database_backup',
                type: 'database',
                cron_expression: '0 2 * * *', // Daily at 2 AM
                enabled: true
            },
            {
                name: 'weekly_full_backup',
                type: 'full',
                cron_expression: '0 3 * * 0', // Weekly on Sunday at 3 AM
                enabled: true
            },
            {
                name: 'hourly_config_backup',
                type: 'config',
                cron_expression: '0 * * * *', // Every hour
                enabled: false
            }
        ];

        for (const schedule of defaultSchedules) {
            await db.run(`
                INSERT OR IGNORE INTO backup_schedules 
                (name, type, cron_expression, enabled) 
                VALUES (?, ?, ?, ?)
            `, [schedule.name, schedule.type, schedule.cron_expression, schedule.enabled]);
        }
    }

    /**
     * Setup scheduled backups
     */
    async setupScheduledBackups() {
        const schedules = await db.all(`
            SELECT * FROM backup_schedules WHERE enabled = TRUE
        `);

        schedules.forEach(schedule => {
            if (cron.validate(schedule.cron_expression)) {
                const task = cron.schedule(schedule.cron_expression, async () => {
                    console.log(`Running scheduled backup: ${schedule.name}`);
                    await this.runScheduledBackup(schedule);
                }, {
                    scheduled: false
                });

                this.backupSchedules.set(schedule.id, task);
                task.start();

                console.log(`Scheduled backup: ${schedule.name} (${schedule.cron_expression})`);
            } else {
                console.error(`Invalid cron expression for schedule ${schedule.name}: ${schedule.cron_expression}`);
            }
        });
    }

    /**
     * Run scheduled backup
     */
    async runScheduledBackup(schedule) {
        try {
            let result;
            
            switch (schedule.type) {
                case 'database':
                    result = await this.backupDatabase();
                    break;
                case 'files':
                    result = await this.backupFiles();
                    break;
                case 'config':
                    result = await this.backupConfig();
                    break;
                case 'full':
                    result = await this.fullBackup();
                    break;
                default:
                    throw new Error(`Unknown backup type: ${schedule.type}`);
            }

            // Update last run time
            await db.run(`
                UPDATE backup_schedules 
                SET last_run = CURRENT_TIMESTAMP, 
                    next_run = datetime('now', '+1 day') 
                WHERE id = ?
            `, [schedule.id]);

            console.log(`✅ Scheduled backup completed: ${schedule.name}`);
            return result;

        } catch (error) {
            console.error(`❌ Scheduled backup failed: ${schedule.name}`, error);
            
            // Log the error
            await db.run(`
                INSERT INTO system_logs (level, message, component) 
                VALUES ('error', 'Scheduled backup failed: ' || ? || ' - ' || ?, 'backup')
            `, [schedule.name, error.message]);
        }
    }

    /**
     * Backup database
     */
    async backupDatabase() {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `database_backup_${timestamp}.db`;
        const filePath = path.join(this.backupPath, 'database', filename);

        try {
            // Create backup record
            const backupRecord = await db.run(`
                INSERT INTO backups (type, filename, file_path, status) 
                VALUES ('database', ?, ?, 'running')
            `, [filename, filePath]);

            // Create database backup
            const backupPath = await db.backup();
            
            // Move backup to designated location
            await fs.rename(backupPath, filePath);

            // Get file stats
            const stats = await fs.stat(filePath);
            const checksum = await this.calculateChecksum(filePath);

            // Compress if enabled
            let finalPath = filePath;
            let compressed = false;
            if (this.compressionEnabled) {
                finalPath = await this.compressFile(filePath);
                compressed = true;
            }

            // Encrypt if enabled
            let encrypted = false;
            if (this.encryptionEnabled) {
                finalPath = await this.encryptFile(finalPath);
                encrypted = true;
            }

            // Update backup record
            await db.run(`
                UPDATE backups 
                SET file_path = ?, file_size = ?, checksum = ?, 
                    compressed = ?, encrypted = ?, status = 'completed',
                    expires_at = datetime('now', '+30 days')
                WHERE id = ?
            `, [finalPath, stats.size, checksum, compressed, encrypted, backupRecord.id]);

            // Cleanup old backups
            await this.cleanupOldBackups('database');

            console.log(`✅ Database backup created: ${filename}`);
            return { success: true, filename, path: finalPath };

        } catch (error) {
            // Update backup record with error
            await db.run(`
                UPDATE backups 
                SET status = 'failed', error_message = ? 
                WHERE filename = ?
            `, [error.message, filename]);

            console.error('❌ Database backup failed:', error);
            throw error;
        }
    }

    /**
     * Backup files
     */
    async backupFiles() {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `files_backup_${timestamp}.tar.gz`;
        const filePath = path.join(this.backupPath, 'files', filename);

        try {
            // Create backup record
            const backupRecord = await db.run(`
                INSERT INTO backups (type, filename, file_path, status) 
                VALUES ('files', ?, ?, 'running')
            `, [filename, filePath]);

            // Define directories to backup
            const sourceDirectories = [
                path.join(__dirname, '../public'),
                path.join(__dirname, '../uploads'),
                path.join(__dirname, '../ssl')
            ];

            // Create tar archive
            await this.createTarArchive(sourceDirectories, filePath);

            // Get file stats
            const stats = await fs.stat(filePath);
            const checksum = await this.calculateChecksum(filePath);

            // Encrypt if enabled
            let finalPath = filePath;
            let encrypted = false;
            if (this.encryptionEnabled) {
                finalPath = await this.encryptFile(filePath);
                encrypted = true;
            }

            // Update backup record
            await db.run(`
                UPDATE backups 
                SET file_path = ?, file_size = ?, checksum = ?, 
                    encrypted = ?, status = 'completed',
                    expires_at = datetime('now', '+30 days')
                WHERE id = ?
            `, [finalPath, stats.size, checksum, encrypted, backupRecord.id]);

            // Cleanup old backups
            await this.cleanupOldBackups('files');

            console.log(`✅ Files backup created: ${filename}`);
            return { success: true, filename, path: finalPath };

        } catch (error) {
            await db.run(`
                UPDATE backups 
                SET status = 'failed', error_message = ? 
                WHERE filename = ?
            `, [error.message, filename]);

            console.error('❌ Files backup failed:', error);
            throw error;
        }
    }

    /**
     * Backup configuration
     */
    async backupConfig() {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `config_backup_${timestamp}.json`;
        const filePath = path.join(this.backupPath, 'config', filename);

        try {
            // Create backup record
            const backupRecord = await db.run(`
                INSERT INTO backups (type, filename, file_path, status) 
                VALUES ('config', ?, ?, 'running')
            `, [filename, filePath]);

            // Get configuration settings
            const configSettings = await db.all('SELECT * FROM config_settings');
            const serverConfig = {
                settings: configSettings,
                timestamp: new Date().toISOString(),
                version: process.env.npm_package_version || '1.0.0'
            };

            // Write config to file
            await fs.writeFile(filePath, JSON.stringify(serverConfig, null, 2));

            // Get file stats
            const stats = await fs.stat(filePath);
            const checksum = await this.calculateChecksum(filePath);

            // Encrypt if enabled
            let finalPath = filePath;
            let encrypted = false;
            if (this.encryptionEnabled) {
                finalPath = await this.encryptFile(filePath);
                encrypted = true;
            }

            // Update backup record
            await db.run(`
                UPDATE backups 
                SET file_path = ?, file_size = ?, checksum = ?, 
                    encrypted = ?, status = 'completed',
                    expires_at = datetime('now', '+30 days')
                WHERE id = ?
            `, [finalPath, stats.size, checksum, encrypted, backupRecord.id]);

            // Cleanup old backups
            await this.cleanupOldBackups('config');

            console.log(`✅ Config backup created: ${filename}`);
            return { success: true, filename, path: finalPath };

        } catch (error) {
            await db.run(`
                UPDATE backups 
                SET status = 'failed', error_message = ? 
                WHERE filename = ?
            `, [error.message, filename]);

            console.error('❌ Config backup failed:', error);
            throw error;
        }
    }

    /**
     * Full system backup
     */
    async fullBackup() {
        console.log('🔄 Starting full system backup...');
        
        try {
            const results = {
                database: await this.backupDatabase(),
                files: await this.backupFiles(),
                config: await this.backupConfig()
            };

            // Create full backup manifest
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const manifestPath = path.join(this.backupPath, `full_backup_manifest_${timestamp}.json`);
            
            await fs.writeFile(manifestPath, JSON.stringify({
                timestamp: new Date().toISOString(),
                components: results,
                checksum: await this.calculateChecksum(manifestPath)
            }, null, 2));

            console.log('✅ Full system backup completed');
            return { success: true, results, manifest: manifestPath };

        } catch (error) {
            console.error('❌ Full backup failed:', error);
            throw error;
        }
    }

    /**
     * Restore from backup
     */
    async restoreFromBackup(backupId, options = {}) {
        try {
            const backup = await db.get('SELECT * FROM backups WHERE id = ?', [backupId]);
            if (!backup) {
                throw new Error('Backup not found');
            }

            console.log(`🔄 Starting restore from backup: ${backup.filename}`);

            let filePath = backup.file_path;

            // Decrypt if necessary
            if (backup.encrypted) {
                filePath = await this.decryptFile(filePath);
            }

            // Decompress if necessary
            if (backup.compressed) {
                filePath = await this.decompressFile(filePath);
            }

            // Verify checksum
            const currentChecksum = await this.calculateChecksum(filePath);
            if (currentChecksum !== backup.checksum) {
                throw new Error('Backup file integrity check failed');
            }

            // Restore based on backup type
            switch (backup.type) {
                case 'database':
                    await this.restoreDatabase(filePath, options);
                    break;
                case 'files':
                    await this.restoreFiles(filePath, options);
                    break;
                case 'config':
                    await this.restoreConfig(filePath, options);
                    break;
                default:
                    throw new Error(`Unsupported backup type: ${backup.type}`);
            }

            console.log(`✅ Restore completed from backup: ${backup.filename}`);
            return { success: true, backup };

        } catch (error) {
            console.error('❌ Restore failed:', error);
            throw error;
        }
    }

    /**
     * Restore database
     */
    async restoreDatabase(backupPath, options = {}) {
        // This is a simplified restore - in production you'd want more safety checks
        const currentDbPath = path.join(__dirname, '../data/vpn_platform.db');
        
        // Create backup of current database
        if (!options.skipCurrentBackup) {
            const backupCurrentPath = `${currentDbPath}.restore_backup_${Date.now()}`;
            await fs.copyFile(currentDbPath, backupCurrentPath);
        }

        // Close current database connection
        await db.close();

        // Replace with backup
        await fs.copyFile(backupPath, currentDbPath);

        // Reconnect to database
        await db.connect();

        console.log('✅ Database restored successfully');
    }

    /**
     * Restore files
     */
    async restoreFiles(backupPath, options = {}) {
        // Extract tar archive
        await this.extractTarArchive(backupPath, path.join(__dirname, '..'));
        console.log('✅ Files restored successfully');
    }

    /**
     * Restore configuration
     */
    async restoreConfig(backupPath, options = {}) {
        const configData = JSON.parse(await fs.readFile(backupPath, 'utf8'));
        
        // Clear existing config (if requested)
        if (options.clearExisting) {
            await db.run('DELETE FROM config_settings');
        }

        // Restore config settings
        for (const setting of configData.settings) {
            await db.run(`
                INSERT OR REPLACE INTO config_settings 
                (key, value, description, category, is_encrypted) 
                VALUES (?, ?, ?, ?, ?)
            `, [setting.key, setting.value, setting.description, setting.category, setting.is_encrypted]);
        }

        console.log('✅ Configuration restored successfully');
    }

    /**
     * Get backup list
     */
    async getBackupList(type = null, limit = 50) {
        let sql = 'SELECT * FROM backups';
        const params = [];

        if (type) {
            sql += ' WHERE type = ?';
            params.push(type);
        }

        sql += ' ORDER BY created_at DESC LIMIT ?';
        params.push(limit);

        return await db.all(sql, params);
    }

    /**
     * Delete backup
     */
    async deleteBackup(backupId) {
        const backup = await db.get('SELECT * FROM backups WHERE id = ?', [backupId]);
        if (!backup) {
            throw new Error('Backup not found');
        }

        // Delete file
        try {
            await fs.unlink(backup.file_path);
        } catch (error) {
            console.warn(`Could not delete backup file: ${error.message}`);
        }

        // Delete record
        await db.run('DELETE FROM backups WHERE id = ?', [backupId]);

        return { success: true };
    }

    /**
     * Cleanup old backups
     */
    async cleanupOldBackups(type) {
        const oldBackups = await db.all(`
            SELECT * FROM backups 
            WHERE type = ? AND status = 'completed'
            ORDER BY created_at DESC 
            LIMIT -1 OFFSET ?
        `, [type, this.maxBackups]);

        for (const backup of oldBackups) {
            try {
                await fs.unlink(backup.file_path);
                await db.run('DELETE FROM backups WHERE id = ?', [backup.id]);
                console.log(`🗑️ Cleaned up old backup: ${backup.filename}`);
            } catch (error) {
                console.warn(`Could not cleanup backup ${backup.filename}:`, error.message);
            }
        }

        return oldBackups.length;
    }

    /**
     * Calculate file checksum
     */
    async calculateChecksum(filePath) {
        const hash = crypto.createHash('sha256');
        const data = await fs.readFile(filePath);
        hash.update(data);
        return hash.digest('hex');
    }

    /**
     * Compress file
     */
    async compressFile(filePath) {
        const compressedPath = `${filePath}.gz`;
        
        return new Promise((resolve, reject) => {
            const gzip = spawn('gzip', ['-c', filePath]);
            const output = require('fs').createWriteStream(compressedPath);
            
            gzip.stdout.pipe(output);
            
            gzip.on('close', (code) => {
                if (code === 0) {
                    // Remove original file
                    fs.unlink(filePath).catch(() => {});
                    resolve(compressedPath);
                } else {
                    reject(new Error(`Compression failed with code ${code}`));
                }
            });
            
            gzip.on('error', reject);
        });
    }

    /**
     * Decompress file
     */
    async decompressFile(filePath) {
        const decompressedPath = filePath.replace(/\.gz$/, '');
        
        return new Promise((resolve, reject) => {
            const gunzip = spawn('gunzip', ['-c', filePath]);
            const output = require('fs').createWriteStream(decompressedPath);
            
            gunzip.stdout.pipe(output);
            
            gunzip.on('close', (code) => {
                if (code === 0) {
                    resolve(decompressedPath);
                } else {
                    reject(new Error(`Decompression failed with code ${code}`));
                }
            });
            
            gunzip.on('error', reject);
        });
    }

    /**
     * Encrypt file
     */
    async encryptFile(filePath) {
        if (!this.encryptionKey) {
            throw new Error('Encryption key not available');
        }

        const encryptedPath = `${filePath}.enc`;
        const cipher = crypto.createCipher('aes-256-cbc', this.encryptionKey);
        
        const input = await fs.readFile(filePath);
        const encrypted = Buffer.concat([cipher.update(input), cipher.final()]);
        
        await fs.writeFile(encryptedPath, encrypted);
        await fs.unlink(filePath);
        
        return encryptedPath;
    }

    /**
     * Decrypt file
     */
    async decryptFile(filePath) {
        if (!this.encryptionKey) {
            throw new Error('Encryption key not available');
        }

        const decryptedPath = filePath.replace(/\.enc$/, '');
        const decipher = crypto.createDecipher('aes-256-cbc', this.encryptionKey);
        
        const encrypted = await fs.readFile(filePath);
        const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
        
        await fs.writeFile(decryptedPath, decrypted);
        
        return decryptedPath;
    }

    /**
     * Create tar archive
     */
    async createTarArchive(sources, output) {
        return new Promise((resolve, reject) => {
            const args = ['-czf', output, ...sources];
            const tar = spawn('tar', args);
            
            tar.on('close', (code) => {
                if (code === 0) {
                    resolve(output);
                } else {
                    reject(new Error(`tar command failed with code ${code}`));
                }
            });
            
            tar.on('error', reject);
        });
    }

    /**
     * Extract tar archive
     */
    async extractTarArchive(archive, destination) {
        return new Promise((resolve, reject) => {
            const tar = spawn('tar', ['-xzf', archive, '-C', destination]);
            
            tar.on('close', (code) => {
                if (code === 0) {
                    resolve();
                } else {
                    reject(new Error(`tar extraction failed with code ${code}`));
                }
            });
            
            tar.on('error', reject);
        });
    }

    /**
     * Generate encryption key
     */
    generateEncryptionKey() {
        return crypto.randomBytes(32).toString('hex');
    }

    /**
     * Get backup statistics
     */
    async getBackupStats() {
        const stats = await db.get(`
            SELECT 
                COUNT(*) as total_backups,
                COUNT(CASE WHEN status = 'completed' THEN 1 END) as successful_backups,
                COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_backups,
                SUM(file_size) as total_size,
                MAX(created_at) as last_backup
            FROM backups
        `);

        const typeStats = await db.all(`
            SELECT type, COUNT(*) as count, SUM(file_size) as size
            FROM backups 
            WHERE status = 'completed'
            GROUP BY type
        `);

        return { ...stats, by_type: typeStats };
    }

    /**
     * Test backup system
     */
    async testBackupSystem() {
        const tests = [];
        
        try {
            // Test database backup
            const dbBackup = await this.backupDatabase();
            tests.push({ name: 'Database Backup', success: dbBackup.success });
            
            // Test config backup
            const configBackup = await this.backupConfig();
            tests.push({ name: 'Config Backup', success: configBackup.success });
            
            // Test backup list
            const backupList = await this.getBackupList();
            tests.push({ name: 'Backup List', success: Array.isArray(backupList) });
            
            // Test cleanup
            const cleaned = await this.cleanupOldBackups('database');
            tests.push({ name: 'Backup Cleanup', success: typeof cleaned === 'number' });
            
        } catch (error) {
            tests.push({ name: 'Backup Test', success: false, error: error.message });
        }

        return {
            success: tests.every(test => test.success),
            tests
        };
    }
}

// Export singleton instance
module.exports = new BackupRecoveryService();
