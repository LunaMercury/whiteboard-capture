$ErrorActionPreference = "Stop"

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "Running Verification for MOBILE (Android)" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan

Set-Location -Path "..\mobile"

Write-Host "Running gradlew assembleDebug..." -ForegroundColor Yellow
.\gradlew.bat assembleDebug

Write-Host "==========================================" -ForegroundColor Green
Write-Host "MOBILE Verification Completed Successfully" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Green
