/**
 * User Notification System
 * Handles email notifications, in-app notifications, push notifications,
 * and notification preferences with templating and scheduling
 */

const nodemailer = require('nodemailer');
const EventEmitter = require('events');
const db = require('../database/manager');
const crypto = require('crypto');

class NotificationService extends EventEmitter {
    constructor() {
        super();
        this.emailTransporter = null;
        this.templates = new Map();
        this.notificationQueue = [];
        this.isProcessing = false;
        this.maxRetries = 3;
        this.retryDelays = [1000, 5000, 15000]; // 1s, 5s, 15s
        
        this.init();
    }

    /**
     * Initialize notification service
     */
    async init() {
        try {
            await this.setupEmailTransporter();
            await this.loadTemplates();
            await this.createNotificationTables();
            this.startQueueProcessor();
            
            console.log('✅ Notification service initialized');
        } catch (error) {
            console.error('❌ Notification service initialization failed:', error);
        }
    }

    /**
     * Setup email transporter
     */
    async setupEmailTransporter() {
        const config = await this.getEmailConfig();
        
        if (config.smtp_host) {
            this.emailTransporter = nodemailer.createTransporter({
                host: config.smtp_host,
                port: parseInt(config.smtp_port) || 587,
                secure: config.smtp_secure === 'true',
                auth: {
                    user: config.smtp_username,
                    pass: config.smtp_password
                },
                tls: {
                    rejectUnauthorized: false
                }
            });

            // Verify connection
            try {
                await this.emailTransporter.verify();
                console.log('✅ Email transporter configured successfully');
            } catch (error) {
                console.error('❌ Email transporter verification failed:', error);
                this.emailTransporter = null;
            }
        }
    }

    /**
     * Get email configuration from database
     */
    async getEmailConfig() {
        const configs = await db.all(
            'SELECT key, value FROM config_settings WHERE category = "email"'
        );
        
        const config = {};
        configs.forEach(item => {
            config[item.key] = item.value;
        });
        
        return config;
    }

    /**
     * Create notification tables
     */
    async createNotificationTables() {
        await db.exec(`
            CREATE TABLE IF NOT EXISTS notifications (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                type TEXT NOT NULL,
                title TEXT NOT NULL,
                message TEXT NOT NULL,
                data TEXT, -- JSON data
                read_at DATETIME,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                expires_at DATETIME,
                FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS notification_preferences (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                type TEXT NOT NULL,
                email_enabled BOOLEAN DEFAULT TRUE,
                push_enabled BOOLEAN DEFAULT TRUE,
                in_app_enabled BOOLEAN DEFAULT TRUE,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
                UNIQUE(user_id, type)
            );

            CREATE TABLE IF NOT EXISTS notification_templates (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT UNIQUE NOT NULL,
                type TEXT NOT NULL,
                subject TEXT,
                html_content TEXT,
                text_content TEXT,
                variables TEXT, -- JSON array of variable names
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );

            CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
            CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(type);
            CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at);
            CREATE INDEX IF NOT EXISTS idx_notification_preferences_user_id ON notification_preferences(user_id);
        `);

        // Insert default notification preferences
        await this.insertDefaultPreferences();
        
        // Insert default templates
        await this.insertDefaultTemplates();
    }

    /**
     * Insert default notification preferences
     */
    async insertDefaultPreferences() {
        const defaultTypes = [
            'account_created',
            'subscription_activated',
            'subscription_expiring',
            'subscription_expired',
            'payment_success',
            'payment_failed',
            'security_alert',
            'connection_limit_reached',
            'system_maintenance',
            'password_reset',
            'email_verification'
        ];

        for (const type of defaultTypes) {
            await db.run(`
                INSERT OR IGNORE INTO notification_preferences 
                (user_id, type, email_enabled, push_enabled, in_app_enabled) 
                SELECT id, ?, TRUE, TRUE, TRUE FROM users
            `, [type]);
        }
    }

