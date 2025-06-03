// Dashboard JavaScript
class VPNDashboard {
    constructor() {
        this.isConnected = false;
        this.currentServer = null;
        this.connectionStartTime = null;
        this.servers = [];
        this.connectionTimer = null;
        this.statsTimer = null;
        this.init();
    }

    init() {
        this.checkAuthStatus();
        this.loadUserData();
        this.loadServers();
        this.bindEvents();
        this.startStatsUpdates();
    }

    checkAuthStatus() {
        const token = localStorage.getItem('authToken');
        if (!token) {
            window.location.href = 'login.html';
            return;
        }
        
        // In a real app, verify token with server
        console.log('User authenticated');
    }

    loadUserData() {
        // Mock user data - in real app, fetch from API
        const userData = {
            name: 'John Doe',
            email: 'john@example.com',
            plan: 'Premium Annual',
            renewalDate: 'March 15, 2026',
            devicesUsed: 3,
            devicesLimit: 10
        };
        
        document.getElementById('userName').textContent = userData.name;
        document.getElementById('renewalDate').textContent = userData.renewalDate;
        
        // Update device count
        const deviceCount = document.querySelector('.device-count');
        if (deviceCount) {
            deviceCount.textContent = `${userData.devicesUsed}/${userData.devicesLimit}`;
        }
    }

    loadServers() {
        // Mock server data
        this.servers = [
            {
                id: 1,
                name: 'United States',
                city: 'New York',
                country: 'US',
                flag: '🇺🇸',
                region: 'americas',
                ping: 23,
                load: 45,
                status: 'excellent'
            },
            {
                id: 2,
                name: 'United Kingdom',
                city: 'London',
                country: 'GB',
                flag: '🇬🇧',
                region: 'europe',
                ping: 67,
                load: 32,
                status: 'excellent'
            },
            {
                id: 3,
                name: 'Germany',
                city: 'Frankfurt',
                country: 'DE',
                flag: '🇩🇪',
                region: 'europe',
                ping: 78,
                load: 28,
                status: 'good'
            },
            {
                id: 4,
                name: 'Japan',
                city: 'Tokyo',
                country: 'JP',
                flag: '🇯🇵',
                region: 'asia',
                ping: 145,
                load: 55,
                status: 'good'
            },
            {
                id: 5,
                name: 'Singapore',
                city: 'Singapore',
                country: 'SG',
                flag: '🇸🇬',
                region: 'asia',
                ping: 167,
                load: 41,
                status: 'fair'
            },
            {
                id: 6,
                name: 'Canada',
                city: 'Toronto',
                country: 'CA',
                flag: '🇨🇦',
                region: 'americas',
                ping: 34,
                load: 38,
                status: 'excellent'
            }
        ];
        
        this.renderServers();
    }

    renderServers(filter = 'all') {
        const serversGrid = document.getElementById('serversGrid');
        const filteredServers = filter === 'all' 
            ? this.servers 
            : this.servers.filter(server => server.region === filter);
        
        serversGrid.innerHTML = filteredServers.map(server => `
            <div class="server-card ${this.currentServer?.id === server.id ? 'active' : ''}" 
                 data-server-id="${server.id}">
                <div class="server-header">
                    <div class="server-info">
                        <div class="server-flag">${server.flag}</div>
                        <div class="server-details">
                            <h4>${server.name}</h4>
                            <p>${server.city}</p>
                        </div>
                    </div>
                    <div class="server-status ${server.status}">
                        <i class="fas fa-circle"></i>
                        <span>${server.status}</span>
                    </div>
                </div>
                <div class="server-metrics">
                    <div class="metric">
                        <span class="value">${server.ping}ms</span>
                        <span class="label">Ping</span>
                    </div>
                    <div class="metric">
                        <span class="value">${server.load}%</span>
                        <span class="label">Load</span>
                    </div>
                    <div class="metric">
                        <span class="value">1Gbps</span>
                        <span class="label">Speed</span>
                    </div>
                </div>
            </div>
        `).join('');
        
        // Add click events to server cards
        serversGrid.querySelectorAll('.server-card').forEach(card => {
            card.addEventListener('click', () => {
                const serverId = parseInt(card.dataset.serverId);
                this.selectServer(serverId);
            });
        });
    }

    selectServer(serverId) {
        const server = this.servers.find(s => s.id === serverId);
        if (!server) return;
        
        // Update current server
        this.currentServer = server;
        
        // Update UI
        this.renderServers();
        
        // If connected, reconnect to new server
        if (this.isConnected) {
            this.disconnect();
            setTimeout(() => this.connect(), 1000);
        }
        
        this.showNotification(`Selected ${server.name} - ${server.city}`, 'info');
    }

