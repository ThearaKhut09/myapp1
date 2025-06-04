const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const validator = require('validator');
const crypto = require('crypto');
const dbManager = require('../database/manager_hybrid');

const router = express.Router();

// In-memory storage for tokens (can be moved to database in production)
const refreshTokens = new Set();
const emailVerificationTokens = new Map();

// Rate limiting for auth endpoints
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // limit each IP to 5 requests per windowMs for auth
    message: 'Too many authentication attempts, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
});

// JWT secret (use environment variable in production)
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';
const REFRESH_SECRET = process.env.REFRESH_SECRET || 'your-super-secret-refresh-key-change-in-production';

// Middleware to verify JWT token
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Access token required' });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Invalid or expired token' });
        }
        req.user = user;
        next();
    });
};

// Input validation helper
const validateInput = (data) => {
    const errors = [];

    if (!data.email || !validator.isEmail(data.email)) {
        errors.push('Valid email is required');
    }

    if (!data.password || data.password.length < 6) {
        errors.push('Password must be at least 6 characters long');
    }

    if (data.username && (data.username.length < 3 || data.username.length > 20)) {
        errors.push('Username must be between 3 and 20 characters');
    }

    return errors;
};

// Generate tokens
const generateTokens = (userId, email, role) => {
    const accessToken = jwt.sign(
        { userId, email, role },
        JWT_SECRET,
        { expiresIn: '15m' }
    );

    const refreshToken = jwt.sign(
        { userId, email, role },
        REFRESH_SECRET,
        { expiresIn: '7d' }
    );

    return { accessToken, refreshToken };
};

// User Registration
router.post('/register', authLimiter, async (req, res) => {
    try {
        const { username, email, password, confirmPassword } = req.body;

        // Validate input
        const validationErrors = validateInput({ username, email, password });
        
        if (validationErrors.length > 0) {
            return res.status(400).json({ 
                error: 'Validation failed',
                details: validationErrors
            });
        }

        if (password !== confirmPassword) {
            return res.status(400).json({ error: 'Passwords do not match' });
        }

        // Check if user already exists in database
        const existingUserByEmail = await dbManager.get(
            'SELECT id FROM users WHERE email = ?', 
            [email.toLowerCase().trim()]
        );
        
        const existingUserByUsername = await dbManager.get(
            'SELECT id FROM users WHERE username = ?', 
            [username.trim()]
        );

        if (existingUserByEmail) {
            return res.status(409).json({ 
                error: 'User already exists',
                details: 'Email already registered'
            });
        }

        if (existingUserByUsername) {
            return res.status(409).json({ 
                error: 'User already exists',
                details: 'Username already taken'
            });
        }

        // Hash password with salt
        const salt = crypto.randomBytes(16).toString('hex');
        const saltedPassword = password + salt;
        const hashedPassword = await bcrypt.hash(saltedPassword, 12);

        // Generate verification token
        const verificationToken = crypto.randomBytes(32).toString('hex');

        // Create user in database
        const result = await dbManager.run(
            `INSERT INTO users 
             (username, email, password_hash, salt, status, created_at, updated_at) 
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
                username.trim(),
                email.toLowerCase().trim(),
                hashedPassword,
                salt,
                'active',
                new Date().toISOString(),
                new Date().toISOString()
            ]
        );

        // Store verification token
        emailVerificationTokens.set(verificationToken, { 
            userId: result.id, 
            expiresAt: Date.now() + 24 * 60 * 60 * 1000 
        });

        // TODO: Send verification email
        console.log(`Verification token for ${email}: ${verificationToken}`);

        res.status(201).json({
            message: 'User registered successfully',
            data: {
                userId: result.id,
                username: username.trim(),
                email: email.toLowerCase().trim(),
                isVerified: false
            }
        });

    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ error: 'Internal server error during registration' });
    }
});

// User Login
router.post('/login', authLimiter, async (req, res) => {
    try {
        const { email, password } = req.body;

        // Validate input
        const validationErrors = validateInput({ email, password });
        
        if (validationErrors.length > 0) {
            return res.status(400).json({ 
                error: 'Validation failed',
                details: validationErrors
            });
        }

        // Find user by email in database
        const user = await dbManager.get(
            'SELECT * FROM users WHERE email = ?', 
            [email.toLowerCase().trim()]
        );

        if (!user) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Verify password using salt and password_hash
        const saltedPassword = password + user.salt;
        const isValidPassword = await bcrypt.compare(saltedPassword, user.password_hash);

        if (!isValidPassword) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }        // Generate tokens
        const { accessToken, refreshToken } = generateTokens(user.id, user.email, user.role);
        refreshTokens.add(refreshToken);

        // Update last login in database
        await dbManager.run(
            'UPDATE users SET last_login = ? WHERE id = ?', 
            [new Date().toISOString(), user.id]
        );

        res.json({
            message: 'Login successful',
            data: {
                user: {
                    id: user.id,
                    username: user.username,
                    email: user.email,
                    role: user.role,
                    status: user.status
                },
                accessToken,
                refreshToken
            }
        });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Internal server error during login' });
    }
});

// Refresh Token
router.post('/refresh', (req, res) => {
    try {
        const { refreshToken } = req.body;

        if (!refreshToken) {
            return res.status(401).json({ error: 'Refresh token required' });
        }

        if (!refreshTokens.has(refreshToken)) {
            return res.status(403).json({ error: 'Invalid refresh token' });
        }        jwt.verify(refreshToken, REFRESH_SECRET, async (err, decoded) => {
            if (err) {
                refreshTokens.delete(refreshToken);
                return res.status(403).json({ error: 'Invalid or expired refresh token' });
            }

            // Get user's current role from database
            const user = await dbManager.get(
                'SELECT role FROM users WHERE id = ?', 
                [decoded.userId]
            );

            if (!user) {
                refreshTokens.delete(refreshToken);
                return res.status(403).json({ error: 'User not found' });
            }

            const { accessToken, refreshToken: newRefreshToken } = generateTokens(decoded.userId, decoded.email, user.role);
            
            // Replace old refresh token
            refreshTokens.delete(refreshToken);
            refreshTokens.add(newRefreshToken);

            res.json({
                accessToken,
                refreshToken: newRefreshToken
            });
        });

    } catch (error) {
        console.error('Token refresh error:', error);
        res.status(500).json({ error: 'Internal server error during token refresh' });
    }
});

// Logout
router.post('/logout', (req, res) => {
    try {
        const { refreshToken } = req.body;

        if (refreshToken) {
            refreshTokens.delete(refreshToken);
        }

        res.json({ message: 'Logged out successfully' });

    } catch (error) {
        console.error('Logout error:', error);
        res.status(500).json({ error: 'Internal server error during logout' });
    }
});

// Get User Profile
router.get('/profile', authenticateToken, (req, res) => {
    try {
        const user = users.get(req.user.userId);

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        const { password, ...userProfile } = user;

        res.json({
            data: userProfile
        });

    } catch (error) {
        console.error('Profile fetch error:', error);
        res.status(500).json({ error: 'Internal server error while fetching profile' });
    }
});

module.exports = router;
module.exports.authenticateToken = authenticateToken;