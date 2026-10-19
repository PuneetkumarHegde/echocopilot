# EchoCopilot Desktop Launcher for PowerShell
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "            Starting EchoCopilot Desktop HUD            " -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Cyan

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
if (-not $ScriptDir) { $ScriptDir = Get-Location }
Set-Location $ScriptDir

# 1. Check Ollama
$ollamaOk = $false
try {
    $res = Invoke-WebRequest -Uri 'http://localhost:11434/api/tags' -UseBasicParsing -TimeoutSec 1
    if ($res.StatusCode -eq 200) { $ollamaOk = $true }
} catch {}

if (-not $ollamaOk) {
    Write-Host "[1/3] Starting Ollama local AI service..." -ForegroundColor Yellow
    $ollamaExe = "$env:LOCALAPPDATA\Programs\Ollama\ollama.exe"
    if (Test-Path $ollamaExe) {
        Start-Process -FilePath $ollamaExe -ArgumentList "serve" -WindowStyle Minimized
    } else {
        Start-Process -FilePath "ollama" -ArgumentList "serve" -WindowStyle Minimized
    }
    for ($i = 0; $i -lt 15; $i++) {
        try {
            $r = Invoke-WebRequest -Uri 'http://localhost:11434/api/tags' -UseBasicParsing -TimeoutSec 1
            if ($r.StatusCode -eq 200) { break }
        } catch {}
        Start-Sleep -Milliseconds 400
    }
} else {
    Write-Host "[1/3] Ollama service is active on http://localhost:11434." -ForegroundColor Green
}

# 2. Check Next.js server
$serverOk = $false
try {
    $res = Invoke-WebRequest -Uri 'http://localhost:3000/api/health' -UseBasicParsing -TimeoutSec 1
    if ($res.StatusCode -eq 200) { $serverOk = $true }
} catch {}

if (-not $serverOk) {
    Write-Host "[2/3] Starting Next.js background server on http://localhost:3000..." -ForegroundColor Yellow
    Start-Process -FilePath "cmd.exe" -ArgumentList "/c npm run dev" -WindowStyle Minimized
    Write-Host "Waiting for server to initialize..."
    for ($i = 0; $i -lt 30; $i++) {
        try {
            $r = Invoke-WebRequest -Uri 'http://localhost:3000/api/health' -UseBasicParsing -TimeoutSec 1
            if ($r.StatusCode -eq 200) { $serverOk = $true; break }
        } catch {}
        Start-Sleep -Milliseconds 500
    }
} else {
    Write-Host "[2/3] Next.js server is already active on http://localhost:3000." -ForegroundColor Green
}

# 3. Launch Electron HUD
Write-Host "[3/3] Launching EchoCopilot Floating Electron Desktop HUD..." -ForegroundColor Cyan
$electronExe = Join-Path $ScriptDir "node_modules\electron\dist\electron.exe"
$mainJs = Join-Path $ScriptDir "electron\main.js"

if (Test-Path $electronExe) {
    Start-Process -FilePath $electronExe -ArgumentList "`"$mainJs`""
} else {
    Start-Process -FilePath "npm.cmd" -ArgumentList "run desktop"
}

Write-Host "EchoCopilot Floating Desktop HUD is running!" -ForegroundColor Green
