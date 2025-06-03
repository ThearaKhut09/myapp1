// VPN Platform API Client
class VPNApiClient {
    constructor() {
        this.baseURL = this.getApiBaseUrl();
        this.token = localStorage.getItem('authToken');
        this.refreshToken = localStorage.getItem('refreshToken');
    }    getApiBaseUrl() {
        // Use different base URLs for different environments
        const hostname = window.location.hostname;
        
        if (hostname === 'localhost' || hostname === '127.0.0.1') {
            return 'http://localhost:3001/api';
        } else if (hostname.includes('staging')) {
            return 'https://api-staging.securevpn.com';
        } else {
            return 'https://api.securevpn.com';
        }
    }

    // Generic request method
    async request(endpoint, options = {}) {
        const url = `${this.baseURL}${endpoint}`;
        const config = {
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            },
            ...options
        };

        // Add authorization header if token exists
        if (this.token) {
            config.headers.Authorization = `Bearer ${this.token}`;
        }

        try {
            const response = await fetch(url, config);
            
            // Handle token expiration
            if (response.status === 401 && this.refreshToken) {
                const refreshed = await this.refreshAuthToken();
                if (refreshed) {
                    config.headers.Authorization = `Bearer ${this.token}`;
                    return fetch(url, config);
                } else {
                    this.handleAuthError();
                    throw new Error('Authentication failed');
                }
            }

            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.message || `HTTP ${response.status}`);
            }

            return data;
        } catch (error) {
            console.error('API Request failed:', error);
            throw error;
        }
    }

    // Authentication methods
    async login(credentials) {
        try {
            const response = await this.request('/auth/login', {
                method: 'POST',
                body: JSON.stringify(credentials)
            });

            if (response.token) {
                this.token = response.token;
                localStorage.setItem('authToken', response.token);
                
                if (response.refreshToken) {
                    this.refreshToken = response.refreshToken;
                    localStorage.setItem('refreshToken', response.refreshToken);
                }
            }

            return response;
        } catch (error) {
            throw new Error('Login failed: ' + error.message);
        }
    }

    async register(userData) {
        try {
            return await this.request('/auth/register', {
                method: 'POST',
                body: JSON.stringify(userData)
            });
        } catch (error) {
            throw new Error('Registration failed: ' + error.message);
        }
    }

    async refreshAuthToken() {
        try {
            const response = await this.request('/auth/refresh', {
                method: 'POST',
                body: JSON.stringify({ refreshToken: this.refreshToken })
            });

            if (response.token) {
                this.token = response.token;
                localStorage.setItem('authToken', response.token);
                return true;
            }
            return false;
        } catch (error) {
            console.error('Token refresh failed:', error);
            return false;
        }
    }

    async logout() {
        try {
            await this.request('/auth/logout', {
                method: 'POST'
            });
        } catch (error) {
            console.error('Logout request failed:', error);
        } finally {
            this.clearAuthData();
        }
    }

    clearAuthData() {
        this.token = null;
        this.refreshToken = null;
        localStorage.removeItem('authToken');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('rememberUser');
    }

    handleAuthError() {
        this.clearAuthData();
        window.location.href = '/login.html';
    }

    // User management methods
    async getUserProfile() {
        return await this.request('/user/profile');
    }

    async updateUserProfile(profileData) {
        return await this.request('/user/profile', {
            method: 'PUT',
            body: JSON.stringify(profileData)
        });
    }

    async changePassword(passwordData) {
        return await this.request('/user/change-password', {
            method: 'POST',
            body: JSON.stringify(passwordData)
        });
    }

    // VPN server methods
    async getServers() {
        return await this.request('/servers');
    }

    async getServerById(serverId) {
        return await this.request(`/servers/${serverId}`);
    }

    async getServersByRegion(region) {
        return await this.request(`/servers?region=${region}`);
    }

    async testServerLatency(serverId) {
        return await this.request(`/servers/${serverId}/ping`);
    }

    // VPN connection methods
    async connect(serverId) {
        return await this.request('/vpn/connect', {
            method: 'POST',
            body: JSON.stringify({ serverId })
        });
    }

    async disconnect() {
        return await this.request('/vpn/disconnect', {
            method: 'POST'
        });
    }

    async getConnectionStatus() {
        return await this.request('/vpn/status');
    }

    async getConnectionLogs() {
        return await this.request('/vpn/logs');
    }

    // Subscription and billing methods
    async getSubscription() {
        return await this.request('/billing/subscription');
    }

    async getPaymentMethods() {
        return await this.request('/billing/payment-methods');
    }

    async addPaymentMethod(paymentData) {
        return await this.request('/billing/payment-methods', {
            method: 'POST',
            body: JSON.stringify(paymentData)
        });
    }

    async updateSubscription(planId) {
        return await this.request('/billing/subscription', {
            method: 'PUT',
            body: JSON.stringify({ planId })
        });
    }

    async cancelSubscription() {
        return await this.request('/billing/subscription/cancel', {
            method: 'POST'
        });
    }

    async getInvoices() {
        return await this.request('/billing/invoices');
    }

    // Device management methods
    async getDevices() {
        return await this.request('/devices');
    }

    async addDevice(deviceData) {
        return await this.request('/devices', {
            method: 'POST',
            body: JSON.stringify(deviceData)
        });
    }

    async removeDevice(deviceId) {
        return await this.request(`/devices/${deviceId}`, {
            method: 'DELETE'
        });
    }

    // Usage statistics methods
    async getUsageStats(period = '30d') {
        return await this.request(`/stats/usage?period=${period}`);
    }

    async getBandwidthStats(period = '24h') {
        return await this.request(`/stats/bandwidth?period=${period}`);
    }

    async getConnectionHistory() {
        return await this.request('/stats/connections');
    }

    // Support methods
    async createSupportTicket(ticketData) {
        return await this.request('/support/tickets', {
            method: 'POST',
            body: JSON.stringify(ticketData)
        });
    }

    async getSupportTickets() {
        return await this.request('/support/tickets');
    }

    async getSupportTicket(ticketId) {
        return await this.request(`/support/tickets/${ticketId}`);
    }

    async updateSupportTicket(ticketId, message) {
        return await this.request(`/support/tickets/${ticketId}/messages`, {
            method: 'POST',
            body: JSON.stringify({ message })
        });
    }

    // Configuration methods
    async getVPNConfig(serverId, protocol = 'openvpn') {
        return await this.request(`/config/${protocol}/${serverId}`);
    }

    async getUserSettings() {
        return await this.request('/user/settings');
    }

    async updateUserSettings(settings) {
        return await this.request('/user/settings', {
            method: 'PUT',
            body: JSON.stringify(settings)
        });
    }

    // USDT Payment methods (for crypto payments)
    async createUSDTPayment(amount, planId) {
        return await this.request('/payment/usdt/create', {
            method: 'POST',
            body: JSON.stringify({ amount, planId })
        });
    }

    async verifyUSDTPayment(transactionHash) {
        return await this.request('/payment/usdt/verify', {
            method: 'POST',
            body: JSON.stringify({ transactionHash })
        });
    }

    async getUSDTPaymentStatus(paymentId) {
        return await this.request(`/payment/usdt/${paymentId}/status`);
    }

    // Referral system methods
    async getReferralInfo() {
        return await this.request('/referral/info');
    }

    async getReferralStats() {
        return await this.request('/referral/stats');
    }

    async generateReferralCode() {
        return await this.request('/referral/generate', {
            method: 'POST'
        });
    }

    // Admin methods (for admin users)
    async getAdminStats() {
        return await this.request('/admin/stats');
    }

    async getAllUsers(page = 1, limit = 50) {
        return await this.request(`/admin/users?page=${page}&limit=${limit}`);
    }

    async getUserDetails(userId) {
        return await this.request(`/admin/users/${userId}`);
    }

    async updateUserStatus(userId, status) {
        return await this.request(`/admin/users/${userId}/status`, {
            method: 'PUT',
            body: JSON.stringify({ status })
        });
    }

    async getServerStats() {
        return await this.request('/admin/servers/stats');
    }

    async addServer(serverData) {
        return await this.request('/admin/servers', {
            method: 'POST',
            body: JSON.stringify(serverData)
        });
    }

    async updateServer(serverId, serverData) {
        return await this.request(`/admin/servers/${serverId}`, {
            method: 'PUT',
            body: JSON.stringify(serverData)
        });
    }

    async deleteServer(serverId) {
        return await this.request(`/admin/servers/${serverId}`, {
            method: 'DELETE'
        });
    }
}

