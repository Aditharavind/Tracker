@echo off
setlocal
REM Double-click this file to set up and run the 75 Hard app locally.
REM   1. Installs npm dependencies if they're missing.
REM   2. Installs the "three" package if it's missing -- @google/model-viewer
REM      needs it to build, but it isn't listed in package.json.
REM   3. Starts the API server (port 3001) and the Vite dev server (port
REM      5173), each in its own window.
REM   4. Opens the app in your default browser.
REM
REM To stop the app, close the two windows this opens (or Ctrl+C in each).

cd /d "%~dp0"

if not exist "node_modules\" (
    echo Installing dependencies -- this only happens once...
    call npm install
    if errorlevel 1 (
        echo.
        echo npm install failed. Fix the error above and run this again.
        pause
        exit /b 1
    )
)

if not exist "node_modules\three\" (
    echo Installing the "three" package required by @google/model-viewer...
    call npm install three --no-save
    if errorlevel 1 (
        echo.
        echo Failed to install "three". Fix the error above and run this again.
        pause
        exit /b 1
    )
)

start "75hard - API server (port 3001)" cmd /k "node scripts/api-server.js"
start "75hard - Vite dev server (port 5173)" cmd /k "npx vite"

echo Waiting for the dev server to come up...
timeout /t 6 /nobreak >nul
start http://localhost:5173/

echo.
echo Two windows just opened: the API server and the Vite dev server.
echo Close both of those windows (or Ctrl+C in each) to stop the app.
echo If the browser didn't open, go to http://localhost:5173/ manually.