    /**
     * Insert default email templates
     */
    async insertDefaultTemplates() {
        const templates = [
            {
                name: 'welcome_email',
                type: 'account_created',
                subject: 'Welcome to SecureVPN!',
                html_content: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                        <h1 style="color: #2563eb;">Welcome to SecureVPN!</h1>
                        <p>Hello {{username}},</p>
                        <p>Thank you for joining SecureVPN! Your account has been successfully created.</p>
                        <p>You can now:</p>
                        <ul>
                            <li>Connect to our secure VPN servers</li>
                            <li>Browse the internet safely and privately</li>
                            <li>Access geo-restricted content</li>
                        </ul>
                        <p>If you have any questions, feel free to contact our support team.</p>
                        <p>Best regards,<br>The SecureVPN Team</p>
                    </div>
                `,
                text_content: `Welcome to SecureVPN!\n\nHello {{username}},\n\nThank you for joining SecureVPN! Your account has been successfully created.\n\nBest regards,\nThe SecureVPN Team`,
                variables: JSON.stringify(['username'])
            },
            {
                name: 'subscription_activated',
                type: 'subscription_activated',
                subject: 'Your subscription is now active!',
                html_content: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                        <h1 style="color: #10b981;">Subscription Activated!</h1>
                        <p>Hello {{username}},</p>
                        <p>Great news! Your {{plan_name}} subscription is now active.</p>
                        <p><strong>Subscription Details:</strong></p>
                        <ul>
                            <li>Plan: {{plan_name}}</li>
                            <li>Start Date: {{start_date}}</li>
                            <li>End Date: {{end_date}}</li>
                            <li>Max Devices: {{max_devices}}</li>
                        </ul>
                        <p>You can now enjoy unlimited access to our VPN network.</p>
                        <p>Best regards,<br>The SecureVPN Team</p>
                    </div>
                `,
                text_content: `Subscription Activated!\n\nHello {{username}},\n\nYour {{plan_name}} subscription is now active from {{start_date}} to {{end_date}}.\n\nBest regards,\nThe SecureVPN Team`,
                variables: JSON.stringify(['username', 'plan_name', 'start_date', 'end_date', 'max_devices'])
            },
            {
                name: 'subscription_expiring',
                type: 'subscription_expiring',
                subject: 'Your subscription expires soon',
                html_content: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                        <h1 style="color: #f59e0b;">Subscription Expiring Soon</h1>
                        <p>Hello {{username}},</p>
                        <p>This is a friendly reminder that your {{plan_name}} subscription will expire on {{end_date}}.</p>
                        <p>To continue enjoying our VPN service without interruption, please renew your subscription.</p>
                        <a href="{{renewal_link}}" style="background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin: 20px 0;">Renew Now</a>
                        <p>If you have any questions, please contact our support team.</p>
                        <p>Best regards,<br>The SecureVPN Team</p>
                    </div>
                `,
                text_content: `Subscription Expiring Soon\n\nHello {{username}},\n\nYour {{plan_name}} subscription expires on {{end_date}}. Please renew to continue service.\n\nRenewal link: {{renewal_link}}\n\nBest regards,\nThe SecureVPN Team`,
                variables: JSON.stringify(['username', 'plan_name', 'end_date', 'renewal_link'])
            },
            {
                name: 'payment_success',
                type: 'payment_success',
                subject: 'Payment confirmation',
                html_content: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                        <h1 style="color: #10b981;">Payment Confirmed</h1>
                        <p>Hello {{username}},</p>
                        <p>We've successfully received your payment.</p>
                        <p><strong>Payment Details:</strong></p>
                        <ul>
                            <li>Amount: {{amount}} {{currency}}</li>
                            <li>Transaction ID: {{transaction_id}}</li>
                            <li>Date: {{payment_date}}</li>
                            <li>Method: {{payment_method}}</li>
                        </ul>
                        <p>Thank you for your payment!</p>
                        <p>Best regards,<br>The SecureVPN Team</p>
                    </div>
                `,
                text_content: `Payment Confirmed\n\nHello {{username}},\n\nPayment of {{amount}} {{currency}} confirmed.\nTransaction ID: {{transaction_id}}\n\nThank you!\n\nBest regards,\nThe SecureVPN Team`,
                variables: JSON.stringify(['username', 'amount', 'currency', 'transaction_id', 'payment_date', 'payment_method'])
            },
            {
                name: 'security_alert',
                type: 'security_alert',
                subject: 'Security Alert - Unusual Activity Detected',
                html_content: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                        <h1 style="color: #ef4444;">Security Alert</h1>
                        <p>Hello {{username}},</p>
                        <p>We detected unusual activity on your account:</p>
                        <p><strong>Details:</strong></p>
                        <ul>
                            <li>Activity: {{activity_type}}</li>
                            <li>Time: {{activity_time}}</li>
                            <li>IP Address: {{ip_address}}</li>
                            <li>Location: {{location}}</li>
                        </ul>
                        <p>If this wasn't you, please:</p>
                        <ol>
                            <li>Change your password immediately</li>
                            <li>Enable two-factor authentication</li>
                            <li>Contact our support team</li>
                        </ol>
                        <p>Best regards,<br>The SecureVPN Security Team</p>
                    </div>
                `,
                text_content: `Security Alert\n\nHello {{username}},\n\nUnusual activity detected: {{activity_type}} from {{ip_address}} at {{activity_time}}.\n\nIf this wasn't you, please change your password and contact support.\n\nBest regards,\nThe SecureVPN Security Team`,
                variables: JSON.stringify(['username', 'activity_type', 'activity_time', 'ip_address', 'location'])
            }
        ];

        for (const template of templates) {
            await db.run(`
                INSERT OR REPLACE INTO notification_templates 
                (name, type, subject, html_content, text_content, variables) 
                VALUES (?, ?, ?, ?, ?, ?)
            `, [template.name, template.type, template.subject, template.html_content, template.text_content, template.variables]);
        }
    }

