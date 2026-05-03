@echo off
echo ==========================================
echo Force Cleaning up Mobile Development Environment...
echo ==========================================

echo 1. Killing all Java/Gradle processes immediately...
taskkill /f /im java.exe /t 2>nul
taskkill /f /im gradle.exe /t 2>nul

echo 2. Removing Gradle lock files...
del /s /q /f "%USERPROFILE%\.gradle\caches\*.lock" 2>nul
del /s /q /f "%USERPROFILE%\.gradle\daemon\*.lock" 2>nul

echo ==========================================
echo Cleanup Complete! All zombie processes terminated.
echo ==========================================
pause
