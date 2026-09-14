@echo off
title Technyks Academy - Restart Local Project
cd /d "%~dp0"
echo ============================================================
echo  Stopping the old API and website processes...
echo ============================================================
echo.
taskkill /F /IM node.exe /T >nul 2>&1
timeout /t 2 /nobreak >nul

echo Starting the API and the website again with the fix applied...
echo.
start "Technyks API - http://localhost:4310" cmd /k "npm run start:api"
start "Technyks Website - http://localhost:4200" cmd /k "npm run start:web"

echo Two new windows just opened - one for the API, one for the website.
echo Leave BOTH of those windows open while you're using the site.
echo.
echo Wait about 20-30 seconds, then open this address in your browser:
echo.
echo     http://localhost:4200
echo.
echo You can close THIS window now - it already did its job.
pause
