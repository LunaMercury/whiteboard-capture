$ErrorActionPreference = "Stop"

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "Running Verification for WEB (React)" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan

Set-Location -Path "..\web"

Write-Host "Running npm install..." -ForegroundColor Yellow
npm install

Write-Host "Running typescript check & vite build..." -ForegroundColor Yellow
npm run build

Write-Host "==========================================" -ForegroundColor Green
Write-Host "WEB Verification Completed Successfully" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Green
