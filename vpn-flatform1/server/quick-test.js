// Quick API test script
const axios = require('axios');

console.log('🏥 Quick API Health Check');
console.log('========================');

async function quickTest() {
    try {
        console.log('Testing server...');
        
        // Test health endpoint
        const health = await axios.get('http://localhost:3001/api/health');
        console.log('✅ Server Health:', health.data.status);
        
        // Test main page
        const main = await axios.get('http://localhost:3001/');
        console.log('✅ Main Page:', main.status === 200 ? 'OK' : 'ERROR');
        
        console.log('\n🌐 Available URLs:');
        console.log('   Main: http://localhost:3001');
        console.log('   Login: http://localhost:3001/login');
        console.log('   Admin: http://localhost:3001/admin');
        console.log('   Health: http://localhost:3001/api/health');
        
    } catch (error) {
        console.log('❌ Server not running or error occurred');
        console.log('💡 Run START.bat to start the server first');
    }
}

quickTest();
