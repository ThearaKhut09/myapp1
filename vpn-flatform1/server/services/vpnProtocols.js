const { spawn, exec } = require('child_process');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const config = require('../config');
const { Logger } = require('../middleware/logger');
const logger = new Logger();
const analytics = require('./analytics');

class VPNProtocolManager {
    constructor() {
        this.protocols = new Map();
        this.activeConnections = new Map();
        this.serverConfigs = new Map();
        this.initialized = false;
    }

    async initialize() {
        try {
            logger.info('Initializing VPN Protocol Manager...');

            // Initialize protocol handlers
            if (config.vpn.protocols.openvpn.enabled) {
                await this.initializeOpenVPN();
            }

            if (config.vpn.protocols.wireguard.enabled) {
                await this.initializeWireGuard();
            }

            if (config.vpn.protocols.ikev2.enabled) {
                await this.initializeIKEv2();
            }

            // Start monitoring
            this.startConnectionMonitoring();

            this.initialized = true;
            logger.info('VPN Protocol Manager initialized successfully');
        } catch (error) {
            logger.error('Failed to initialize VPN Protocol Manager:', error);
            throw error;
        }
    }

    // OpenVPN Protocol Management
    async initializeOpenVPN() {
        logger.info('Initializing OpenVPN protocol...');

        const openVPNConfig = {
            name: 'OpenVPN',
            type: 'openvpn',
            port: config.vpn.protocols.openvpn.port,
            protocol: config.vpn.protocols.openvpn.protocol,
            configPath: path.join(__dirname, '../configs/openvpn'),
            status: 'stopped',
            connections: new Map()
        };

        // Ensure config directory exists
        await this.ensureDirectory(openVPNConfig.configPath);

        // Generate server configuration
        await this.generateOpenVPNConfig(openVPNConfig);

        // Generate certificates
        await this.generateOpenVPNCertificates(openVPNConfig);

        this.protocols.set('openvpn', openVPNConfig);
        logger.info('OpenVPN protocol initialized');
    }

    async generateOpenVPNConfig(config) {
        const serverConfig = `
# OpenVPN Server Configuration
port ${config.port}
proto ${config.protocol}
dev tun
server 10.8.0.0 255.255.255.0
ifconfig-pool-persist ipp.txt
keepalive 10 120
comp-lzo
persist-key
persist-tun
status openvpn-status.log
verb 3
mute 20

# Security settings
cipher AES-256-CBC
auth SHA256
tls-auth ta.key 0
tls-version-min 1.2

# Certificate files
ca ca.crt
cert server.crt
key server.key
dh dh2048.pem

# Client configuration
client-to-client
duplicate-cn
max-clients ${config.vpn.servers.maxConcurrentConnections}

# Logging
log-append /var/log/openvpn.log

# Push routes to clients
push "redirect-gateway def1 bypass-dhcp"
push "dhcp-option DNS 8.8.8.8"
push "dhcp-option DNS 8.8.4.4"

# User management
username-as-common-name
plugin /usr/lib/openvpn/openvpn-plugin-auth-pam.so login
verify-client-cert none

# Management interface
management 127.0.0.1 7505
`;

        const configPath = path.join(config.configPath, 'server.conf');
        await fs.writeFile(configPath, serverConfig.trim());
        logger.info('OpenVPN server configuration generated');
    }

