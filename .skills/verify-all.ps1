$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

function Invoke-VerificationScript {
    param(
        [Parameter(Mandatory = $true)]
        [string] $ScriptName,
        [Parameter(Mandatory = $true)]
        [string] $FailureMessage
    )

    $scriptPath = Join-Path $scriptDir $ScriptName
    & powershell -ExecutionPolicy Bypass -File $scriptPath
    if ($LASTEXITCODE -ne 0) { throw $FailureMessage }
}

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "STARTING FULL PROJECT VERIFICATION" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan

Invoke-VerificationScript -ScriptName "verify-web.ps1" -FailureMessage "Web verification failed"
Invoke-VerificationScript -ScriptName "verify-fast.ps1" -FailureMessage "Fast backend verification failed"
Invoke-VerificationScript -ScriptName "verify-core.ps1" -FailureMessage "Core backend verification failed"
Invoke-VerificationScript -ScriptName "verify-mobile.ps1" -FailureMessage "Mobile verification failed"
Invoke-VerificationScript -ScriptName "verify-orchestrator.ps1" -FailureMessage "Orchestrator verification failed"

Set-Location -Path $scriptDir

Write-Host "==========================================" -ForegroundColor Green
Write-Host "ALL CHECKS PASSED SUCCESSFULLY" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Green
