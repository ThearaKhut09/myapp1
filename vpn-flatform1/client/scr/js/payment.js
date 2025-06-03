// Payment Page JavaScript
class PaymentManager {
    constructor() {
        this.api = new VPNApiClient();
        this.selectedMethod = 'usdt';
        this.planData = this.getPlanData();
        this.currentPayment = null;
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.loadPlanData();
        this.initializePaymentMethods();
        this.setupPromoCode();
        this.updatePricing();
    }

    getPlanData() {
        // Get plan data from URL parameters or localStorage
        const urlParams = new URLSearchParams(window.location.search);
        const planId = urlParams.get('plan') || localStorage.getItem('selectedPlan');
        
        // Default plans configuration
        const plans = {
            'monthly': {
                name: 'Premium Monthly Plan',
                price: 12.99,
                originalPrice: 15.99,
                duration: '1 Month',
                features: 'Unlimited bandwidth • 5 devices • 100+ servers'
            },
            'annual': {
                name: 'Premium Annual Plan',
                price: 79.99,
                originalPrice: 99.99,
                duration: '12 Months',
                features: 'Unlimited bandwidth • 10 devices • 100+ servers'
            },
            'lifetime': {
                name: 'Lifetime Premium Plan',
                price: 199.99,
                originalPrice: 299.99,
                duration: 'Lifetime',
                features: 'Unlimited bandwidth • Unlimited devices • 100+ servers'
            }
        };

        return plans[planId] || plans['annual'];
    }

    loadPlanData() {
        const planSummary = document.getElementById('planSummary');
        const selectedPlan = document.getElementById('selectedPlan');
        const planFeatures = document.getElementById('planFeatures');
        const subtotal = document.getElementById('subtotal');
        const discount = document.getElementById('discount');
        const totalAmount = document.getElementById('totalAmount');

        if (selectedPlan) selectedPlan.textContent = this.planData.name;
        if (planFeatures) planFeatures.textContent = this.planData.features;
        if (subtotal) subtotal.textContent = `$${this.planData.originalPrice}`;
        
        const discountAmount = this.planData.originalPrice - this.planData.price;
        if (discount) discount.textContent = `-$${discountAmount.toFixed(2)}`;
        if (totalAmount) totalAmount.textContent = `$${this.planData.price}`;

        this.updateUSDTAmount();
    }

    updateUSDTAmount() {
        const usdtAmount = document.getElementById('usdtAmount');
        if (usdtAmount) {
            // Apply 5% crypto discount
            const cryptoPrice = this.planData.price * 0.95;
            usdtAmount.textContent = `${cryptoPrice.toFixed(2)} USDT`;
        }
    }

