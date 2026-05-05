$ErrorActionPreference = "Stop"
. "$PSScriptRoot\lib.ps1"
$RepoRoot = Get-RepoRoot
Set-Location $RepoRoot
Load-DotEnv (Join-Path $RepoRoot ".env.local")
pnpm --filter @workspace/db run push
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
pnpm --filter @workspace/db run import-dump
