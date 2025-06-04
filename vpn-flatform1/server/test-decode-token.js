// Decode JWT token to check its payload
const jwt = require('jsonwebtoken');
const axios = require('axios');

async function decodeToken() {
    try {
        // Get a fresh token
        const loginResponse = await axios.post('http://localhost:3001/api/login', {
            email: 'admin@vpn.com',
            password: 'admin123'
        });
        
        const token = loginResponse.data.data.accessToken;
        console.log('🔍 Token received from login:', token.substring(0, 50) + '...');
        
        // Decode without verification to see payload
        const decoded = jwt.decode(token);
        console.log('📋 Token payload:', JSON.stringify(decoded, null, 2));
        
        // Check if role is included
        if (decoded.role) {
            console.log('✅ Role found in token:', decoded.role);
        } else {
            console.log('❌ Role NOT found in token');
        }
        
    } catch (error) {
        console.error('💥 Error:', error.message);
    }
}

decodeToken();
