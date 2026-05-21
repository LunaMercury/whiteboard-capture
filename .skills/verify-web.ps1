$ErrorActionPreference = "Stop"

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "Running Verification for WEB (React)" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan

$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location -Path (Join-Path $repoRoot "web")
$npmCmd = "C:\Program Files\nodejs\npm.cmd"

Write-Host "Running npm install..." -ForegroundColor Yellow
if (-not (Test-Path "node_modules")) {
    & $npmCmd install
    if ($LASTEXITCODE -ne 0) { throw "npm install failed" }
} else {
    Write-Host "Skipping npm install because node_modules already exists." -ForegroundColor DarkYellow
}

Write-Host "Running typescript check & vite build..." -ForegroundColor Yellow
& $npmCmd run build
if ($LASTEXITCODE -ne 0) { throw "npm run build failed" }

Write-Host "==========================================" -ForegroundColor Green
Write-Host "WEB Verification Completed Successfully" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Green
