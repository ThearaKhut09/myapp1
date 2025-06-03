#!/bin/bash
# filepath: c:\xampp\htdocs\myapp1\vpn-flatform1\docker\init-vpn.sh

set -e

echo "Initializing VPN configurations..."

# Create directories
mkdir -p /app/server/configs/openvpn
mkdir -p /app/server/configs/wireguard
mkdir -p /app/server/configs/ikev2

# Initialize OpenVPN
if [ ! -f "/app/server/configs/openvpn/server.conf" ]; then
    echo "Setting up OpenVPN..."
    
    # Generate basic server config
    cat > /app/server/configs/openvpn/server.conf << EOF
port 1194
proto udp
dev tun
server 10.8.0.0 255.255.255.0
ifconfig-pool-persist ipp.txt
keepalive 10 120
comp-lzo
persist-key
persist-tun
status openvpn-status.log
verb 3
cipher AES-256-CBC
auth SHA256
max-clients 100
user nobody
group nobody
EOF
    
    # Generate simple certificates for development
    cd /app/server/configs/openvpn
    
    # Generate CA key and certificate
    openssl genrsa -out ca.key 2048
    openssl req -new -x509 -days 3650 -key ca.key -out ca.crt -subj "/C=US/ST=CA/L=SF/O=VPN/OU=CA/CN=VPN-CA"
    
    # Generate server key and certificate
    openssl genrsa -out server.key 2048
    openssl req -new -key server.key -out server.csr -subj "/C=US/ST=CA/L=SF/O=VPN/OU=Server/CN=vpn-server"
    openssl x509 -req -days 3650 -in server.csr -CA ca.crt -CAkey ca.key -CAcreateserial -out server.crt
    
    # Generate DH parameters
    openssl dhparam -out dh2048.pem 2048
    
    # Generate TLS auth key
    openvpn --genkey --secret ta.key
    
    echo "OpenVPN configuration complete"
fi

# Initialize WireGuard
if [ ! -f "/app/server/configs/wireguard/wg0.conf" ]; then
    echo "Setting up WireGuard..."
    
    # Generate server private key
    wg genkey > /app/server/configs/wireguard/server_private.key
    wg pubkey < /app/server/configs/wireguard/server_private.key > /app/server/configs/wireguard/server_public.key
    
    # Create server config
    cat > /app/server/configs/wireguard/wg0.conf << EOF
[Interface]
PrivateKey = $(cat /app/server/configs/wireguard/server_private.key)
Address = 10.13.13.1/24
ListenPort = 51820
SaveConfig = true

PostUp = iptables -A FORWARD -i wg0 -j ACCEPT; iptables -A FORWARD -o wg0 -j ACCEPT; iptables -t nat -A POSTROUTING -o eth0 -j MASQUERADE
PostDown = iptables -D FORWARD -i wg0 -j ACCEPT; iptables -D FORWARD -o wg0 -j ACCEPT; iptables -t nat -D POSTROUTING -o eth0 -j MASQUERADE
EOF
    
    echo "WireGuard configuration complete"
fi

echo "VPN initialization complete"
