$ErrorActionPreference = "Stop"
. "$PSScriptRoot\lib.ps1"
$RepoRoot = Get-RepoRoot
Set-Location $RepoRoot
Load-DotEnv (Join-Path $RepoRoot ".env.local")

if (-not $env:PANEL_PORT) { $env:PANEL_PORT = "5173" }
if (-not $env:API_PORT) { $env:API_PORT = "5000" }
if (-not $env:BASE_PATH) { $env:BASE_PATH = "/" }
if (-not $env:API_PROXY_TARGET) { $env:API_PROXY_TARGET = "http://localhost:$($env:API_PORT)" }
$env:PORT = $env:PANEL_PORT

Write-Host "EMS Panel -> http://localhost:$($env:PORT)" -ForegroundColor Cyan
Write-Host "API Proxy -> $($env:API_PROXY_TARGET)" -ForegroundColor Cyan
pnpm.cmd --filter @workspace/ems-panel run dev
