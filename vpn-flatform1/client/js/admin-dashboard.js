/**
 * Admin Dashboard JavaScript
 * Handles all frontend functionality including WebSocket connections,
 * data visualization, user interactions, and real-time updates
 */

class AdminDashboard {
    constructor() {
        this.socket = null;
        this.charts = {};
        this.realTimeData = {
            stats: {},
            users: [],
            connections: [],
            servers: []
        };
        this.currentView = 'dashboard';
        this.refreshInterval = null;
        
        this.init();
    }

    /**
     * Initialize the dashboard
     */
    init() {
        this.setupEventListeners();
        this.initializeWebSocket();
        this.loadInitialData();
        this.setupCharts();
        this.startRealTimeUpdates();
        
        // Check authentication
        this.checkAuth();
    }

    /**
     * Setup event listeners for UI interactions
     */
    setupEventListeners() {
        // Sidebar toggle
        const sidebarToggle = document.querySelector('.sidebar-toggle');
        const sidebar = document.querySelector('.sidebar');
        const mainContent = document.querySelector('.main-content');
        
        if (sidebarToggle) {
            sidebarToggle.addEventListener('click', () => {
                sidebar?.classList.toggle('collapsed');
                mainContent?.classList.toggle('expanded');
            });
        }

        // Navigation links
        document.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const target = link.getAttribute('data-target');
                if (target) {
                    this.switchView(target);
                    this.updateActiveNav(link);
                }
            });
        });

        // Search functionality
        const searchInput = document.getElementById('searchInput');
        if (searchInput) {
            searchInput.addEventListener('input', debounce((e) => {
                this.handleSearch(e.target.value);
            }, 300));
        }

        // Filter functionality
        const filterSelect = document.getElementById('filterSelect');
        if (filterSelect) {
            filterSelect.addEventListener('change', (e) => {
                this.handleFilter(e.target.value);
            });
        }

        // Action buttons
        document.addEventListener('click', (e) => {
            if (e.target.matches('[data-action]')) {
                this.handleAction(e.target.getAttribute('data-action'), e.target);
            }
        });

        // Window resize handler
        window.addEventListener('resize', debounce(() => {
            this.resizeCharts();
        }, 250));
    }

    /**
     * Initialize WebSocket connection
     */
    initializeWebSocket() {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}`;
        
        try {
            this.socket = new WebSocket(wsUrl);
            
            this.socket.onopen = () => {
                console.log('WebSocket connected');
                this.showNotification('Connected to real-time updates', 'success');
                
                // Join admin room
                this.socket.send(JSON.stringify({
                    type: 'join',
                    room: 'admin'
                }));
            };

            this.socket.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    this.handleWebSocketMessage(data);
                } catch (error) {
                    console.error('Error parsing WebSocket message:', error);
                }
            };

            this.socket.onclose = () => {
                console.log('WebSocket disconnected');
                this.showNotification('Lost connection to real-time updates', 'warning');
                
                // Attempt to reconnect after 5 seconds
                setTimeout(() => {
                    this.initializeWebSocket();
                }, 5000);
            };

            this.socket.onerror = (error) => {
                console.error('WebSocket error:', error);
                this.showNotification('Connection error occurred', 'danger');
            };
        } catch (error) {
            console.error('Failed to initialize WebSocket:', error);
        }
    }

    /**
     * Handle incoming WebSocket messages
     */
    handleWebSocketMessage(data) {
        switch (data.type) {
            case 'stats_update':
                this.updateStats(data.payload);
                break;
            case 'user_update':
                this.updateUserList(data.payload);
                break;
            case 'connection_update':
                this.updateConnections(data.payload);
                break;
            case 'server_update':
                this.updateServers(data.payload);
                break;
            case 'alert':
                this.showNotification(data.message, data.level || 'info');
                break;
            case 'system_event':
                this.handleSystemEvent(data.payload);
                break;
            default:
                console.log('Unhandled WebSocket message:', data);
        }
    }

    /**
     * Load initial data from API
     */
    async loadInitialData() {
        try {
            this.showLoading(true);
            
            // Load dashboard stats
            const statsResponse = await this.apiCall('/api/admin/stats');
            if (statsResponse.success) {
                this.realTimeData.stats = statsResponse.data;
                this.updateDashboardStats();
            }

            // Load users
            const usersResponse = await this.apiCall('/api/admin/users');
            if (usersResponse.success) {
                this.realTimeData.users = usersResponse.data;
                this.updateUserTable();
            }

            // Load servers
            const serversResponse = await this.apiCall('/api/admin/servers');
            if (serversResponse.success) {
                this.realTimeData.servers = serversResponse.data;
                this.updateServerTable();
            }

            // Load analytics data
            await this.loadAnalyticsData();
            
        } catch (error) {
            console.error('Error loading initial data:', error);
            this.showNotification('Failed to load dashboard data', 'danger');
        } finally {
            this.showLoading(false);
        }
    }

    /**
     * Load analytics data
     */
    async loadAnalyticsData() {
        try {
            const response = await this.apiCall('/api/admin/analytics');
            if (response.success) {
                this.updateCharts(response.data);
            }
        } catch (error) {
            console.error('Error loading analytics:', error);
        }
    }

    /**
     * Setup charts using Chart.js
     */
    setupCharts() {
        // Usage Chart
        const usageCtx = document.getElementById('usageChart');
        if (usageCtx) {
            this.charts.usage = new Chart(usageCtx, {
                type: 'line',
                data: {
                    labels: [],
                    datasets: [{
                        label: 'Active Connections',
                        data: [],
                        borderColor: '#2563eb',
                        backgroundColor: 'rgba(37, 99, 235, 0.1)',
                        tension: 0.4,
                        fill: true
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            display: false
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            grid: {
                                color: '#334155'
                            },
                            ticks: {
                                color: '#cbd5e1'
                            }
                        },
                        x: {
                            grid: {
                                color: '#334155'
                            },
                            ticks: {
                                color: '#cbd5e1'
                            }
                        }
                    }
                }
            });
        }

        // Traffic Chart
        const trafficCtx = document.getElementById('trafficChart');
        if (trafficCtx) {
            this.charts.traffic = new Chart(trafficCtx, {
                type: 'doughnut',
                data: {
                    labels: ['Upload', 'Download'],
                    datasets: [{
                        data: [0, 0],
                        backgroundColor: ['#10b981', '#06b6d4'],
                        borderWidth: 0
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            position: 'bottom',
                            labels: {
                                color: '#cbd5e1',
                                padding: 20
                            }
                        }
                    }
                }
            });
        }

        // Revenue Chart
        const revenueCtx = document.getElementById('revenueChart');
        if (revenueCtx) {
            this.charts.revenue = new Chart(revenueCtx, {
                type: 'bar',
                data: {
                    labels: [],
                    datasets: [{
                        label: 'Monthly Revenue',
                        data: [],
                        backgroundColor: '#10b981',
                        borderRadius: 6
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            display: false
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            grid: {
                                color: '#334155'
                            },
                            ticks: {
                                color: '#cbd5e1',
                                callback: function(value) {
                                    return '$' + value;
                                }
                            }
                        },
                        x: {
                            grid: {
                                display: false
                            },
                            ticks: {
                                color: '#cbd5e1'
                            }
                        }
                    }
                }
            });
        }
    }

    /**
     * Update charts with new data
     */
    updateCharts(data) {
        // Update usage chart
        if (this.charts.usage && data.usage) {
            this.charts.usage.data.labels = data.usage.labels;
            this.charts.usage.data.datasets[0].data = data.usage.values;
            this.charts.usage.update('none');
        }

        // Update traffic chart
        if (this.charts.traffic && data.traffic) {
            this.charts.traffic.data.datasets[0].data = [data.traffic.upload, data.traffic.download];
            this.charts.traffic.update('none');
        }

        // Update revenue chart
        if (this.charts.revenue && data.revenue) {
            this.charts.revenue.data.labels = data.revenue.labels;
            this.charts.revenue.data.datasets[0].data = data.revenue.values;
            this.charts.revenue.update('none');
        }
    }

    /**
     * Update dashboard statistics
     */
    updateDashboardStats() {
        const stats = this.realTimeData.stats;
        
        // Update stat values
        this.updateElement('activeUsers', stats.activeUsers || 0);
        this.updateElement('totalConnections', stats.totalConnections || 0);
        this.updateElement('dataTransferred', this.formatBytes(stats.dataTransferred || 0));
        this.updateElement('monthlyRevenue', '$' + (stats.monthlyRevenue || 0).toLocaleString());
        this.updateElement('serverUptime', this.formatUptime(stats.serverUptime || 0));
        this.updateElement('avgResponseTime', (stats.avgResponseTime || 0) + 'ms');

        // Update stat changes
        this.updateStatChange('activeUsersChange', stats.activeUsersChange);
        this.updateStatChange('connectionsChange', stats.connectionsChange);
        this.updateStatChange('revenueChange', stats.revenueChange);
    }

    /**
     * Update stat change indicators
     */
    updateStatChange(elementId, change) {
        const element = document.getElementById(elementId);
        if (!element || change === undefined) return;

        const isPositive = change >= 0;
        const icon = isPositive ? '↗' : '↘';
        const className = isPositive ? 'positive' : 'negative';
        
        element.textContent = `${icon} ${Math.abs(change)}%`;
        element.className = `stat-change ${className}`;
    }

    /**
     * Update user table
     */
    updateUserTable() {
        const tbody = document.getElementById('usersTableBody');
        if (!tbody) return;

        tbody.innerHTML = this.realTimeData.users.map(user => `
            <tr>
                <td>
                    <div class="flex items-center gap-2">
                        <div class="w-8 h-8 bg-primary-color rounded-full flex items-center justify-center text-white text-sm font-bold">
                            ${user.username.charAt(0).toUpperCase()}
                        </div>
                        ${user.username}
                    </div>
                </td>
                <td>${user.email}</td>
                <td>
                    <span class="status-badge ${user.status.toLowerCase()}">
                        ${user.status}
                    </span>
                </td>
                <td>${this.formatDate(user.lastSeen)}</td>
                <td>${this.formatBytes(user.dataUsage)}</td>
                <td>
                    <div class="flex gap-1">
                        <button class="btn btn-sm btn-primary" data-action="editUser" data-user-id="${user.id}">
                            Edit
                        </button>
                        <button class="btn btn-sm btn-danger" data-action="deleteUser" data-user-id="${user.id}">
                            Delete
                        </button>
                    </div>
                </td>
            </tr>
        `).join('');
    }

    /**
     * Update server table
     */
    updateServerTable() {
        const tbody = document.getElementById('serversTableBody');
        if (!tbody) return;

        tbody.innerHTML = this.realTimeData.servers.map(server => `
            <tr>
                <td>
                    <div class="flex items-center gap-2">
                        <div class="status-dot ${server.status.toLowerCase()}"></div>
                        ${server.name}
                    </div>
                </td>
                <td>${server.location}</td>
                <td>
                    <span class="status-badge ${server.status.toLowerCase()}">
                        ${server.status}
                    </span>
                </td>
                <td>${server.load}%</td>
                <td>${server.connections}</td>
                <td>${this.formatUptime(server.uptime)}</td>
                <td>
                    <div class="flex gap-1">
                        <button class="btn btn-sm btn-primary" data-action="manageServer" data-server-id="${server.id}">
                            Manage
                        </button>
                        <button class="btn btn-sm btn-secondary" data-action="restartServer" data-server-id="${server.id}">
                            Restart
                        </button>
                    </div>
                </td>
            </tr>
        `).join('');
    }

    /**
     * Handle user actions
     */
    async handleAction(action, element) {
        const userId = element.getAttribute('data-user-id');
        const serverId = element.getAttribute('data-server-id');

        switch (action) {
            case 'editUser':
                this.openUserModal(userId);
                break;
            case 'deleteUser':
                await this.deleteUser(userId);
                break;
            case 'manageServer':
                this.openServerModal(serverId);
                break;
            case 'restartServer':
                await this.restartServer(serverId);
                break;
            case 'exportData':
                await this.exportData();
                break;
            case 'refreshData':
                await this.loadInitialData();
                break;
        }
    }

    /**
     * Delete user
     */
    async deleteUser(userId) {
        if (!confirm('Are you sure you want to delete this user?')) return;

        try {
            const response = await this.apiCall(`/api/admin/users/${userId}`, 'DELETE');
            if (response.success) {
                this.showNotification('User deleted successfully', 'success');
                await this.loadInitialData();
            } else {
                throw new Error(response.message);
            }
        } catch (error) {
            console.error('Error deleting user:', error);
            this.showNotification('Failed to delete user', 'danger');
        }
    }

    /**
     * Restart server
     */
    async restartServer(serverId) {
        if (!confirm('Are you sure you want to restart this server?')) return;

        try {
            const response = await this.apiCall(`/api/admin/servers/${serverId}/restart`, 'POST');
            if (response.success) {
                this.showNotification('Server restart initiated', 'success');
            } else {
                throw new Error(response.message);
            }
        } catch (error) {
            console.error('Error restarting server:', error);
            this.showNotification('Failed to restart server', 'danger');
        }
    }

    /**
     * Switch between views
     */
    switchView(viewName) {
        // Hide all views
        document.querySelectorAll('.view').forEach(view => {
            view.classList.add('hidden');
        });

        // Show selected view
        const targetView = document.getElementById(`${viewName}View`);
        if (targetView) {
            targetView.classList.remove('hidden');
            this.currentView = viewName;
        }

        // Load view-specific data
        this.loadViewData(viewName);
    }

    /**
     * Load data specific to current view
     */
    async loadViewData(viewName) {
        switch (viewName) {
            case 'analytics':
                await this.loadAnalyticsData();
                break;
            case 'logs':
                await this.loadLogs();
                break;
            case 'settings':
                await this.loadSettings();
                break;
        }
    }

    /**
     * Update active navigation
     */
    updateActiveNav(activeLink) {
        document.querySelectorAll('.nav-link').forEach(link => {
            link.classList.remove('active');
        });
        activeLink.classList.add('active');
    }

    /**
     * Handle search functionality
     */
    handleSearch(query) {
        const currentTable = this.getCurrentTable();
        if (!currentTable) return;

        const rows = currentTable.querySelectorAll('tbody tr');
        rows.forEach(row => {
            const text = row.textContent.toLowerCase();
            const matches = text.includes(query.toLowerCase());
            row.style.display = matches ? '' : 'none';
        });
    }

    /**
     * Handle filter functionality
     */
    handleFilter(filter) {
        const currentTable = this.getCurrentTable();
        if (!currentTable) return;

        const rows = currentTable.querySelectorAll('tbody tr');
        rows.forEach(row => {
            if (filter === 'all') {
                row.style.display = '';
            } else {
                const statusBadge = row.querySelector('.status-badge');
                const matches = statusBadge && statusBadge.classList.contains(filter);
                row.style.display = matches ? '' : 'none';
            }
        });
    }

    /**
     * Get current table based on active view
     */
    getCurrentTable() {
        const view = document.getElementById(`${this.currentView}View`);
        return view ? view.querySelector('table') : null;
    }

    /**
     * Start real-time updates
     */
    startRealTimeUpdates() {
        // Update every 30 seconds
        this.refreshInterval = setInterval(() => {
            if (this.socket && this.socket.readyState === WebSocket.OPEN) {
                this.socket.send(JSON.stringify({
                    type: 'request_update',
                    view: this.currentView
                }));
            }
        }, 30000);
    }

    /**
     * Stop real-time updates
     */
    stopRealTimeUpdates() {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
            this.refreshInterval = null;
        }
    }

    /**
     * Resize charts on window resize
     */
    resizeCharts() {
        Object.values(this.charts).forEach(chart => {
            if (chart && chart.resize) {
                chart.resize();
            }
        });
    }

    /**
     * Show notification
     */
    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `alert alert-${type} fade-in`;
        notification.innerHTML = `
            <i class="fas fa-${this.getNotificationIcon(type)}"></i>
            ${message}
        `;

        const container = document.getElementById('notificationContainer') || document.body;
        container.appendChild(notification);

        // Auto remove after 5 seconds
        setTimeout(() => {
            notification.remove();
        }, 5000);
    }

    /**
     * Get notification icon based on type
     */
    getNotificationIcon(type) {
        const icons = {
            success: 'check-circle',
            warning: 'exclamation-triangle',
            danger: 'exclamation-circle',
            info: 'info-circle'
        };
        return icons[type] || 'info-circle';
    }

    /**
     * Show/hide loading state
     */
    showLoading(show) {
        const loader = document.getElementById('loadingOverlay');
        if (loader) {
            loader.style.display = show ? 'flex' : 'none';
        }
    }

    /**
     * Make API call
     */
    async apiCall(url, method = 'GET', data = null) {
        const options = {
            method,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
            }
        };

        if (data) {
            options.body = JSON.stringify(data);
        }

        const response = await fetch(url, options);
        return await response.json();
    }

    /**
     * Check authentication
     */
    checkAuth() {
        const token = localStorage.getItem('adminToken');
        if (!token) {
            window.location.href = '/admin/login.html';
            return;
        }

        // Verify token with server
        this.apiCall('/api/admin/verify-token')
            .then(response => {
                if (!response.success) {
                    localStorage.removeItem('adminToken');
                    window.location.href = '/admin/login.html';
                }
            })
            .catch(() => {
                localStorage.removeItem('adminToken');
                window.location.href = '/admin/login.html';
            });
    }

    /**
     * Update element content
     */
    updateElement(id, content) {
        const element = document.getElementById(id);
        if (element) {
            element.textContent = content;
        }
    }

    /**
     * Format bytes to human readable format
     */
    formatBytes(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    /**
     * Format uptime to human readable format
     */
    formatUptime(seconds) {
        const days = Math.floor(seconds / 86400);
        const hours = Math.floor((seconds % 86400) / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        
        if (days > 0) return `${days}d ${hours}h`;
        if (hours > 0) return `${hours}h ${minutes}m`;
        return `${minutes}m`;
    }

    /**
     * Format date to human readable format
     */
    formatDate(dateString) {
        const date = new Date(dateString);
        return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
    }

    /**
     * Cleanup on page unload
     */
    cleanup() {
        this.stopRealTimeUpdates();
        if (this.socket) {
            this.socket.close();
        }
        Object.values(this.charts).forEach(chart => {
            if (chart && chart.destroy) {
                chart.destroy();
            }
        });
    }
}

/**
 * Utility function for debouncing
 */
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

/**
 * Initialize dashboard when DOM is loaded
 */
document.addEventListener('DOMContentLoaded', () => {
    window.adminDashboard = new AdminDashboard();
});

/**
 * Cleanup on page unload
 */
window.addEventListener('beforeunload', () => {
    if (window.adminDashboard) {
        window.adminDashboard.cleanup();
    }
});

/**
 * Handle visibility change to pause/resume updates
 */
document.addEventListener('visibilitychange', () => {
    if (window.adminDashboard) {
        if (document.hidden) {
            window.adminDashboard.stopRealTimeUpdates();
        } else {
            window.adminDashboard.startRealTimeUpdates();
        }
    }
});
