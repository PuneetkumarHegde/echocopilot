@echo off
title EchoCopilot Launcher
echo ========================================================
echo             Starting EchoCopilot Desktop HUD            
echo ========================================================

cd /d "%~dp0"

:: Check if Next.js local server is already running on port 3000
powershell -Command "try { $res = Invoke-WebRequest -Uri 'http://localhost:3000/api/health' -UseBasicParsing -TimeoutSec 1; if ($res.StatusCode -eq 200) { exit 0 } else { exit 1 } } catch { exit 1 }" >nul 2>&1

if %ERRORLEVEL% NEQ 0 (
    echo [1/2] Starting Next.js background server on http://localhost:3000...
    start "EchoCopilot Server" /min cmd /c "npm run dev"
    echo Waiting for server to initialize...
    powershell -Command "for ($i = 0; $i -lt 30; $i++) { try { $r = Invoke-WebRequest -Uri 'http://localhost:3000/api/health' -UseBasicParsing -TimeoutSec 1; if ($r.StatusCode -eq 200) { exit 0 } } catch {} Start-Sleep -Milliseconds 500 }; exit 1"
) else (
    echo [1/2] Next.js server is already active on http://localhost:3000.
)

echo [2/2] Launching Transparent Desktop Window...
start "EchoCopilot Window" cmd /c "npm run desktop"

echo EchoCopilot is now running!
exit
