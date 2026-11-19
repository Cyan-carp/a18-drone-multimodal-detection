@echo off
rem Starts the packaged backend in the foreground with output written to .tools\backend.log
setlocal
for %%I in ("%~dp0..") do set "ROOT=%%~fI"
set "JAR=%ROOT%\target\traffic-detection-1.0-SNAPSHOT.jar"
if not exist "%JAR%" (
  echo JAR_MISSING "%JAR%"
  exit /b 2
)
set "JAVA=%ROOT%\.tools\jdk17\bin\java.exe"
if not exist "%JAVA%" set "JAVA=java"
cd /d "%ROOT%"
"%JAVA%" -Dfile.encoding=UTF-8 -Djava.awt.headless=true -jar "%JAR%" > "%ROOT%\.tools\backend.log" 2>&1
