@echo off
rem Build helper. Uses the project-local JDK 17 and Maven, writing full output to
rem .tools\build.log because console output is unreliable from some launchers.
setlocal
for %%I in ("%~dp0..") do set "ROOT=%%~fI"
set "MVN=%ROOT%\.tools\apache-maven-3.9.9\bin\mvn.cmd"
if not exist "%ROOT%\.tools" mkdir "%ROOT%\.tools"
if exist "%ROOT%\.tools\jdk17\bin\javac.exe" (
  set "JAVA_HOME=%ROOT%\.tools\jdk17"
) else (
  echo WARN: .tools\jdk17 missing, falling back to system JAVA_HOME/PATH
)
if not exist "%MVN%" (
  echo MAVEN_MISSING "%MVN%"
  exit /b 2
)
call "%MVN%" -s "%ROOT%\.tools\settings.xml" -f "%ROOT%\pom.xml" -B %* > "%ROOT%\.tools\build.log" 2>&1
set "CODE=%ERRORLEVEL%"
echo BUILD_EXIT=%CODE%
exit /b %CODE%
