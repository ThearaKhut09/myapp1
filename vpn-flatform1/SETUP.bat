@echo off
echo 🛠️ VPN Platform Setup...
echo ========================

cd /d "c:\xampp\htdocs\myapp1\vpn-flatform1\server"

echo 📦 Installing Node.js dependencies...
call npm install

echo 🗄️ Setting up database...
node create-database.js

echo 🔧 Checking configuration...
node debug-config.js

echo.
echo ✅ Setup completed!
echo.
echo Next steps:
echo   1. Run START.bat to start the server
echo   2. Run TEST.bat to run tests
echo   3. Open http://localhost:3001 in your browser

pause
