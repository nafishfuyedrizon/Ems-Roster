$ErrorActionPreference = "Stop"
. "$PSScriptRoot\lib.ps1"
$RepoRoot = Get-RepoRoot
Set-Location $RepoRoot
Load-DotEnv (Join-Path $RepoRoot ".env.local")

if (-not $env:API_PORT) { $env:API_PORT = "5000" }
$env:PORT = $env:API_PORT
if (-not $env:NODE_ENV) { $env:NODE_ENV = "development" }

Write-Host "API Server -> http://localhost:$($env:PORT)" -ForegroundColor Cyan
pnpm.cmd --filter @workspace/api-server run build
pnpm.cmd --filter @workspace/api-server run start
