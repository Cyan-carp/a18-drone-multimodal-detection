@echo off
rem Runs the Vite dev server. Output goes to .tools\frontend.log.
rem NODE_OPTIONS cleared and project-local Node 20 preferred (system Node 22 is broken here).
setlocal
set "NODE_OPTIONS="
for %%I in ("%~dp0..") do set "ROOT=%%~fI"
set "NODEDIR=%ROOT%\.tools\node20"
if exist "%NODEDIR%\node.exe" set "PATH=%NODEDIR%;%PATH%"
if not exist "%ROOT%\.tools" mkdir "%ROOT%\.tools"
cd /d "%ROOT%\frontend"
if errorlevel 1 (
  echo CD_FAILED "%ROOT%\frontend"
  exit /b 2
)
echo CWD=%CD%> "%ROOT%\.tools\frontend-diag.txt"
"%NODEDIR%\node.exe" "node_modules\vite\bin\vite.js" --port 5173 --host 0.0.0.0 > "%ROOT%\.tools\frontend.log" 2>&1
exit /b %ERRORLEVEL%
