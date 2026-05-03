@echo off
echo ==========================================
echo Stopping Whiteboard Capture Services...
echo ==========================================

:: 1. Database (Docker)
echo [1/2] Stopping Database (Docker)...
docker compose down

:: 2. Terminating Service Windows
:: This targets windows with the specific titles we set in run.bat
echo [2/2] Terminating WB-Core, WB-Fast, and WB-Web windows...
taskkill /FI "WINDOWTITLE eq WB-Core" /T /F >nul 2>&1
taskkill /FI "WINDOWTITLE eq WB-Fast" /T /F >nul 2>&1
taskkill /FI "WINDOWTITLE eq WB-Web" /T /F >nul 2>&1

echo.
echo ==========================================
echo All services stopped successfully.
echo ==========================================
pause