    async generateOpenVPNCertificates(config) {
        logger.info('Generating OpenVPN certificates...');

        const certPath = config.configPath;
        const easyRsaPath = path.join(certPath, 'easy-rsa');

        try {
            // Create Easy-RSA directory structure
            await this.ensureDirectory(easyRsaPath);

            // Generate CA
            await this.executeCommand(`cd ${easyRsaPath} && easyrsa init-pki`);
            await this.executeCommand(`cd ${easyRsaPath} && easyrsa --batch build-ca nopass`);

            // Generate server certificate
            await this.executeCommand(`cd ${easyRsaPath} && easyrsa --batch build-server-full server nopass`);

            // Generate DH parameters
            await this.executeCommand(`cd ${easyRsaPath} && easyrsa gen-dh`);

            // Generate TLS auth key
            await this.executeCommand(`openvpn --genkey --secret ${path.join(certPath, 'ta.key')}`);

            // Copy certificates to config directory
            const pkiPath = path.join(easyRsaPath, 'pki');
            await this.copyFile(path.join(pkiPath, 'ca.crt'), path.join(certPath, 'ca.crt'));
            await this.copyFile(path.join(pkiPath, 'issued/server.crt'), path.join(certPath, 'server.crt'));
            await this.copyFile(path.join(pkiPath, 'private/server.key'), path.join(certPath, 'server.key'));
            await this.copyFile(path.join(pkiPath, 'dh.pem'), path.join(certPath, 'dh2048.pem'));

            logger.info('OpenVPN certificates generated successfully');
        } catch (error) {
            logger.warn('Certificate generation failed, using self-signed certificates');
            await this.generateSelfSignedCertificates(certPath);
        }
    }

    // WireGuard Protocol Management
    async initializeWireGuard() {
        logger.info('Initializing WireGuard protocol...');

        const wireGuardConfig = {
            name: 'WireGuard',
            type: 'wireguard',
            port: config.vpn.protocols.wireguard.port,
            interface: config.vpn.protocols.wireguard.interface,
            configPath: path.join(__dirname, '../configs/wireguard'),
            status: 'stopped',
            connections: new Map(),
            keys: {}
        };

        await this.ensureDirectory(wireGuardConfig.configPath);
        await this.generateWireGuardConfig(wireGuardConfig);

        this.protocols.set('wireguard', wireGuardConfig);
        logger.info('WireGuard protocol initialized');
    }

    async generateWireGuardConfig(config) {
        // Generate server keys
        const privateKey = await this.generateWireGuardKey();
        const publicKey = await this.generateWireGuardPublicKey(privateKey);

        config.keys = { privateKey, publicKey };

        const serverConfig = `
[Interface]
PrivateKey = ${privateKey}
Address = 10.13.13.1/24
ListenPort = ${config.port}
SaveConfig = true

# Firewall rules
PostUp = iptables -A FORWARD -i ${config.interface} -j ACCEPT; iptables -A FORWARD -o ${config.interface} -j ACCEPT; iptables -t nat -A POSTROUTING -o eth0 -j MASQUERADE
PostDown = iptables -D FORWARD -i ${config.interface} -j ACCEPT; iptables -D FORWARD -o ${config.interface} -j ACCEPT; iptables -t nat -D POSTROUTING -o eth0 -j MASQUERADE

# DNS
DNS = 8.8.8.8, 8.8.4.4
`;

        const configPath = path.join(config.configPath, `${config.interface}.conf`);
        await fs.writeFile(configPath, serverConfig.trim());
        logger.info('WireGuard server configuration generated');
    }

    async generateWireGuardKey() {
        return new Promise((resolve, reject) => {
            exec('wg genkey', (error, stdout, stderr) => {
                if (error) {
                    reject(error);
                } else {
                    resolve(stdout.trim());
                }
            });
        });
    }

    async generateWireGuardPublicKey(privateKey) {
        return new Promise((resolve, reject) => {
            const process = spawn('wg', ['pubkey']);
            process.stdin.write(privateKey);
            process.stdin.end();

            let output = '';
            process.stdout.on('data', (data) => {
                output += data.toString();
            });

            process.on('close', (code) => {
                if (code === 0) {
                    resolve(output.trim());
                } else {
                    reject(new Error(`Process exited with code ${code}`));
                }
            });
        });
    }

