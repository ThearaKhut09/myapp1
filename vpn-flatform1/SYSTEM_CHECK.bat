@echo off
title VPN Platform - System Check & Auto Start
color 0F

echo.
echo  ███████╗██╗   ██╗███████╗████████╗███████╗███╗   ███╗     ██████╗██╗  ██╗███████╗ ██████╗██╗  ██╗
echo  ██╔════╝╚██╗ ██╔╝██╔════╝╚══██╔══╝██╔════╝████╗ ████║    ██╔════╝██║  ██║██╔════╝██╔════╝██║ ██╔╝
echo  ███████╗ ╚████╔╝ ███████╗   ██║   █████╗  ██╔████╔██║    ██║     ███████║█████╗  ██║     █████╔╝ 
echo  ╚════██║  ╚██╔╝  ╚════██║   ██║   ██╔══╝  ██║╚██╔╝██║    ██║     ██╔══██║██╔══╝  ██║     ██╔═██╗ 
echo  ███████║   ██║   ███████║   ██║   ███████╗██║ ╚═╝ ██║    ╚██████╗██║  ██║███████╗╚██████╗██║  ██╗
echo  ╚══════╝   ╚═╝   ╚══════╝   ╚═╝   ╚══════╝╚═╝     ╚═╝     ╚═════╝╚═╝  ╚═╝╚══════╝ ╚═════╝╚═╝  ╚═╝
echo.
echo                                🔍 SYSTEM CHECK & AUTO START 🔍
echo                              ===================================
echo.

echo  Running comprehensive system check...
echo.

REM Check 1: Node.js
echo  [1/5] 🟡 Checking Node.js installation...
node --version >nul 2>&1
if %errorlevel% equ 0 (
    for /f "tokens=*" %%a in ('node --version') do set nodeversion=%%a
    echo        ✅ Node.js found: !nodeversion!
    set node_ok=1
) else (
    echo        ❌ Node.js not found
    set node_ok=0
)

REM Check 2: NPM
echo  [2/5] 🟡 Checking NPM...
npm --version >nul 2>&1
if %errorlevel% equ 0 (
    for /f "tokens=*" %%a in ('npm --version') do set npmversion=%%a
    echo        ✅ NPM found: v!npmversion!
    set npm_ok=1
) else (
    echo        ❌ NPM not found
    set npm_ok=0
)

REM Check 3: Project files
echo  [3/5] 🟡 Checking project files...
if exist "server\package.json" (
    echo        ✅ Server configuration found
    set files_ok=1
) else (
    echo        ❌ Project files missing
    set files_ok=0
)

REM Check 4: Database
echo  [4/5] 🟡 Checking database...
if exist "server\data\vpn_platform.db" (
    echo        ✅ Database already exists
    set db_ok=1
) else (
    echo        🟡 Database will be created
    set db_ok=1
)

REM Check 5: Dependencies
echo  [5/5] 🟡 Checking dependencies...
if exist "server\node_modules" (
    echo        ✅ Dependencies already installed
    set deps_ok=1
) else (
    echo        🟡 Dependencies will be installed
    set deps_ok=1
)

echo.
echo  📊 SYSTEM REPORT:
echo  =================

if %node_ok%==1 if %npm_ok%==1 if %files_ok%==1 (
    echo        🟢 SYSTEM READY - All requirements met!
    echo        🚀 Your VPN Platform is ready to launch
    echo.
    
    set /p auto="  🎯 Auto-start VPN Platform now? (Y/N): "
    if /i "!auto!"=="Y" (
        echo.
        echo        🚀 Launching VPN Platform...
        call QUICK_START.bat
    ) else (
        echo.
        echo        💡 Manual launch options:
        echo           • Double-click QUICK_START.bat
        echo           • Double-click LAUNCHER.bat for menu
        echo           • Create desktop shortcut with CREATE_SHORTCUT.bat
    )
) else (
    echo        🔴 SYSTEM NOT READY - Missing requirements:
    if %node_ok%==0 echo           ❌ Install Node.js from https://nodejs.org
    if %npm_ok%==0 echo           ❌ NPM should come with Node.js
    if %files_ok%==0 echo           ❌ Project files missing or corrupted
    echo.
    echo        📋 TO FIX:
    echo           1. Install Node.js from https://nodejs.org
    echo           2. Restart this script
    echo           3. Everything else will be automatic!
)

echo.
echo  🎮 QUICK ACCESS MENU:
echo  ====================
echo        🚀 QUICK_START.bat     - One-click start (recommended)
echo        🎮 LAUNCHER.bat        - Interactive menu
echo        🔧 SETUP.bat          - Manual setup only
echo        🧪 TEST.bat           - Run system tests
echo        🖥️  CREATE_SHORTCUT.bat - Desktop shortcut

echo.
pause
