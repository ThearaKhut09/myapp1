// Test token debugging
const axios = require('axios');

async function testTokenDebug() {
    try {
        console.log('🔧 Testing token generation and validation...');
        
        // Step 1: Login to get token
        const loginResponse = await axios.post('http://localhost:3001/api/login', {
            email: 'admin@vpn.com',
            password: 'admin123'
        });
        
        console.log('✅ Login successful');
        const token = loginResponse.data.data.accessToken;
        console.log('🔑 Token:', token.substring(0, 50) + '...');
        
        // Step 2: Test token immediately with a simple endpoint
        console.log('\n🧪 Testing token with health check...');
        try {
            const healthResponse = await axios.get('http://localhost:3001/api/health', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            console.log('✅ Health check with token: SUCCESS');
        } catch (error) {
            console.log('⚠️ Health check with token failed:', error.response?.data || error.message);
        }
        
        // Step 3: Test admin dashboard
        console.log('\n🔐 Testing admin dashboard access...');
        try {
            const dashboardResponse = await axios.get('http://localhost:3001/api/admin/dashboard', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            console.log('✅ Admin dashboard: SUCCESS');
            console.log('📊 Dashboard data:', dashboardResponse.data);
        } catch (error) {
            console.log('❌ Admin dashboard failed:', error.response?.data || error.message);
            console.log('📋 Full error details:', error.response?.status, error.response?.statusText);
        }
        
    } catch (error) {
        console.error('💥 Test failed:', error.message);
    }
}

testTokenDebug();
