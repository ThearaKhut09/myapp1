@echo off
echo 🚀 Starting VPN Platform Server...
echo ================================

cd /d "c:\xampp\htdocs\myapp1\vpn-flatform1\server"

echo 📦 Installing dependencies...
call npm install

echo 🗄️ Checking database...
if not exist "data\vpn_platform.db" (
    echo Creating database...
    node create-database.js
)

echo 🌐 Starting server on http://localhost:3001...
echo.
echo Available URLs:
echo   🏠 Main Site: http://localhost:3001
echo   👤 Login: http://localhost:3001/login
echo   📊 Admin: http://localhost:3001/admin
echo   🏥 Health: http://localhost:3001/api/health
echo.
echo Press Ctrl+C to stop the server
echo ================================

node simple-start.js

pause
