#!/bin/bash
# filepath: c:\xampp\htdocs\myapp1\vpn-flatform1\docker\start.sh

set -e

echo "Starting VPN Platform..."

# Initialize VPN configurations if needed
if [ ! -f "/app/server/configs/openvpn/server.conf" ]; then
    echo "Initializing VPN configurations..."
    /init-vpn.sh
fi

# Set up iptables rules
echo "Setting up firewall rules..."
/iptables-rules.sh

# Start supervisor (manages multiple processes)
echo "Starting services via supervisor..."
exec /usr/bin/supervisord -c /etc/supervisor/conf.d/supervisord.conf
