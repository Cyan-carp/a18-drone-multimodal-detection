@echo off
rem Double-click entry: starts the Spring Boot backend on http://localhost:8080
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\start-backend.ps1" %*
if errorlevel 1 pause
