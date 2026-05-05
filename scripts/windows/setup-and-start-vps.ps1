$ErrorActionPreference = "Stop"
. "$PSScriptRoot\lib.ps1"

$RepoRoot = Get-RepoRoot
Set-Location $RepoRoot

Write-Host "===========================================" -ForegroundColor Cyan
Write-Host " EMS Website VPS One-Click Setup + Start" -ForegroundColor Cyan
Write-Host "===========================================" -ForegroundColor Cyan

$setupScript = Join-Path $PSScriptRoot "auto-setup-website.ps1"
$backgroundScript = Join-Path $PSScriptRoot "start-website-background.ps1"

& $setupScript -SetupOnly
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host ""
Write-Host "Starting VPS background mode..." -ForegroundColor Cyan
& $backgroundScript
