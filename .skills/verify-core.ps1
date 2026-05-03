$ErrorActionPreference = "Stop"

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "Running Verification for BACKEND-CORE (Java/Spring)" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan

Set-Location -Path "..\backend-core"

Write-Host "Running gradlew classes..." -ForegroundColor Yellow
.\gradlew.bat classes

Write-Host "==========================================" -ForegroundColor Green
Write-Host "BACKEND-CORE Verification Completed Successfully" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Green
