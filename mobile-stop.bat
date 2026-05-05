@echo off
setlocal EnableExtensions
cd /d "%~dp0"

echo ==========================================
echo Stopping Mobile Development Helpers...
echo ==========================================

echo [1/3] Stopping mobile Gradle daemon...
if exist "mobile\gradlew.bat" (
    call "mobile\gradlew.bat" --stop >nul 2>&1
)

echo [2/3] Stopping shared Gradle daemon...
if exist "backend-core\gradlew.bat" (
    call "backend-core\gradlew.bat" --stop >nul 2>&1
)

echo [3/3] Cleaning temporary Gradle verification caches...
if exist "C:\Users\Public\Documents\ESTsoft\CreatorTemp\whiteboard-capture-mobile-gradle" (
    rmdir /s /q "C:\Users\Public\Documents\ESTsoft\CreatorTemp\whiteboard-capture-mobile-gradle"
)
if exist "C:\Users\Public\Documents\ESTsoft\CreatorTemp\whiteboard-capture-core-gradle" (
    rmdir /s /q "C:\Users\Public\Documents\ESTsoft\CreatorTemp\whiteboard-capture-core-gradle"
)

echo.
echo ==========================================
echo Mobile cleanup completed successfully.
echo ==========================================
pause
