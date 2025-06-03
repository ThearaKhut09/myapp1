require('dotenv').config();

const config = {
    // Server Configuration
    server: {
        port: parseInt(process.env.PORT) || 3000,
        host: process.env.HOST || 'localhost',
        environment: process.env.NODE_ENV || 'development',
        trustProxy: process.env.TRUST_PROXY === 'true',
        requestTimeout: parseInt(process.env.REQUEST_TIMEOUT) || 30000,
        bodyLimit: process.env.BODY_LIMIT || '10mb'
    },

    // Database Configuration
    database: {
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT) || 3306,
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'vpn_platform',
        connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT) || 10,
        acquireTimeout: parseInt(process.env.DB_ACQUIRE_TIMEOUT) || 60000,
        timeout: parseInt(process.env.DB_TIMEOUT) || 60000,
        reconnect: process.env.DB_RECONNECT !== 'false',
        ssl: process.env.DB_SSL === 'true'
    },

    // Redis Configuration
    redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT) || 6379,
        password: process.env.REDIS_PASSWORD || '',
        db: parseInt(process.env.REDIS_DB) || 0,
        family: parseInt(process.env.REDIS_FAMILY) || 4,
        keyPrefix: process.env.REDIS_PREFIX || 'vpn:',
        retryDelayOnFailover: parseInt(process.env.REDIS_RETRY_DELAY) || 100,
        maxRetriesPerRequest: parseInt(process.env.REDIS_MAX_RETRIES) || 3
    },

    // JWT Configuration
    jwt: {
        secret: process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this-in-production',
        expiresIn: process.env.JWT_EXPIRES_IN || '24h',
        refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
        issuer: process.env.JWT_ISSUER || 'vpn-platform',
        algorithm: process.env.JWT_ALGORITHM || 'HS256'
    },

    // Security Configuration
    security: {
        // Rate Limiting
        rateLimit: {
            windowMs: parseInt(process.env.RATE_LIMIT_WINDOW) || 15 * 60 * 1000, // 15 minutes
            max: parseInt(process.env.RATE_LIMIT_MAX) || 100,
            skipSuccessfulRequests: process.env.RATE_LIMIT_SKIP_SUCCESS === 'true',
            skipFailedRequests: process.env.RATE_LIMIT_SKIP_FAILED === 'true'
        },
        
        // CORS
        cors: {
            origin: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000'],
            credentials: process.env.CORS_CREDENTIALS !== 'false',
            optionsSuccessStatus: parseInt(process.env.CORS_OPTIONS_STATUS) || 200
        },

        // Encryption
        encryption: {
            algorithm: process.env.ENCRYPTION_ALGORITHM || 'aes-256-gcm',
            key: process.env.ENCRYPTION_KEY || 'your-32-character-encryption-key-here',
            ivLength: parseInt(process.env.ENCRYPTION_IV_LENGTH) || 16
        },

        // Session
        session: {
            secret: process.env.SESSION_SECRET || 'your-session-secret-key',
            maxAge: parseInt(process.env.SESSION_MAX_AGE) || 24 * 60 * 60 * 1000, // 24 hours
            secure: process.env.SESSION_SECURE === 'true',
            httpOnly: process.env.SESSION_HTTP_ONLY !== 'false',
            sameSite: process.env.SESSION_SAME_SITE || 'strict'
        },

        // Brute Force Protection
        bruteForce: {
            freeRetries: parseInt(process.env.BRUTE_FORCE_FREE_RETRIES) || 5,
            minWait: parseInt(process.env.BRUTE_FORCE_MIN_WAIT) || 5 * 60 * 1000, // 5 minutes
            maxWait: parseInt(process.env.BRUTE_FORCE_MAX_WAIT) || 60 * 60 * 1000, // 1 hour
            failuresExpire: parseInt(process.env.BRUTE_FORCE_FAILURES_EXPIRE) || 24 * 60 * 60 * 1000 // 24 hours
        }
    },

    // Email Configuration
    email: {
        smtp: {
            host: process.env.SMTP_HOST || 'smtp.gmail.com',
            port: parseInt(process.env.SMTP_PORT) || 587,
            secure: process.env.SMTP_SECURE === 'true',
            auth: {
                user: process.env.SMTP_USER || '',
                pass: process.env.SMTP_PASS || ''
            }
        },
        from: {
            name: process.env.EMAIL_FROM_NAME || 'VPN Platform',
            address: process.env.EMAIL_FROM_ADDRESS || 'noreply@vpnplatform.com'
        },
        templates: {
            path: process.env.EMAIL_TEMPLATES_PATH || './templates/email',
            engine: process.env.EMAIL_TEMPLATE_ENGINE || 'handlebars'
        }
    },

    // Payment Configuration
    payment: {
        stripe: {
            publicKey: process.env.STRIPE_PUBLIC_KEY || '',
            secretKey: process.env.STRIPE_SECRET_KEY || '',
            webhookSecret: process.env.STRIPE_WEBHOOK_SECRET || '',
            apiVersion: process.env.STRIPE_API_VERSION || '2022-11-15'
        },
        paypal: {
            clientId: process.env.PAYPAL_CLIENT_ID || '',
            clientSecret: process.env.PAYPAL_CLIENT_SECRET || '',
            mode: process.env.PAYPAL_MODE || 'sandbox', // sandbox or live
            webhookId: process.env.PAYPAL_WEBHOOK_ID || ''
        },
        coinbase: {
            apiKey: process.env.COINBASE_API_KEY || '',
            webhookSecret: process.env.COINBASE_WEBHOOK_SECRET || '',
            apiVersion: process.env.COINBASE_API_VERSION || '2018-03-22'
        }
    },

    // VPN Configuration
    vpn: {
        protocols: {
            openvpn: {
                enabled: process.env.VPN_OPENVPN_ENABLED !== 'false',
                port: parseInt(process.env.VPN_OPENVPN_PORT) || 1194,
                protocol: process.env.VPN_OPENVPN_PROTOCOL || 'udp'
            },
            wireguard: {
                enabled: process.env.VPN_WIREGUARD_ENABLED === 'true',
                port: parseInt(process.env.VPN_WIREGUARD_PORT) || 51820,
                interface: process.env.VPN_WIREGUARD_INTERFACE || 'wg0'
            },
            ikev2: {
                enabled: process.env.VPN_IKEV2_ENABLED === 'true',
                port: parseInt(process.env.VPN_IKEV2_PORT) || 500
            }
        },
        servers: {
            maxConcurrentConnections: parseInt(process.env.VPN_MAX_CONNECTIONS) || 1000,
            connectionTimeout: parseInt(process.env.VPN_CONNECTION_TIMEOUT) || 30000,
            keepAliveInterval: parseInt(process.env.VPN_KEEP_ALIVE) || 60000
        }
    },

    // Logging Configuration
    logging: {
        level: process.env.LOG_LEVEL || 'info',
        file: {
            enabled: process.env.LOG_FILE_ENABLED !== 'false',
            path: process.env.LOG_FILE_PATH || './logs',
            maxSize: process.env.LOG_FILE_MAX_SIZE || '20m',
            maxFiles: parseInt(process.env.LOG_FILE_MAX_FILES) || 14,
            datePattern: process.env.LOG_FILE_DATE_PATTERN || 'YYYY-MM-DD'
        },
        console: {
            enabled: process.env.LOG_CONSOLE_ENABLED !== 'false',
            colorize: process.env.LOG_CONSOLE_COLORIZE !== 'false'
        }
    },

    // Analytics Configuration
    analytics: {
        enabled: process.env.ANALYTICS_ENABLED !== 'false',
        retention: {
            events: parseInt(process.env.ANALYTICS_EVENTS_RETENTION) || 90, // days
            sessions: parseInt(process.env.ANALYTICS_SESSIONS_RETENTION) || 30, // days
            errors: parseInt(process.env.ANALYTICS_ERRORS_RETENTION) || 180 // days
        },
        sampling: {
            rate: parseFloat(process.env.ANALYTICS_SAMPLING_RATE) || 1.0, // 0.0 to 1.0
            excludeHealthChecks: process.env.ANALYTICS_EXCLUDE_HEALTH !== 'false'
        }
    },

    // Backup Configuration
    backup: {
        enabled: process.env.BACKUP_ENABLED !== 'false',
        schedule: process.env.BACKUP_SCHEDULE || '0 2 * * *', // Daily at 2 AM
        retention: parseInt(process.env.BACKUP_RETENTION_DAYS) || 30,
        compression: process.env.BACKUP_COMPRESSION !== 'false',
        encryption: process.env.BACKUP_ENCRYPTION === 'true',
        destinations: {
            local: {
                enabled: process.env.BACKUP_LOCAL_ENABLED !== 'false',
                path: process.env.BACKUP_LOCAL_PATH || './backups'
            },
            s3: {
                enabled: process.env.BACKUP_S3_ENABLED === 'true',
                bucket: process.env.BACKUP_S3_BUCKET || '',
                region: process.env.BACKUP_S3_REGION || 'us-east-1',
                accessKeyId: process.env.BACKUP_S3_ACCESS_KEY || '',
                secretAccessKey: process.env.BACKUP_S3_SECRET_KEY || ''
            }
        }
    },

    // WebSocket Configuration
    websocket: {
        enabled: process.env.WEBSOCKET_ENABLED !== 'false',
        path: process.env.WEBSOCKET_PATH || '/socket.io',
        cors: {
            origin: process.env.WEBSOCKET_CORS_ORIGINS?.split(',') || ['http://localhost:3000'],
            credentials: process.env.WEBSOCKET_CORS_CREDENTIALS !== 'false'
        },
        pingTimeout: parseInt(process.env.WEBSOCKET_PING_TIMEOUT) || 60000,
        pingInterval: parseInt(process.env.WEBSOCKET_PING_INTERVAL) || 25000,
        maxHttpBufferSize: parseInt(process.env.WEBSOCKET_MAX_BUFFER) || 1e6
    },

    // Monitoring Configuration
    monitoring: {
        enabled: process.env.MONITORING_ENABLED !== 'false',
        interval: parseInt(process.env.MONITORING_INTERVAL) || 30000, // 30 seconds
        metrics: {
            cpu: process.env.MONITORING_CPU !== 'false',
            memory: process.env.MONITORING_MEMORY !== 'false',
            disk: process.env.MONITORING_DISK !== 'false',
            network: process.env.MONITORING_NETWORK !== 'false'
        },
        alerts: {
            enabled: process.env.MONITORING_ALERTS_ENABLED === 'true',
            thresholds: {
                cpu: parseInt(process.env.MONITORING_CPU_THRESHOLD) || 80,
                memory: parseInt(process.env.MONITORING_MEMORY_THRESHOLD) || 85,
                disk: parseInt(process.env.MONITORING_DISK_THRESHOLD) || 90
            }
        }
    },

    // Feature Flags
    features: {
        registration: process.env.FEATURE_REGISTRATION !== 'false',
        socialLogin: process.env.FEATURE_SOCIAL_LOGIN === 'true',
        twoFactorAuth: process.env.FEATURE_2FA === 'true',
        apiV2: process.env.FEATURE_API_V2 === 'true',
        betaFeatures: process.env.FEATURE_BETA === 'true'
    }
};

