@echo off
title Create Desktop Shortcut
color 0B

echo.
echo  🖥️  VPN Platform - Desktop Shortcut Creator
echo  =========================================
echo.

echo  This will create a desktop shortcut for easy access to your VPN Platform.
echo.

set /p create="  Create desktop shortcut? (Y/N): "
if /i "%create%" neq "Y" goto end

echo.
echo  🔄 Creating desktop shortcut...

set "shortcutPath=%USERPROFILE%\Desktop\VPN Platform.lnk"
set "targetPath=%~dp0QUICK_START.bat"
set "iconPath=%~dp0server\public\favicon.ico"

REM Create shortcut using PowerShell
powershell -Command "$WshShell = New-Object -comObject WScript.Shell; $Shortcut = $WshShell.CreateShortcut('%shortcutPath%'); $Shortcut.TargetPath = '%targetPath%'; $Shortcut.WorkingDirectory = '%~dp0'; $Shortcut.Description = 'VPN Platform - One Click Start'; $Shortcut.Save()"

if exist "%shortcutPath%" (
    echo  ✅ Desktop shortcut created successfully!
    echo     📍 Location: %USERPROFILE%\Desktop\VPN Platform.lnk
    echo.
    echo  🎯 You can now double-click the desktop shortcut to start VPN Platform!
) else (
    echo  ❌ Failed to create shortcut. You can manually create one by:
    echo     1. Right-click on desktop → New → Shortcut
    echo     2. Browse to: %targetPath%
    echo     3. Name it: VPN Platform
)

echo.
echo  💡 Tip: You can also pin QUICK_START.bat to your taskbar for even faster access!

:end
echo.
pause
