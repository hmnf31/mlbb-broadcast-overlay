@echo off
setlocal
cd /d "%~dp0"

echo MLBB Broadcast Engine - Local Server

echo.
where python >nul 2>nul
if errorlevel 1 (
  echo Python was not found. Install Python 3 and add it to PATH.
  pause
  exit /b 1
)

python -c "import websockets" >nul 2>nul
if errorlevel 1 (
  echo Installing project dependencies...
  python -m pip install -r requirements.txt
  if errorlevel 1 (
    echo Dependency installation failed.
    pause
    exit /b 1
  )
)

echo Open the HTTP port printed below in OBS or TikTok Live Studio.
echo Press Ctrl+C to stop the server.
echo.
python -m backend.main --host 0.0.0.0 --http-port 8002 --ws-port 8768

echo.
echo The local server has stopped.
pause
endlocal
