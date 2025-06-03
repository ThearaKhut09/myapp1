const express = require('express');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const { getDatabase } = require('../database/connection');

const router = express.Router();

// Rate limiting for payment endpoints
const paymentLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // limit each IP to 10 requests per windowMs
    message: 'Too many payment requests, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
});

// USDT Payment Configuration (NowPayments or similar)
const PAYMENT_CONFIG = {
    apiKey: process.env.NOWPAYMENTS_API_KEY || 'your-api-key',
    callbackSecret: process.env.PAYMENT_CALLBACK_SECRET || 'your-callback-secret',
    currency: 'USDT',
    network: 'TRC20', // TRON network for lower fees
    minimumAmount: 1
};

// Plan configurations
const PLANS = {
    basic: {
        name: 'Basic Plan',
        price: 5,
        currency: 'USD',
        features: ['1 Device', '3 Servers', '10GB Bandwidth', 'XBorad & V2bx'],
        duration: 30 // days
    },
    pro: {
        name: 'Pro Plan',
        price: 10,
        currency: 'USD',
        features: ['3 Devices', '5 Servers', 'Unlimited Bandwidth', 'All Protocols'],
        duration: 30 // days
    },
    premium: {
        name: 'Premium Plan',
        price: 20,
        currency: 'USD',
        features: ['5 Devices', '8+ Servers', 'Unlimited Bandwidth', 'All Protocols + udp2raw'],
        duration: 30 // days
    }
};

// Middleware to verify JWT token (simplified version)
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Access token required' });
    }

    // In a real implementation, verify the JWT token here
    // For now, we'll mock it
    req.user = { userId: 'mock-user-id', email: 'mock@example.com' };
    next();
};

