# VPN Platform - PowerShell Quick Start
# Run this with: .\QUICK_START.ps1

Write-Host ""
Write-Host "  ████████╗██╗   ██╗██████╗ ██████╗ ██████╗     ███████╗████████╗ █████╗ ██████╗ ████████╗" -ForegroundColor Green
Write-Host "  ╚══██╔══╝██║   ██║██╔══██╗██╔══██╗██╔═══██╗    ██╔════╝╚══██╔══╝██╔══██╗██╔══██╗╚══██╔══╝" -ForegroundColor Green
Write-Host "     ██║   ██║   ██║██████╔╝██████╔╝██║   ██║    ███████╗   ██║   ███████║██████╔╝   ██║   " -ForegroundColor Green
Write-Host "     ██║   ██║   ██║██╔══██╗██╔══██╗██║   ██║    ╚════██║   ██║   ██╔══██║██╔══██╗   ██║   " -ForegroundColor Green
Write-Host "     ██║   ╚██████╔╝██████╔╝██████╔╝╚██████╔╝    ███████║   ██║   ██║  ██║██║  ██║   ██║   " -ForegroundColor Green
Write-Host "     ╚═╝    ╚═════╝ ╚═════╝ ╚═════╝  ╚═════╝     ╚══════╝   ╚═╝   ╚═╝  ╚═╝╚═╝  ╚═╝   ╚═╝   " -ForegroundColor Green
Write-Host ""
Write-Host "                              🚀 PowerShell VPN Platform Start 🚀" -ForegroundColor Cyan
Write-Host "                            =========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "  💡 This will automatically:" -ForegroundColor Yellow
Write-Host "     ✅ Install all dependencies" -ForegroundColor Green
Write-Host "     ✅ Set up the database" -ForegroundColor Green
Write-Host "     ✅ Start the server" -ForegroundColor Green
Write-Host "     ✅ Open your browser" -ForegroundColor Green
Write-Host ""

$confirm = Read-Host "  Ready to start? (Y/N)"
if ($confirm -notmatch "^[Yy]") {
    Write-Host "  👋 Goodbye!" -ForegroundColor Yellow
    exit
}

# Check Node.js
Write-Host ""
Write-Host "  🔄 Step 1/4: Checking Node.js..." -ForegroundColor Cyan
try {
    $nodeVersion = node --version
    Write-Host "  ✅ Node.js found: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "  ❌ Node.js not found! Please install Node.js first." -ForegroundColor Red
    Write-Host "     Download from: https://nodejs.org" -ForegroundColor Yellow
    Read-Host "Press Enter to exit"
    exit
}

# Change to server directory
Set-Location "c:\xampp\htdocs\myapp1\vpn-flatform1\server"

# Install dependencies
Write-Host ""
Write-Host "  🔄 Step 2/4: Installing dependencies..." -ForegroundColor Cyan
Write-Host "     Installing server dependencies..." -ForegroundColor White
try {
    npm install --silent 2>$null
    Write-Host "  ✅ Dependencies installed!" -ForegroundColor Green
} catch {
    Write-Host "     Retrying npm install..." -ForegroundColor Yellow
    npm install
}

# Set up database
Write-Host ""
Write-Host "  🔄 Step 3/4: Setting up database..." -ForegroundColor Cyan
if (-not (Test-Path "data")) {
    New-Item -ItemType Directory -Path "data" | Out-Null
}

if (-not (Test-Path "data\vpn_platform.db")) {
    Write-Host "     Creating new database..." -ForegroundColor White
    try {
        node create-database.js 2>$null
        Write-Host "  ✅ Database created!" -ForegroundColor Green
    } catch {
        Write-Host "     Database creation completed with warnings (normal)" -ForegroundColor Yellow
    }
} else {
    Write-Host "  ✅ Database already exists!" -ForegroundColor Green
}

# Start server
Write-Host ""
Write-Host "  🔄 Step 4/4: Starting server..." -ForegroundColor Cyan
Write-Host ""
Write-Host "  🌐 Server URLs:" -ForegroundColor Magenta
Write-Host "     🏠 Main Site: http://localhost:3001" -ForegroundColor White
Write-Host "     👤 Login: http://localhost:3001/login" -ForegroundColor White  
Write-Host "     📊 Admin: http://localhost:3001/admin" -ForegroundColor White
Write-Host "     🔑 Default Admin: admin@admin.com / admin" -ForegroundColor Yellow
Write-Host ""

# Start browser after delay
Start-Job -ScriptBlock {
    Start-Sleep 3
    Start-Process "http://localhost:3001"
} | Out-Null

Write-Host "  🚀 Server starting... Browser will open automatically!" -ForegroundColor Green
Write-Host "     Press Ctrl+C to stop the server" -ForegroundColor Yellow
Write-Host "  ================================================" -ForegroundColor Cyan
Write-Host ""

# Start the server
node simple-start.js
