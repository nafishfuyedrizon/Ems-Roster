param(
  [switch]$SetupOnly
)

$ErrorActionPreference = "Stop"
. "$PSScriptRoot\lib.ps1"

$RepoRoot = Get-RepoRoot
Set-Location $RepoRoot

Write-Host "===========================================" -ForegroundColor Cyan
Write-Host " Hello-Bot Windows One-Click Runner" -ForegroundColor Cyan
Write-Host "===========================================" -ForegroundColor Cyan

$envFile = Join-Path $RepoRoot ".env.local"

$defaults = [ordered]@{
  DATABASE_URL = "mysql://DB_USER:DB_PASSWORD@DB_HOST:3306/DB_NAME"
  API_PORT = "5000"
  PANEL_PORT = "5173"
  BASE_PATH = "/"
  API_PROXY_TARGET = "http://localhost:5000"
  NODE_ENV = "development"
  AUTO_IMPORT_DATABASE = "true"
  ADMIN_MASTER_KEYS = "ADMIN_KEY_1,ADMIN_KEY_2"
  DISCORD_BOT_TOKEN = "PASTE_DISCORD_BOT_TOKEN_IF_NEEDED"
  DISCORD_TIMESTAMP_CHANNEL_ID = "PASTE_CHANNEL_ID_IF_NEEDED"
  DISCORD_CLIENT_ID = "PASTE_CLIENT_ID_IF_NEEDED"
  DISCORD_CLIENT_SECRET = ""
  DISCORD_REDIRECT_URI = "http://localhost:5000/api/auth/discord/callback"
}

function Read-EnvMap {
  param([string]$Path)
  $map = [ordered]@{}
  if (Test-Path $Path) {
    Get-Content $Path | ForEach-Object {
      $line = $_.Trim()
      if (-not $line -or $line.StartsWith("#")) { return }
      $idx = $line.IndexOf("=")
      if ($idx -lt 1) { return }
      $key = $line.Substring(0, $idx).Trim()
      $value = $line.Substring($idx + 1).Trim()
      $map[$key] = $value
    }
  }
  return $map
}

function Write-EnvMap {
  param([string]$Path, $Map)
  $content = @"
DATABASE_URL=$($Map["DATABASE_URL"])
API_PORT=$($Map["API_PORT"])
PANEL_PORT=$($Map["PANEL_PORT"])
BASE_PATH=$($Map["BASE_PATH"])
API_PROXY_TARGET=$($Map["API_PROXY_TARGET"])
NODE_ENV=$($Map["NODE_ENV"])
AUTO_IMPORT_DATABASE=$($Map["AUTO_IMPORT_DATABASE"])
ADMIN_MASTER_KEYS=$($Map["ADMIN_MASTER_KEYS"])

DISCORD_BOT_TOKEN=$($Map["DISCORD_BOT_TOKEN"])
DISCORD_TIMESTAMP_CHANNEL_ID=$($Map["DISCORD_TIMESTAMP_CHANNEL_ID"])

DISCORD_CLIENT_ID=$($Map["DISCORD_CLIENT_ID"])
DISCORD_CLIENT_SECRET=$($Map["DISCORD_CLIENT_SECRET"])
DISCORD_REDIRECT_URI=$($Map["DISCORD_REDIRECT_URI"])
"@
  Set-Content -Path $Path -Value $content -Encoding UTF8
}

$envMap = Read-EnvMap $envFile
foreach ($key in $defaults.Keys) {
  if (-not $envMap.Contains($key) -or (Test-PlaceholderValue $envMap[$key])) {
    $envMap[$key] = $defaults[$key]
  }
}

# Always keep the packaged bot token/channel ready unless user manually replaces with a real value.
if (Test-PlaceholderValue $envMap["DISCORD_BOT_TOKEN"]) { $envMap["DISCORD_BOT_TOKEN"] = $defaults["DISCORD_BOT_TOKEN"] }
if (Test-PlaceholderValue $envMap["DISCORD_TIMESTAMP_CHANNEL_ID"]) { $envMap["DISCORD_TIMESTAMP_CHANNEL_ID"] = $defaults["DISCORD_TIMESTAMP_CHANNEL_ID"] }
if (Test-PlaceholderValue $envMap["DISCORD_CLIENT_ID"]) { $envMap["DISCORD_CLIENT_ID"] = $defaults["DISCORD_CLIENT_ID"] }

Write-EnvMap $envFile $envMap
Write-Host ".env.local ready." -ForegroundColor Green

Load-DotEnv $envFile

Require-Command node "Install Node.js first: https://nodejs.org/"

if (-not (Get-Command pnpm -ErrorAction SilentlyContinue)) {
  if (Get-Command corepack -ErrorAction SilentlyContinue) {
    Write-Host "Enabling pnpm using Corepack..." -ForegroundColor Cyan
    corepack enable
    corepack prepare pnpm@latest --activate
  }
}
if (-not (Get-Command pnpm -ErrorAction SilentlyContinue)) {
  Write-Host "Installing pnpm globally..." -ForegroundColor Cyan
  npm install -g pnpm
}
Require-Command pnpm "pnpm could not be installed. Install it manually, then run this again."

