@echo off
setlocal EnableExtensions EnableDelayedExpansion
cd /d "%~dp0"

set "NO_PAUSE="
call :ParseArgs %*

echo ==========================================
echo Stopping Whiteboard Capture Services...
echo ==========================================

echo [1/4] Closing service windows...
call :KillWindow "WB-Core"
call :KillWindow "WB-Fast"
call :KillWindow "WB-Web"

echo [2/4] Releasing local service ports...
call :StopPort "Core API" 18080
call :StopPort "Fast API" 18081
call :StopPort "Web App" 5173

echo [3/4] Stopping Gradle daemons used by local services...
call :StopCoreGradle
call :StopMobileGradle

echo [4/4] Stopping Database (Docker)...
docker compose down >nul 2>&1
if errorlevel 1 (
    echo [WARN] Docker compose shutdown was skipped or failed. Docker Desktop may already be stopped.
)

echo.
echo ==========================================
echo Whiteboard Capture services have been stopped.
echo ==========================================
if not defined NO_PAUSE pause
exit /b 0

:KillWindow
taskkill /FI "WINDOWTITLE eq %~1" /T /F >nul 2>&1
exit /b 0

:ParseArgs
if "%~1"=="" exit /b 0
if /I "%~1"=="--no-pause" set "NO_PAUSE=1"
shift
goto :ParseArgs

:StopPort
set "PORT_NAME=%~1"
set "PORT_NUMBER=%~2"
for /f "tokens=5" %%P in ('netstat -ano ^| findstr /R /C:":%PORT_NUMBER% .*LISTENING"') do (
    if not "%%P"=="0" (
        echo   Stopping %PORT_NAME% process on port %PORT_NUMBER% ^(PID %%P^)...
        taskkill /PID %%P /T /F >nul 2>&1
    )
)
exit /b 0

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
