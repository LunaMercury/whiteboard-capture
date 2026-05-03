$ErrorActionPreference = "Stop"

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "Running Verification for BACKEND-FAST (Rust)" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan

Set-Location -Path "..\backend-fast"

Write-Host "Running cargo check..." -ForegroundColor Yellow
cargo check

Write-Host "==========================================" -ForegroundColor Green
Write-Host "BACKEND-FAST Verification Completed Successfully" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Green
