const express = require('express');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');

const router = express.Router();

// In-memory storage (replace with actual database in production)
const vpnConfigs = new Map();
const serverNodes = new Map();
const userConnections = new Map();

// Rate limiting for VPN endpoints
const vpnLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 20, // limit each IP to 20 requests per windowMs
    message: 'Too many VPN requests, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
});

// Initialize server nodes
function initializeServerNodes() {
    const servers = [
        { id: 'us-east-1', name: 'US East (New York)', country: 'US', flag: '🇺🇸', city: 'New York', protocols: ['XBorad', 'V2bx', 'WireGuard'] },
        { id: 'us-west-1', name: 'US West (Los Angeles)', country: 'US', flag: '🇺🇸', city: 'Los Angeles', protocols: ['XBorad', 'V2bx', 'WireGuard'] },
        { id: 'uk-london-1', name: 'UK (London)', country: 'GB', flag: '🇬🇧', city: 'London', protocols: ['XBorad', 'V2bx', 'WireGuard'] },
        { id: 'de-frankfurt-1', name: 'Germany (Frankfurt)', country: 'DE', flag: '🇩🇪', city: 'Frankfurt', protocols: ['XBorad', 'V2bx', 'WireGuard', 'udp2raw'] },
        { id: 'jp-tokyo-1', name: 'Japan (Tokyo)', country: 'JP', flag: '🇯🇵', city: 'Tokyo', protocols: ['XBorad', 'V2bx', 'WireGuard'] },
        { id: 'sg-singapore-1', name: 'Singapore', country: 'SG', flag: '🇸🇬', city: 'Singapore', protocols: ['XBorad', 'V2bx', 'WireGuard'] },
        { id: 'au-sydney-1', name: 'Australia (Sydney)', country: 'AU', flag: '🇦🇺', city: 'Sydney', protocols: ['XBorad', 'V2bx', 'WireGuard'] },
    ];

    servers.forEach(server => {
        serverNodes.set(server.id, {
            ...server,
            status: 'online',
            load: Math.floor(Math.random() * 80) + 10, // 10-90% load
            ping: Math.floor(Math.random() * 100) + 20, // 20-120ms ping
            bandwidth: '1 Gbps',
            createdAt: new Date().toISOString(),
            lastUpdated: new Date().toISOString()
        });
    });
}

// Initialize servers on startup
initializeServerNodes();

// Middleware to verify JWT token (simplified version)
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Access token required' });
    }

    // In a real implementation, verify the JWT token here
    // For now, we'll mock it
    req.user = { userId: 'mock-user-id', email: 'mock@example.com' };
    next();
};

