$ErrorActionPreference = "Stop"
. "$PSScriptRoot\lib.ps1"
$RepoRoot = Get-RepoRoot
Set-Location $RepoRoot
Load-DotEnv (Join-Path $RepoRoot ".env.local")

Write-Host "Pushing schema before reset..." -ForegroundColor Cyan
pnpm --filter @workspace/db run push
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "Resetting database from database_dump.json..." -ForegroundColor Yellow
$env:FORCE_DATABASE_IMPORT = "1"
pnpm --filter @workspace/db run import-dump-force
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "Database reset complete." -ForegroundColor Green
