$ErrorActionPreference = "Stop"
. "$PSScriptRoot\lib.ps1"
$RepoRoot = Get-RepoRoot
Set-Location $RepoRoot
Load-DotEnv (Join-Path $RepoRoot ".env.local")

$apiScript = Join-Path $PSScriptRoot "start-api.ps1"
$panelScript = Join-Path $PSScriptRoot "start-panel.ps1"

Write-Host "Opening API and EMS Panel windows..." -ForegroundColor Cyan
Start-PowerShellScriptWindow -ScriptPath $apiScript
Start-Sleep -Seconds 5
Start-PowerShellScriptWindow -ScriptPath $panelScript

if (-not $env:PANEL_PORT) { $env:PANEL_PORT = "5173" }
if (-not $env:API_PORT) { $env:API_PORT = "5000" }

Wait-Url -Url "http://localhost:$($env:API_PORT)/api/healthz" -TimeoutSeconds 90 -Name "API Server"
Wait-Url -Url "http://localhost:$($env:PANEL_PORT)" -TimeoutSeconds 120 -Name "EMS Panel"

$panelUrl = "http://localhost:$($env:PANEL_PORT)"
Write-Host "Opening website: $panelUrl" -ForegroundColor Green
Start-Process $panelUrl
Write-Host "Done. Close the opened PowerShell windows to stop services." -ForegroundColor Green
