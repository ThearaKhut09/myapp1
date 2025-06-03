// API Documentation Interactive Features
class APIDocumentation {
    constructor() {
        this.baseUrl = 'http://localhost:3000/api';
        this.token = localStorage.getItem('api_token');
        this.ws = null;
        
        this.init();
    }

    init() {
        this.setupNavigation();
        this.setupSearch();
        this.setupTabs();
        this.setupAPITester();
        this.setupWebSocketTester();
        this.setupTryItButtons();
        this.loadStoredToken();
    }

    // Navigation
    setupNavigation() {
        const navLinks = document.querySelectorAll('.nav-link');
        const sections = document.querySelectorAll('.section');

        navLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const targetId = link.getAttribute('href').substring(1);
                
                // Update active states
                navLinks.forEach(l => l.classList.remove('active'));
                sections.forEach(s => s.classList.remove('active'));
                
                link.classList.add('active');
                const targetSection = document.getElementById(targetId);
                if (targetSection) {
                    targetSection.classList.add('active');
                }
                
                // Smooth scroll to top of content
                document.querySelector('.content').scrollTo({ top: 0, behavior: 'smooth' });
            });
        });
    }

    // Search functionality
    setupSearch() {
        const searchInput = document.getElementById('searchInput');
        const navLinks = document.querySelectorAll('.nav-link');

        searchInput.addEventListener('input', (e) => {
            const searchTerm = e.target.value.toLowerCase();
            
            navLinks.forEach(link => {
                const text = link.textContent.toLowerCase();
                const listItem = link.parentElement;
                
                if (text.includes(searchTerm) || searchTerm === '') {
                    listItem.style.display = 'block';
                } else {
                    listItem.style.display = 'none';
                }
            });
        });
    }

    // Tab switching for examples
    setupTabs() {
        const tabButtons = document.querySelectorAll('.tab-button');
        const examples = document.querySelectorAll('.example-content');

        tabButtons.forEach(button => {
            button.addEventListener('click', () => {
                const targetTab = button.getAttribute('data-tab');
                
                // Update active states
                tabButtons.forEach(b => b.classList.remove('active'));
                examples.forEach(e => e.style.display = 'none');
                
                button.classList.add('active');
                const targetExample = document.getElementById(`${targetTab}-example`);
                if (targetExample) {
                    targetExample.style.display = 'block';
                }
            });
        });
    }

    // API Tester Modal
    setupAPITester() {
        const modal = document.getElementById('apiTesterModal');
        const toggleBtn = document.getElementById('toggleTester');
        const closeBtn = modal.querySelector('.close');
        const sendBtn = document.getElementById('sendRequest');

        // Open modal
        toggleBtn.addEventListener('click', () => {
            modal.style.display = 'block';
        });

        // Close modal
        closeBtn.addEventListener('click', () => {
            modal.style.display = 'none';
        });

        // Close on outside click
        window.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.style.display = 'none';
            }
        });

        // Send request
        sendBtn.addEventListener('click', () => {
            this.sendTestRequest();
        });
    }

    // WebSocket Tester
    setupWebSocketTester() {
        const connectBtn = document.getElementById('wsConnect');
        const disconnectBtn = document.getElementById('wsDisconnect');
        const statusDiv = document.getElementById('wsStatus');
        const messagesTextarea = document.getElementById('wsMessages');

        connectBtn.addEventListener('click', () => {
            this.connectWebSocket();
        });

        disconnectBtn.addEventListener('click', () => {
            this.disconnectWebSocket();
        });
    }

    // Try It buttons for endpoints
    setupTryItButtons() {
        const tryItBtns = document.querySelectorAll('.try-it-btn');
        
        tryItBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const endpoint = btn.getAttribute('data-endpoint');
                const method = btn.getAttribute('data-method');
                const requiresAuth = btn.getAttribute('data-auth') === 'true';
                const requiresAdmin = btn.getAttribute('data-admin') === 'true';
                
                this.openTesterWithEndpoint(endpoint, method, requiresAuth, requiresAdmin);
            });
        });
    }

    // Open API tester with pre-filled endpoint
    openTesterWithEndpoint(endpoint, method, requiresAuth, requiresAdmin) {
        const modal = document.getElementById('apiTesterModal');
        const methodSelect = document.getElementById('testerMethod');
        const endpointInput = document.getElementById('testerEndpoint');
        const tokenInput = document.getElementById('testerToken');

        methodSelect.value = method;
        endpointInput.value = endpoint;
        
        if (requiresAuth && this.token) {
            tokenInput.value = this.token;
        }

        modal.style.display = 'block';
    }

    // Send test request
    async sendTestRequest() {
        const method = document.getElementById('testerMethod').value;
        const endpoint = document.getElementById('testerEndpoint').value;
        const token = document.getElementById('testerToken').value;
        const body = document.getElementById('testerBody').value;
        const statusDiv = document.getElementById('responseStatus');
        const responseDiv = document.getElementById('responseBody');

        const url = `${this.baseUrl}/${endpoint.replace(/^\//, '')}`;
        
        const options = {
            method: method,
            headers: {
                'Content-Type': 'application/json'
            }
        };

        if (token) {
            options.headers['Authorization'] = `Bearer ${token}`;
        }

        if (body && (method === 'POST' || method === 'PUT')) {
            try {
                JSON.parse(body); // Validate JSON
                options.body = body;
            } catch (e) {
                statusDiv.textContent = 'Error: Invalid JSON in request body';
                statusDiv.className = 'response-status error';
                return;
            }
        }

        try {
            statusDiv.textContent = 'Sending request...';
            statusDiv.className = 'response-status';
            
            const response = await fetch(url, options);
            const responseData = await response.json();
            
            statusDiv.textContent = `${response.status} ${response.statusText}`;
            statusDiv.className = response.ok ? 'response-status success' : 'response-status error';
            
            responseDiv.textContent = JSON.stringify(responseData, null, 2);
            
            // Store token if login was successful
            if (endpoint.includes('auth/login') && responseData.success && responseData.data.token) {
                this.token = responseData.data.token;
                localStorage.setItem('api_token', this.token);
                document.getElementById('testerToken').value = this.token;
            }
            
        } catch (error) {
            statusDiv.textContent = `Error: ${error.message}`;
            statusDiv.className = 'response-status error';
            responseDiv.textContent = error.stack;
        }
    }

    // WebSocket connection
    connectWebSocket() {
        const statusDiv = document.getElementById('wsStatus');
        const messagesTextarea = document.getElementById('wsMessages');
        const connectBtn = document.getElementById('wsConnect');
        const disconnectBtn = document.getElementById('wsDisconnect');

        try {
            this.ws = new WebSocket('ws://localhost:3000');
            
            this.ws.onopen = () => {
                statusDiv.textContent = 'Connected';
                statusDiv.className = 'ws-status connected';
                connectBtn.disabled = true;
                disconnectBtn.disabled = false;
                this.addWSMessage('Connected to WebSocket server');
            };

            this.ws.onmessage = (event) => {
                const data = JSON.parse(event.data);
                this.addWSMessage(`Received: ${JSON.stringify(data, null, 2)}`);
            };

            this.ws.onclose = () => {
                statusDiv.textContent = 'Disconnected';
                statusDiv.className = 'ws-status disconnected';
                connectBtn.disabled = false;
                disconnectBtn.disabled = true;
                this.addWSMessage('WebSocket connection closed');
            };

            this.ws.onerror = (error) => {
                this.addWSMessage(`WebSocket error: ${error.message || 'Connection failed'}`);
            };

        } catch (error) {
            this.addWSMessage(`Connection error: ${error.message}`);
        }
    }

    // Disconnect WebSocket
    disconnectWebSocket() {
        if (this.ws) {
            this.ws.close();
        }
    }

    // Add message to WebSocket log
    addWSMessage(message) {
        const messagesTextarea = document.getElementById('wsMessages');
        const timestamp = new Date().toLocaleTimeString();
        messagesTextarea.value += `[${timestamp}] ${message}\n`;
        messagesTextarea.scrollTop = messagesTextarea.scrollHeight;
    }

    // Load stored token
    loadStoredToken() {
        if (this.token) {
            const tokenInput = document.getElementById('testerToken');
            if (tokenInput) {
                tokenInput.value = this.token;
            }
        }
    }

    // Utility method to format JSON
    formatJSON(json) {
        try {
            return JSON.stringify(JSON.parse(json), null, 2);
        } catch (e) {
            return json;
        }
    }

    // Copy to clipboard functionality
    copyToClipboard(text) {
        navigator.clipboard.writeText(text).then(() => {
            this.showNotification('Copied to clipboard!');
        }).catch(() => {
            // Fallback for older browsers
            const textarea = document.createElement('textarea');
            textarea.value = text;
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand('copy');
            document.body.removeChild(textarea);
            this.showNotification('Copied to clipboard!');
        });
    }

    // Show notification
    showNotification(message, type = 'success') {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${type === 'success' ? 'var(--success-color)' : 'var(--danger-color)'};
            color: white;
            padding: 1rem 1.5rem;
            border-radius: 0.5rem;
            z-index: 1001;
            animation: slideIn 0.3s ease;
        `;

        document.body.appendChild(notification);

        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => {
                document.body.removeChild(notification);
            }, 300);
        }, 3000);
    }

    // Add keyboard shortcuts
    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // Ctrl/Cmd + K to focus search
            if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
                e.preventDefault();
                document.getElementById('searchInput').focus();
            }
            
            // Escape to close modal
            if (e.key === 'Escape') {
                const modal = document.getElementById('apiTesterModal');
                if (modal.style.display === 'block') {
                    modal.style.display = 'none';
                }
            }
        });
    }
}

// Add CSS animations
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    @keyframes slideOut {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(100%);
            opacity: 0;
        }
    }
    
    .endpoint:hover {
        transform: translateY(-2px);
        box-shadow: var(--shadow);
        transition: all 0.2s ease;
    }
    
    .try-it-btn:active {
        transform: translateY(0);
    }
    
    .nav-link {
        border-left: 3px solid transparent;
    }
    
    .nav-link.active {
        border-left-color: var(--primary-color);
    }
    
    .loading {
        opacity: 0.6;
        pointer-events: none;
    }
    
    .fade-in {
        animation: fadeIn 0.3s ease;
    }
    
    @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
    }
`;
document.head.appendChild(style);

// Add copy buttons to code blocks
function addCopyButtons() {
    const codeBlocks = document.querySelectorAll('pre code');
    
    codeBlocks.forEach(block => {
        const pre = block.parentElement;
        const copyBtn = document.createElement('button');
        copyBtn.className = 'copy-btn';
        copyBtn.textContent = 'Copy';
        copyBtn.style.cssText = `
            position: absolute;
            top: 0.5rem;
            right: 0.5rem;
            background: var(--surface-light);
            border: 1px solid var(--border);
            color: var(--text-primary);
            padding: 0.25rem 0.5rem;
            border-radius: 0.25rem;
            font-size: 0.75rem;
            cursor: pointer;
            opacity: 0;
            transition: opacity 0.2s;
        `;
        
        pre.style.position = 'relative';
        pre.appendChild(copyBtn);
        
        pre.addEventListener('mouseenter', () => {
            copyBtn.style.opacity = '1';
        });
        
        pre.addEventListener('mouseleave', () => {
            copyBtn.style.opacity = '0';
        });
        
        copyBtn.addEventListener('click', () => {
            const apiDocs = window.apiDocs;
            if (apiDocs) {
                apiDocs.copyToClipboard(block.textContent);
            }
            copyBtn.textContent = 'Copied!';
            setTimeout(() => {
                copyBtn.textContent = 'Copy';
            }, 2000);
        });
    });
}

// Add mobile menu toggle
function setupMobileMenu() {
    const sidebar = document.querySelector('.sidebar');
    const content = document.querySelector('.content');
    
    // Create mobile menu button
    const menuBtn = document.createElement('button');
    menuBtn.className = 'mobile-menu-btn';
    menuBtn.innerHTML = '☰';
    menuBtn.style.cssText = `
        display: none;
        position: fixed;
        top: 1rem;
        left: 1rem;
        z-index: 101;
        background: var(--primary-color);
        color: white;
        border: none;
        padding: 0.75rem;
        border-radius: 0.5rem;
        cursor: pointer;
        font-size: 1.25rem;
    `;
    
    document.body.appendChild(menuBtn);
    
    menuBtn.addEventListener('click', () => {
        sidebar.classList.toggle('open');
    });
    
    // Show on mobile
    const mediaQuery = window.matchMedia('(max-width: 768px)');
    function handleMediaChange(e) {
        if (e.matches) {
            menuBtn.style.display = 'block';
        } else {
            menuBtn.style.display = 'none';
            sidebar.classList.remove('open');
        }
    }
    
    mediaQuery.addListener(handleMediaChange);
    handleMediaChange(mediaQuery);
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.apiDocs = new APIDocumentation();
    addCopyButtons();
    setupMobileMenu();
    
    // Add some sample data for demonstration
    if (window.location.hash) {
        const targetId = window.location.hash.substring(1);
        const targetLink = document.querySelector(`[href="#${targetId}"]`);
        if (targetLink) {
            targetLink.click();
        }
    }
});

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = APIDocumentation;
}
