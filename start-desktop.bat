@echo off
title EchoCopilot Launcher
echo ========================================================
echo             Starting EchoCopilot Desktop HUD            
echo ========================================================

cd /d "%~dp0"

:: 1. Check if Ollama service is running on port 11434
powershell -Command "try { $res = Invoke-WebRequest -Uri 'http://127.0.0.1:11434/api/tags' -UseBasicParsing -TimeoutSec 1; if ($res.StatusCode -eq 200) { exit 0 } else { exit 1 } } catch { exit 1 }" >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [1/3] Starting Ollama local AI service...
    if exist "%LOCALAPPDATA%\Programs\Ollama\ollama.exe" (
        start "Ollama" /min "%LOCALAPPDATA%\Programs\Ollama\ollama.exe" serve
    ) else (
        start "Ollama" /min ollama serve
    )
    powershell -Command "$done = $false; for ($i = 0; $i -lt 15; $i++) { try { $r = Invoke-WebRequest -Uri 'http://127.0.0.1:11434/api/tags' -UseBasicParsing -TimeoutSec 1; if ($r.StatusCode -eq 200) { $done = $true; break } } catch {} Start-Sleep -Milliseconds 400 }; if ($done) { exit 0 } else { exit 1 }"
) else (
    echo [1/3] Ollama service is active on http://127.0.0.1:11434.
)

:: 2. Check if Local Faster-Whisper STT service is running on port 5001
powershell -Command "try { $res = Invoke-WebRequest -Uri 'http://127.0.0.1:5001/health' -UseBasicParsing -TimeoutSec 1; if ($res.StatusCode -eq 200) { exit 0 } else { exit 1 } } catch { exit 1 }" >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [2/4] Starting Faster-Whisper local offline STT service...
    start "EchoCopilot Whisper STT" /min cmd /c "py -3.12 scripts\whisper_server.py"
    powershell -Command "$done = $false; for ($i = 0; $i -lt 15; $i++) { try { $r = Invoke-WebRequest -Uri 'http://127.0.0.1:5001/health' -UseBasicParsing -TimeoutSec 1; if ($r.StatusCode -eq 200) { $done = $true; break } } catch {} Start-Sleep -Milliseconds 400 }; if ($done) { exit 0 } else { exit 1 }"
) else (
    echo [2/4] Faster-Whisper STT service is active on http://127.0.0.1:5001.
)

:: 3. Check if Next.js local server is already running on port 3000
powershell -Command "try { $res = Invoke-WebRequest -Uri 'http://127.0.0.1:3000/api/health' -UseBasicParsing -TimeoutSec 1; if ($res.StatusCode -eq 200) { exit 0 } else { exit 1 } } catch { exit 1 }" >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [3/4] Starting Next.js background server on http://localhost:3000...
    start "EchoCopilot Server" /min cmd /c "npm run dev"
    echo Waiting for server to initialize...
    powershell -Command "$done = $false; for ($i = 0; $i -lt 40; $i++) { try { $r = Invoke-WebRequest -Uri 'http://127.0.0.1:3000/api/health' -UseBasicParsing -TimeoutSec 1; if ($r.StatusCode -eq 200) { $done = $true; break } } catch {} Start-Sleep -Milliseconds 500 }; if ($done) { exit 0 } else { exit 1 }"
) else (
    echo [3/4] Next.js server is already active on http://localhost:3000.
)

:: 4. Clean up any stale or background electron instances so the user gets a fresh window
taskkill /F /IM electron.exe >nul 2>&1

echo [4/4] Launching EchoCopilot Floating Electron Desktop HUD...
start "EchoCopilot Electron HUD" /min cmd /c "npx electron electron\main.js"

echo EchoCopilot Floating Desktop HUD is running with Local Faster-Whisper STT!
exit /b 0