// Mock API responses for development
class MockVPNApi extends VPNApiClient {
    constructor() {
        super();
        this.mockMode = true;
    }

    async request(endpoint, options = {}) {
        // Simulate network delay
        await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 1000));

        // Mock responses based on endpoint
        return this.getMockResponse(endpoint, options);
    }

    getMockResponse(endpoint, options) {
        const method = options.method || 'GET';
        
        // Authentication endpoints
        if (endpoint === '/auth/login' && method === 'POST') {
            return {
                success: true,
                token: 'mock-jwt-token-' + Date.now(),
                refreshToken: 'mock-refresh-token-' + Date.now(),
                user: {
                    id: 1,
                    email: 'user@example.com',
                    name: 'John Doe',
                    plan: 'premium'
                }
            };
        }

        if (endpoint === '/auth/register' && method === 'POST') {
            return {
                success: true,
                message: 'Registration successful. Please verify your email.'
            };
        }

        // User profile
        if (endpoint === '/user/profile') {
            return {
                id: 1,
                email: 'john@example.com',
                firstName: 'John',
                lastName: 'Doe',
                plan: 'Premium Annual',
                planExpiry: '2026-03-15',
                devicesLimit: 10,
                devicesUsed: 3,
                createdAt: '2024-01-15'
            };
        }

        // Servers
        if (endpoint === '/servers') {
            return [
                {
                    id: 1,
                    name: 'United States',
                    city: 'New York',
                    country: 'US',
                    region: 'americas',
                    ping: 23,
                    load: 45,
                    status: 'online',
                    protocols: ['openvpn', 'wireguard']
                },
                {
                    id: 2,
                    name: 'United Kingdom',
                    city: 'London',
                    country: 'GB',
                    region: 'europe',
                    ping: 67,
                    load: 32,
                    status: 'online',
                    protocols: ['openvpn', 'wireguard']
                }
            ];
        }

        // VPN connection
        if (endpoint === '/vpn/connect' && method === 'POST') {
            return {
                success: true,
                connectionId: 'conn-' + Date.now(),
                serverInfo: {
                    id: 1,
                    name: 'United States - New York',
                    ip: '198.51.100.42'
                }
            };
        }

        if (endpoint === '/vpn/status') {
            return {
                connected: false,
                server: null,
                connectedSince: null,
                bytesReceived: 0,
                bytesSent: 0
            };
        }

        // Default response
        return {
            success: true,
            message: 'Mock response for ' + endpoint
        };
    }
}

// Create global API instance
window.vpnApi = new (window.location.hostname === 'localhost' ? MockVPNApi : VPNApiClient)();

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { VPNApiClient, MockVPNApi };
}