function Wait-Http {
  param(
    [string]$Url,
    [string]$Name,
    [int]$Seconds = 90
  )

  Write-Host "Waiting for $Name at $Url ..." -ForegroundColor Cyan
  $deadline = (Get-Date).AddSeconds($Seconds)
  while ((Get-Date) -lt $deadline) {
    try {
      $resp = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 2
      if ($resp.StatusCode -ge 200 -and $resp.StatusCode -lt 500) {
        Write-Host "$Name is ready." -ForegroundColor Green
        return $true
      }
    } catch {
      Start-Sleep -Seconds 2
    }
  }
  Write-Host "$Name did not respond within $Seconds seconds. Opening anyway; refresh the page after the terminal finishes loading." -ForegroundColor Yellow
  return $false
}


$dockerReady = $false
if (Get-Command docker -ErrorAction SilentlyContinue) {
  try {
    docker info *> $null
    if ($LASTEXITCODE -eq 0) { $dockerReady = $true }
  } catch {
    $dockerReady = $false
  }
}

if ($dockerReady) {
  Write-Host "Checking MySQL/MariaDB Docker container..." -ForegroundColor Cyan
  $names = docker ps -a --format "{{.Names}}"
  if ($names -notcontains "hello-bot-mariadb") {
    Write-Host "Creating hello-bot-mariadb container..." -ForegroundColor Cyan
    docker run --name hello-bot-mariadb -e MARIADB_ROOT_PASSWORD=root -e MARIADB_DATABASE=hello_bot -p 3306:3306 -d mariadb:11
    Start-Sleep -Seconds 10
  } else {
    docker start hello-bot-mariadb *> $null
    Start-Sleep -Seconds 5
  }
} else {
  Write-Host "Docker Desktop is not running/found. I will use DATABASE_URL from .env.local." -ForegroundColor Yellow
  Write-Host "Make sure MySQL or MariaDB is running before this continues." -ForegroundColor Yellow
}

if (-not (Test-Path (Join-Path $RepoRoot "node_modules"))) {
  Write-Host "Installing dependencies. First time can take a few minutes..." -ForegroundColor Cyan
  pnpm install
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
} else {
  Write-Host "Dependencies already installed. Running pnpm install to verify lockfile..." -ForegroundColor Cyan
  pnpm install
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}

Write-Host "Pushing database schema..." -ForegroundColor Cyan
pnpm --filter @workspace/db run push
if ($LASTEXITCODE -ne 0) {
  Write-Host "Database schema push failed. Start Docker Desktop or MySQL/MariaDB, then run RUN_WINDOWS.bat again." -ForegroundColor Red
  exit $LASTEXITCODE
}

if ($env:AUTO_IMPORT_DATABASE -ne "false") {
  Write-Host "Importing bundled database_dump.json..." -ForegroundColor Cyan
  pnpm --filter @workspace/db run import-dump
  if ($LASTEXITCODE -ne 0) {
    Write-Host "Database import failed. Check MySQL/MariaDB or Docker, then run RUN_WINDOWS.bat again." -ForegroundColor Red
    exit $LASTEXITCODE
  }
} else {
  Write-Host "Database import skipped because AUTO_IMPORT_DATABASE=false." -ForegroundColor Yellow
}

if ($SetupOnly) {
  Write-Host "Setup complete. Now run RUN_WINDOWS.bat to start everything." -ForegroundColor Green
  exit 0
}

$apiScript = Join-Path $PSScriptRoot "start-api.ps1"
$panelScript = Join-Path $PSScriptRoot "start-panel.ps1"
$botScript = Join-Path $PSScriptRoot "start-bot.ps1"

Write-Host "Starting API Server..." -ForegroundColor Cyan
Start-PowerShellScriptWindow -ScriptPath $apiScript
Wait-Http "http://localhost:$($env:API_PORT)/api/healthz" "API Server" 90

Write-Host "Starting EMS Panel..." -ForegroundColor Cyan
Start-PowerShellScriptWindow -ScriptPath $panelScript
Wait-Http "http://localhost:$($env:PANEL_PORT)" "EMS Panel" 120

if (-not ((Test-PlaceholderValue $env:DISCORD_BOT_TOKEN) -or (Test-PlaceholderValue $env:DISCORD_TIMESTAMP_CHANNEL_ID))) {
  Write-Host "Starting Discord Bot..." -ForegroundColor Cyan
  Start-PowerShellScriptWindow -ScriptPath $botScript
} else {
  Write-Host "Bot skipped because token/channel is missing." -ForegroundColor Yellow
}

$panelUrl = "http://localhost:$($env:PANEL_PORT)"
Write-Host "Opening website: $panelUrl" -ForegroundColor Green
Start-Process $panelUrl

Write-Host "All done. Keep the opened PowerShell windows running." -ForegroundColor Green

