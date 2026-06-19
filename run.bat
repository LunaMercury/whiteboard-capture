@echo off
setlocal EnableExtensions EnableDelayedExpansion
cd /d "%~dp0"

echo ==========================================
echo Starting Whiteboard Capture Services...
echo ==========================================

if exist ".env" (
    echo Loading environment from .env...
    for /f "usebackq tokens=* delims=" %%A in (".env") do (
        set "line=%%A"
        if defined line if not "!line:~0,1!"=="#" (
            for /f "tokens=1,* delims==" %%K in ("!line!") do (
                if not "%%K"=="" set "%%K=%%L"
            )
        )
    )
)

if not defined VITE_API_BASE_URL if defined VITE_API_CORE_URL set "VITE_API_BASE_URL=!VITE_API_CORE_URL!"
if not defined VITE_REALTIME_WS_URL if defined VITE_WS_FAST_URL set "VITE_REALTIME_WS_URL=!VITE_WS_FAST_URL!"
if not defined ALLOWED_WEB_ORIGINS set "ALLOWED_WEB_ORIGINS=http://localhost:5173"
if not defined UPLOAD_DIR set "UPLOAD_DIR=%CD%\uploads"

:: For local testing, force every service to use ports that are not commonly reserved by Windows.
set "FAST_PORT=18081"
set "FAST_BIND_ADDR=0.0.0.0:%FAST_PORT%"
set "PUBLIC_BASE_URL=http://localhost:%FAST_PORT%"
set "VITE_API_BASE_URL=http://localhost:18080"
set "VITE_FAST_API_BASE_URL=http://localhost:%FAST_PORT%"
set "VITE_REALTIME_WS_URL=ws://localhost:%FAST_PORT%/ws"
set "SPRING_DATASOURCE_URL=jdbc:postgresql://localhost:5433/whiteboard_db"
set "SPRING_DATASOURCE_USERNAME=postgres"
set "SPRING_DATASOURCE_PASSWORD=postgres"
set "DATABASE_URL=postgres://postgres:postgres@localhost:5433/whiteboard_db"

:: Keep local boot simple even when .env does not contain a real secret yet.
if not defined JWT_SECRET_KEY set "JWT_SECRET_KEY=local_test_secret_key_12345678901234567890"

if not defined NAVER_CLIENT_ID echo [WARN] NAVER_CLIENT_ID is not set. Naver login will be unavailable.
if not defined NAVER_CLIENT_SECRET echo [WARN] NAVER_CLIENT_SECRET is not set. Naver login will be unavailable.
if not defined NAVER_REDIRECT_URI echo [WARN] NAVER_REDIRECT_URI is not set. Naver login will be unavailable.

:: Clear previous service windows first so repeated run.bat calls do not pile up processes and ports.
echo [0/4] Stopping old service windows...
taskkill /FI "WINDOWTITLE eq WB-Core" /T /F >nul 2>&1
taskkill /FI "WINDOWTITLE eq WB-Fast" /T /F >nul 2>&1
taskkill /FI "WINDOWTITLE eq WB-Web" /T /F >nul 2>&1

echo [1/4] Starting Database (Docker)...
docker compose up -d
if errorlevel 1 goto :fail

echo Waiting for PostgreSQL to accept connections...
set "DB_READY="
for /L %%I in (1,1,20) do (
    docker exec whiteboard-postgres pg_isready -U postgres -d whiteboard_db >nul 2>&1
    if not errorlevel 1 (
        set "DB_READY=1"
        goto :db_ready
    )
    timeout /t 1 >nul
)

:db_ready
if not defined DB_READY (
    echo PostgreSQL did not become ready in time.
    goto :fail
)

echo [2/4] Starting Backend Core (Spring Boot)...
start "WB-Core" cmd /k "cd /d backend-core && .\gradlew.bat bootRun"

echo [3/4] Starting Backend Fast (Rust)...
start "WB-Fast" cmd /k "cd /d backend-fast && cargo run"

echo [4/4] Starting Frontend (Web)...
start "WB-Web" cmd /k "cd /d web && npm run dev"

echo.
echo ==========================================
echo All services are starting in separate windows.
echo Core API:    http://localhost:18080
echo Fast API:    http://localhost:%FAST_PORT%
echo Web App:     http://localhost:5173
echo Uploads:     %UPLOAD_DIR%
echo ==========================================
pause
exit /b 0

:fail
echo.
echo ==========================================
echo Failed to start one or more services.
echo Check Docker Desktop and the service windows for details.
echo ==========================================
pause
exit /b 1
