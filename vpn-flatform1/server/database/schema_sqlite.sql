-- VPN Platform Database Schema - SQLite Version

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    first_name TEXT,
    last_name TEXT,
    email_verified INTEGER DEFAULT 0,
    verification_token TEXT,
    reset_token TEXT,
    reset_token_expires TEXT,
    subscription_status TEXT DEFAULT 'inactive',
    subscription_plan TEXT,
    subscription_expires TEXT,
    devices_limit INTEGER DEFAULT 5,
    role TEXT DEFAULT 'user',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    last_login TEXT,
    is_active INTEGER DEFAULT 1
);

-- VPN Servers table
CREATE TABLE IF NOT EXISTS vpn_servers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    location TEXT NOT NULL,
    country_code TEXT NOT NULL,
    ip_address TEXT NOT NULL,
    port INTEGER NOT NULL,
    protocol TEXT NOT NULL,
    max_capacity INTEGER DEFAULT 1000,
    current_load INTEGER DEFAULT 0,
    status TEXT DEFAULT 'active',
    ping_latency INTEGER,
    bandwidth_mbps INTEGER,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- User connections table
CREATE TABLE IF NOT EXISTS user_connections (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    server_id INTEGER,
    device_name TEXT,
    device_id TEXT,
    ip_address TEXT,
    connected_at TEXT DEFAULT CURRENT_TIMESTAMP,
    disconnected_at TEXT,
    bytes_sent INTEGER DEFAULT 0,
    bytes_received INTEGER DEFAULT 0,
    session_duration INTEGER DEFAULT 0,
    status TEXT DEFAULT 'connected',
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (server_id) REFERENCES vpn_servers(id)
);

-- Payment transactions table
CREATE TABLE IF NOT EXISTS payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    transaction_id TEXT UNIQUE NOT NULL,
    amount REAL NOT NULL,
    currency TEXT DEFAULT 'USD',
    payment_method TEXT NOT NULL,
    payment_provider TEXT,
    status TEXT DEFAULT 'pending',
    plan_type TEXT,
    plan_duration INTEGER,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    processed_at TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Subscription plans table
CREATE TABLE IF NOT EXISTS subscription_plans (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    price REAL NOT NULL,
    currency TEXT DEFAULT 'USD',
    duration_months INTEGER NOT NULL,
    features TEXT, -- JSON string
    device_limit INTEGER DEFAULT 5,
    bandwidth_limit INTEGER, -- GB per month, NULL for unlimited
    server_access TEXT DEFAULT 'all', -- 'all', 'premium', 'basic'
    is_active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- User subscriptions table
CREATE TABLE IF NOT EXISTS user_subscriptions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    plan_id INTEGER,
    payment_id INTEGER,
    starts_at TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    auto_renewal INTEGER DEFAULT 1,
    status TEXT DEFAULT 'active',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    cancelled_at TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (plan_id) REFERENCES subscription_plans(id),
    FOREIGN KEY (payment_id) REFERENCES payments(id)
);

-- Support tickets table
CREATE TABLE IF NOT EXISTS support_tickets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    subject TEXT NOT NULL,
    message TEXT NOT NULL,
    priority TEXT DEFAULT 'medium',
    status TEXT DEFAULT 'open',
    category TEXT,
    assigned_to INTEGER,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    closed_at TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Promotional codes table
CREATE TABLE IF NOT EXISTS promo_codes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT UNIQUE NOT NULL,
    description TEXT,
    discount_type TEXT NOT NULL, -- 'percentage', 'fixed'
    discount_value REAL NOT NULL,
    max_uses INTEGER,
    current_uses INTEGER DEFAULT 0,
    expires_at TEXT,
    is_active INTEGER DEFAULT 1,
    applicable_plans TEXT, -- JSON array of plan IDs
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Usage statistics table
CREATE TABLE IF NOT EXISTS usage_stats (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    date TEXT NOT NULL,
    bytes_uploaded INTEGER DEFAULT 0,
    bytes_downloaded INTEGER DEFAULT 0,
    connection_time INTEGER DEFAULT 0, -- in seconds
    sessions_count INTEGER DEFAULT 0,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Admin logs table
CREATE TABLE IF NOT EXISTS admin_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    admin_id INTEGER,
    action TEXT NOT NULL,
    target_type TEXT, -- 'user', 'server', 'payment', etc.
    target_id INTEGER,
    details TEXT, -- JSON string
    ip_address TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (admin_id) REFERENCES users(id)
);

-- System monitoring table
CREATE TABLE IF NOT EXISTS system_monitoring (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    metric_type TEXT NOT NULL,
    metric_value REAL NOT NULL,
    unit TEXT,
    timestamp TEXT DEFAULT CURRENT_TIMESTAMP,
    metadata TEXT -- JSON string for additional data
);

-- Insert default subscription plans
INSERT OR IGNORE INTO subscription_plans (name, price, currency, duration_months, features, device_limit, server_access) VALUES 
('Basic Monthly', 9.99, 'USD', 1, '["Unlimited bandwidth", "5 devices", "Basic servers", "24/7 support"]', 5, 'basic'),
('Pro Monthly', 14.99, 'USD', 1, '["Unlimited bandwidth", "10 devices", "Premium servers", "24/7 support", "Kill switch"]', 10, 'premium'),
('Ultimate Monthly', 19.99, 'USD', 1, '["Unlimited bandwidth", "Unlimited devices", "All servers", "24/7 support", "Kill switch", "Dedicated IP"]', -1, 'all'),
('Basic Yearly', 99.99, 'USD', 12, '["Unlimited bandwidth", "5 devices", "Basic servers", "24/7 support"]', 5, 'basic'),
('Pro Yearly', 149.99, 'USD', 12, '["Unlimited bandwidth", "10 devices", "Premium servers", "24/7 support", "Kill switch"]', 10, 'premium'),
('Ultimate Yearly', 199.99, 'USD', 12, '["Unlimited bandwidth", "Unlimited devices", "All servers", "24/7 support", "Kill switch", "Dedicated IP"]', -1, 'all');

-- Insert sample VPN servers
INSERT OR IGNORE INTO vpn_servers (name, location, country_code, ip_address, port, protocol, bandwidth_mbps) VALUES 
('US East 1', 'New York, USA', 'US', '192.168.1.1', 1194, 'OpenVPN', 1000),
('US West 1', 'Los Angeles, USA', 'US', '192.168.1.2', 1194, 'OpenVPN', 1000),
('UK London 1', 'London, UK', 'GB', '192.168.1.3', 1194, 'OpenVPN', 1000),
('Germany 1', 'Frankfurt, Germany', 'DE', '192.168.1.4', 1194, 'OpenVPN', 1000),
('Japan 1', 'Tokyo, Japan', 'JP', '192.168.1.5', 1194, 'OpenVPN', 1000),
('Canada 1', 'Toronto, Canada', 'CA', '192.168.1.6', 1194, 'OpenVPN', 1000),
('Australia 1', 'Sydney, Australia', 'AU', '192.168.1.7', 1194, 'OpenVPN', 1000),
('Netherlands 1', 'Amsterdam, Netherlands', 'NL', '192.168.1.8', 1194, 'OpenVPN', 1000);
