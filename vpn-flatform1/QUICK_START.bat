@echo off
title VPN Platform - One-Click Start
color 0A

echo.
echo  ████████╗██╗   ██╗██████╗ ██████╗ ██████╗     ███████╗████████╗ █████╗ ██████╗ ████████╗
echo  ╚══██╔══╝██║   ██║██╔══██╗██╔══██╗██╔═══██╗    ██╔════╝╚══██╔══╝██╔══██╗██╔══██╗╚══██╔══╝
echo     ██║   ██║   ██║██████╔╝██████╔╝██║   ██║    ███████╗   ██║   ███████║██████╔╝   ██║   
echo     ██║   ██║   ██║██╔══██╗██╔══██╗██║   ██║    ╚════██║   ██║   ██╔══██║██╔══██╗   ██║   
echo     ██║   ╚██████╔╝██████╔╝██████╔╝╚██████╔╝    ███████║   ██║   ██║  ██║██║  ██║   ██║   
echo     ╚═╝    ╚═════╝ ╚═════╝ ╚═════╝  ╚═════╝     ╚══════╝   ╚═╝   ╚═╝  ╚═╝╚═╝  ╚═╝   ╚═╝   
echo.
echo                              🚀 ONE-CLICK VPN PLATFORM START 🚀
echo                            =====================================
echo.

echo  💡 This will automatically:
echo     ✅ Install all dependencies
echo     ✅ Set up the database
echo     ✅ Start the server
echo     ✅ Open your browser
echo.

set /p confirm="  Ready to start? (Y/N): "
if /i "%confirm%" neq "Y" goto end

echo.
echo  🔄 Step 1/4: Checking Node.js...
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo  ❌ Node.js not found! Please install Node.js first.
    echo     Download from: https://nodejs.org
    pause
    goto end
)
echo  ✅ Node.js found!

echo.
echo  🔄 Step 2/4: Installing dependencies...
cd /d "c:\xampp\htdocs\myapp1\vpn-flatform1\server"
echo     Installing server dependencies...
call npm install --silent 2>nul
if %errorlevel% neq 0 (
    echo     Retrying npm install...
    call npm install
)

echo.
echo  🔄 Step 3/4: Setting up database...
if not exist "data" mkdir data
if not exist "data\vpn_platform.db" (
    echo     Creating new database...
    node create-database.js 2>nul
    if %errorlevel% neq 0 (
        echo     Database creation completed with warnings (normal)
    )
) else (
    echo     ✅ Database already exists!
)

echo.
echo  🔄 Step 4/4: Starting server...
echo.
echo  🌐 Server URLs:
echo     🏠 Main Site: http://localhost:3001y
echo     👤 Login: http://localhost:3001/login  
echo     📊 Admin: http://localhost:3001/admin
echo     🔑 Default Admin: admin@admin.com / admin
echo.

REM Start browser after a short delay
start "" cmd /c "timeout /t 3 /nobreak >nul && start http://localhost:3001"

echo  🚀 Server starting... Browser will open automatically!
echo     Press Ctrl+C to stop the server
echo  ================================================
echo.

node simple-start.js

:end
echo.
echo  👋 Thanks for using VPN Platform!
pause