    setupEventListeners() {
        // Payment method selection
        const paymentOptions = document.querySelectorAll('.payment-option');
        paymentOptions.forEach(option => {
            option.addEventListener('click', (e) => {
                this.selectPaymentMethod(option.dataset.method);
            });
        });

        // Copy wallet address
        const copyBtn = document.getElementById('copyAddress');
        if (copyBtn) {
            copyBtn.addEventListener('click', () => {
                this.copyWalletAddress();
            });
        }

        // Verify payment
        const verifyBtn = document.getElementById('verifyPayment');
        if (verifyBtn) {
            verifyBtn.addEventListener('click', () => {
                this.verifyPayment();
            });
        }

        // Card payment form
        const cardForm = document.querySelector('.card-form form');
        if (cardForm) {
            cardForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.processCardPayment();
            });
        }

        // PayPal payment
        const paypalBtn = document.getElementById('paypalBtn');
        if (paypalBtn) {
            paypalBtn.addEventListener('click', () => {
                this.processPayPalPayment();
            });
        }

        // Card number formatting
        const cardNumber = document.getElementById('cardNumber');
        if (cardNumber) {
            cardNumber.addEventListener('input', (e) => {
                this.formatCardNumber(e.target);
            });
        }

        // Expiry date formatting
        const expiryDate = document.getElementById('expiryDate');
        if (expiryDate) {
            expiryDate.addEventListener('input', (e) => {
                this.formatExpiryDate(e.target);
            });
        }
    }

    selectPaymentMethod(method) {
        this.selectedMethod = method;

        // Update active payment option
        document.querySelectorAll('.payment-option').forEach(option => {
            option.classList.remove('active');
        });
        document.querySelector(`[data-method="${method}"]`).classList.add('active');

        // Show/hide payment forms
        document.querySelectorAll('.payment-form').forEach(form => {
            form.classList.remove('active');
        });
        document.getElementById(`${method}Form`).classList.add('active');

        this.updatePricing();
    }

    updatePricing() {
        const totalAmount = document.getElementById('totalAmount');
        let finalPrice = this.planData.price;

        // Apply crypto discount for USDT
        if (this.selectedMethod === 'usdt') {
            finalPrice = this.planData.price * 0.95;
        }

        if (totalAmount) {
            totalAmount.textContent = `$${finalPrice.toFixed(2)}`;
        }

        this.updateUSDTAmount();
    }

    setupPromoCode() {
        const applyPromoBtn = document.getElementById('applyPromo');
        const promoInput = document.getElementById('promoInput');

        if (applyPromoBtn && promoInput) {
            applyPromoBtn.addEventListener('click', async () => {
                const code = promoInput.value.trim();
                if (code) {
                    await this.applyPromoCode(code);
                }
            });

            promoInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    applyPromoBtn.click();
                }
            });
        }
    }

    async applyPromoCode(code) {
        try {
            const response = await this.api.request('/payment/promo', {
                method: 'POST',
                body: JSON.stringify({ code, planPrice: this.planData.price })
            });

            const result = await response.json();

            if (response.ok && result.valid) {
                this.showNotification('Promo code applied successfully!', 'success');
                this.updatePricingWithPromo(result.discount);
            } else {
                this.showNotification(result.message || 'Invalid promo code', 'error');
            }
        } catch (error) {
            console.error('Promo code error:', error);
            this.showNotification('Failed to apply promo code', 'error');
        }
    }

    updatePricingWithPromo(discount) {
        const discountElement = document.getElementById('discount');
        const totalAmount = document.getElementById('totalAmount');

        if (discountElement && totalAmount) {
            const originalDiscount = this.planData.originalPrice - this.planData.price;
            const totalDiscount = originalDiscount + discount;
            const newTotal = this.planData.originalPrice - totalDiscount;

            discountElement.textContent = `-$${totalDiscount.toFixed(2)}`;
            totalAmount.textContent = `$${newTotal.toFixed(2)}`;

            this.planData.price = newTotal;
            this.updateUSDTAmount();
        }
    }

    copyWalletAddress() {
        const walletAddress = document.getElementById('walletAddress');
        const copyBtn = document.getElementById('copyAddress');

        if (walletAddress && copyBtn) {
            walletAddress.select();
            document.execCommand('copy');

            const originalHTML = copyBtn.innerHTML;
            copyBtn.innerHTML = '<i class="fas fa-check"></i>';
            copyBtn.classList.add('copied');

            setTimeout(() => {
                copyBtn.innerHTML = originalHTML;
                copyBtn.classList.remove('copied');
            }, 2000);

            this.showNotification('Wallet address copied!', 'success');
        }
    }

    async verifyPayment() {
        const txHash = document.getElementById('txHash').value.trim();
        const verifyBtn = document.getElementById('verifyPayment');

        if (!txHash) {
            this.showNotification('Please enter the transaction hash', 'error');
            return;
        }

        this.setButtonLoading(verifyBtn, true);

        try {
            const response = await this.api.request('/payment/verify', {
                method: 'POST',
                body: JSON.stringify({
                    txHash,
                    planType: this.getPlanType(),
                    amount: this.planData.price * 0.95 // USDT amount with discount
                })
            });

            const result = await response.json();

            if (response.ok && result.verified) {
                this.showSuccessModal();
                this.activateSubscription(result.paymentId);
            } else {
                this.showNotification(result.message || 'Payment verification failed', 'error');
            }
        } catch (error) {
            console.error('Payment verification error:', error);
            this.showNotification('Failed to verify payment', 'error');
        } finally {
            this.setButtonLoading(verifyBtn, false);
        }
    }

    async processCardPayment() {
        const cardData = this.getCardFormData();
        if (!this.validateCardData(cardData)) {
            return;
        }

        try {
            this.showNotification('Processing payment...', 'info');

            const response = await this.api.request('/payment/card', {
                method: 'POST',
                body: JSON.stringify({
                    cardData,
                    planType: this.getPlanType(),
                    amount: this.planData.price
                })
            });

            const result = await response.json();

            if (response.ok && result.success) {
                this.showSuccessModal();
                this.activateSubscription(result.paymentId);
            } else {
                this.showNotification(result.message || 'Payment failed', 'error');
            }
        } catch (error) {
            console.error('Card payment error:', error);
            this.showNotification('Payment processing failed', 'error');
        }
    }

    async processPayPalPayment() {
        try {
            const response = await this.api.request('/payment/paypal/create', {
                method: 'POST',
                body: JSON.stringify({
                    planType: this.getPlanType(),
                    amount: this.planData.price
                })
            });

            const result = await response.json();

            if (response.ok && result.approvalUrl) {
                window.location.href = result.approvalUrl;
            } else {
                this.showNotification(result.message || 'PayPal payment setup failed', 'error');
            }
        } catch (error) {
            console.error('PayPal payment error:', error);
            this.showNotification('PayPal payment setup failed', 'error');
        }
    }

    getCardFormData() {
        return {
            number: document.getElementById('cardNumber').value.replace(/\s/g, ''),
            expiry: document.getElementById('expiryDate').value,
            cvv: document.getElementById('cvv').value,
            name: document.getElementById('cardName').value
        };
    }

    validateCardData(cardData) {
        if (!cardData.number || cardData.number.length < 13) {
            this.showNotification('Please enter a valid card number', 'error');
            return false;
        }

        if (!cardData.expiry || !/^\d{2}\/\d{2}$/.test(cardData.expiry)) {
            this.showNotification('Please enter a valid expiry date', 'error');
            return false;
        }

        if (!cardData.cvv || cardData.cvv.length < 3) {
            this.showNotification('Please enter a valid CVV', 'error');
            return false;
        }

        if (!cardData.name.trim()) {
            this.showNotification('Please enter the cardholder name', 'error');
            return false;
        }

        return true;
    }

    formatCardNumber(input) {
        let value = input.value.replace(/\s/g, '').replace(/[^0-9]/gi, '');
        let formattedValue = value.match(/.{1,4}/g)?.join(' ') || value;
        input.value = formattedValue;
    }

    formatExpiryDate(input) {
        let value = input.value.replace(/\D/g, '');
        if (value.length >= 2) {
            value = value.substring(0, 2) + '/' + value.substring(2, 4);
        }
        input.value = value;
    }

    getPlanType() {
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get('plan') || 'annual';
    }

    async activateSubscription(paymentId) {
        try {
            await this.api.request('/auth/activate-subscription', {
                method: 'POST',
                body: JSON.stringify({
                    paymentId,
                    planType: this.getPlanType()
                })
            });
        } catch (error) {
            console.error('Subscription activation error:', error);
        }
    }

    showSuccessModal() {
        const modal = document.getElementById('successModal');
        if (modal) {
            modal.style.display = 'flex';
            
            // Auto-redirect after 5 seconds
            setTimeout(() => {
                window.location.href = 'dashboard.html';
            }, 5000);
        }
    }

    setButtonLoading(button, loading) {
        const btnText = button.querySelector('.btn-text');
        const btnLoader = button.querySelector('.btn-loader');

        if (loading) {
            button.disabled = true;
            if (btnText) btnText.style.display = 'none';
            if (btnLoader) btnLoader.style.display = 'inline-block';
        } else {
            button.disabled = false;
            if (btnText) btnText.style.display = 'inline';
            if (btnLoader) btnLoader.style.display = 'none';
        }
    }

    showNotification(message, type = 'info') {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.innerHTML = `
            <div class="notification-content">
                <i class="fas fa-${this.getNotificationIcon(type)}"></i>
                <span>${message}</span>
            </div>
            <button class="notification-close">
                <i class="fas fa-times"></i>
            </button>
        `;

        // Add to page
        document.body.appendChild(notification);

        // Show notification
        setTimeout(() => notification.classList.add('show'), 100);

        // Auto-hide after 5 seconds
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => notification.remove(), 300);
        }, 5000);

        // Close button
        notification.querySelector('.notification-close').addEventListener('click', () => {
            notification.classList.remove('show');
            setTimeout(() => notification.remove(), 300);
        });
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

    initializePaymentMethods() {
        // Generate QR code for USDT payment
        this.generateQRCode();
        
        // Initialize payment gateway widgets if needed
        this.initializePaymentGateways();
    }

    generateQRCode() {
        const qrContainer = document.getElementById('qrCode');
        const walletAddress = document.getElementById('walletAddress').value;
        const amount = document.getElementById('usdtAmount').textContent.replace(' USDT', '');

        if (qrContainer && walletAddress) {
            // For production, you would use a proper QR code library
            // For now, we'll create a placeholder
            qrContainer.innerHTML = `
                <div class="qr-placeholder generated">
                    <i class="fas fa-qrcode"></i>
                    <p>QR Code for ${amount} USDT</p>
                    <small>Scan with your wallet app</small>
                </div>
            `;
        }
    }

    initializePaymentGateways() {
        // Initialize any third-party payment widgets
        // This would be where you'd load Stripe, PayPal SDK, etc.
        console.log('Payment gateways initialized');
    }
}

// Initialize payment manager when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new PaymentManager();
});

// Handle PayPal return
window.addEventListener('load', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const paymentId = urlParams.get('paymentId');
    const payerId = urlParams.get('PayerID');

    if (paymentId && payerId) {
        // Handle PayPal return
        handlePayPalReturn(paymentId, payerId);
    }
});

async function handlePayPalReturn(paymentId, payerId) {
    try {
        const api = new VPNApiClient();
        const response = await api.request('/payment/paypal/execute', {
            method: 'POST',
            body: JSON.stringify({ paymentId, payerId })
        });

        const result = await response.json();

        if (response.ok && result.success) {
            document.getElementById('successModal').style.display = 'flex';
            setTimeout(() => {
                window.location.href = 'dashboard.html';
            }, 3000);
        } else {
            alert('Payment verification failed. Please contact support.');
        }
    } catch (error) {
        console.error('PayPal return error:', error);
        alert('Payment verification failed. Please contact support.');
    }
}
