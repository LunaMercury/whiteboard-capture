@echo off
setlocal EnableExtensions
cd /d "%~dp0"

echo ==========================================
echo Stopping Whiteboard Capture Services...
echo ==========================================

echo [1/3] Closing service windows...
taskkill /FI "WINDOWTITLE eq WB-Core" /T /F >nul 2>&1
taskkill /FI "WINDOWTITLE eq WB-Fast" /T /F >nul 2>&1
taskkill /FI "WINDOWTITLE eq WB-Web" /T /F >nul 2>&1

echo [2/3] Stopping Gradle daemons used by local services...
if exist "backend-core\gradlew.bat" (
    call "backend-core\gradlew.bat" --stop >nul 2>&1
)
if exist "mobile\gradlew.bat" (
    call "mobile\gradlew.bat" --stop >nul 2>&1
)

echo [3/3] Stopping Database (Docker)...
docker compose down >nul 2>&1

echo.
echo ==========================================
echo Whiteboard Capture services have been stopped.
echo ==========================================
pause
