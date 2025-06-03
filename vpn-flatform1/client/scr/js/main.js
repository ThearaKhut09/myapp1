// Main JavaScript for VPN Platform
document.addEventListener('DOMContentLoaded', function() {
    // Initialize all components
    initNavigation();
    initScrollEffects();
    initPricingCards();
    initServerStatus();
    initContactForm();
    initAnimations();
    
    // Setup additional functionalities
    setupSmoothScrolling();
    setupDownloadHandlers();
    setupMobileMenu();
    setupProtocolInfo();
    
    // Add new functionality
    setupServerSelection();
    addAnimationStyles();
    
    // Make functions globally available
    window.VPNPlatform = {
        initiatePayment,
        showNotification,
        showProtocolInfo,
        copyToClipboard,
        checkPaymentStatus
    };
    
    console.log('VPN Platform functionality loaded successfully!');
});

// Navigation functionality
function initNavigation() {
    const hamburger = document.getElementById('hamburger');
    const navMenu = document.getElementById('nav-menu');
    const navbar = document.getElementById('navbar');

    // Mobile menu toggle
    if (hamburger && navMenu) {
        hamburger.addEventListener('click', function() {
            navMenu.classList.toggle('active');
            hamburger.classList.toggle('active');
        });

        // Close mobile menu when clicking on a link
        const navLinks = document.querySelectorAll('.nav-link');
        navLinks.forEach(link => {
            link.addEventListener('click', () => {
                navMenu.classList.remove('active');
                hamburger.classList.remove('active');
            });
        });
    }

    // Navbar scroll effect
    if (navbar) {
        window.addEventListener('scroll', function() {
            if (window.scrollY > 100) {
                navbar.classList.add('scrolled');
            } else {
                navbar.classList.remove('scrolled');
            }
        });
    }
}

// Scroll effects and animations
function initScrollEffects() {
    // Intersection Observer for animations
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };

    const observer = new IntersectionObserver(function(entries) {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('animate-in');
            }
        });
    }, observerOptions);

    // Observe elements for animation
    const animateElements = document.querySelectorAll('.feature-card, .pricing-card, .server-card, .download-card');
    animateElements.forEach(el => {
        observer.observe(el);
    });

    // Parallax effect for hero section
    window.addEventListener('scroll', function() {
        const scrolled = window.pageYOffset;
        const heroImage = document.querySelector('.hero-image');
        
        if (heroImage) {
            const rate = scrolled * -0.5;
            heroImage.style.transform = `translate3d(0, ${rate}px, 0)`;
        }
    });
}

// Pricing cards functionality
function initPricingCards() {
    const pricingCards = document.querySelectorAll('.pricing-card');
    
    pricingCards.forEach(card => {
        card.addEventListener('mouseenter', function() {
            // Add glow effect
            this.style.boxShadow = '0 20px 40px rgba(102, 126, 234, 0.3)';
        });
        
        card.addEventListener('mouseleave', function() {
            // Remove glow effect
            this.style.boxShadow = '';
        });
    });

    // Handle plan selection from URL
    const urlParams = new URLSearchParams(window.location.search);
    const selectedPlan = urlParams.get('plan');
    
    if (selectedPlan) {
        const planCard = document.querySelector(`[data-plan="${selectedPlan}"]`);
        if (planCard) {
            planCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
            planCard.classList.add('selected');
        }
    }
}

// Server status simulation
function initServerStatus() {
    const serverCards = document.querySelectorAll('.server-card');
    
    serverCards.forEach(card => {
        const statusElement = card.querySelector('.server-status');
        if (statusElement) {
            // Simulate random server loads
            const load = Math.floor(Math.random() * 100);
            const loadClass = load > 80 ? 'high-load' : load > 50 ? 'medium-load' : 'low-load';
            
            // Add load indicator
            const loadIndicator = document.createElement('div');
            loadIndicator.className = `load-indicator ${loadClass}`;
            loadIndicator.textContent = `${load}% load`;
            card.appendChild(loadIndicator);
        }
    });

    // Update server status every 30 seconds
    setInterval(updateServerStatus, 30000);
}

