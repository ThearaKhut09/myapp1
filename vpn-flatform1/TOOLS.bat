@echo off
echo 🔍 Quick Development Tools...
echo ============================

:menu
echo.
echo Choose an option:
echo   1. Start Server
echo   2. Run Tests
echo   3. Check Database
echo   4. View Admin Dashboard
echo   5. Check API Health
echo   6. View Logs
echo   7. Exit
echo.
set /p choice="Enter your choice (1-7): "

cd /d "c:\xampp\htdocs\myapp1\vpn-flatform1\server"

if "%choice%"=="1" (
    echo Starting server...
    node simple-start.js
    goto menu
)

if "%choice%"=="2" (
    echo Running tests...
    node test-database-full.js
    goto menu
)

if "%choice%"=="3" (
    echo Checking database...
    node check-db.js
    goto menu
)

if "%choice%"=="4" (
    echo Opening admin dashboard...
    start http://localhost:3001/admin
    goto menu
)

if "%choice%"=="5" (
    echo Checking API health...
    curl -s http://localhost:3001/api/health | echo.
    goto menu
)

if "%choice%"=="6" (
    echo Showing recent logs...
    if exist "logs\app-2025-06-03.log" (
        type "logs\app-2025-06-03.log" | findstr /i "error warning"
    ) else (
        echo No logs found
    )
    goto menu
)

if "%choice%"=="7" (
    echo Goodbye!
    exit
)

echo Invalid choice. Please try again.
goto menu
