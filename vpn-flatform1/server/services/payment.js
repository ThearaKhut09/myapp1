/**
 * Enhanced Payment Processing System
 * Supports multiple payment methods including traditional and cryptocurrency payments
 * with fraud detection, subscription management, and automated processing
 */

const crypto = require('crypto');
const axios = require('axios');
const EventEmitter = require('events');
const db = require('../database/manager');

class PaymentProcessor extends EventEmitter {
    constructor() {
        super();
        this.providers = {
            stripe: null,
            paypal: null,
            coinbase: null,
            crypto: null
        };
        this.webhookSecrets = {};
        this.fraudThreshold = 0.7;
        this.processingQueue = [];
        this.isProcessing = false;
        
        this.init();
    }

    /**
     * Initialize payment processor
     */
    async init() {
        try {
            await this.loadProviderConfigs();
            await this.initializeProviders();
            this.startQueueProcessor();
            
            console.log('✅ Payment processor initialized');
        } catch (error) {
            console.error('❌ Payment processor initialization failed:', error);
        }
    }

    /**
     * Load provider configurations from database
     */
    async loadProviderConfigs() {
        const configs = await db.all(
            'SELECT key, value FROM config_settings WHERE category = "payments"'
        );
        
        this.config = {};
        configs.forEach(config => {
            this.config[config.key] = config.value;
        });
    }

    /**
     * Initialize payment providers
     */
    async initializeProviders() {
        // Initialize Stripe
        if (this.config.stripe_secret_key) {
            const stripe = require('stripe')(this.config.stripe_secret_key);
            this.providers.stripe = stripe;
            this.webhookSecrets.stripe = this.config.stripe_webhook_secret;
        }

        // Initialize PayPal
        if (this.config.paypal_client_id && this.config.paypal_client_secret) {
            this.providers.paypal = {
                clientId: this.config.paypal_client_id,
                clientSecret: this.config.paypal_client_secret,
                environment: this.config.paypal_environment || 'sandbox'
            };
        }

        // Initialize Coinbase Commerce
        if (this.config.coinbase_api_key) {
            this.providers.coinbase = {
                apiKey: this.config.coinbase_api_key,
                webhookSecret: this.config.coinbase_webhook_secret
            };
        }

        // Initialize crypto payment processor
        this.providers.crypto = new CryptoPaymentProcessor();
    }

