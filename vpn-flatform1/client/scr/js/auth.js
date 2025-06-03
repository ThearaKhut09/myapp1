// Authentication JavaScript
class AuthManager {
    constructor() {
        this.apiBaseUrl = '/api';
        this.init();
    }

    init() {
        this.bindEvents();
        this.setupFormValidation();
        this.addAnimations();
    }

    bindEvents() {
        // Password toggle functionality
        document.querySelectorAll('.password-toggle').forEach(toggle => {
            toggle.addEventListener('click', (e) => {
                e.preventDefault();
                this.togglePasswordVisibility(toggle);
            });
        });

        // Form submissions
        const loginForm = document.getElementById('loginForm');
        const registerForm = document.getElementById('registerForm');

        if (loginForm) {
            loginForm.addEventListener('submit', (e) => this.handleLogin(e));
        }

        if (registerForm) {
            registerForm.addEventListener('submit', (e) => this.handleRegister(e));
            
            // Password strength checker
            const passwordInput = document.getElementById('password');
            if (passwordInput) {
                passwordInput.addEventListener('input', (e) => this.checkPasswordStrength(e.target.value));
            }
        }

        // Social login buttons
        document.querySelectorAll('.social-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                this.handleSocialLogin(btn);
            });
        });
    }

    togglePasswordVisibility(toggle) {
        const input = toggle.previousElementSibling;
        const icon = toggle.querySelector('i');
        
        if (input.type === 'password') {
            input.type = 'text';
            icon.classList.remove('fa-eye');
            icon.classList.add('fa-eye-slash');
        } else {
            input.type = 'password';
            icon.classList.remove('fa-eye-slash');
            icon.classList.add('fa-eye');
        }
    }

    checkPasswordStrength(password) {
        const strengthElement = document.getElementById('passwordStrength');
        const strengthFill = strengthElement.querySelector('.strength-fill');
        const strengthText = strengthElement.querySelector('.strength-text');
        
        let score = 0;
        let text = 'Very Weak';
        
        // Length check
        if (password.length >= 8) score += 1;
        if (password.length >= 12) score += 1;
        
        // Character variety checks
        if (/[a-z]/.test(password)) score += 1;
        if (/[A-Z]/.test(password)) score += 1;
        if (/[0-9]/.test(password)) score += 1;
        if (/[^A-Za-z0-9]/.test(password)) score += 1;
        
        // Remove existing classes
        strengthElement.className = 'password-strength';
        
        if (score < 3) {
            strengthElement.classList.add('strength-weak');
            text = 'Weak';
        } else if (score < 5) {
            strengthElement.classList.add('strength-medium');
            text = 'Medium';
        } else {
            strengthElement.classList.add('strength-strong');
            text = 'Strong';
        }
        
        strengthText.textContent = `Password strength: ${text}`;
    }

    async handleLogin(e) {
        e.preventDefault();
        
        const form = e.target;
        const formData = new FormData(form);
        const loginBtn = document.getElementById('loginBtn');
        
        // Show loading state
        this.setButtonLoading(loginBtn, true);
        
        try {
            const response = await this.makeRequest('/auth/login', {
                method: 'POST',
                body: JSON.stringify({
                    email: formData.get('email'),
                    password: formData.get('password'),
                    rememberMe: formData.get('rememberMe') === 'on'
                })
            });

            if (response.success) {
                this.showMessage('Login successful! Redirecting...', 'success');
                
                // Store auth token
                localStorage.setItem('authToken', response.token);
                if (formData.get('rememberMe')) {
                    localStorage.setItem('rememberUser', 'true');
                }
                
                // Redirect to dashboard
                setTimeout(() => {
                    window.location.href = 'dashboard.html';
                }, 1500);
            } else {
                throw new Error(response.message || 'Login failed');
            }
        } catch (error) {
            this.showMessage(error.message || 'Login failed. Please try again.', 'error');
            form.classList.add('error-shake');
            setTimeout(() => form.classList.remove('error-shake'), 500);
        } finally {
            this.setButtonLoading(loginBtn, false);
        }
    }

    async handleRegister(e) {
        e.preventDefault();
        
        const form = e.target;
        const formData = new FormData(form);
        const registerBtn = document.getElementById('registerBtn');
        
        // Validate passwords match
        const password = formData.get('password');
        const confirmPassword = formData.get('confirmPassword');
        
        if (password !== confirmPassword) {
            this.showMessage('Passwords do not match', 'error');
            return;
        }
        
        // Check password strength
        const strengthElement = document.getElementById('passwordStrength');
        if (strengthElement.classList.contains('strength-weak')) {
            this.showMessage('Please choose a stronger password', 'warning');
            return;
        }
        
        // Show loading state
        this.setButtonLoading(registerBtn, true);
        
        try {
            const response = await this.makeRequest('/auth/register', {
                method: 'POST',
                body: JSON.stringify({
                    firstName: formData.get('firstName'),
                    lastName: formData.get('lastName'),
                    email: formData.get('email'),
                    password: password,
                    referralCode: formData.get('referralCode'),
                    newsletter: formData.get('newsletter') === 'on'
                })
            });

            if (response.success) {
                this.showMessage('Account created successfully! Please check your email to verify your account.', 'success');
                
                // Clear form
                form.reset();
                
                // Redirect to login after 3 seconds
                setTimeout(() => {
                    window.location.href = 'login.html';
                }, 3000);
            } else {
                throw new Error(response.message || 'Registration failed');
            }
        } catch (error) {
            this.showMessage(error.message || 'Registration failed. Please try again.', 'error');
            form.classList.add('error-shake');
            setTimeout(() => form.classList.remove('error-shake'), 500);
        } finally {
            this.setButtonLoading(registerBtn, false);
        }
    }

    handleSocialLogin(btn) {
        const provider = btn.classList.contains('google-btn') ? 'google' : 'github';
        
        // In a real implementation, this would redirect to OAuth provider
        this.showMessage(`${provider} login coming soon!`, 'warning');
        
        // Mock social login for development
        if (confirm(`Continue with ${provider}? (This is a demo)`)) {
            window.location.href = `${this.apiBaseUrl}/auth/${provider}`;
        }
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

    showMessage(text, type = 'info') {
        // Remove existing messages
        const existingMessages = document.querySelectorAll('.message');
        existingMessages.forEach(msg => msg.remove());
        
        // Create new message
        const message = document.createElement('div');
        message.className = `message ${type}`;
        message.textContent = text;
        
        // Insert message at the top of the form
        const form = document.querySelector('.auth-form');
        form.insertBefore(message, form.firstChild);
        
        // Auto-remove after 5 seconds
        setTimeout(() => {
            if (message.parentNode) {
                message.remove();
            }
        }, 5000);
    }

    async makeRequest(url, options = {}) {
        // Mock API responses for development
        const mockResponses = {
            '/auth/login': {
                success: true,
                token: 'mock-jwt-token-' + Date.now(),
                user: {
                    id: 1,
                    email: 'user@example.com',
                    name: 'John Doe'
                }
            },
            '/auth/register': {
                success: true,
                message: 'Registration successful'
            }
        };
        
        // Simulate network delay
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Return mock response for development
        if (mockResponses[url]) {
            return mockResponses[url];
        }
        
        // Real API call would go here
        try {
            const response = await fetch(this.apiBaseUrl + url, {
                headers: {
                    'Content-Type': 'application/json',
                    ...options.headers
                },
                ...options
            });
            
            return await response.json();
        } catch (error) {
            throw new Error('Network error. Please check your connection.');
        }
    }

    setupFormValidation() {
        // Real-time validation
        document.querySelectorAll('input[required]').forEach(input => {
            input.addEventListener('blur', () => this.validateField(input));
            input.addEventListener('input', () => this.clearFieldError(input));
        });
        
        // Email validation
        document.querySelectorAll('input[type="email"]').forEach(input => {
            input.addEventListener('blur', () => this.validateEmail(input));
        });
    }

    validateField(field) {
        const value = field.value.trim();
        let isValid = true;
        let message = '';
        
        if (field.hasAttribute('required') && !value) {
            isValid = false;
            message = 'This field is required';
        }
        
        if (field.type === 'email' && value && !this.isValidEmail(value)) {
            isValid = false;
            message = 'Please enter a valid email address';
        }
        
        if (field.type === 'password' && value && value.length < 8) {
            isValid = false;
            message = 'Password must be at least 8 characters';
        }
        
        this.setFieldError(field, isValid ? null : message);
        return isValid;
    }

    validateEmail(field) {
        const email = field.value.trim();
        if (email && !this.isValidEmail(email)) {
            this.setFieldError(field, 'Please enter a valid email address');
            return false;
        }
        this.clearFieldError(field);
        return true;
    }

    isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    setFieldError(field, message) {
        this.clearFieldError(field);
        
        if (message) {
            field.style.borderColor = '#f44336';
            
            const errorElement = document.createElement('div');
            errorElement.className = 'field-error';
            errorElement.style.cssText = 'color: #f44336; font-size: 0.8rem; margin-top: 5px;';
            errorElement.textContent = message;
            
            field.parentNode.parentNode.appendChild(errorElement);
        }
    }

    clearFieldError(field) {
        field.style.borderColor = '';
        const errorElement = field.parentNode.parentNode.querySelector('.field-error');
        if (errorElement) {
            errorElement.remove();
        }
    }

    addAnimations() {
        // Add fade-in animation to auth card
        const authCard = document.querySelector('.auth-card');
        const authFeatures = document.querySelector('.auth-features');
        
        if (authCard) {
            authCard.classList.add('fade-in');
        }
        
        if (authFeatures) {
            setTimeout(() => {
                authFeatures.classList.add('fade-in');
            }, 200);
        }
        
        // Animate feature items
        const featureItems = document.querySelectorAll('.feature-item');
        featureItems.forEach((item, index) => {
            setTimeout(() => {
                item.style.opacity = '0';
                item.style.transform = 'translateX(-20px)';
                item.style.transition = 'all 0.5s ease';
                
                setTimeout(() => {
                    item.style.opacity = '1';
                    item.style.transform = 'translateX(0)';
                }, 100 * index);
            }, 500);
        });
    }
}

// Utility functions
function checkAuthStatus() {
    const token = localStorage.getItem('authToken');
    if (token) {
        // Verify token validity (in real app, make API call)
        return true;
    }
    return false;
}

function logout() {
    localStorage.removeItem('authToken');
    localStorage.removeItem('rememberUser');
    window.location.href = 'login.html';
}

// Initialize authentication manager when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new AuthManager();
    
    // Auto-fill remembered user (if any)
    if (localStorage.getItem('rememberUser')) {
        const emailInput = document.getElementById('email');
        const rememberCheckbox = document.getElementById('rememberMe');
        
        if (emailInput && rememberCheckbox) {
            rememberCheckbox.checked = true;
            // In real app, you might store the email securely
        }
    }
});

// Export for use in other modules
window.AuthManager = AuthManager;
