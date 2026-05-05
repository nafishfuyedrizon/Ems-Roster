$ErrorActionPreference = "Stop"
. "$PSScriptRoot\lib.ps1"
$RepoRoot = Get-RepoRoot
Set-Location $RepoRoot
Load-DotEnv (Join-Path $RepoRoot ".env.local")

if ((Test-PlaceholderValue $env:DISCORD_BOT_TOKEN) -or (Test-PlaceholderValue $env:DISCORD_TIMESTAMP_CHANNEL_ID)) {
  Write-Host "Discord bot token/channel missing. Edit .env.local then run this again." -ForegroundColor Yellow
  exit 0
}

Write-Host "Discord Bot starting..." -ForegroundColor Cyan
pnpm.cmd --filter @workspace/discord-bot run start