    /**
     * Load templates into memory
     */
    async loadTemplates() {
        const templates = await db.all('SELECT * FROM notification_templates');
        
        templates.forEach(template => {
            this.templates.set(template.name, {
                ...template,
                variables: JSON.parse(template.variables || '[]')
            });
        });
        
        console.log(`Loaded ${templates.length} notification templates`);
    }

    /**
     * Send notification
     */
    async sendNotification(type, userId, data = {}, options = {}) {
        try {
            // Get user and preferences
            const user = await db.get('SELECT * FROM users WHERE id = ?', [userId]);
            if (!user) {
                throw new Error('User not found');
            }

            const preferences = await this.getUserPreferences(userId, type);
            
            // Create in-app notification if enabled
            if (preferences.in_app_enabled) {
                await this.createInAppNotification(type, userId, data);
            }

            // Send email if enabled
            if (preferences.email_enabled && this.emailTransporter) {
                await this.sendEmailNotification(type, user, data);
            }

            // Send push notification if enabled
            if (preferences.push_enabled) {
                await this.sendPushNotification(type, userId, data);
            }

            this.emit('notification_sent', {
                type,
                userId,
                channels: {
                    email: preferences.email_enabled,
                    push: preferences.push_enabled,
                    inApp: preferences.in_app_enabled
                }
            });

            return { success: true };

        } catch (error) {
            console.error('Notification sending error:', error);
            this.emit('notification_error', { type, userId, error: error.message });
            return { success: false, error: error.message };
        }
    }

