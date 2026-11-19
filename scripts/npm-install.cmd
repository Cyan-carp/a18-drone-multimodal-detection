@echo off
rem Installs frontend dependencies.
rem  - NODE_OPTIONS cleared: an injected --require shim crashes Node on this machine.
rem  - --ignore-scripts: esbuild's postinstall crashes; the platform binary package is
rem    installed normally, so Vite still works.
rem  - Uses the project-local Node 20 when present (system Node 22 is broken here).
setlocal
set "NODE_OPTIONS="
for %%I in ("%~dp0..") do set "ROOT=%%~fI"
set "NODEDIR=%ROOT%\.tools\node20"
if exist "%NODEDIR%\node.exe" set "PATH=%NODEDIR%;%PATH%"
cd /d "%ROOT%\frontend"
if not exist "%ROOT%\.tools" mkdir "%ROOT%\.tools"
call npm install --ignore-scripts --no-fund --no-audit > "%ROOT%\.tools\npm-install.log" 2>&1
set "CODE=%ERRORLEVEL%"
if not "%CODE%"=="0" (
  echo FIRST_ATTEMPT_FAILED, retrying with npmmirror
  call npm install --ignore-scripts --no-fund --no-audit --registry=https://registry.npmmirror.com >> "%ROOT%\.tools\npm-install.log" 2>&1
  set "CODE=%ERRORLEVEL%"
)
echo NPM_EXIT=%CODE%
exit /b %CODE%
