@echo off
title Technyks Academy - Start Local Project
cd /d "%~dp0"
echo ============================================================
echo  Technyks Academy - starting the project locally
echo ============================================================
echo.
echo Step 1 of 2: Installing/updating packages (only takes effect
echo the first time, or whenever new packages were added)...
echo.
call npx --yes pnpm install
if errorlevel 1 (
  echo.
  echo Something went wrong while installing packages.
  echo Scroll up in this window to see the error, then let Claude know.
  pause
  exit /b 1
)

echo.
echo Step 2 of 2: Starting the API and the website...
echo.
start "Technyks API - http://localhost:4310" cmd /k "npm run start:api"
start "Technyks Website - http://localhost:4200" cmd /k "npm run start:web"

echo Two new windows just opened - one for the API, one for the website.
echo Leave BOTH of those windows open while you're using the site.
echo (Closing one of them stops that part of the app.)
echo.
echo Wait about 20-30 seconds for them to finish starting, then open
echo this address in your browser:
echo.
echo     http://localhost:4200
echo.
echo You can close THIS window now - it already did its job.
pause
