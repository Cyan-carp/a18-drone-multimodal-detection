@echo off
rem Installs Playwright's Chromium for the click-through checks.
setlocal
set "NODE_OPTIONS="
for %%I in ("%~dp0..") do set "ROOT=%%~fI"
set "PATH=%ROOT%\.tools\node20;%PATH%"
cd /d "%ROOT%\tools\e2e"
node "node_modules\playwright\cli.js" install chromium
exit /b %ERRORLEVEL%
