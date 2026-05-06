$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent (Get-Location)
Set-Location -Path (Join-Path $repoRoot "orchestrator")
$npmCmd = "C:\Program Files\nodejs\npm.cmd"

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "Running Verification for ORCHESTRATOR (LangGraph)" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan

if (-not (Test-Path "node_modules")) {
    Write-Host "Installing orchestrator dependencies..." -ForegroundColor Yellow
    & $npmCmd install
    if ($LASTEXITCODE -ne 0) { throw "npm install failed" }
} else {
    Write-Host "Skipping npm install because node_modules already exists." -ForegroundColor DarkYellow
}

Write-Host "Building orchestrator..." -ForegroundColor Yellow
& $npmCmd run build
if ($LASTEXITCODE -ne 0) { throw "npm run build failed" }

Write-Host "Running mock orchestration demo..." -ForegroundColor Yellow
& $npmCmd run demo:mock -- "네이버 로그인 기능을 만들어줘"
if ($LASTEXITCODE -ne 0) { throw "mock orchestration demo failed" }

Write-Host "==========================================" -ForegroundColor Green
Write-Host "ORCHESTRATOR Verification Completed Successfully" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Green