// Validation function
function validateConfig() {
    const errors = [];

    // Validate required fields
    if (!config.jwt.secret || config.jwt.secret === 'your-super-secret-jwt-key-change-this-in-production') {
        errors.push('JWT_SECRET must be set to a secure value');
    }

    if (!config.security.encryption.key || config.security.encryption.key === 'your-32-character-encryption-key-here') {
        errors.push('ENCRYPTION_KEY must be set to a secure 32-character value');
    }

    if (config.server.environment === 'production') {
        if (config.database.password === '') {
            errors.push('DB_PASSWORD must be set in production');
        }

        if (!config.email.smtp.auth.user || !config.email.smtp.auth.pass) {
            errors.push('SMTP credentials must be set in production');
        }
    }

    // Validate numeric ranges
    if (config.server.port < 1 || config.server.port > 65535) {
        errors.push('PORT must be between 1 and 65535');
    }

    if (config.database.connectionLimit < 1 || config.database.connectionLimit > 1000) {
        errors.push('DB_CONNECTION_LIMIT must be between 1 and 1000');
    }

    if (errors.length > 0) {
        console.error('Configuration validation errors:');
        errors.forEach(error => console.error(`  - ${error}`));
        throw new Error('Invalid configuration');
    }
}

// Environment-specific overrides
if (config.server.environment === 'development') {
    config.logging.level = 'debug';
    config.security.cors.origin = ['http://localhost:3000', 'http://localhost:8080', 'http://127.0.0.1:3000'];
}

if (config.server.environment === 'test') {
    config.database.database = config.database.database + '_test';
    config.logging.level = 'error';
    config.analytics.enabled = false;
}

// Validate configuration on load
validateConfig();

module.exports = config;
