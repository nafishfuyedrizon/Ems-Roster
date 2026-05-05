$ErrorActionPreference = "Stop"
param(
  [switch]$SetupOnly
)
. "$PSScriptRoot\lib.ps1"
$RepoRoot = Get-RepoRoot
Set-Location $RepoRoot

Write-Host "===========================================" -ForegroundColor Cyan
Write-Host " EMS Website One-Click Setup + Run" -ForegroundColor Cyan
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
"@
  Set-Content -Path $Path -Value $content -Encoding UTF8
}

$envMap = Read-EnvMap $envFile
foreach ($key in $defaults.Keys) {
  if (-not $envMap.Contains($key) -or (Test-PlaceholderValue $envMap[$key])) {
    $envMap[$key] = $defaults[$key]
  }
}

Write-EnvMap $envFile $envMap
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
  Write-Host "Make sure MySQL or MariaDB is running before setup continues." -ForegroundColor Yellow
}

Write-Host "Installing/verifying dependencies..." -ForegroundColor Cyan
pnpm install
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "Pushing database schema..." -ForegroundColor Cyan
pnpm --filter @workspace/db run push
if ($LASTEXITCODE -ne 0) {
  Write-Host "Database schema push failed. Start Docker Desktop or MySQL/MariaDB, then run RUN_WEBSITE_SETUP.bat again." -ForegroundColor Red
  exit $LASTEXITCODE
}

if ($env:AUTO_IMPORT_DATABASE -ne "false") {
  Write-Host "Importing bundled database_dump.json..." -ForegroundColor Cyan
  pnpm --filter @workspace/db run import-dump
  if ($LASTEXITCODE -ne 0) {
    Write-Host "Database import failed. Check MySQL/MariaDB or Docker, then run RUN_WEBSITE_SETUP.bat again." -ForegroundColor Red
    exit $LASTEXITCODE
  }
}

if ($SetupOnly) {
  Write-Host "Setup complete." -ForegroundColor Green
  exit 0
}

& (Join-Path $PSScriptRoot "start-website.ps1")