    // IKEv2 Protocol Management
    async initializeIKEv2() {
        logger.info('Initializing IKEv2 protocol...');

        const ikev2Config = {
            name: 'IKEv2',
            type: 'ikev2',
            port: config.vpn.protocols.ikev2.port,
            configPath: path.join(__dirname, '../configs/ikev2'),
            status: 'stopped',
            connections: new Map()
        };

        await this.ensureDirectory(ikev2Config.configPath);
        await this.generateIKEv2Config(ikev2Config);

        this.protocols.set('ikev2', ikev2Config);
        logger.info('IKEv2 protocol initialized');
    }

    async generateIKEv2Config(config) {
        const serverConfig = `
# IKEv2 Server Configuration
config setup
    charondebug="ike 1, knl 1, cfg 0"
    uniqueids=no

conn ikev2-vpn
    auto=add
    compress=no
    type=tunnel
    keyexchange=ikev2
    fragmentation=yes
    forceencaps=yes
    dpdaction=clear
    dpddelay=300s
    rekey=no
    left=%any
    leftid=@server.vpn.local
    leftcert=server.cert.pem
    leftsendcert=always
    leftsubnet=0.0.0.0/0
    right=%any
    rightid=%any
    rightsourceip=10.10.10.0/24
    rightdns=8.8.8.8,8.8.4.4
    rightsendcert=never
    eap_identity=%identity
    ike=chacha20poly1305-sha256-curve25519-prfsha256,aes256gcm16-sha384-prfsha384-ecp384,aes256-sha1-modp1024,aes128-sha1-modp1024,3des-sha1-modp1024!
    esp=chacha20poly1305-sha256,aes256gcm16-ecp384,aes256-sha256,aes256-sha1,3des-sha1!
`;

        const configPath = path.join(config.configPath, 'ipsec.conf');
        await fs.writeFile(configPath, serverConfig.trim());
        logger.info('IKEv2 server configuration generated');
    }

    // Protocol Control Methods
    async startProtocol(protocolType) {
        const protocol = this.protocols.get(protocolType);
        if (!protocol) {
            throw new Error(`Protocol ${protocolType} not found`);
        }

        if (protocol.status === 'running') {
            logger.warn(`Protocol ${protocolType} is already running`);
            return;
        }

        try {
            switch (protocolType) {
                case 'openvpn':
                    await this.startOpenVPN(protocol);
                    break;
                case 'wireguard':
                    await this.startWireGuard(protocol);
                    break;
                case 'ikev2':
                    await this.startIKEv2(protocol);
                    break;
                default:
                    throw new Error(`Unsupported protocol: ${protocolType}`);
            }

            protocol.status = 'running';
            logger.info(`${protocol.name} protocol started successfully`);
            
            analytics.track('vpn.protocol_started', {
                protocol: protocolType,
                port: protocol.port
            });

        } catch (error) {
            protocol.status = 'error';
            logger.error(`Failed to start ${protocol.name}:`, error);
            throw error;
        }
    }

    async stopProtocol(protocolType) {
        const protocol = this.protocols.get(protocolType);
        if (!protocol) {
            throw new Error(`Protocol ${protocolType} not found`);
        }

        if (protocol.status === 'stopped') {
            logger.warn(`Protocol ${protocolType} is already stopped`);
            return;
        }

        try {
            switch (protocolType) {
                case 'openvpn':
                    await this.stopOpenVPN(protocol);
                    break;
                case 'wireguard':
                    await this.stopWireGuard(protocol);
                    break;
                case 'ikev2':
                    await this.stopIKEv2(protocol);
                    break;
            }

            protocol.status = 'stopped';
            logger.info(`${protocol.name} protocol stopped successfully`);
            
            analytics.track('vpn.protocol_stopped', {
                protocol: protocolType
            });

        } catch (error) {
            logger.error(`Failed to stop ${protocol.name}:`, error);
            throw error;
        }
    }

