@echo off
title EchoCopilot - Localhost Browser Mode
echo ========================================================
echo             Starting EchoCopilot (Localhost Mode)        
echo ========================================================

cd /d "%~dp0"

:: 1. Check if Ollama local AI service is running on port 11434
powershell -Command "try { $res = Invoke-WebRequest -Uri 'http://localhost:11434/api/tags' -UseBasicParsing -TimeoutSec 1; if ($res.StatusCode -eq 200) { exit 0 } else { exit 1 } } catch { exit 1 }" >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [1/2] Starting Ollama local AI service...
    if exist "%LOCALAPPDATA%\Programs\Ollama\ollama.exe" (
        start "Ollama" /min "%LOCALAPPDATA%\Programs\Ollama\ollama.exe" serve
    ) else (
        start "Ollama" /min ollama serve
    )
    powershell -Command "for ($i = 0; $i -lt 15; $i++) { try { $r = Invoke-WebRequest -Uri 'http://localhost:11434/api/tags' -UseBasicParsing -TimeoutSec 1; if ($r.StatusCode -eq 200) { exit 0 } } catch {} Start-Sleep -Milliseconds 400 }; exit 0"
) else (
    echo [1/2] Ollama service is active on http://localhost:11434.
)

:: 2. Check if Next.js server is running on port 3000
powershell -Command "try { $res = Invoke-WebRequest -Uri 'http://localhost:3000/api/health' -UseBasicParsing -TimeoutSec 1; if ($res.StatusCode -eq 200) { exit 0 } else { exit 1 } } catch { exit 1 }" >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [2/2] Starting Next.js background server on http://localhost:3000...
    start "EchoCopilot Server" cmd /c "npm run dev"
    echo Waiting for server to initialize...
    powershell -Command "for ($i = 0; $i -lt 30; $i++) { try { $r = Invoke-WebRequest -Uri 'http://localhost:3000/api/health' -UseBasicParsing -TimeoutSec 1; if ($r.StatusCode -eq 200) { exit 0 } } catch {} Start-Sleep -Milliseconds 500 }; exit 1"
) else (
    echo [2/2] Next.js server is already active on http://localhost:3000.
)

echo Opening http://localhost:3000 in your web browser...
start http://localhost:3000

echo.
echo ========================================================
echo   EchoCopilot is running at http://localhost:3000
echo   Live speech transcription and LLaMA AI answers active!
echo ========================================================
exit /b 0