// Get available plans
router.get('/plans', async (req, res) => {
    try {
        const db = await getDatabase();
        const plans = await db.all('SELECT * FROM subscription_plans WHERE active = 1');
        
        // If no plans in database, return default plans
        if (plans.length === 0) {
            const plansWithIds = Object.entries(PLANS).map(([id, plan]) => ({
                id,
                ...plan
            }));
            return res.json({ data: plansWithIds });
        }

        const formattedPlans = plans.map(plan => ({
            id: plan.plan_key,
            name: plan.name,
            price: plan.price,
            currency: 'USD',
            features: plan.features ? plan.features.split(',') : [],
            duration: plan.duration_days || 30
        }));

        res.json({
            data: formattedPlans
        });
    } catch (error) {
        console.error('Error fetching plans:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Initialize payment
router.post('/initiate', paymentLimiter, authenticateToken, async (req, res) => {
    try {
        const { planId, email } = req.body;
        const db = await getDatabase();

        // Check if plan exists in database first
        let plan = await db.get('SELECT * FROM subscription_plans WHERE plan_key = ? AND active = 1', [planId]);
        
        // Fallback to hardcoded plans if not in database
        if (!plan && PLANS[planId]) {
            plan = {
                name: PLANS[planId].name,
                price: PLANS[planId].price,
                duration_days: PLANS[planId].duration
            };
        }

        if (!plan) {
            return res.status(400).json({ error: 'Invalid plan selected' });
        }

        const paymentId = crypto.randomUUID();
        const orderHash = crypto.randomBytes(16).toString('hex');

        // Create payment record in database
        await db.run(`
            INSERT INTO payments (
                id, user_id, plan_id, amount, currency, status, 
                order_hash, payment_method, network, expires_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            paymentId,
            req.user.userId,
            planId,
            plan.price,
            'USD',
            'pending',
            orderHash,
            'USDT',
            PAYMENT_CONFIG.network,
            new Date(Date.now() + 30 * 60 * 1000).toISOString()
        ]);

        // Mock USDT payment details
        const mockPaymentDetails = {
            paymentId,
            amount: plan.price,
            currency: 'USDT',
            network: 'TRC20',
            address: 'TMockUSDTAddressForTestingPurposes123456789',
            qrCode: `usdt:TMockUSDTAddressForTestingPurposes123456789?amount=${plan.price}`,
            expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
            orderHash
        };

        res.json({
            message: 'Payment initiated successfully',
            data: mockPaymentDetails
        });

    } catch (error) {
        console.error('Payment initiation error:', error);
        res.status(500).json({ error: 'Internal server error during payment initiation' });
    }
});

// Check payment status
router.get('/status/:paymentId', authenticateToken, async (req, res) => {
    try {
        const { paymentId } = req.params;
        const db = await getDatabase();
        
        const payment = await db.get('SELECT * FROM payments WHERE id = ?', [paymentId]);

        if (!payment) {
            return res.status(404).json({ error: 'Payment not found' });
        }

        if (payment.user_id !== req.user.userId) {
            return res.status(403).json({ error: 'Access denied' });
        }

        // Check if payment expired
        if (new Date() > new Date(payment.expires_at) && payment.status === 'pending') {
            await db.run('UPDATE payments SET status = ?, updated_at = ? WHERE id = ?', 
                ['expired', new Date().toISOString(), paymentId]);
            payment.status = 'expired';
        }

        res.json({
            data: {
                id: payment.id,
                status: payment.status,
                amount: payment.amount,
                currency: payment.currency,
                plan: payment.plan_id,
                createdAt: payment.created_at,
                expiresAt: payment.expires_at,
                confirmedAt: payment.confirmed_at
            }
        });

    } catch (error) {
        console.error('Payment status check error:', error);
        res.status(500).json({ error: 'Internal server error while checking payment status' });
    }
});

// Webhook for payment confirmation (from NowPayments or similar)
router.post('/webhook', async (req, res) => {
    try {
        const { payment_id, payment_status, order_id, price_amount, price_currency } = req.body;
        const db = await getDatabase();

        // Verify webhook signature
        const signature = req.headers['x-nowpayments-sig'];
        const payload = JSON.stringify(req.body);
        const expectedSignature = crypto
            .createHmac('sha512', PAYMENT_CONFIG.callbackSecret)
            .update(payload)
            .digest('hex');

        if (signature !== expectedSignature) {
            console.log('Invalid webhook signature');
            return res.status(400).json({ error: 'Invalid signature' });
        }

        // Find payment by order hash
        const payment = await db.get('SELECT * FROM payments WHERE order_hash = ?', [order_id]);

        if (!payment) {
            console.log('Payment not found for order:', order_id);
            return res.status(404).json({ error: 'Payment not found' });
        }

        // Update payment status
        await db.run('UPDATE payments SET status = ?, updated_at = ? WHERE id = ?', 
            [payment_status, new Date().toISOString(), payment.id]);

        if (payment_status === 'finished') {
            await db.run('UPDATE payments SET confirmed_at = ? WHERE id = ?', 
                [new Date().toISOString(), payment.id]);
            
            // Activate subscription
            await activateSubscription(payment.user_id, payment.plan_id);
        }

        console.log(`Payment ${payment.id} status updated to: ${payment_status}`);
        res.status(200).json({ message: 'Webhook processed successfully' });

    } catch (error) {
        console.error('Webhook processing error:', error);
        res.status(500).json({ error: 'Internal server error processing webhook' });
    }
});

// Manual payment confirmation (for testing)
router.post('/confirm/:paymentId', authenticateToken, async (req, res) => {
    try {
        const { paymentId } = req.params;
        const db = await getDatabase();
        
        const payment = await db.get('SELECT * FROM payments WHERE id = ?', [paymentId]);

        if (!payment) {
            return res.status(404).json({ error: 'Payment not found' });
        }

        if (payment.user_id !== req.user.userId) {
            return res.status(403).json({ error: 'Access denied' });
        }

        if (payment.status !== 'pending') {
            return res.status(400).json({ error: 'Payment cannot be confirmed' });
        }

        // Update payment status
        const now = new Date().toISOString();
        await db.run(`
            UPDATE payments 
            SET status = 'finished', confirmed_at = ?, updated_at = ? 
            WHERE id = ?
        `, ['finished', now, now, payment.id]);

        // Activate subscription
        await activateSubscription(payment.user_id, payment.plan_id);

        res.json({
            message: 'Payment confirmed successfully',
            data: {
                paymentId: payment.id,
                status: 'finished',
                confirmedAt: now
            }
        });

    } catch (error) {
        console.error('Payment confirmation error:', error);
        res.status(500).json({ error: 'Internal server error during payment confirmation' });
    }
});

// Get user's payment history
router.get('/history', authenticateToken, async (req, res) => {
    try {
        const db = await getDatabase();
        const userPayments = await db.all(`
            SELECT p.*, sp.name as plan_name 
            FROM payments p 
            LEFT JOIN subscription_plans sp ON p.plan_id = sp.plan_key 
            WHERE p.user_id = ? 
            ORDER BY p.created_at DESC
        `, [req.user.userId]);

        const formattedPayments = userPayments.map(payment => ({
            id: payment.id,
            plan: payment.plan_name || payment.plan_id,
            amount: payment.amount,
            currency: payment.currency,
            status: payment.status,
            createdAt: payment.created_at,
            confirmedAt: payment.confirmed_at
        }));

        res.json({
            data: formattedPayments
        });

    } catch (error) {
        console.error('Payment history error:', error);
        res.status(500).json({ error: 'Internal server error while fetching payment history' });
    }
});

// Get user's current subscription
router.get('/subscription', authenticateToken, async (req, res) => {
    try {
        const db = await getDatabase();
        const subscription = await db.get(`
            SELECT s.*, sp.name as plan_name, sp.features 
            FROM user_subscriptions s 
            LEFT JOIN subscription_plans sp ON s.plan_id = sp.plan_key 
            WHERE s.user_id = ? AND s.status = 'active' 
            ORDER BY s.created_at DESC LIMIT 1
        `, [req.user.userId]);

        if (!subscription) {
            return res.json({
                data: {
                    planId: 'free',
                    planName: 'Free Plan',
                    status: 'active',
                    expiresAt: null,
                    features: ['Limited access']
                }
            });
        }

        res.json({
            data: {
                planId: subscription.plan_id,
                planName: subscription.plan_name,
                status: subscription.status,
                activatedAt: subscription.activated_at,
                expiresAt: subscription.expires_at,
                features: subscription.features ? subscription.features.split(',') : [],
                autoRenew: subscription.auto_renew || false
            }
        });

    } catch (error) {
        console.error('Subscription fetch error:', error);
        res.status(500).json({ error: 'Internal server error while fetching subscription' });
    }
});

// Helper function to activate subscription
async function activateSubscription(userId, planId) {
    try {
        const db = await getDatabase();
        
        // Get plan details
        let plan = await db.get('SELECT * FROM subscription_plans WHERE plan_key = ?', [planId]);
        
        // Fallback to hardcoded plans
        if (!plan && PLANS[planId]) {
            plan = {
                name: PLANS[planId].name,
                duration_days: PLANS[planId].duration,
                features: PLANS[planId].features.join(',')
            };
        }
        
        if (!plan) return;

        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + (plan.duration_days || 30));

        // Deactivate existing subscriptions
        await db.run('UPDATE user_subscriptions SET status = ? WHERE user_id = ? AND status = ?', 
            ['expired', userId, 'active']);

        // Create new subscription
        await db.run(`
            INSERT INTO user_subscriptions (
                user_id, plan_id, status, activated_at, expires_at, auto_renew
            ) VALUES (?, ?, ?, ?, ?, ?)
        `, [
            userId,
            planId,
            'active',
            new Date().toISOString(),
            expiresAt.toISOString(),
            false
        ]);

        console.log(`Subscription activated for user ${userId}: ${plan.name}`);
    } catch (error) {
        console.error('Error activating subscription:', error);
    }
}

// Get USDT exchange rate (mock)
router.get('/exchange-rate', (req, res) => {
    try {
        // In a real implementation, fetch from a crypto API
        const mockRate = {
            USD_USDT: 1.0, // 1 USD = 1 USDT (simplified)
            updated: new Date().toISOString()
        };

        res.json({
            data: mockRate
        });

    } catch (error) {
        console.error('Exchange rate error:', error);
        res.status(500).json({ error: 'Internal server error while fetching exchange rate' });
    }
});

module.exports = router;