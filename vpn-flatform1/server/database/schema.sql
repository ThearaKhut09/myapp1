-- VPN Platform Database Schema
-- PostgreSQL Schema for SecureVPN Platform

-- Create database
-- CREATE DATABASE vpn_platform;

-- Users table
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    is_verified BOOLEAN DEFAULT FALSE,
    verification_token VARCHAR(255),
    reset_token VARCHAR(255),
    reset_token_expires TIMESTAMP,
    subscription_status VARCHAR(20) DEFAULT 'inactive',
    subscription_plan VARCHAR(50),
    subscription_expires TIMESTAMP,
    devices_limit INTEGER DEFAULT 5,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE
);

-- VPN Servers table
CREATE TABLE vpn_servers (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    location VARCHAR(100) NOT NULL,
    country_code VARCHAR(2) NOT NULL,
    ip_address INET NOT NULL,
    port INTEGER NOT NULL,
    protocol VARCHAR(20) NOT NULL,
    max_capacity INTEGER DEFAULT 1000,
    current_load INTEGER DEFAULT 0,
    status VARCHAR(20) DEFAULT 'active',
    ping_latency INTEGER,
    bandwidth_mbps INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- User connections table
CREATE TABLE user_connections (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    server_id INTEGER REFERENCES vpn_servers(id),
    device_name VARCHAR(100),
    device_type VARCHAR(50),
    ip_address INET,
    connected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    disconnected_at TIMESTAMP,
    bytes_uploaded BIGINT DEFAULT 0,
    bytes_downloaded BIGINT DEFAULT 0,
    session_duration INTEGER DEFAULT 0,
    status VARCHAR(20) DEFAULT 'active'
);

-- Payments table
CREATE TABLE payments (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    payment_id VARCHAR(255) UNIQUE NOT NULL,
    payment_method VARCHAR(50) NOT NULL,
    amount DECIMAL(10, 2) NOT NULL,
    currency VARCHAR(10) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending',
    transaction_hash VARCHAR(255),
    plan_type VARCHAR(50) NOT NULL,
    payment_gateway VARCHAR(50),
    gateway_payment_id VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP,
    expires_at TIMESTAMP,
    metadata JSONB
);

-- Subscription plans table
CREATE TABLE subscription_plans (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    plan_type VARCHAR(50) UNIQUE NOT NULL,
    duration_months INTEGER NOT NULL,
    price DECIMAL(10, 2) NOT NULL,
    features JSONB NOT NULL,
    devices_limit INTEGER NOT NULL,
    bandwidth_limit_gb INTEGER,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- User devices table
CREATE TABLE user_devices (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    device_name VARCHAR(100) NOT NULL,
    device_type VARCHAR(50) NOT NULL,
    device_fingerprint VARCHAR(255) UNIQUE,
    last_ip INET,
    last_connected TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- User sessions table (for JWT tokens)
CREATE TABLE user_sessions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL,
    device_info JSONB,
    ip_address INET,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    revoked_at TIMESTAMP
);

-- Support tickets table
CREATE TABLE support_tickets (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    email VARCHAR(255) NOT NULL,
    subject VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    status VARCHAR(20) DEFAULT 'open',
    priority VARCHAR(20) DEFAULT 'medium',
    assigned_to INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    closed_at TIMESTAMP
);

-- Promo codes table
CREATE TABLE promo_codes (
    id SERIAL PRIMARY KEY,
    code VARCHAR(50) UNIQUE NOT NULL,
    discount_type VARCHAR(20) NOT NULL, -- 'percentage' or 'fixed'
    discount_value DECIMAL(10, 2) NOT NULL,
    max_uses INTEGER,
    current_uses INTEGER DEFAULT 0,
    valid_from TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    valid_until TIMESTAMP,
    applicable_plans JSONB, -- Array of plan types
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Usage statistics table
CREATE TABLE usage_statistics (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    bytes_uploaded BIGINT DEFAULT 0,
    bytes_downloaded BIGINT DEFAULT 0,
    connection_time INTEGER DEFAULT 0, -- in seconds
    servers_used JSONB, -- Array of server IDs used
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, date)
);

-- Admin logs table
CREATE TABLE admin_logs (
    id SERIAL PRIMARY KEY,
    admin_id INTEGER REFERENCES users(id),
    action VARCHAR(100) NOT NULL,
    target_type VARCHAR(50), -- 'user', 'server', 'payment', etc.
    target_id INTEGER,
    details JSONB,
    ip_address INET,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Server monitoring table
CREATE TABLE server_monitoring (
    id SERIAL PRIMARY KEY,
    server_id INTEGER REFERENCES vpn_servers(id) ON DELETE CASCADE,
    cpu_usage DECIMAL(5, 2),
    memory_usage DECIMAL(5, 2),
    disk_usage DECIMAL(5, 2),
    network_in_mbps DECIMAL(10, 2),
    network_out_mbps DECIMAL(10, 2),
    active_connections INTEGER,
    response_time_ms INTEGER,
    recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_subscription_status ON users(subscription_status);
CREATE INDEX idx_user_connections_user_id ON user_connections(user_id);
CREATE INDEX idx_user_connections_server_id ON user_connections(server_id);
CREATE INDEX idx_user_connections_connected_at ON user_connections(connected_at);
CREATE INDEX idx_payments_user_id ON payments(user_id);
CREATE INDEX idx_payments_status ON payments(status);
CREATE INDEX idx_payments_created_at ON payments(created_at);
CREATE INDEX idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX idx_user_sessions_expires_at ON user_sessions(expires_at);
CREATE INDEX idx_usage_statistics_user_id_date ON usage_statistics(user_id, date);
CREATE INDEX idx_server_monitoring_server_id ON server_monitoring(server_id);
CREATE INDEX idx_server_monitoring_recorded_at ON server_monitoring(recorded_at);

-- Insert default subscription plans
INSERT INTO subscription_plans (name, plan_type, duration_months, price, features, devices_limit, bandwidth_limit_gb) VALUES
('Monthly Basic', 'monthly', 1, 12.99, '{"servers": 50, "countries": 30, "support": "email"}', 5, NULL),
('Annual Premium', 'annual', 12, 79.99, '{"servers": 100, "countries": 60, "support": "priority", "streaming": true}', 10, NULL),
('Lifetime Premium', 'lifetime', 9999, 199.99, '{"servers": 100, "countries": 60, "support": "priority", "streaming": true, "unlimited": true}', 999, NULL);

-- Insert sample VPN servers
INSERT INTO vpn_servers (name, location, country_code, ip_address, port, protocol, max_capacity, bandwidth_mbps) VALUES
('US-East-1', 'New York, USA', 'US', '192.168.1.10', 1194, 'XBorad', 1000, 1000),
('US-West-1', 'Los Angeles, USA', 'US', '192.168.1.11', 1194, 'XBorad', 1000, 1000),
('UK-London-1', 'London, UK', 'GB', '192.168.1.20', 1194, 'XBorad', 800, 800),
('DE-Frankfurt-1', 'Frankfurt, Germany', 'DE', '192.168.1.30', 1194, 'XBorad', 800, 800),
('JP-Tokyo-1', 'Tokyo, Japan', 'JP', '192.168.1.40', 1194, 'XBorad', 600, 600),
('SG-Singapore-1', 'Singapore', 'SG', '192.168.1.50', 1194, 'XBorad', 600, 600),
('CA-Toronto-1', 'Toronto, Canada', 'CA', '192.168.1.60', 1194, 'XBorad', 500, 500),
('AU-Sydney-1', 'Sydney, Australia', 'AU', '192.168.1.70', 1194, 'XBorad', 500, 500);

-- Insert promo codes
INSERT INTO promo_codes (code, discount_type, discount_value, max_uses, valid_until, applicable_plans) VALUES
('WELCOME20', 'percentage', 20.00, 1000, '2025-12-31 23:59:59', '["monthly", "annual"]'),
('SAVE50', 'fixed', 50.00, 500, '2025-06-30 23:59:59', '["annual", "lifetime"]'),
('CRYPTO10', 'percentage', 10.00, NULL, '2025-12-31 23:59:59', '["monthly", "annual", "lifetime"]');

-- Create a function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers to auto-update the updated_at column
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_vpn_servers_updated_at BEFORE UPDATE ON vpn_servers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_subscription_plans_updated_at BEFORE UPDATE ON subscription_plans FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_user_devices_updated_at BEFORE UPDATE ON user_devices FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create a view for user subscription info
CREATE VIEW user_subscription_info AS
SELECT 
    u.id,
    u.email,
    u.first_name,
    u.last_name,
    u.subscription_status,
    u.subscription_plan,
    u.subscription_expires,
    sp.name as plan_name,
    sp.features,
    sp.devices_limit,
    u.created_at,
    u.last_login
FROM users u
LEFT JOIN subscription_plans sp ON u.subscription_plan = sp.plan_type;

-- Create a view for server statistics
CREATE VIEW server_statistics AS
SELECT 
    vs.id,
    vs.name,
    vs.location,
    vs.country_code,
    vs.status,
    vs.max_capacity,
    vs.current_load,
    ROUND((vs.current_load::float / vs.max_capacity::float) * 100, 2) as load_percentage,
    vs.ping_latency,
    vs.bandwidth_mbps,
    COUNT(uc.id) as active_connections
FROM vpn_servers vs
LEFT JOIN user_connections uc ON vs.id = uc.server_id AND uc.status = 'active'
GROUP BY vs.id, vs.name, vs.location, vs.country_code, vs.status, vs.max_capacity, vs.current_load, vs.ping_latency, vs.bandwidth_mbps;

-- Grant permissions (adjust as needed for your setup)
-- GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO vpn_user;
-- GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO vpn_user;
