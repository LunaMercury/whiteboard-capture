$ErrorActionPreference = "Stop"

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "Running Verification for MOBILE (Android)" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan

$repoRoot = Split-Path -Parent $PSScriptRoot
$mobileRoot = Join-Path $repoRoot "mobile"
Set-Location -Path $mobileRoot

Write-Host "Running gradlew compileDebugSources..." -ForegroundColor Yellow
.\gradlew.bat --stop | Out-Host
& .\gradlew.bat --no-daemon "-Dorg.gradle.vfs.watch=false" :app:compileDebugSources --console=plain
if ($LASTEXITCODE -ne 0) { throw "gradlew compileDebugSources failed" }

Write-Host "==========================================" -ForegroundColor Green
Write-Host "MOBILE Verification Completed Successfully" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Green
