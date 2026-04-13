@echo off
REM Broady Auto-Startup Script for Windows Task Scheduler
REM This script resurrects PM2 processes on machine boot

cd /d "D:\WEB DEVELOPMENT\Broady"

REM Wait for system to stabilize
timeout /t 5 /nobreak

REM Resurrect PM2 processes
npx pm2 resurrect

REM Log that startup completed
echo [%date% %time%] Broady processes restored >> "%USERPROFILE%\.pm2\startup.log"

exit /b 0