    /**
     * Process payment
     */
    async processPayment(paymentData) {
        try {
            // Validate payment data
            this.validatePaymentData(paymentData);
            
            // Fraud detection
            const fraudScore = await this.detectFraud(paymentData);
            if (fraudScore > this.fraudThreshold) {
                throw new Error('Payment flagged for potential fraud');
            }

            // Create transaction record
            const transaction = await this.createTransaction(paymentData);
            
            // Process based on payment method
            let result;
            switch (paymentData.method) {
                case 'stripe':
                    result = await this.processStripePayment(paymentData, transaction);
                    break;
                case 'paypal':
                    result = await this.processPayPalPayment(paymentData, transaction);
                    break;
                case 'crypto':
                    result = await this.processCryptoPayment(paymentData, transaction);
                    break;
                case 'coinbase':
                    result = await this.processCoinbasePayment(paymentData, transaction);
                    break;
                default:
                    throw new Error('Unsupported payment method');
            }

            // Update transaction with result
            await this.updateTransaction(transaction.id, result);
            
            // Handle successful payment
            if (result.status === 'completed') {
                await this.handleSuccessfulPayment(transaction, paymentData);
            }

            this.emit('payment_processed', {
                transactionId: transaction.id,
                status: result.status,
                amount: paymentData.amount,
                method: paymentData.method
            });

            return {
                success: true,
                transactionId: transaction.id,
                status: result.status,
                ...result
            };

        } catch (error) {
            console.error('Payment processing error:', error);
            
            this.emit('payment_failed', {
                error: error.message,
                paymentData
            });

            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Process Stripe payment
     */
    async processStripePayment(paymentData, transaction) {
        if (!this.providers.stripe) {
            throw new Error('Stripe not configured');
        }

        try {
            const paymentIntent = await this.providers.stripe.paymentIntents.create({
                amount: Math.round(paymentData.amount * 100), // Convert to cents
                currency: paymentData.currency || 'usd',
                payment_method: paymentData.paymentMethodId,
                confirmation_method: 'manual',
                confirm: true,
                metadata: {
                    transactionId: transaction.id,
                    userId: paymentData.userId,
                    planId: paymentData.planId
                }
            });

            return {
                status: paymentIntent.status === 'succeeded' ? 'completed' : 'pending',
                providerTransactionId: paymentIntent.id,
                providerResponse: JSON.stringify(paymentIntent)
            };

        } catch (error) {
            return {
                status: 'failed',
                error: error.message,
                providerResponse: JSON.stringify(error)
            };
        }
    }

    /**
     * Process PayPal payment
     */
    async processPayPalPayment(paymentData, transaction) {
        try {
            const accessToken = await this.getPayPalAccessToken();
            
            const order = await axios.post(
                `https://api.${this.providers.paypal.environment}.paypal.com/v2/checkout/orders`,
                {
                    intent: 'CAPTURE',
                    purchase_units: [{
                        amount: {
                            currency_code: paymentData.currency || 'USD',
                            value: paymentData.amount.toString()
                        },
                        custom_id: transaction.id
                    }]
                },
                {
                    headers: {
                        'Authorization': `Bearer ${accessToken}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            return {
                status: 'pending',
                providerTransactionId: order.data.id,
                providerResponse: JSON.stringify(order.data),
                approvalUrl: order.data.links.find(link => link.rel === 'approve')?.href
            };

        } catch (error) {
            return {
                status: 'failed',
                error: error.message,
                providerResponse: JSON.stringify(error.response?.data)
            };
        }
    }

    /**
     * Process cryptocurrency payment
     */
    async processCryptoPayment(paymentData, transaction) {
        try {
            const cryptoProcessor = this.providers.crypto;
            const address = await cryptoProcessor.generateAddress(
                paymentData.cryptocurrency,
                transaction.id
            );

            return {
                status: 'pending',
                cryptoAddress: address,
                amount: paymentData.cryptoAmount,
                cryptocurrency: paymentData.cryptocurrency,
                expiresAt: new Date(Date.now() + 30 * 60 * 1000) // 30 minutes
            };

        } catch (error) {
            return {
                status: 'failed',
                error: error.message
            };
        }
    }

    /**
     * Process Coinbase Commerce payment
     */
    async processCoinbasePayment(paymentData, transaction) {
        try {
            const charge = await axios.post(
                'https://api.commerce.coinbase.com/charges',
                {
                    name: `VPN Subscription - ${paymentData.planName}`,
                    description: `Payment for VPN subscription`,
                    local_price: {
                        amount: paymentData.amount.toString(),
                        currency: paymentData.currency || 'USD'
                    },
                    pricing_type: 'fixed_price',
                    metadata: {
                        transaction_id: transaction.id,
                        user_id: paymentData.userId
                    }
                },
                {
                    headers: {
                        'X-CC-Api-Key': this.providers.coinbase.apiKey,
                        'Content-Type': 'application/json'
                    }
                }
            );

            return {
                status: 'pending',
                providerTransactionId: charge.data.data.id,
                providerResponse: JSON.stringify(charge.data),
                hostedUrl: charge.data.data.hosted_url
            };

        } catch (error) {
            return {
                status: 'failed',
                error: error.message,
                providerResponse: JSON.stringify(error.response?.data)
            };
        }
    }

    /**
     * Handle webhook from payment providers
     */
    async handleWebhook(provider, payload, signature) {
        try {
            // Verify webhook signature
            if (!this.verifyWebhookSignature(provider, payload, signature)) {
                throw new Error('Invalid webhook signature');
            }

            switch (provider) {
                case 'stripe':
                    return await this.handleStripeWebhook(payload);
                case 'paypal':
                    return await this.handlePayPalWebhook(payload);
                case 'coinbase':
                    return await this.handleCoinbaseWebhook(payload);
                default:
                    throw new Error('Unsupported webhook provider');
            }

        } catch (error) {
            console.error('Webhook handling error:', error);
            throw error;
        }
    }

    /**
     * Handle Stripe webhook
     */
    async handleStripeWebhook(payload) {
        const event = JSON.parse(payload);
        
        switch (event.type) {
            case 'payment_intent.succeeded':
                await this.updateTransactionFromWebhook(
                    event.data.object.metadata.transactionId,
                    'completed',
                    event.data.object
                );
                break;
                
            case 'payment_intent.payment_failed':
                await this.updateTransactionFromWebhook(
                    event.data.object.metadata.transactionId,
                    'failed',
                    event.data.object
                );
                break;
        }

        return { success: true };
    }

    /**
     * Update transaction from webhook
     */
    async updateTransactionFromWebhook(transactionId, status, providerData) {
        await db.run(
            `UPDATE payment_transactions 
             SET status = ?, provider_response = ?, updated_at = CURRENT_TIMESTAMP 
             WHERE id = ?`,
            [status, JSON.stringify(providerData), transactionId]
        );

        if (status === 'completed') {
            const transaction = await db.get(
                'SELECT * FROM payment_transactions WHERE id = ?',
                [transactionId]
            );
            
            if (transaction) {
                await this.activateSubscription(transaction);
            }
        }
    }

    /**
     * Verify webhook signature
     */
    verifyWebhookSignature(provider, payload, signature) {
        const secret = this.webhookSecrets[provider];
        if (!secret) return false;

        const expectedSignature = crypto
            .createHmac('sha256', secret)
            .update(payload)
            .digest('hex');

        return crypto.timingSafeEqual(
            Buffer.from(signature),
            Buffer.from(expectedSignature)
        );
    }

    /**
     * Fraud detection
     */
    async detectFraud(paymentData) {
        let score = 0;

        // Check for rapid successive payments
        const recentPayments = await db.get(
            `SELECT COUNT(*) as count FROM payment_transactions 
             WHERE user_id = ? AND created_at > datetime('now', '-5 minutes')`,
            [paymentData.userId]
        );
        
        if (recentPayments.count > 3) score += 0.4;

        // Check for unusual amount
        const avgAmount = await db.get(
            `SELECT AVG(amount) as avg FROM payment_transactions 
             WHERE user_id = ? AND status = 'completed'`,
            [paymentData.userId]
        );
        
        if (avgAmount.avg && paymentData.amount > avgAmount.avg * 5) {
            score += 0.3;
        }

        // Check IP reputation (simplified)
        if (paymentData.ipAddress) {
            const suspiciousIPs = await db.get(
                `SELECT COUNT(*) as count FROM security_events 
                 WHERE ip_address = ? AND severity IN ('high', 'critical')`,
                [paymentData.ipAddress]
            );
            
            if (suspiciousIPs.count > 0) score += 0.5;
        }

        return score;
    }

    /**
     * Create transaction record
     */
    async createTransaction(paymentData) {
        const transactionId = this.generateTransactionId();
        
        const result = await db.run(
            `INSERT INTO payment_transactions 
             (user_id, subscription_id, transaction_id, amount, currency, 
              payment_method, payment_provider, status) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                paymentData.userId,
                paymentData.subscriptionId,
                transactionId,
                paymentData.amount,
                paymentData.currency || 'USD',
                paymentData.method,
                paymentData.method,
                'pending'
            ]
        );

        return {
            id: result.id,
            transactionId: transactionId
        };
    }

    /**
     * Update transaction
     */
    async updateTransaction(id, updateData) {
        await db.run(
            `UPDATE payment_transactions 
             SET status = ?, provider_response = ?, updated_at = CURRENT_TIMESTAMP 
             WHERE id = ?`,
            [updateData.status, updateData.providerResponse || null, id]
        );
    }

    /**
     * Handle successful payment
     */
    async handleSuccessfulPayment(transaction, paymentData) {
        // Activate or extend subscription
        await this.activateSubscription(transaction);
        
        // Send confirmation email
        this.emit('payment_success', {
            userId: paymentData.userId,
            transactionId: transaction.id,
            amount: paymentData.amount
        });
    }

    /**
     * Activate subscription
     */
    async activateSubscription(transaction) {
        const plan = await db.get(
            'SELECT * FROM subscription_plans WHERE id = ?',
            [transaction.plan_id]
        );

        if (!plan) return;

        const endDate = new Date();
        endDate.setDate(endDate.getDate() + plan.duration_days);

        await db.run(
            `INSERT OR REPLACE INTO user_subscriptions 
             (user_id, plan_id, start_date, end_date, status) 
             VALUES (?, ?, CURRENT_TIMESTAMP, ?, 'active')`,
            [transaction.user_id, plan.id, endDate.toISOString()]
        );
    }

    /**
     * Get PayPal access token
     */
    async getPayPalAccessToken() {
        const auth = Buffer.from(
            `${this.providers.paypal.clientId}:${this.providers.paypal.clientSecret}`
        ).toString('base64');

        const response = await axios.post(
            `https://api.${this.providers.paypal.environment}.paypal.com/v1/oauth2/token`,
            'grant_type=client_credentials',
            {
                headers: {
                    'Authorization': `Basic ${auth}`,
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            }
        );

        return response.data.access_token;
    }

    /**
     * Generate unique transaction ID
     */
    generateTransactionId() {
        return 'TXN_' + Date.now() + '_' + crypto.randomBytes(8).toString('hex').toUpperCase();
    }

    /**
     * Validate payment data
     */
    validatePaymentData(paymentData) {
        const required = ['userId', 'amount', 'method'];
        for (const field of required) {
            if (!paymentData[field]) {
                throw new Error(`Missing required field: ${field}`);
            }
        }

        if (paymentData.amount <= 0) {
            throw new Error('Amount must be greater than 0');
        }
    }

    /**
     * Start processing queue
     */
    startQueueProcessor() {
        setInterval(async () => {
            if (this.processingQueue.length > 0 && !this.isProcessing) {
                this.isProcessing = true;
                const payment = this.processingQueue.shift();
                
                try {
                    await this.processPayment(payment);
                } catch (error) {
                    console.error('Queue processing error:', error);
                } finally {
                    this.isProcessing = false;
                }
            }
        }, 1000);
    }

    /**
     * Add payment to queue
     */
    queuePayment(paymentData) {
        this.processingQueue.push(paymentData);
        return { queued: true, position: this.processingQueue.length };
    }

    /**
     * Get transaction status
     */
    async getTransactionStatus(transactionId) {
        return await db.get(
            'SELECT * FROM payment_transactions WHERE transaction_id = ?',
            [transactionId]
        );
    }

    /**
     * Process refund
     */
    async processRefund(transactionId, amount = null) {
        const transaction = await db.get(
            'SELECT * FROM payment_transactions WHERE transaction_id = ?',
            [transactionId]
        );

        if (!transaction) {
            throw new Error('Transaction not found');
        }

        if (transaction.status !== 'completed') {
            throw new Error('Can only refund completed transactions');
        }

        const refundAmount = amount || transaction.amount;
        
        try {
            let refundResult;
            
            switch (transaction.payment_provider) {
                case 'stripe':
                    refundResult = await this.providers.stripe.refunds.create({
                        payment_intent: JSON.parse(transaction.provider_response).id,
                        amount: Math.round(refundAmount * 100)
                    });
                    break;
                    
                default:
                    throw new Error('Refund not supported for this payment provider');
            }

            // Update transaction
            await db.run(
                `UPDATE payment_transactions 
                 SET status = 'refunded', updated_at = CURRENT_TIMESTAMP 
                 WHERE id = ?`,
                [transaction.id]
            );

            // Deactivate subscription if full refund
            if (refundAmount >= transaction.amount) {
                await db.run(
                    `UPDATE user_subscriptions 
                     SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP 
                     WHERE user_id = ? AND plan_id = ?`,
                    [transaction.user_id, transaction.subscription_id]
                );
            }

            return { success: true, refundResult };

        } catch (error) {
            console.error('Refund processing error:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Get payment statistics
     */
    async getPaymentStats(timeframe = '30 days') {
        const stats = await db.all(`
            SELECT 
                payment_provider,
                status,
                COUNT(*) as count,
                SUM(amount) as total_amount,
                AVG(amount) as avg_amount
            FROM payment_transactions 
            WHERE created_at > datetime('now', '-${timeframe}')
            GROUP BY payment_provider, status
        `);

        return stats;
    }
}

/**
 * Cryptocurrency Payment Processor
 */
class CryptoPaymentProcessor {
    constructor() {
        this.supportedCurrencies = ['BTC', 'ETH', 'LTC', 'BCH'];
        this.addresses = new Map();
        this.priceCache = new Map();
        this.priceUpdateInterval = 5 * 60 * 1000; // 5 minutes
        
        this.startPriceUpdater();
    }

    /**
     * Generate payment address
     */
    async generateAddress(currency, transactionId) {
        if (!this.supportedCurrencies.includes(currency)) {
            throw new Error('Unsupported cryptocurrency');
        }

        // In a real implementation, this would generate actual wallet addresses
        // For demo purposes, we'll use deterministic addresses
        const address = this.generateDeterministicAddress(currency, transactionId);
        
        this.addresses.set(address, {
            currency,
            transactionId,
            createdAt: Date.now()
        });

        return address;
    }

    /**
     * Generate deterministic address (demo)
     */
    generateDeterministicAddress(currency, transactionId) {
        const hash = crypto.createHash('sha256')
            .update(currency + transactionId)
            .digest('hex');
            
        const prefixes = {
            BTC: '1',
            ETH: '0x',
            LTC: 'L',
            BCH: 'q'
        };

        return prefixes[currency] + hash.substring(0, 32);
    }

    /**
     * Get current crypto prices
     */
    async updatePrices() {
        try {
            const response = await axios.get(
                'https://api.coingecko.com/api/v3/simple/price',
                {
                    params: {
                        ids: 'bitcoin,ethereum,litecoin,bitcoin-cash',
                        vs_currencies: 'usd'
                    }
                }
            );

            this.priceCache.set('BTC', response.data.bitcoin.usd);
            this.priceCache.set('ETH', response.data.ethereum.usd);
            this.priceCache.set('LTC', response.data.litecoin.usd);
            this.priceCache.set('BCH', response.data['bitcoin-cash'].usd);

        } catch (error) {
            console.error('Failed to update crypto prices:', error);
        }
    }

    /**
     * Convert USD to cryptocurrency amount
     */
    convertToCrypto(usdAmount, currency) {
        const price = this.priceCache.get(currency);
        if (!price) throw new Error('Price not available');
        
        return usdAmount / price;
    }

    /**
     * Start price updater
     */
    startPriceUpdater() {
        this.updatePrices(); // Initial update
        setInterval(() => {
            this.updatePrices();
        }, this.priceUpdateInterval);
    }

    /**
     * Check payment status (demo)
     */
    async checkPaymentStatus(address) {
        const addressInfo = this.addresses.get(address);
        if (!addressInfo) {
            throw new Error('Address not found');
        }

        // In a real implementation, this would check blockchain
        // For demo, we'll simulate random payment confirmations
        const isConfirmed = Math.random() > 0.7;
        
        return {
            confirmed: isConfirmed,
            confirmations: isConfirmed ? Math.floor(Math.random() * 6) + 1 : 0,
            amount: isConfirmed ? Math.random() * 0.1 : 0
        };
    }
}

module.exports = PaymentProcessor;
