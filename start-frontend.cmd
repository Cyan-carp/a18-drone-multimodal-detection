@echo off
rem Double-click entry: starts the Vite dev server on http://localhost:5173
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\start-frontend.ps1" %*
if errorlevel 1 pause
