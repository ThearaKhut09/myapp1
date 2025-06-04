@echo off
title VPN Platform - Quick Start
color 0A

echo.
echo  ██╗   ██╗██████╗ ███╗   ██╗    ██████╗ ██╗      █████╗ ████████╗███████╗ ██████╗ ██████╗ ███╗   ███╗
echo  ██║   ██║██╔══██╗████╗  ██║    ██╔══██╗██║     ██╔══██╗╚══██╔══╝██╔════╝██╔═══██╗██╔══██╗████╗ ████║
echo  ██║   ██║██████╔╝██╔██╗ ██║    ██████╔╝██║     ███████║   ██║   █████╗  ██║   ██║██████╔╝██╔████╔██║
echo  ╚██╗ ██╔╝██╔═══╝ ██║╚██╗██║    ██╔═══╝ ██║     ██╔══██║   ██║   ██╔══╝  ██║   ██║██╔══██╗██║╚██╔╝██║
echo   ╚████╔╝ ██║     ██║ ╚████║    ██║     ███████╗██║  ██║   ██║   ██║     ╚██████╔╝██║  ██║██║ ╚═╝ ██║
echo    ╚═══╝  ╚═╝     ╚═╝  ╚═══╝    ╚═╝     ╚══════╝╚═╝  ╚═╝   ╚═╝   ╚═╝      ╚═════╝ ╚═╝  ╚═╝╚═╝     ╚═╝
echo.
echo                                    🚀 QUICK START LAUNCHER 🚀
echo                                  ================================
echo.

:menu
echo  What would you like to do?
echo.
echo    [1] 🛠️  First Time Setup      (Install dependencies, create database)
echo    [2] 🚀 Start Server          (Launch VPN platform on port 3001)
echo    [3] 🧪 Run Tests             (Test database and authentication)
echo    [4] 🔍 Developer Tools       (Advanced options menu)
echo    [5] 🌐 Open in Browser       (Launch admin dashboard)
echo    [6] 🖥️  Create Desktop Shortcut (Easy desktop access)
echo    [7] 📖 View Documentation    (Open help guide)
echo    [8] ❌ Exit
echo.
set /p choice="  Enter your choice (1-8): "

if "%choice%"=="1" goto setup
if "%choice%"=="2" goto start
if "%choice%"=="3" goto test
if "%choice%"=="4" goto tools
if "%choice%"=="5" goto browser
if "%choice%"=="6" goto shortcut
if "%choice%"=="7" goto docs
if "%choice%"=="8" goto exit

echo  ❌ Invalid choice. Please enter 1-8.
timeout /t 2 /nobreak >nul
goto menu

:setup
echo.
echo  🛠️  Running First Time Setup...
call SETUP.bat
goto menu

:start
echo.
echo  🚀 Starting VPN Platform Server...
call START.bat
goto menu

:test
echo.
echo  🧪 Running Test Suite...
call TEST.bat
goto menu

:tools
echo.
echo  🔍 Opening Developer Tools...
call TOOLS.bat
goto menu

:browser
echo.
echo  🌐 Opening browser...
start http://localhost:3001/admin
echo  ✅ Admin dashboard should open in your browser
echo  📧 Login: admin@admin.com
echo  🔑 Password: admin
timeout /t 3 /nobreak >nul
goto menu

:shortcut
echo.
echo  🖥️  Creating Desktop Shortcut...
call CREATE_SHORTCUT.bat
goto menu

:docs
echo.
echo  📖 Opening documentation...
start EASY_RUN_GUIDE.md
timeout /t 2 /nobreak >nul
goto menu

:exit
echo.
echo  👋 Thanks for using VPN Platform!
echo  🌟 Have a great day!
timeout /t 2 /nobreak >nul
exit

pause
