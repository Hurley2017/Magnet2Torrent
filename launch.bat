@echo off
title Magnet2Torrent CLI 🧲
mode con: cols=120 lines=40
color 0B

cd /d "%~dp0"

:: Ensure Node.js is on PATH (handles cases where env vars aren't refreshed)
for /f "usebackq tokens=*" %%P in (`powershell -NoProfile -Command "[System.Environment]::GetEnvironmentVariable('Path','Machine')"`) do (
    set "PATH=%%P;%PATH%"
)

:: Auto-install dependencies if not already present
if not exist "%~dp0node_modules\" (
    echo [Magnet2Torrent] Installing required dependencies...
    call npm install
)

node index.js

echo.
echo  Press any key to close...
pause >nul
