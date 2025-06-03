# VPN Platform - Production Ready Dockerfile
FROM node:18-alpine AS base

# Install system dependencies
RUN apk add --no-cache \
    openvpn \
    easy-rsa \
    wireguard-tools \
    iptables \
    openssl \
    curl \
    bash \
    supervisor \
    mysql-client

# Create app directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY server/package*.json ./server/
COPY client/package*.json ./client/

# Install dependencies
RUN npm ci --only=production --silent

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S vpnuser -u 1001

# Copy application code
COPY --chown=vpnuser:nodejs . .

# Create necessary directories
RUN mkdir -p /var/log/openvpn \
    /var/log/supervisor \
    /etc/openvpn \
    /etc/wireguard \
    ./logs \
    ./backups \
    ./server/configs/openvpn \
    ./server/configs/wireguard \
    ./server/configs/ikev2 \
    && chown -R vpnuser:nodejs /var/log/openvpn \
    && chown -R vpnuser:nodejs /var/log/supervisor \
    && chown -R vpnuser:nodejs /etc/openvpn \
    && chown -R vpnuser:nodejs /etc/wireguard \
    && chown -R vpnuser:nodejs ./logs \
    && chown -R vpnuser:nodejs ./backups \
    && chown -R vpnuser:nodejs ./server/configs

# Copy supervisor configuration
COPY docker/supervisord.conf /etc/supervisor/conf.d/supervisord.conf

# Copy startup scripts
COPY docker/start.sh /start.sh
COPY docker/init-vpn.sh /init-vpn.sh
RUN chmod +x /start.sh /init-vpn.sh

# Set up firewall rules script
COPY docker/iptables-rules.sh /iptables-rules.sh
RUN chmod +x /iptables-rules.sh

# Expose ports
EXPOSE 3000 1194/udp 51820/udp 500/udp 4500/udp

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:3000/api/system/health || exit 1

# Use non-root user
USER vpnuser

# Start application
CMD ["/start.sh"]
