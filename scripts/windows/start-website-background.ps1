$ErrorActionPreference = "Stop"
. "$PSScriptRoot\lib.ps1"
$RepoRoot = Get-RepoRoot
Set-Location $RepoRoot
Load-DotEnv (Join-Path $RepoRoot ".env.local")

$apiScript = Join-Path $PSScriptRoot "start-api.ps1"
$panelScript = Join-Path $PSScriptRoot "start-panel.ps1"

if (-not $env:PANEL_PORT) { $env:PANEL_PORT = "5173" }
if (-not $env:API_PORT) { $env:API_PORT = "5000" }

$logDir = Join-Path $RepoRoot "artifacts\runtime-logs"
New-Item -ItemType Directory -Force -Path $logDir | Out-Null

$apiOut = Join-Path $logDir "api.out.log"
$apiErr = Join-Path $logDir "api.err.log"
$panelOut = Join-Path $logDir "panel.out.log"
$panelErr = Join-Path $logDir "panel.err.log"

Write-Host "Starting API and EMS Panel in background..." -ForegroundColor Cyan
Start-PowerShellScript -ScriptPath $apiScript -Hidden -StdOutPath $apiOut -StdErrPath $apiErr
Start-Sleep -Seconds 5
Start-PowerShellScript -ScriptPath $panelScript -Hidden -StdOutPath $panelOut -StdErrPath $panelErr

Wait-Url -Url "http://localhost:$($env:API_PORT)/api/healthz" -TimeoutSeconds 90 -Name "API Server" | Out-Null
Wait-Url -Url "http://localhost:$($env:PANEL_PORT)" -TimeoutSeconds 120 -Name "EMS Panel" | Out-Null

Write-Host "Background start completed." -ForegroundColor Green
Write-Host "Website: http://localhost:$($env:PANEL_PORT)" -ForegroundColor Green
Write-Host "API: http://localhost:$($env:API_PORT)/api/healthz" -ForegroundColor Green
Write-Host "Logs: $logDir" -ForegroundColor Yellow