function updateServerStatus() {
    const serverCards = document.querySelectorAll('.server-card');
    
    serverCards.forEach(card => {
        const loadIndicator = card.querySelector('.load-indicator');
        if (loadIndicator) {
            const newLoad = Math.floor(Math.random() * 100);
            const newLoadClass = newLoad > 80 ? 'high-load' : newLoad > 50 ? 'medium-load' : 'low-load';
            
            loadIndicator.className = `load-indicator ${newLoadClass}`;
            loadIndicator.textContent = `${newLoad}% load`;
        }
    });
}

// Contact form functionality
function initContactForm() {
    const contactForm = document.getElementById('contact-form');
    
    if (contactForm) {
        contactForm.addEventListener('submit', function(e) {
            e.preventDefault();
            
            // Get form data
            const formData = new FormData(this);
            const data = Object.fromEntries(formData);
            
            // Show loading state
            const submitButton = this.querySelector('button[type="submit"]');
            const originalText = submitButton.textContent;
            submitButton.textContent = 'Sending...';
            submitButton.disabled = true;
            
            // Simulate form submission
            setTimeout(() => {
                showNotification('Message sent successfully!', 'success');
                this.reset();
                submitButton.textContent = originalText;
                submitButton.disabled = false;
            }, 2000);
        });
    }
}

// Animation utilities
function initAnimations() {
    // Add loading animation to cards
    const cards = document.querySelectorAll('.feature-card, .pricing-card, .server-card');
    cards.forEach((card, index) => {
        card.style.animationDelay = `${index * 0.1}s`;
        card.classList.add('loading');
    });

    // Counter animation for stats
    const stats = document.querySelectorAll('.stat-number');
    stats.forEach(stat => {
        const target = parseInt(stat.textContent.replace(/[^\d]/g, ''));
        animateCounter(stat, 0, target, 2000);
    });
}

function animateCounter(element, start, end, duration) {
    const range = end - start;
    const increment = range / (duration / 16);
    let current = start;
    
    const timer = setInterval(() => {
        current += increment;
        if (current >= end) {
            current = end;
            clearInterval(timer);
        }
        
        // Format the number based on the original text
        const originalText = element.textContent;
        if (originalText.includes('%')) {
            element.textContent = Math.floor(current) + '%';
        } else if (originalText.includes('+')) {
            element.textContent = Math.floor(current) + '+';
        } else if (originalText.includes('M')) {
            element.textContent = (current / 1000000).toFixed(1) + 'M+';
        } else {
            element.textContent = Math.floor(current);
        }
    }, 16);
}

// Smooth scrolling functionality
function setupSmoothScrolling() {
    // Handle all anchor links for smooth scrolling
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                const offsetTop = target.offsetTop - 80; // Account for fixed navbar
                window.scrollTo({
                    top: offsetTop,
                    behavior: 'smooth'
                });
            }
        });
    });
}

// Enhanced download functionality
function setupDownloadHandlers() {
    document.querySelectorAll('.download-btn').forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.preventDefault();
            const platform = this.getAttribute('data-platform');
            handleDownload(platform);
        });
    });
}

async function handleDownload(platform) {
    const downloadUrls = {
        windows: '/downloads/windows-client.exe',
        macos: '/downloads/macos-client.dmg',
        android: '/downloads/android-client.apk',
        ios: 'https://apps.apple.com/app/securevpn',
        linux: '/downloads/linux-client.tar.gz'
    };

    const platformNames = {
        windows: 'Windows Clash Client',
        macos: 'macOS Singbox Client',
        android: 'Android VPN App',
        ios: 'iOS VPN App',
        linux: 'Linux VPN Client'
    };

    try {
        // Show download notification
        if (window.VPNPlatform && window.VPNPlatform.showNotification) {
            window.VPNPlatform.showNotification(`Preparing ${platformNames[platform]} download...`, 'info');
        }
        
        // Simulate download preparation
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Track download analytics
        if (typeof gtag !== 'undefined') {
            gtag('event', 'download', {
                'event_category': 'Downloads',
                'event_label': platform,
                'value': 1
            });
        }
        
        // Start download
        const link = document.createElement('a');
        link.href = downloadUrls[platform];
        link.download = '';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        if (window.VPNPlatform && window.VPNPlatform.showNotification) {
            window.VPNPlatform.showNotification(`${platformNames[platform]} download started!`, 'success');
        }
        
    } catch (error) {
        console.error('Download error:', error);
        if (window.VPNPlatform && window.VPNPlatform.showNotification) {
            window.VPNPlatform.showNotification('Download failed. Please try again later.', 'error');
        }
    }
}

