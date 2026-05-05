function Get-RepoRoot {
  return (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
}

function Load-DotEnv {
  param([string]$EnvPath)
  if (-not (Test-Path $EnvPath)) {
    Write-Host "Missing .env.local. Run FIRST_TIME_SETUP.bat first." -ForegroundColor Red
    exit 1
  }
  Get-Content $EnvPath | ForEach-Object {
    $line = $_.Trim()
    if (-not $line -or $line.StartsWith('#')) { return }
    $idx = $line.IndexOf('=')
    if ($idx -lt 1) { return }
    $key = $line.Substring(0, $idx).Trim()
    $value = $line.Substring($idx + 1).Trim()
    if (($value.StartsWith('"') -and $value.EndsWith('"')) -or ($value.StartsWith("'") -and $value.EndsWith("'"))) {
      $value = $value.Substring(1, $value.Length - 2)
    }
    [Environment]::SetEnvironmentVariable($key, $value, 'Process')
  }
}

function Require-Command {
  param([string]$Name, [string]$Help)
  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
    Write-Host "Missing: $Name" -ForegroundColor Red
    if ($Help) { Write-Host $Help -ForegroundColor Yellow }
    exit 1
  }
}

function Test-PlaceholderValue {
  param([string]$Value)
  if (-not $Value) { return $true }
  if ($Value -match '^YOUR_' -or $Value -match '^PASTE_') { return $true }
  return $false
}

function Start-PowerShellScript {
  param(
    [Parameter(Mandatory = $true)]
    [string]$ScriptPath,
    [switch]$Hidden,
    [string]$StdOutPath,
    [string]$StdErrPath
  )

  $resolvedScript = (Resolve-Path $ScriptPath).Path
  $quotedScript = $resolvedScript.Replace("'", "''")
  $command = "& '$quotedScript'"

  $params = @{
    FilePath = "powershell"
    ArgumentList = @(
    '-NoExit',
    '-NoProfile',
    '-ExecutionPolicy',
    'Bypass',
    '-Command',
    $command
    )
  }

  if ($Hidden) {
    $params.WindowStyle = "Hidden"
    $params.ArgumentList[0] = '-NoProfile'
    $params.ArgumentList = @(
      '-NoProfile',
      '-ExecutionPolicy',
      'Bypass',
      '-Command',
      $command
    )
  }

  if ($StdOutPath) {
    $params.RedirectStandardOutput = $StdOutPath
  }

  if ($StdErrPath) {
    $params.RedirectStandardError = $StdErrPath
  }

  Start-Process @params
}

function Start-PowerShellScriptWindow {
  param(
    [Parameter(Mandatory = $true)]
    [string]$ScriptPath
  )

  Start-PowerShellScript -ScriptPath $ScriptPath
}

function Wait-Url {
  param(
    [string]$Url,
    [int]$TimeoutSeconds = 90,
    [string]$Name = "service"
  )
  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  Write-Host "Waiting for ${Name}: $Url" -ForegroundColor Cyan
  while ((Get-Date) -lt $deadline) {
    try {
      $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 3
      if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 500) {
        Write-Host "$Name is ready." -ForegroundColor Green
        return $true
      }
    } catch {
      Start-Sleep -Seconds 2
    }
  }
  Write-Host "$Name did not respond within $TimeoutSeconds seconds. Continuing anyway..." -ForegroundColor Yellow
  return $false
}
