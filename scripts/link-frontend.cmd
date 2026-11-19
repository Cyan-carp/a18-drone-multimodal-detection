@echo off
rem Build helper: some Node toolchains crash (0xC0000005) when the working directory is
rem this long non-ASCII path. A short junction (C:\a18fe) gives the same files a safe CWD.
setlocal
for %%I in ("%~dp0..") do set "ROOT=%%~fI"
if exist "C:\a18fe" rmdir "C:\a18fe"
mklink /J "C:\a18fe" "%ROOT%\frontend"
if errorlevel 1 exit /b 2
exit /b 0