    bindEvents() {
        // Connect/Disconnect button
        const connectBtn = document.getElementById('connectBtn');
        connectBtn.addEventListener('click', () => {
            if (this.isConnected) {
                this.disconnect();
            } else {
                this.connect();
            }
        });
        
        // Server refresh button
        const refreshBtn = document.getElementById('refreshServers');
        refreshBtn.addEventListener('click', () => {
            this.refreshServers();
        });
        
        // Server filter
        const serverFilter = document.getElementById('serverFilter');
        serverFilter.addEventListener('change', (e) => {
            this.renderServers(e.target.value);
        });
        
        // Mobile menu toggle
        const hamburger = document.getElementById('hamburger');
        const navMenu = document.getElementById('nav-menu');
        
        if (hamburger && navMenu) {
            hamburger.addEventListener('click', () => {
                navMenu.classList.toggle('active');
                hamburger.classList.toggle('active');
            });
        }
    }

    async connect() {
        if (!this.currentServer) {
            // Auto-select best server
            this.currentServer = this.servers.find(s => s.status === 'excellent') || this.servers[0];
        }
        
        const connectBtn = document.getElementById('connectBtn');
        const statusIndicator = document.getElementById('statusIndicator');
        const statusTitle = document.getElementById('statusTitle');
        const statusSubtitle = document.getElementById('statusSubtitle');
        
        // Show connecting state
        this.setButtonLoading(connectBtn, true);
        statusIndicator.className = 'status-indicator connecting';
        statusTitle.textContent = 'Connecting...';
        statusSubtitle.textContent = `Connecting to ${this.currentServer.name}`;
        
        try {
            // Simulate connection process
            await this.simulateConnection();
            
            // Update connection state
            this.isConnected = true;
            this.connectionStartTime = Date.now();
            
            // Update UI
            statusIndicator.className = 'status-indicator connected';
            statusTitle.textContent = 'Connected';
            statusSubtitle.textContent = `Connected to ${this.currentServer.name}`;
            connectBtn.querySelector('.btn-text').textContent = 'Disconnect';
            
            // Show connection details
            this.updateConnectionDetails();
            document.getElementById('connectionDetails').style.display = 'grid';
            
            // Start connection timer
            this.startConnectionTimer();
            
            this.showNotification(`Successfully connected to ${this.currentServer.name}`, 'success');
            
        } catch (error) {
            // Handle connection error
            statusIndicator.className = 'status-indicator disconnected';
            statusTitle.textContent = 'Connection Failed';
            statusSubtitle.textContent = 'Click to try again';
            
            this.showNotification('Connection failed. Please try again.', 'error');
        } finally {
            this.setButtonLoading(connectBtn, false);
        }
    }

    async disconnect() {
        const connectBtn = document.getElementById('connectBtn');
        const statusIndicator = document.getElementById('statusIndicator');
        const statusTitle = document.getElementById('statusTitle');
        const statusSubtitle = document.getElementById('statusSubtitle');
        
        // Show disconnecting state
        this.setButtonLoading(connectBtn, true);
        statusTitle.textContent = 'Disconnecting...';
        
        try {
            // Simulate disconnection process
            await new Promise(resolve => setTimeout(resolve, 1500));
            
            // Update connection state
            this.isConnected = false;
            this.connectionStartTime = null;
            
            // Update UI
            statusIndicator.className = 'status-indicator disconnected';
            statusTitle.textContent = 'Disconnected';
            statusSubtitle.textContent = 'Click to connect to the nearest server';
            connectBtn.querySelector('.btn-text').textContent = 'Connect';
            
            // Hide connection details
            document.getElementById('connectionDetails').style.display = 'none';
            
            // Stop connection timer
            this.stopConnectionTimer();
            
            this.showNotification('Disconnected from VPN', 'info');
            
        } catch (error) {
            this.showNotification('Disconnection failed', 'error');
        } finally {
            this.setButtonLoading(connectBtn, false);
        }
    }

    async simulateConnection() {
        const steps = [
            { text: 'Initializing connection...', delay: 500 },
            { text: 'Establishing secure tunnel...', delay: 800 },
            { text: 'Verifying server credentials...', delay: 600 },
            { text: 'Configuring network settings...', delay: 700 },
            { text: 'Connection established!', delay: 400 }
        ];
        
        const statusSubtitle = document.getElementById('statusSubtitle');
        
        for (const step of steps) {
            statusSubtitle.textContent = step.text;
            await new Promise(resolve => setTimeout(resolve, step.delay));
        }
    }

    updateConnectionDetails() {
        if (!this.isConnected || !this.currentServer) return;
        
        document.getElementById('currentServer').textContent = 
            `${this.currentServer.name} - ${this.currentServer.city}`;
        document.getElementById('currentProtocol').textContent = 'OpenVPN';
        document.getElementById('currentIP').textContent = this.generateMockIP();
    }

    generateMockIP() {
        return `${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`;
    }

