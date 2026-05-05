$ErrorActionPreference = "Stop"

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "Running Verification for BACKEND-FAST (Rust)" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan

 $repoRoot = Split-Path -Parent (Get-Location)
Set-Location -Path (Join-Path $repoRoot "backend-fast")
$env:CARGO_TARGET_DIR = "C:\Users\Public\Documents\ESTsoft\CreatorTemp\whiteboard-capture-cargo-target"
New-Item -ItemType Directory -Force -Path $env:CARGO_TARGET_DIR | Out-Null

Write-Host "Running cargo check..." -ForegroundColor Yellow
cargo check
if ($LASTEXITCODE -ne 0) { throw "cargo check failed" }

Write-Host "==========================================" -ForegroundColor Green
Write-Host "BACKEND-FAST Verification Completed Successfully" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Green
