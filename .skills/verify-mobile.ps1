$ErrorActionPreference = "Stop"

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "Running Verification for MOBILE (Android)" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan

$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location -Path (Join-Path $repoRoot "mobile")
$env:GRADLE_USER_HOME = "C:\Users\Public\Documents\ESTsoft\CreatorTemp\whiteboard-capture-mobile-gradle"
New-Item -ItemType Directory -Force -Path $env:GRADLE_USER_HOME | Out-Null

Write-Host "Running gradlew assembleDebug..." -ForegroundColor Yellow
.\gradlew.bat assembleDebug
if ($LASTEXITCODE -ne 0) { throw "gradlew assembleDebug failed" }

Write-Host "==========================================" -ForegroundColor Green
Write-Host "MOBILE Verification Completed Successfully" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Green
