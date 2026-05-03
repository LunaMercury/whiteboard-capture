$ErrorActionPreference = "Stop"

$currentDir = Get-Location

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "STARTING FULL PROJECT VERIFICATION" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan

# 1. Verify Web
Set-Location -Path $currentDir
.\verify-web.ps1
if ($LASTEXITCODE -ne 0) { throw "Web verification failed" }

# 2. Verify Rust Backend
Set-Location -Path $currentDir
.\verify-fast.ps1
if ($LASTEXITCODE -ne 0) { throw "Fast Backend verification failed" }

# 3. Verify Java Backend
Set-Location -Path $currentDir
.\verify-core.ps1
if ($LASTEXITCODE -ne 0) { throw "Core Backend verification failed" }

Set-Location -Path $currentDir

Write-Host "==========================================" -ForegroundColor Green
Write-Host "ALL CHECKS PASSED SUCCESSFULLY" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Green