    /**
     * Create in-app notification
     */
    async createInAppNotification(type, userId, data) {
        const template = this.templates.get(type) || this.templates.get('default');
        if (!template) {
            throw new Error(`Template not found for type: ${type}`);
        }

        const title = this.renderTemplate(template.subject || 'Notification', data);
        const message = this.renderTemplate(template.text_content, data);

        await db.run(`
            INSERT INTO notifications (user_id, type, title, message, data, expires_at) 
            VALUES (?, ?, ?, ?, ?, datetime('now', '+30 days'))
        `, [userId, type, title, message, JSON.stringify(data)]);
    }

    /**
     * Send email notification
     */
    async sendEmailNotification(type, user, data) {
        const template = this.templates.get(type);
        if (!template || !template.html_content) {
            throw new Error(`Email template not found for type: ${type}`);
        }

        const mailOptions = {
            from: `"SecureVPN" <${process.env.SMTP_FROM || 'noreply@securevpn.com'}>`,
            to: user.email,
            subject: this.renderTemplate(template.subject, { ...data, username: user.username }),
            html: this.renderTemplate(template.html_content, { ...data, username: user.username }),
            text: this.renderTemplate(template.text_content, { ...data, username: user.username })
        };

        await this.emailTransporter.sendMail(mailOptions);
        
        // Log email sent
        await db.run(`
            INSERT INTO system_logs (level, message, component, user_id) 
            VALUES ('info', 'Email notification sent: ' || ?, 'notification', ?)
        `, [type, user.id]);
    }

    /**
     * Send push notification (placeholder)
     */
    async sendPushNotification(type, userId, data) {
        // Implement push notification logic here
        // This could integrate with services like FCM, APNS, etc.
        console.log(`Push notification sent: ${type} to user ${userId}`);
    }

    /**
     * Render template with variables
     */
    renderTemplate(template, data) {
        if (!template) return '';
        
        let rendered = template;
        
        // Replace template variables
        Object.keys(data).forEach(key => {
            const placeholder = `{{${key}}}`;
            rendered = rendered.replace(new RegExp(placeholder, 'g'), data[key] || '');
        });

        return rendered;
    }

    /**
     * Get user notification preferences
     */
    async getUserPreferences(userId, type) {
        const preferences = await db.get(`
            SELECT * FROM notification_preferences 
            WHERE user_id = ? AND type = ?
        `, [userId, type]);

        return preferences || {
            email_enabled: true,
            push_enabled: true,
            in_app_enabled: true
        };
    }

    /**
     * Update user notification preferences
     */
    async updateUserPreferences(userId, type, preferences) {
        await db.run(`
            INSERT OR REPLACE INTO notification_preferences 
            (user_id, type, email_enabled, push_enabled, in_app_enabled, updated_at) 
            VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        `, [
            userId,
            type,
            preferences.email_enabled || false,
            preferences.push_enabled || false,
            preferences.in_app_enabled || false
        ]);

        return { success: true };
    }

    /**
     * Get user notifications
     */
    async getUserNotifications(userId, options = {}) {
        const limit = options.limit || 50;
        const offset = options.offset || 0;
        const unreadOnly = options.unreadOnly || false;

        let sql = `
            SELECT * FROM notifications 
            WHERE user_id = ? 
            ${unreadOnly ? 'AND read_at IS NULL' : ''}
            AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
            ORDER BY created_at DESC 
            LIMIT ? OFFSET ?
        `;

        const notifications = await db.all(sql, [userId, limit, offset]);
        
        // Parse JSON data
        notifications.forEach(notification => {
            if (notification.data) {
                try {
                    notification.data = JSON.parse(notification.data);
                } catch (e) {
                    notification.data = {};
                }
            }
        });

        return notifications;
    }

    /**
     * Mark notification as read
     */
    async markAsRead(notificationId, userId) {
        const result = await db.run(`
            UPDATE notifications 
            SET read_at = CURRENT_TIMESTAMP 
            WHERE id = ? AND user_id = ?
        `, [notificationId, userId]);

        return { success: result.changes > 0 };
    }