    // Client Configuration Generation
    async generateClientConfig(protocolType, clientId, userInfo = {}) {
        const protocol = this.protocols.get(protocolType);
        if (!protocol) {
            throw new Error(`Protocol ${protocolType} not found`);
        }

        switch (protocolType) {
            case 'openvpn':
                return await this.generateOpenVPNClientConfig(protocol, clientId, userInfo);
            case 'wireguard':
                return await this.generateWireGuardClientConfig(protocol, clientId, userInfo);
            case 'ikev2':
                return await this.generateIKEv2ClientConfig(protocol, clientId, userInfo);
            default:
                throw new Error(`Client config generation not supported for ${protocolType}`);
        }
    }

    async generateOpenVPNClientConfig(protocol, clientId, userInfo) {
        const clientConfig = `
client
dev tun
proto ${protocol.protocol}
remote ${process.env.SERVER_IP || 'your-server-ip'} ${protocol.port}
resolv-retry infinite
nobind
persist-key
persist-tun
comp-lzo
verb 3

# Security
cipher AES-256-CBC
auth SHA256
tls-version-min 1.2

# Authentication
auth-user-pass

# Certificate data will be embedded here
<ca>
${await this.readCertificate(path.join(protocol.configPath, 'ca.crt'))}
</ca>

<tls-auth>
${await this.readCertificate(path.join(protocol.configPath, 'ta.key'))}
</tls-auth>
key-direction 1
`;

        analytics.track('vpn.client_config_generated', {
            protocol: 'openvpn',
            clientId,
            userId: userInfo.id
        });

        return clientConfig.trim();
    }

    async generateWireGuardClientConfig(protocol, clientId, userInfo) {
        const clientPrivateKey = await this.generateWireGuardKey();
        const clientPublicKey = await this.generateWireGuardPublicKey(clientPrivateKey);

        // Add client to server config
        await this.addWireGuardPeer(protocol, clientPublicKey, clientId);

        const clientConfig = `
[Interface]
PrivateKey = ${clientPrivateKey}
Address = 10.13.13.${this.getNextClientIP(protocol)}/32
DNS = 8.8.8.8

[Peer]
PublicKey = ${protocol.keys.publicKey}
AllowedIPs = 0.0.0.0/0
Endpoint = ${process.env.SERVER_IP || 'your-server-ip'}:${protocol.port}
PersistentKeepalive = 21
`;

        analytics.track('vpn.client_config_generated', {
            protocol: 'wireguard',
            clientId,
            userId: userInfo.id
        });

        return clientConfig.trim();
    }

    // Connection Management
    async addConnection(protocolType, connectionInfo) {
        const protocol = this.protocols.get(protocolType);
        if (!protocol) {
            throw new Error(`Protocol ${protocolType} not found`);
        }

        const connectionId = connectionInfo.id || this.generateConnectionId();
        const connection = {
            id: connectionId,
            protocol: protocolType,
            clientIP: connectionInfo.clientIP,
            serverIP: connectionInfo.serverIP,
            userId: connectionInfo.userId,
            startTime: new Date(),
            bytesReceived: 0,
            bytesSent: 0,
            status: 'active'
        };

        protocol.connections.set(connectionId, connection);
        this.activeConnections.set(connectionId, connection);

        analytics.track('vpn.connection_established', {
            protocol: protocolType,
            connectionId,
            userId: connectionInfo.userId,
            clientIP: connectionInfo.clientIP
        });

        logger.info(`New ${protocolType} connection established:`, connectionId);
        return connection;
    }

    async removeConnection(connectionId, reason = 'disconnected') {
        const connection = this.activeConnections.get(connectionId);
        if (!connection) {
            return;
        }

        const protocol = this.protocols.get(connection.protocol);
        if (protocol) {
            protocol.connections.delete(connectionId);
        }

        connection.endTime = new Date();
        connection.duration = connection.endTime - connection.startTime;
        connection.status = 'disconnected';

        this.activeConnections.delete(connectionId);

        analytics.track('vpn.connection_terminated', {
            protocol: connection.protocol,
            connectionId,
            userId: connection.userId,
            duration: connection.duration,
            bytesTransferred: connection.bytesReceived + connection.bytesSent,
            reason
        });

        logger.info(`${connection.protocol} connection terminated:`, connectionId);
    }

