$ErrorActionPreference = "Stop"

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "Running Verification for MOBILE (Android)" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan

$repoRoot = Split-Path -Parent $PSScriptRoot
$mobileRoot = Join-Path $repoRoot "mobile"
Set-Location -Path $mobileRoot

$requiredJavaMajor = 26
if (-not $env:JAVA_HOME) {
    throw "JAVA_HOME must point to JDK $requiredJavaMajor."
}

$javaBin = Join-Path $env:JAVA_HOME "bin"
$javaExe = Join-Path $javaBin "java.exe"
if (-not (Test-Path $javaExe)) {
    throw "java.exe was not found under JAVA_HOME: $env:JAVA_HOME"
}

# Put JAVA_HOME first so old Oracle java8path/javapath shims cannot shadow the project JDK.
$env:Path = "$javaBin;$env:Path"
$javaVersionOutput = & cmd.exe /c "`"$javaExe`" -version 2>&1"
$javaVersionText = $javaVersionOutput -join " "
if ($javaVersionText -notmatch '"26(\.|")') {
    throw "MOBILE requires JDK $requiredJavaMajor. JAVA_HOME reports: $javaVersionText"
}

Write-Host "Using JAVA_HOME=$env:JAVA_HOME" -ForegroundColor Yellow
Write-Host ($javaVersionOutput -join "`n") -ForegroundColor DarkGray

Write-Host "Running gradlew compileDebugSources..." -ForegroundColor Yellow
.\gradlew.bat --stop | Out-Host
& .\gradlew.bat --no-daemon "-Dorg.gradle.vfs.watch=false" :app:compileDebugSources --console=plain
if ($LASTEXITCODE -ne 0) { throw "gradlew compileDebugSources failed" }

Write-Host "==========================================" -ForegroundColor Green
Write-Host "MOBILE Verification Completed Successfully" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Green
