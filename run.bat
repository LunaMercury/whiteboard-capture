@echo off
echo ==========================================
echo Starting Whiteboard Capture Services...
echo ==========================================

:: 1. Database (Docker)
echo [1/4] Starting Database (Docker)...
docker compose up -d

:: 2. Backend Core (Spring Boot)
echo [2/4] Starting Backend Core (Spring Boot)...
start "WB-Core" cmd /k "cd backend-core && .\gradlew.bat bootRun"

:: 3. Backend Fast (Rust)
echo [3/4] Starting Backend Fast (Rust)...
start "WB-Fast" cmd /k "cd backend-fast && cargo run"

:: 4. Frontend (Web)
echo [4/4] Starting Frontend (Web)...
start "WB-Web" cmd /k "cd web && npm run dev"

echo.
echo ==========================================
echo All services are starting in separate windows.
echo Please check each window for status.
echo ==========================================
pause