    // Utility Methods
    async ensureDirectory(dirPath) {
        try {
            await fs.access(dirPath);
        } catch {
            await fs.mkdir(dirPath, { recursive: true });
        }
    }

    async executeCommand(command) {
        return new Promise((resolve, reject) => {
            exec(command, (error, stdout, stderr) => {
                if (error) {
                    reject(error);
                } else {
                    resolve(stdout);
                }
            });
        });
    }

    async copyFile(src, dest) {
        try {
            await fs.copyFile(src, dest);
        } catch (error) {
            logger.warn(`Failed to copy ${src} to ${dest}:`, error.message);
        }
    }

    async readCertificate(filePath) {
        try {
            return await fs.readFile(filePath, 'utf8');
        } catch (error) {
            logger.warn(`Failed to read certificate ${filePath}:`, error.message);
            return '';
        }
    }

    generateConnectionId() {
        return crypto.randomBytes(16).toString('hex');
    }

    getNextClientIP(protocol) {
        const usedIPs = new Set();
        for (const [, connection] of protocol.connections) {
            if (connection.clientIP) {
                const lastOctet = connection.clientIP.split('.').pop();
                usedIPs.add(parseInt(lastOctet));
            }
        }

        for (let i = 2; i < 255; i++) {
            if (!usedIPs.has(i)) {
                return i;
            }
        }
        return 2; // fallback
    }

    // Monitoring and Statistics
    startConnectionMonitoring() {
        setInterval(() => {
            this.updateConnectionStats();
        }, 30000); // Update every 30 seconds
    }

    async updateConnectionStats() {
        for (const [protocolType, protocol] of this.protocols) {
            if (protocol.status === 'running') {
                try {
                    const stats = await this.getProtocolStats(protocolType);
                    protocol.stats = stats;
                } catch (error) {
                    logger.warn(`Failed to update stats for ${protocolType}:`, error.message);
                }
            }
        }
    }

    async getProtocolStats(protocolType) {
        const protocol = this.protocols.get(protocolType);
        if (!protocol) return null;

        return {
            activeConnections: protocol.connections.size,
            totalBytesReceived: Array.from(protocol.connections.values())
                .reduce((sum, conn) => sum + conn.bytesReceived, 0),
            totalBytesSent: Array.from(protocol.connections.values())
                .reduce((sum, conn) => sum + conn.bytesSent, 0),
            uptime: protocol.status === 'running' ? Date.now() - protocol.startTime : 0
        };
    }

    // Public API Methods
    getProtocolStatus(protocolType) {
        const protocol = this.protocols.get(protocolType);
        return protocol ? {
            name: protocol.name,
            type: protocol.type,
            status: protocol.status,
            port: protocol.port,
            activeConnections: protocol.connections.size,
            stats: protocol.stats || {}
        } : null;
    }

    getAllProtocolsStatus() {
        const status = {};
        for (const [type, protocol] of this.protocols) {
            status[type] = this.getProtocolStatus(type);
        }
        return status;
    }

    getActiveConnections() {
        return Array.from(this.activeConnections.values()).map(conn => ({
            id: conn.id,
            protocol: conn.protocol,
            clientIP: conn.clientIP,
            userId: conn.userId,
            startTime: conn.startTime,
            duration: Date.now() - conn.startTime,
            bytesReceived: conn.bytesReceived,
            bytesSent: conn.bytesSent,
            status: conn.status
        }));
    }

    isHealthy() {
        return this.initialized && this.protocols.size > 0;
    }
}

module.exports = new VPNProtocolManager();
