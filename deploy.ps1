# Deploys GOG NEWSROOM to Cloudflare Workers.
#
# Prerequisites (once): a Cloudflare account and `npx wrangler login`.
# The D1 database is created on first run and reused afterwards.
#
#   .\deploy.ps1

param(
  [string]$DatabaseName = "gog-newsroom-db"
)

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

function Get-D1Id([string]$Name) {
  # `d1 list --json` prints a wrangler banner before the JSON array.
  $raw = (npx --no-install wrangler d1 list --json | Out-String)
  $start = $raw.IndexOf("[")
  if ($start -lt 0) { return $null }
  $parsed = $raw.Substring($start) | ConvertFrom-Json
  $match = $parsed | Where-Object { $_.name -eq $Name } | Select-Object -First 1
  if ($match) { return $match.uuid }
  return $null
}

Write-Host "==> Checking Cloudflare authentication" -ForegroundColor Cyan
# An API token in .cloudflare-token avoids the OAuth flow entirely.
if (-not $env:CLOUDFLARE_API_TOKEN -and (Test-Path ".cloudflare-token")) {
  $env:CLOUDFLARE_API_TOKEN = (Get-Content ".cloudflare-token" -Raw).Trim()
  Write-Host "    using the API token from .cloudflare-token"
}
$whoami = (npx --no-install wrangler whoami | Out-String)
if ($whoami -match "not authenticated") {
  throw "No Cloudflare credentials. Put an API token in .cloudflare-token, or run: npx wrangler login"
}
Write-Host $whoami.Trim()

Write-Host "==> Resolving D1 database '$DatabaseName'" -ForegroundColor Cyan
$databaseId = Get-D1Id $DatabaseName
if (-not $databaseId) {
  Write-Host "    not found - creating it" -ForegroundColor Yellow
  npx --no-install wrangler d1 create $DatabaseName
  if ($LASTEXITCODE -ne 0) { throw "Could not create the D1 database." }
  $databaseId = Get-D1Id $DatabaseName
  if (-not $databaseId) { throw "Created the database but could not read back its id." }
}
Write-Host "    $DatabaseName -> $databaseId"

# The Vite/Cloudflare plugin bakes these into dist/server/wrangler.json at build time.
$env:CF_D1_DATABASE_ID = $databaseId
$env:CF_D1_DATABASE_NAME = $DatabaseName

Write-Host "==> Building" -ForegroundColor Cyan
npm run build
if ($LASTEXITCODE -ne 0) { throw "Build failed." }

Write-Host "==> Deploying" -ForegroundColor Cyan
npx --no-install wrangler deploy --config dist/server/wrangler.json
if ($LASTEXITCODE -ne 0) { throw "Deploy failed." }

Write-Host ""
Write-Host "Done. The scheduled sync runs every 10 minutes." -ForegroundColor Green
Write-Host "Optional API keys: npx wrangler secret put ANTHROPIC_API_KEY --config dist/server/wrangler.json" -ForegroundColor Green