// Get available servers
router.get('/servers', (req, res) => {
    try {
        const servers = Array.from(serverNodes.values()).map(server => ({
            id: server.id,
            name: server.name,
            country: server.country,
            flag: server.flag,
            city: server.city,
            status: server.status,
            load: server.load,
            ping: server.ping,
            protocols: server.protocols,
            bandwidth: server.bandwidth
        }));

        res.json({
            data: servers
        });
    } catch (error) {
        console.error('Error fetching servers:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get server details
router.get('/servers/:serverId', (req, res) => {
    try {
        const { serverId } = req.params;
        const server = serverNodes.get(serverId);

        if (!server) {
            return res.status(404).json({ error: 'Server not found' });
        }

        res.json({
            data: server
        });
    } catch (error) {
        console.error('Error fetching server details:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Generate VPN configuration
router.post('/config', vpnLimiter, authenticateToken, (req, res) => {
    try {
        const { serverId, protocol, deviceName } = req.body;

        if (!serverId || !protocol) {
            return res.status(400).json({ error: 'Server ID and protocol are required' });
        }

        const server = serverNodes.get(serverId);
        if (!server) {
            return res.status(404).json({ error: 'Server not found' });
        }

        if (!server.protocols.includes(protocol)) {
            return res.status(400).json({ error: 'Protocol not supported by this server' });
        }

        const configId = crypto.randomUUID();
        const configData = generateVPNConfig(server, protocol, req.user.userId, deviceName);

        vpnConfigs.set(configId, {
            id: configId,
            userId: req.user.userId,
            serverId,
            protocol,
            deviceName: deviceName || 'Unknown Device',
            config: configData,
            createdAt: new Date().toISOString(),
            lastUsed: null,
            isActive: true
        });

        res.json({
            message: 'VPN configuration generated successfully',
            data: {
                configId,
                serverId,
                serverName: server.name,
                protocol,
                config: configData,
                downloadUrl: `/api/vpn/config/${configId}/download`
            }
        });

    } catch (error) {
        console.error('Config generation error:', error);
        res.status(500).json({ error: 'Internal server error during config generation' });
    }
});

// Download VPN configuration file
router.get('/config/:configId/download', authenticateToken, (req, res) => {
    try {
        const { configId } = req.params;
        const config = vpnConfigs.get(configId);

        if (!config) {
            return res.status(404).json({ error: 'Configuration not found' });
        }

        if (config.userId !== req.user.userId) {
            return res.status(403).json({ error: 'Access denied' });
        }

        const server = serverNodes.get(config.serverId);
        const filename = `${server.city}-${config.protocol}.conf`;

        res.setHeader('Content-Type', 'application/octet-stream');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.send(config.config);

    } catch (error) {
        console.error('Config download error:', error);
        res.status(500).json({ error: 'Internal server error during config download' });
    }
});

// Get user's VPN configurations
router.get('/configs', authenticateToken, (req, res) => {
    try {
        const userConfigs = Array.from(vpnConfigs.values())
            .filter(config => config.userId === req.user.userId)
            .map(config => {
                const server = serverNodes.get(config.serverId);
                return {
                    id: config.id,
                    serverId: config.serverId,
                    serverName: server ? server.name : 'Unknown Server',
                    protocol: config.protocol,
                    deviceName: config.deviceName,
                    createdAt: config.createdAt,
                    lastUsed: config.lastUsed,
                    isActive: config.isActive
                };
            })
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        res.json({
            data: userConfigs
        });

    } catch (error) {
        console.error('Configs fetch error:', error);
        res.status(500).json({ error: 'Internal server error while fetching configurations' });
    }
});

// Delete VPN configuration
router.delete('/config/:configId', authenticateToken, (req, res) => {
    try {
        const { configId } = req.params;
        const config = vpnConfigs.get(configId);

        if (!config) {
            return res.status(404).json({ error: 'Configuration not found' });
        }

        if (config.userId !== req.user.userId) {
            return res.status(403).json({ error: 'Access denied' });
        }

        vpnConfigs.delete(configId);

        res.json({
            message: 'Configuration deleted successfully'
        });

    } catch (error) {
        console.error('Config deletion error:', error);
        res.status(500).json({ error: 'Internal server error during config deletion' });
    }
});

// Record connection status
router.post('/connection', authenticateToken, (req, res) => {
    try {
        const { configId, status, clientIP } = req.body;

        if (!configId || !status) {
            return res.status(400).json({ error: 'Config ID and status are required' });
        }

        const config = vpnConfigs.get(configId);
        if (!config || config.userId !== req.user.userId) {
            return res.status(404).json({ error: 'Configuration not found' });
        }

        const connectionId = crypto.randomUUID();
        const connectionData = {
            id: connectionId,
            userId: req.user.userId,
            configId,
            status, // 'connected', 'disconnected'
            clientIP,
            timestamp: new Date().toISOString()
        };

        userConnections.set(connectionId, connectionData);

        // Update config last used time
        if (status === 'connected') {
            config.lastUsed = new Date().toISOString();
        }

        res.json({
            message: 'Connection status recorded',
            data: connectionData
        });

    } catch (error) {
        console.error('Connection recording error:', error);
        res.status(500).json({ error: 'Internal server error while recording connection' });
    }
});

// Get connection history
router.get('/connections', authenticateToken, (req, res) => {
    try {
        const userConnectionHistory = Array.from(userConnections.values())
            .filter(conn => conn.userId === req.user.userId)
            .map(conn => {
                const config = vpnConfigs.get(conn.configId);
                const server = config ? serverNodes.get(config.serverId) : null;
                return {
                    id: conn.id,
                    configId: conn.configId,
                    serverName: server ? server.name : 'Unknown Server',
                    protocol: config ? config.protocol : 'Unknown',
                    status: conn.status,
                    timestamp: conn.timestamp
                };
            })
            .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
            .slice(0, 50); // Last 50 connections

        res.json({
            data: userConnectionHistory
        });

    } catch (error) {
        console.error('Connection history error:', error);
        res.status(500).json({ error: 'Internal server error while fetching connection history' });
    }
});

// Get supported protocols
router.get('/protocols', (req, res) => {
    try {
        const protocols = [
            {
                name: 'XBorad',
                description: 'Advanced proxy protocol with high performance',
                features: ['Fast speeds', 'Strong encryption', 'Low latency'],
                platforms: ['Windows', 'macOS', 'Android', 'iOS']
            },
            {
                name: 'V2bx',
                description: 'High-performance protocol with advanced features',
                features: ['Traffic masking', 'Multiple transports', 'Censorship resistant'],
                platforms: ['Windows', 'macOS', 'Android', 'iOS']
            },
            {
                name: 'WireGuard',
                description: 'Modern VPN protocol with excellent performance',
                features: ['Lightweight', 'Fast handshake', 'Strong cryptography'],
                platforms: ['Windows', 'macOS', 'Linux', 'Android', 'iOS']
            },
            {
                name: 'udp2raw',
                description: 'UDP tunnel over TCP for bypassing restrictions',
                features: ['TCP disguise', 'Packet scrambling', 'Anti-detection'],
                platforms: ['Windows', 'macOS', 'Linux']
            }
        ];

        res.json({
            data: protocols
        });
    } catch (error) {
        console.error('Error fetching protocols:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Update server status (admin endpoint - simplified)
router.put('/servers/:serverId/status', (req, res) => {
    try {
        const { serverId } = req.params;
        const { status, load } = req.body;

        const server = serverNodes.get(serverId);
        if (!server) {
            return res.status(404).json({ error: 'Server not found' });
        }

        if (status) {
            server.status = status;
        }
        if (load !== undefined) {
            server.load = load;
        }
        server.lastUpdated = new Date().toISOString();

        res.json({
            message: 'Server status updated',
            data: server
        });

    } catch (error) {
        console.error('Server update error:', error);
        res.status(500).json({ error: 'Internal server error while updating server' });
    }
});

// Helper function to generate VPN configuration
function generateVPNConfig(server, protocol, userId, deviceName) {
    const baseConfig = {
        server: server.name,
        city: server.city,
        country: server.country,
        protocol: protocol,
        userId: userId,
        deviceName: deviceName || 'Device',
        generatedAt: new Date().toISOString()
    };

    switch (protocol) {
        case 'WireGuard':
            return generateWireGuardConfig(server, baseConfig);
        case 'XBorad':
            return generateXBoradConfig(server, baseConfig);
        case 'V2bx':
            return generateV2bxConfig(server, baseConfig);
        case 'udp2raw':
            return generateUdp2rawConfig(server, baseConfig);
        default:
            throw new Error('Unsupported protocol');
    }
}

function generateWireGuardConfig(server, baseConfig) {
    const privateKey = crypto.randomBytes(32).toString('base64');
    const publicKey = crypto.randomBytes(32).toString('base64');
    
    return `[Interface]
PrivateKey = ${privateKey}
Address = 10.0.0.2/24
DNS = 1.1.1.1, 8.8.8.8

[Peer]
PublicKey = ${publicKey}
Endpoint = ${server.city.toLowerCase()}.securevpn.example:51820
AllowedIPs = 0.0.0.0/0
PersistentKeepalive = 25

# Generated for: ${baseConfig.deviceName}
# Server: ${server.name}
# Generated at: ${baseConfig.generatedAt}`;
}

function generateXBoradConfig(server, baseConfig) {
    const uuid = crypto.randomUUID();
    return JSON.stringify({
        "log": {
            "loglevel": "warning"
        },
        "inbounds": [{
            "port": 1080,
            "protocol": "socks",
            "settings": {
                "auth": "noauth",
                "udp": true
            }
        }],
        "outbounds": [{
            "protocol": "xboard",
            "settings": {
                "vnext": [{
                    "address": `${server.city.toLowerCase()}.securevpn.example`,
                    "port": 443,
                    "users": [{
                        "id": uuid,
                        "security": "auto"
                    }]
                }]
            },
            "streamSettings": {
                "network": "tcp",
                "security": "tls"
            }
        }],
        "meta": {
            "server": server.name,
            "device": baseConfig.deviceName,
            "generated": baseConfig.generatedAt
        }
    }, null, 2);
}

function generateV2bxConfig(server, baseConfig) {
    const uuid = crypto.randomUUID();
    return JSON.stringify({
        "log": {
            "loglevel": "warning"
        },
        "inbounds": [{
            "port": 1080,
            "protocol": "socks",
            "settings": {
                "auth": "noauth",
                "udp": true
            }
        }],
        "outbounds": [{
            "protocol": "v2bx",
            "settings": {
                "vnext": [{
                    "address": `${server.city.toLowerCase()}.securevpn.example`,
                    "port": 443,
                    "users": [{
                        "id": uuid,
                        "security": "aes-128-gcm"
                    }]
                }]
            },
            "streamSettings": {
                "network": "ws",
                "security": "tls",
                "wsSettings": {
                    "path": "/v2ray"
                }
            }
        }],
        "meta": {
            "server": server.name,
            "device": baseConfig.deviceName,
            "generated": baseConfig.generatedAt
        }
    }, null, 2);
}

function generateUdp2rawConfig(server, baseConfig) {
    return `# udp2raw configuration
# Server: ${server.name}
# Device: ${baseConfig.deviceName}
# Generated: ${baseConfig.generatedAt}

-c
-r ${server.city.toLowerCase()}.securevpn.example:4096
-l 0.0.0.0:1194
--raw-mode faketcp
--cipher-mode aes128cbc
--auth-mode md5
--key ${crypto.randomBytes(16).toString('hex')}`;
}

module.exports = router;