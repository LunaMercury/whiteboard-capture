$ErrorActionPreference = "Stop"

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "Running Verification for BACKEND-CORE (Java/Spring)" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan

$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location -Path (Join-Path $repoRoot "backend-core")

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
    throw "BACKEND-CORE requires JDK $requiredJavaMajor. JAVA_HOME reports: $javaVersionText"
}

Write-Host "Using JAVA_HOME=$env:JAVA_HOME" -ForegroundColor Yellow
Write-Host ($javaVersionOutput -join "`n") -ForegroundColor DarkGray

$env:GRADLE_USER_HOME = "C:\Users\Public\Documents\ESTsoft\CreatorTemp\whiteboard-capture-core-gradle"
New-Item -ItemType Directory -Force -Path $env:GRADLE_USER_HOME | Out-Null

Write-Host "Running gradlew classes..." -ForegroundColor Yellow
.\gradlew.bat --no-daemon --console=plain classes
if ($LASTEXITCODE -ne 0) { throw "gradlew classes failed" }

Write-Host "==========================================" -ForegroundColor Green
Write-Host "BACKEND-CORE Verification Completed Successfully" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Green
