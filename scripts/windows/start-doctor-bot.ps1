$ErrorActionPreference = "Stop"
. "$PSScriptRoot\lib.ps1"
$RepoRoot = Get-RepoRoot
Set-Location $RepoRoot
Load-DotEnv (Join-Path $RepoRoot ".env.local")

if (Test-PlaceholderValue $env:DISCORD_BOT_TOKEN) {
  Write-Host "Doctor bot token missing. Set DISCORD_BOT_TOKEN in .env.local first." -ForegroundColor Yellow
  exit 0
}

$medicalChannels = @(
  $env:DISCORD_DOCTOR_APPOINTMENT_CHANNEL_ID,
  $env:DISCORD_MEDICAL_RECORD_HISTORY_CHANNEL_ID,
  $env:DISCORD_MFC_DUMP_CHANNEL_ID,
  $env:DISCORD_PRESCRIPTION_HISTORY_CHANNEL_ID
) | Where-Object { -not (Test-PlaceholderValue $_) }

if ($medicalChannels.Count -eq 0) {
  Write-Host "Doctor bot needs at least one medical Discord channel id in .env.local." -ForegroundColor Yellow
  exit 0
}

Write-Host "Doctor Discord Bot starting..." -ForegroundColor Cyan
pnpm.cmd --filter @workspace/discord-bot run start