    startConnectionTimer() {
        this.connectionTimer = setInterval(() => {
            if (this.connectionStartTime) {
                const elapsed = Date.now() - this.connectionStartTime;
                const minutes = Math.floor(elapsed / 60000);
                const seconds = Math.floor((elapsed % 60000) / 1000);
                
                document.getElementById('connectedTime').textContent = 
                    `${minutes}:${seconds.toString().padStart(2, '0')}`;
                document.getElementById('sessionTime').textContent = `${minutes}m`;
            }
        }, 1000);
    }

    stopConnectionTimer() {
        if (this.connectionTimer) {
            clearInterval(this.connectionTimer);
            this.connectionTimer = null;
        }
    }

    startStatsUpdates() {
        this.statsTimer = setInterval(() => {
            if (this.isConnected) {
                // Simulate real-time stats
                const downloadSpeed = (Math.random() * 50 + 10).toFixed(1);
                const uploadSpeed = (Math.random() * 20 + 5).toFixed(1);
                const dataUsage = (Math.random() * 2 + 0.5).toFixed(2);
                
                document.getElementById('downloadSpeed').textContent = `${downloadSpeed} MB/s`;
                document.getElementById('uploadSpeed').textContent = `${uploadSpeed} MB/s`;
                document.getElementById('dataUsage').textContent = `${dataUsage} GB`;
            } else {
                // Reset stats when disconnected
                document.getElementById('downloadSpeed').textContent = '0 MB/s';
                document.getElementById('uploadSpeed').textContent = '0 MB/s';
                document.getElementById('dataUsage').textContent = '0 GB';
            }
        }, 2000);
    }

    refreshServers() {
        const refreshBtn = document.getElementById('refreshServers');
        const icon = refreshBtn.querySelector('i');
        
        // Animate refresh icon
        icon.style.animation = 'spin 1s linear infinite';
        
        // Simulate server refresh
        setTimeout(() => {
            // Randomly update server loads and pings
            this.servers.forEach(server => {
                server.load = Math.floor(Math.random() * 80) + 10;
                server.ping = server.ping + Math.floor(Math.random() * 20) - 10;
                if (server.ping < 0) server.ping = Math.abs(server.ping);
            });
            
            this.renderServers();
            icon.style.animation = '';
            this.showNotification('Server list updated', 'success');
        }, 1500);
    }

    setButtonLoading(button, loading) {
        const btnText = button.querySelector('.btn-text');
        const btnLoader = button.querySelector('.btn-loader');
        
        if (loading) {
            btnText.style.display = 'none';
            btnLoader.style.display = 'block';
            button.disabled = true;
        } else {
            btnText.style.display = 'block';
            btnLoader.style.display = 'none';
            button.disabled = false;
        }
    }

    showNotification(message, type = 'info') {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.innerHTML = `
            <i class="fas fa-${this.getNotificationIcon(type)}"></i>
            <span>${message}</span>
            <button class="notification-close">
                <i class="fas fa-times"></i>
            </button>
        `;
        
        // Add styles
        Object.assign(notification.style, {
            position: 'fixed',
            top: '100px',
            right: '20px',
            background: this.getNotificationColor(type),
            color: 'white',
            padding: '15px 20px',
            borderRadius: '8px',
            boxShadow: '0 5px 15px rgba(0,0,0,0.2)',
            zIndex: '10000',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            transform: 'translateX(400px)',
            transition: 'transform 0.3s ease'
        });
        
        // Add to page
        document.body.appendChild(notification);
        
        // Animate in
        setTimeout(() => {
            notification.style.transform = 'translateX(0)';
        }, 100);
        
        // Close button functionality
        const closeBtn = notification.querySelector('.notification-close');
        closeBtn.style.cssText = 'background:none;border:none;color:white;cursor:pointer;padding:5px;';
        closeBtn.addEventListener('click', () => {
            this.removeNotification(notification);
        });
        
        // Auto-remove after 5 seconds
        setTimeout(() => {
            this.removeNotification(notification);
        }, 5000);
    }

    removeNotification(notification) {
        if (notification.parentNode) {
            notification.style.transform = 'translateX(400px)';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }
    }

    getNotificationIcon(type) {
        const icons = {
            success: 'check-circle',
            error: 'exclamation-circle',
            warning: 'exclamation-triangle',
            info: 'info-circle'
        };
        return icons[type] || 'info-circle';
    }

    getNotificationColor(type) {
        const colors = {
            success: '#27ae60',
            error: '#e74c3c',
            warning: '#f39c12',
            info: '#3498db'
        };
        return colors[type] || '#3498db';
    }
}

// Global logout function
function logout() {
    localStorage.removeItem('authToken');
    localStorage.removeItem('rememberUser');
    window.location.href = 'login.html';
}

// Add CSS animation for spinning
const style = document.createElement('style');
style.textContent = `
    @keyframes spin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
    }
`;
document.head.appendChild(style);

// Initialize dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new VPNDashboard();
});

// Export for use in other modules
window.VPNDashboard = VPNDashboard;