    /**
     * Mark all notifications as read
     */
    async markAllAsRead(userId) {
        const result = await db.run(`
            UPDATE notifications 
            SET read_at = CURRENT_TIMESTAMP 
            WHERE user_id = ? AND read_at IS NULL
        `, [userId]);

        return { success: true, marked: result.changes };
    }

    /**
     * Delete notification
     */
    async deleteNotification(notificationId, userId) {
        const result = await db.run(`
            DELETE FROM notifications 
            WHERE id = ? AND user_id = ?
        `, [notificationId, userId]);

        return { success: result.changes > 0 };
    }

    /**
     * Get notification statistics
     */
    async getNotificationStats(userId) {
        const stats = await db.get(`
            SELECT 
                COUNT(*) as total,
                COUNT(CASE WHEN read_at IS NULL THEN 1 END) as unread,
                COUNT(CASE WHEN read_at IS NOT NULL THEN 1 END) as read
            FROM notifications 
            WHERE user_id = ? 
            AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
        `, [userId]);

        return stats;
    }

    /**
     * Schedule notification
     */
    async scheduleNotification(type, userId, data, sendAt) {
        const notificationData = {
            type,
            userId,
            data,
            scheduled: true,
            sendAt: new Date(sendAt),
            retries: 0
        };

        this.notificationQueue.push(notificationData);
        return { success: true, scheduled: true };
    }

    /**
     * Queue notification
     */
    queueNotification(type, userId, data, priority = 'normal') {
        const notificationData = {
            type,
            userId,
            data,
            priority,
            queued: true,
            queuedAt: new Date(),
            retries: 0
        };

        if (priority === 'high') {
            this.notificationQueue.unshift(notificationData);
        } else {
            this.notificationQueue.push(notificationData);
        }

        return { success: true, queued: true, position: this.notificationQueue.length };
    }

    /**
     * Start queue processor
     */
    startQueueProcessor() {
        setInterval(async () => {
            if (this.notificationQueue.length > 0 && !this.isProcessing) {
                this.isProcessing = true;
                
                const notification = this.notificationQueue.shift();
                
                try {
                    // Check if scheduled notification is ready
                    if (notification.scheduled && notification.sendAt > new Date()) {
                        this.notificationQueue.push(notification); // Put back in queue
                        this.isProcessing = false;
                        return;
                    }

                    await this.sendNotification(
                        notification.type,
                        notification.userId,
                        notification.data
                    );

                } catch (error) {
                    console.error('Queue processing error:', error);
                    
                    // Retry logic
                    if (notification.retries < this.maxRetries) {
                        notification.retries++;
                        setTimeout(() => {
                            this.notificationQueue.push(notification);
                        }, this.retryDelays[notification.retries - 1] || 15000);
                    }
                } finally {
                    this.isProcessing = false;
                }
            }
        }, 1000);
    }

    /**
     * Clean up old notifications
     */
    async cleanupOldNotifications() {
        const result = await db.run(`
            DELETE FROM notifications 
            WHERE expires_at < CURRENT_TIMESTAMP 
            OR (read_at IS NOT NULL AND created_at < datetime('now', '-30 days'))
        `);

        console.log(`Cleaned up ${result.changes} old notifications`);
        return result.changes;
    }

    /**
     * Bulk send notifications
     */
    async bulkSendNotification(type, userIds, data) {
        const results = [];
        
        for (const userId of userIds) {
            try {
                const result = await this.sendNotification(type, userId, data);
                results.push({ userId, success: result.success });
            } catch (error) {
                results.push({ userId, success: false, error: error.message });
            }
        }

        return {
            success: true,
            results,
            sent: results.filter(r => r.success).length,
            failed: results.filter(r => !r.success).length
        };
    }

    /**
     * Test notification
     */
    async testNotification(userId) {
        return await this.sendNotification('test', userId, {
            message: 'This is a test notification',
            timestamp: new Date().toISOString()
        });
    }
}

// Export singleton instance
module.exports = new NotificationService();
