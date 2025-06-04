@echo off
echo 🧪 Running VPN Platform Tests...
echo ================================

cd /d "c:\xampp\htdocs\myapp1\vpn-flatform1\server"

echo 📊 Running Database Tests...
node test-database-full.js

echo.
echo 🔐 Testing Admin Login...
node test-admin-login.js

echo.
echo 🏥 Testing API Health...
node test-api.js

echo.
echo 🎯 Running Final Comprehensive Test...
node test-final-comprehensive.js

echo.
echo ================================
echo ✅ All tests completed!
echo Check the output above for results.

pause
