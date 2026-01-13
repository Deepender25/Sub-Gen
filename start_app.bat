@echo off
echo Starting Cinescript AI...

:: Start Backend
echo Starting Backend Server on port 5000...
start "Backend Server" cmd /k "call venv\Scripts\activate && python app.py"

:: Wait a few seconds for backend to initialize
timeout /t 5 /nobreak >nul

:: Start Frontend
echo Starting Frontend Client...
cd frontend
start "Frontend Client" cmd /k "npm run dev"

echo Both services are starting up!
echo Backend logs are in the "Backend Server" window.
echo Frontend logs are in the "Frontend Client" window.
pause
