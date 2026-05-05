$ErrorActionPreference = "Stop"
. "$PSScriptRoot\lib.ps1"
$RepoRoot = Get-RepoRoot
Set-Location $RepoRoot
Load-DotEnv (Join-Path $RepoRoot ".env.local")

$apiScript = Join-Path $PSScriptRoot "start-api.ps1"
$panelScript = Join-Path $PSScriptRoot "start-panel.ps1"
$botScript = Join-Path $PSScriptRoot "start-bot.ps1"

Write-Host "Opening API, Panel, and Bot windows..." -ForegroundColor Cyan
Start-PowerShellScriptWindow -ScriptPath $apiScript
Start-Sleep -Seconds 5
Start-PowerShellScriptWindow -ScriptPath $panelScript
Start-Sleep -Seconds 3
if (-not ((Test-PlaceholderValue $env:DISCORD_BOT_TOKEN) -or (Test-PlaceholderValue $env:DISCORD_TIMESTAMP_CHANNEL_ID))) {
  Start-PowerShellScriptWindow -ScriptPath $botScript
} else {
  Write-Host "Bot skipped: token/channel missing in .env.local" -ForegroundColor Yellow
}
if (-not $env:PANEL_PORT) { $env:PANEL_PORT = "5173" }
if (-not $env:API_PORT) { $env:API_PORT = "5000" }
Wait-Url -Url "http://localhost:$($env:API_PORT)/api/healthz" -TimeoutSeconds 90 -Name "API Server"
Wait-Url -Url "http://localhost:$($env:PANEL_PORT)" -TimeoutSeconds 90 -Name "EMS Panel"
Start-Process "http://localhost:$($env:PANEL_PORT)"
Write-Host "Done. Close the opened PowerShell windows to stop services." -ForegroundColor Green