// Enhanced payment integration with USDT support
async function initiatePayment(planId) {
    const button = event.target;
    const originalText = button.textContent;
    
    // Show loading state
    button.classList.add('loading');
    button.textContent = 'Processing...';
    button.disabled = true;
    
    try {
        // Get JWT token from localStorage
        const token = localStorage.getItem('vpn_access_token');
        
        if (!token) {
            showNotification('Please login to purchase a plan.', 'error');
            setTimeout(() => {
                window.location.href = 'login.html';
            }, 2000);
            return;
        }
        
        // Make API call to initiate payment
        const response = await fetch('/api/payment/initiate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                planId: planId,
                currency: 'USDT',
                network: 'TRC20'
            })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            // Show payment modal with USDT details
            showPaymentModal(data.data);
            showNotification('Payment initiated successfully. Please complete USDT payment.', 'success');
        } else {
            throw new Error(data.error || 'Payment initiation failed');
        }
        
    } catch (error) {
        console.error('Payment error:', error);
        showNotification(error.message || 'Payment initialization failed. Please try again.', 'error');
    } finally {
        // Reset button state
        button.classList.remove('loading');
        button.textContent = originalText;
        button.disabled = false;
    }
}

// Show payment modal with USDT payment details
function showPaymentModal(paymentData) {
    // Remove existing modal if any
    const existingModal = document.getElementById('paymentModal');
    if (existingModal) {
        existingModal.remove();
    }
    
    const modal = document.createElement('div');
    modal.id = 'paymentModal';
    modal.className = 'payment-modal';
    modal.innerHTML = `
        <div class="modal-overlay" onclick="closePaymentModal()"></div>
        <div class="modal-content">
            <div class="modal-header">
                <h3><i class="fab fa-bitcoin"></i> USDT Payment</h3>
                <button class="modal-close" onclick="closePaymentModal()">&times;</button>
            </div>
            <div class="modal-body">
                <div class="payment-details">
                    <div class="payment-amount">
                        <span class="amount">${paymentData.amount}</span>
                        <span class="currency">USDT (TRC20)</span>
                    </div>
                    <div class="payment-address">
                        <label>Send USDT to this address:</label>
                        <div class="address-container">
                            <input type="text" value="${paymentData.address}" readonly class="payment-address-input">
                            <button onclick="copyToClipboard('${paymentData.address}')" class="copy-btn">
                                <i class="fas fa-copy"></i>
                            </button>
                        </div>
                    </div>
                    <div class="qr-code">
                        <img src="https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(paymentData.qrCode)}" alt="QR Code">
                        <p>Scan QR code with your USDT wallet</p>
                    </div>
                    <div class="payment-timer">
                        <i class="fas fa-clock"></i>
                        <span>Payment expires in: <span id="paymentTimer">30:00</span></span>
                    </div>
                    <div class="payment-instructions">
                        <h4>Important Instructions:</h4>
                        <ul>
                            <li>Send exactly <strong>${paymentData.amount} USDT</strong> to the address above</li>
                            <li>Use <strong>TRC20 network</strong> only (TRON network)</li>
                            <li>Payment will be confirmed automatically after 1-3 confirmations</li>
                            <li>Do not send any other cryptocurrency to this address</li>
                        </ul>
                    </div>
                </div>
            </div>
            <div class="modal-footer">
                <button onclick="checkPaymentStatus('${paymentData.paymentId}')" class="btn btn-primary">
                    <i class="fas fa-refresh"></i> Check Payment Status
                </button>
                <button onclick="closePaymentModal()" class="btn btn-secondary">Close</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Start payment timer
    startPaymentTimer(30 * 60); // 30 minutes
    
    // Auto-check payment status every 30 seconds
    const statusInterval = setInterval(() => {
        checkPaymentStatus(paymentData.paymentId, true);
    }, 30000);
    
    // Store interval ID for cleanup
    modal.dataset.statusInterval = statusInterval;
}

// Close payment modal
function closePaymentModal() {
    const modal = document.getElementById('paymentModal');
    if (modal) {
        // Clear status check interval
        const intervalId = modal.dataset.statusInterval;
        if (intervalId) {
            clearInterval(parseInt(intervalId));
        }
        modal.remove();
    }
}

// Copy to clipboard function
function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
        showNotification('Address copied to clipboard!', 'success');
    }).catch(() => {
        // Fallback for older browsers
        const textArea = document.createElement('textarea');
        textArea.value = text;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        showNotification('Address copied to clipboard!', 'success');
    });
}

// Start payment timer countdown
function startPaymentTimer(seconds) {
    const timerElement = document.getElementById('paymentTimer');
    if (!timerElement) return;
    
    const timer = setInterval(() => {
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        const display = `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
        
        timerElement.textContent = display;
        
        if (seconds <= 0) {
            clearInterval(timer);
            timerElement.textContent = 'EXPIRED';
            timerElement.style.color = '#ef4444';
            showNotification('Payment window expired. Please initiate a new payment.', 'error');
        }
        
        seconds--;
    }, 1000);
}

