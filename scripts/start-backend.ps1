param(
    [switch]$Rebuild,
    [switch]$Background
)

# Keep this file ASCII-only: Windows PowerShell 5.1 reads BOM-less UTF-8 as ANSI.
$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$tools = Join-Path $root '.tools'
[void][System.IO.Directory]::CreateDirectory($tools)

function Get-Zip([string]$url, [string]$zip) {
    if (Test-Path -LiteralPath $zip) { return }
    Write-Host "[download] $url"
    & curl.exe -L --fail --silent --show-error --max-time 900 -o $zip $url
    if ($LASTEXITCODE -ne 0) { throw "download failed: $url" }
}

function Expand-Zip([string]$zip, [string]$target) {
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $tmp = Join-Path $tools 'unzip_tmp'
    if (Test-Path -LiteralPath $tmp) { [System.IO.Directory]::Delete($tmp, $true) }
    [void][System.IO.Directory]::CreateDirectory($tmp)
    [System.IO.Compression.ZipFile]::ExtractToDirectory($zip, $tmp)
    $inner = Get-ChildItem -LiteralPath $tmp -Directory | Select-Object -First 1
    if (Test-Path -LiteralPath $target) { [System.IO.Directory]::Delete($target, $true) }
    [System.IO.Directory]::Move($inner.FullName, $target)
    [System.IO.Directory]::Delete($tmp, $true)
}

# 1. portable JDK 17 (the machine may only have a broken javapath shim)
$jdk = Join-Path $tools 'jdk17'
$java = Join-Path $jdk 'bin\java.exe'
if (-not (Test-Path -LiteralPath $java)) {
    Write-Host '[jdk] portable JDK 17 not found, bootstrapping'
    $zip = Join-Path $tools 'jdk17.zip'
    Get-Zip 'https://mirrors.huaweicloud.com/openjdk/17.0.2/openjdk-17.0.2_windows-x64_bin.zip' $zip
    Expand-Zip $zip $jdk
    Write-Host '[jdk] ready'
}

# 2. Maven
$mvnHome = Join-Path $tools 'apache-maven-3.9.9'
$mvn = Join-Path $mvnHome 'bin\mvn.cmd'
if (-not (Test-Path -LiteralPath $mvn)) {
    Write-Host '[maven] not found, bootstrapping'
    $zip = Join-Path $tools 'maven.zip'
    Get-Zip 'https://mirrors.huaweicloud.com/apache/maven/maven-3/3.9.9/binaries/apache-maven-3.9.9-bin.zip' $zip
    Expand-Zip $zip $mvnHome
    Write-Host '[maven] ready'
}

# 3. mirror settings
$settings = Join-Path $tools 'settings.xml'
if (-not (Test-Path -LiteralPath $settings)) {
    $xml = @'
<?xml version="1.0" encoding="UTF-8"?>
<settings>
  <mirrors>
    <mirror>
      <id>aliyun-public</id>
      <url>https://maven.aliyun.com/repository/public</url>
      <mirrorOf>central</mirrorOf>
    </mirror>
  </mirrors>
</settings>
'@
    [System.IO.File]::WriteAllText($settings, $xml, (New-Object System.Text.UTF8Encoding($false)))
}

# 4. stop any listener on 8080 before building: Windows locks the running jar
$listener = Get-NetTCPConnection -LocalPort 8080 -State Listen -ErrorAction SilentlyContinue
if ($listener) {
    Write-Host ("[run] stopping previous process on 8080 (pid " + $listener.OwningProcess + ")")
    Stop-Process -Id $listener.OwningProcess -Force -ErrorAction SilentlyContinue
    Start-Sleep -Milliseconds 800
}

# 5. build if needed
$env:JAVA_HOME = $jdk
$jar = Join-Path $root 'target\traffic-detection-1.0-SNAPSHOT.jar'
if ($Rebuild -or -not (Test-Path -LiteralPath $jar)) {
    Write-Host '[build] mvn package (first run downloads dependencies)'
    & $mvn -s $settings -f (Join-Path $root 'pom.xml') -B -DskipTests package
    if ($LASTEXITCODE -ne 0) { throw 'maven build failed, see output above' }
}

$log = Join-Path $tools 'backend.log'
$javaArgs = @('-Dfile.encoding=UTF-8', '-Djava.awt.headless=true', '-jar', $jar)
Write-Host '[run] starting backend on http://localhost:8080'
if ($Background) {
    # cmd is used because Start-Process -WorkingDirectory / -RedirectStandardOutput
    # mis-parses paths containing square brackets (e.g. the "[A18]" folder name).
    $cmdLine = '/c cd /d "' + $root + '" && "' + $java + '" -Dfile.encoding=UTF-8 ' +
               '-Djava.awt.headless=true -jar "' + $jar + '" > "' + $log + '" 2>&1'
    Start-Process -FilePath 'cmd.exe' -ArgumentList $cmdLine -WindowStyle Hidden
    Write-Host '[run] started in background, log: .tools\backend.log'
} else {
    Push-Location $root
    & $java @javaArgs 2>&1 | Tee-Object -FilePath $log
    Pop-Location
}
