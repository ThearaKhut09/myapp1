const axios = require('axios');

async function testAdminLogin() {
    try {
        console.log('Testing admin login...');
        
        const response = await axios.post('http://localhost:3000/api/auth/login', {
            email: 'admin@vpn.com',
            password: 'admin123'
        });
        
        console.log('✅ Admin login successful!');
        console.log('Response:', response.data);
        
        // Test accessing admin dashboard
        const token = response.data.token;
        const dashboardResponse = await axios.get('http://localhost:3000/api/admin/dashboard', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        console.log('✅ Admin dashboard access successful!');
        console.log('Dashboard data:', dashboardResponse.data);
        
    } catch (error) {
        console.error('❌ Test failed:', error.response?.data || error.message);
    }
}

testAdminLogin();