// Check payment status
async function checkPaymentStatus(paymentId, silent = false) {
    try {
        const token = localStorage.getItem('vpn_access_token');
        
        const response = await fetch(`/api/payment/status/${paymentId}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        const data = await response.json();
        
        if (response.ok) {
            const status = data.data.status;
            
            if (status === 'finished') {
                closePaymentModal();
                showNotification('Payment confirmed! Your subscription is now active.', 'success');
                setTimeout(() => {
                    window.location.href = 'dashboard.html';
                }, 2000);
            } else if (status === 'expired') {
                if (!silent) {
                    showNotification('Payment expired. Please initiate a new payment.', 'error');
                }
            } else if (!silent) {
                showNotification(`Payment status: ${status}`, 'info');
            }
        } else {
            throw new Error(data.error);
        }
        
    } catch (error) {
        if (!silent) {
            showNotification('Error checking payment status.', 'error');
        }
        console.error('Payment status check error:', error);
    }
}

// Enhanced server selection functionality
function setupServerSelection() {
    const serverCards = document.querySelectorAll('.server-card');
    
    serverCards.forEach(card => {
        card.addEventListener('click', function() {
            const serverId = this.dataset.serverId;
            if (serverId) {
                selectServer(serverId);
            }
        });
        
        // Add server load indicator animation
        const loadElement = card.querySelector('.server-load');
        if (loadElement) {
            const load = parseInt(loadElement.textContent);
            loadElement.style.setProperty('--load-width', `${load}%`);
        }
    });
}

// Select server functionality
function selectServer(serverId) {
    // Check if user is logged in
    const token = localStorage.getItem('vpn_access_token');
    if (!token) {
        showNotification('Please login to connect to servers.', 'error');
        setTimeout(() => {
            window.location.href = 'login.html';
        }, 2000);
        return;
    }
    
    // Redirect to dashboard with selected server
    window.location.href = `dashboard.html?server=${serverId}`;
}

// Protocol information modal
function showProtocolInfo(protocol) {
    const protocolData = {
        'XBorad': {
            name: 'XBorad',
            description: 'Advanced proxy protocol optimized for high performance and stability.',
            features: [
                'High-speed connections',
                'Advanced encryption',
                'Traffic obfuscation',
                'Multi-platform support'
            ],
            platforms: ['Windows', 'macOS', 'Android', 'iOS'],
            client: 'Clash for Windows/Meta'
        },
        'V2bx': {
            name: 'V2bx',
            description: 'Next-generation protocol with advanced traffic masking capabilities.',
            features: [
                'Multiple transport protocols',
                'Deep packet inspection resistance',
                'Dynamic port allocation',
                'CDN masquerading'
            ],
            platforms: ['Windows', 'macOS', 'Android', 'iOS'],
            client: 'V2rayN/V2rayNG'
        },
        'WireGuard': {
            name: 'WireGuard',
            description: 'Modern VPN protocol that is faster, simpler, and more secure.',
            features: [
                'Minimal codebase',
                'Strong cryptography',
                'Fast handshake',
                'Low latency'
            ],
            platforms: ['Windows', 'macOS', 'Linux', 'Android', 'iOS'],
            client: 'Official WireGuard Client'
        },
        'udp2raw': {
            name: 'udp2raw',
            description: 'UDP tunnel that disguises traffic as TCP for bypassing restrictions.',
            features: [
                'UDP over fake TCP',
                'Packet scrambling',
                'Anti-detection mechanisms',
                'NAT traversal'
            ],
            platforms: ['Windows', 'macOS', 'Linux'],
            client: 'Command line tool'
        }
    };
    
    const info = protocolData[protocol];
    if (!info) return;
    
    // Create modal
    const modal = document.createElement('div');
    modal.className = 'protocol-modal';
    modal.innerHTML = `
        <div class="modal-overlay" onclick="this.parentElement.remove()"></div>
        <div class="modal-content">
            <div class="modal-header">
                <h3><i class="fas fa-network-wired"></i> ${info.name} Protocol</h3>
                <button class="modal-close" onclick="this.closest('.protocol-modal').remove()">&times;</button>
            </div>
            <div class="modal-body">
                <p class="protocol-description">${info.description}</p>
                <div class="protocol-features">
                    <h4>Key Features:</h4>
                    <ul>
                        ${info.features.map(feature => `<li>${feature}</li>`).join('')}
                    </ul>
                </div>
                <div class="protocol-platforms">
                    <h4>Supported Platforms:</h4>
                    <div class="platform-tags">
                        ${info.platforms.map(platform => `<span class="platform-tag">${platform}</span>`).join('')}
                    </div>
                </div>
                <div class="protocol-client">
                    <h4>Recommended Client:</h4>
                    <p><strong>${info.client}</strong></p>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
}

// Enhanced notification system
function showNotification(message, type = 'info', duration = 5000) {
    // Remove existing notifications
    const existingNotifications = document.querySelectorAll('.notification');
    existingNotifications.forEach(n => n.remove());
    
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    
    const icons = {
        success: 'fas fa-check-circle',
        error: 'fas fa-exclamation-circle',
        warning: 'fas fa-exclamation-triangle',
        info: 'fas fa-info-circle'
    };
    
    const colors = {
        success: '#10b981',
        error: '#ef4444',
        warning: '#f59e0b',
        info: '#3b82f6'
    };
    
    notification.innerHTML = `
        <div style="
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${colors[type] || colors.info};
            color: white;
            padding: 15px 20px;
            border-radius: 8px;
            box-shadow: 0 10px 25px rgba(0,0,0,0.1);
            z-index: 10000;
            max-width: 400px;
            animation: slideInRight 0.3s ease;
            backdrop-filter: blur(10px);
        ">
            <div style="display: flex; align-items: center; gap: 10px;">
                <i class="${icons[type] || icons.info}"></i>
                <span>${message}</span>
                <button onclick="this.closest('.notification').remove()" style="
                    background: none;
                    border: none;
                    color: white;
                    font-size: 18px;
                    cursor: pointer;
                    margin-left: auto;
                    opacity: 0.8;
                    transition: opacity 0.2s;
                " onmouseover="this.style.opacity='1'" onmouseout="this.style.opacity='0.8'">&times;</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(notification);
    
    // Auto remove notification
    setTimeout(() => {
        if (notification.parentElement) {
            notification.style.animation = 'slideOutRight 0.3s ease';
            setTimeout(() => notification.remove(), 300);
        }
    }, duration);
}

// Setup protocol info handlers
function setupProtocolInfo() {
    document.querySelectorAll('[data-protocol]').forEach(element => {
        element.addEventListener('click', function() {
            const protocol = this.dataset.protocol;
            showProtocolInfo(protocol);
        });
    });
}

// Enhanced mobile menu functionality
function setupMobileMenu() {
    const hamburger = document.getElementById('hamburger');
    const navMenu = document.getElementById('nav-menu');
    
    if (hamburger && navMenu) {
        hamburger.addEventListener('click', () => {
            hamburger.classList.toggle('active');
            navMenu.classList.toggle('active');
            document.body.classList.toggle('menu-open');
        });
        
        // Close menu when clicking outside
        document.addEventListener('click', (e) => {
            if (!hamburger.contains(e.target) && !navMenu.contains(e.target)) {
                hamburger.classList.remove('active');
                navMenu.classList.remove('active');
                document.body.classList.remove('menu-open');
            }
        });
        
        // Close menu when clicking on links
        navMenu.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', () => {
                hamburger.classList.remove('active');
                navMenu.classList.remove('active');
                document.body.classList.remove('menu-open');
            });
        });
    }
}

// Add CSS animations
function addAnimationStyles() {
    if (document.getElementById('vpn-animations')) return;
    
    const style = document.createElement('style');
    style.id = 'vpn-animations';
    style.textContent = `
        @keyframes slideInRight {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }
        
        @keyframes slideOutRight {
            from { transform: translateX(0); opacity: 1; }
            to { transform: translateX(100%); opacity: 0; }
        }
        
        .payment-modal, .protocol-modal {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            z-index: 10000;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        
        .modal-overlay {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.5);
            backdrop-filter: blur(5px);
        }
        
        .modal-content {
            position: relative;
            background: white;
            border-radius: 12px;
            max-width: 500px;
            width: 90%;
            max-height: 90vh;
            overflow-y: auto;
            box-shadow: 0 25px 50px rgba(0, 0, 0, 0.25);
            animation: modalIn 0.3s ease;
        }
        
        @keyframes modalIn {
            from { transform: scale(0.9); opacity: 0; }
            to { transform: scale(1); opacity: 1; }
        }
        
        .modal-header {
            padding: 20px;
            border-bottom: 1px solid #e5e7eb;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        
        .modal-body {
            padding: 20px;
        }
        
        .modal-footer {
            padding: 20px;
            border-top: 1px solid #e5e7eb;
            display: flex;
            gap: 10px;
            justify-content: flex-end;
        }
        
        .payment-details {
            text-align: center;
        }
        
        .payment-amount {
            font-size: 2rem;
            font-weight: bold;
            color: #059669;
            margin-bottom: 20px;
        }
        
        .address-container {
            display: flex;
            gap: 10px;
            margin: 10px 0;
        }
        
        .payment-address-input {
            flex: 1;
            padding: 10px;
            border: 1px solid #d1d5db;
            border-radius: 6px;
            font-family: monospace;
            font-size: 14px;
        }
        
        .copy-btn {
            padding: 10px 15px;
            background: #3b82f6;
            color: white;
            border: none;
            border-radius: 6px;
            cursor: pointer;
        }
        
        .qr-code {
            margin: 20px 0;
        }
        
        .qr-code img {
            border: 1px solid #e5e7eb;
            border-radius: 8px;
        }
        
        .payment-timer {
            background: #fef3c7;
            color: #92400e;
            padding: 10px;
            border-radius: 6px;
            margin: 15px 0;
        }
        
        .payment-instructions {
            text-align: left;
            background: #f3f4f6;
            padding: 15px;
            border-radius: 8px;
            margin-top: 20px;
        }
        
        .payment-instructions ul {
            margin: 10px 0;
            padding-left: 20px;
        }
        
        .payment-instructions li {
            margin: 5px 0;
        }
        
        .modal-close {
            background: none;
            border: none;
            font-size: 24px;
            cursor: pointer;
            color: #6b7280;
        }
        
        .modal-close:hover {
            color: #374151;
        }
        
        .platform-tags {
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
            margin: 10px 0;
        }
        
        .platform-tag {
            background: #3b82f6;
            color: white;
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 12px;
        }
        
        .body.menu-open {
            overflow: hidden;
        }
    `;
    document.head.appendChild(style);
}

// Initialize performance tracking
trackPagePerformance();