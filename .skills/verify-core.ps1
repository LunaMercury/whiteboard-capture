$ErrorActionPreference = "Stop"

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "Running Verification for BACKEND-CORE (Java/Spring)" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan

$repoRoot = Split-Path -Parent (Get-Location)
Set-Location -Path (Join-Path $repoRoot "backend-core")
$env:GRADLE_USER_HOME = "C:\Users\Public\Documents\ESTsoft\CreatorTemp\whiteboard-capture-core-gradle"
New-Item -ItemType Directory -Force -Path $env:GRADLE_USER_HOME | Out-Null

Write-Host "Running gradlew classes..." -ForegroundColor Yellow
.\gradlew.bat classes
if ($LASTEXITCODE -ne 0) { throw "gradlew classes failed" }

Write-Host "==========================================" -ForegroundColor Green
Write-Host "BACKEND-CORE Verification Completed Successfully" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Green
