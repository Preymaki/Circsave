@echo off
echo ========================================
echo CircSave Backend - Cron Jobs Startup
echo ========================================
echo.

REM Check if .env exists
if not exist .env (
    echo [WARNING] .env file not found!
    echo Creating .env from .env.example...
    copy .env.example .env
    echo.
    echo [INFO] Please edit .env file with your MongoDB URI if needed.
    echo.
    pause
)

echo [INFO] Starting CircSave server with cron jobs...
echo.
echo Expected output:
echo   - Cron jobs initialized successfully
echo   - Contribution auto-debit: Every hour
echo   - Automated payouts: Every 6 hours
echo.

npm start
