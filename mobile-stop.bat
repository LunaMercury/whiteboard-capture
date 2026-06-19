@echo off
setlocal EnableExtensions
cd /d "%~dp0"

set "DEEP_CLEAN="
set "NO_PAUSE="
call :ParseArgs %*

echo ==========================================
echo Stopping Mobile Development Helpers...
echo ==========================================

echo [1/3] Stopping mobile Gradle daemons...
call :StopMobileGradle

echo [2/3] Stopping shared backend Gradle daemons...
call :StopCoreGradle

echo [3/3] Checking Gradle verification caches...
if defined DEEP_CLEAN (
    call :RemoveDirIfExists "mobile\.gradle-user-home"
    call :RemoveDirIfExists "C:\Users\Public\Documents\ESTsoft\CreatorTemp\whiteboard-capture-mobile-gradle"
    call :RemoveDirIfExists "C:\Users\Public\Documents\ESTsoft\CreatorTemp\whiteboard-capture-core-gradle"
) else (
    echo   Cache directories kept. Use --deep-clean to remove Gradle verification caches.
)

echo.
echo ==========================================
echo Mobile cleanup completed successfully.
echo ==========================================
if not defined NO_PAUSE pause
exit /b 0

:StopMobileGradle
if not exist "mobile\gradlew.bat" exit /b 0
pushd "mobile" >nul
call "gradlew.bat" --stop >nul 2>&1
popd >nul

set "OLD_GRADLE_USER_HOME=%GRADLE_USER_HOME%"
set "GRADLE_USER_HOME=%CD%\mobile\.gradle-user-home"
pushd "mobile" >nul
call "gradlew.bat" --stop >nul 2>&1
popd >nul
set "GRADLE_USER_HOME=%OLD_GRADLE_USER_HOME%"
exit /b 0

:ParseArgs
if "%~1"=="" exit /b 0
if /I "%~1"=="--deep-clean" set "DEEP_CLEAN=1"
if /I "%~1"=="--no-pause" set "NO_PAUSE=1"
shift
goto :ParseArgs

:StopCoreGradle
if not exist "backend-core\gradlew.bat" exit /b 0
pushd "backend-core" >nul
call "gradlew.bat" --stop >nul 2>&1
popd >nul

set "OLD_GRADLE_USER_HOME=%GRADLE_USER_HOME%"
set "GRADLE_USER_HOME=C:\Users\Public\Documents\ESTsoft\CreatorTemp\whiteboard-capture-core-gradle"
pushd "backend-core" >nul
call "gradlew.bat" --stop >nul 2>&1
popd >nul
set "GRADLE_USER_HOME=%OLD_GRADLE_USER_HOME%"
exit /b 0

:RemoveDirIfExists
if exist "%~1" (
    echo   Removing %~1...
    rmdir /s /q "%~1"
)
exit /b 0
