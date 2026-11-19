param(
    [switch]$Install,
    [switch]$Background
)

# Keep this file ASCII-only: Windows PowerShell 5.1 reads BOM-less UTF-8 as ANSI.
# NODE_OPTIONS is cleared because an injected --require shim makes Node crash
# (0xC0000005) on this machine when loading real module graphs.
$ErrorActionPreference = 'Stop'
$env:NODE_OPTIONS = ''

$root = Split-Path $PSScriptRoot -Parent
$frontend = Join-Path $root 'frontend'

if (-not (Test-Path -LiteralPath (Join-Path $frontend 'package.json'))) {
    throw 'frontend/package.json not found.'
}

# Prefer the project-local Node 20: the system Node 22 install crashes when loading
# node_modules on this machine.
$node20 = Join-Path $root '.tools\node20'
if (Test-Path -LiteralPath (Join-Path $node20 'node.exe')) {
    $env:PATH = $node20 + ';' + $env:PATH
    Write-Host '[node] using project-local Node 20'
} else {
    Write-Host '[node] using system Node'
}

Push-Location -LiteralPath $frontend
try {
    if ($Install -or -not (Test-Path -LiteralPath (Join-Path $frontend 'node_modules'))) {
        Write-Host '[npm] installing dependencies (postinstall scripts skipped)'
        & npm install --ignore-scripts --no-fund --no-audit
        if ($LASTEXITCODE -ne 0) {
            Write-Host '[npm] retry with npmmirror registry'
            & npm install --ignore-scripts --no-fund --no-audit --registry=https://registry.npmmirror.com
            if ($LASTEXITCODE -ne 0) { throw 'npm install failed' }
        }
    }

    Write-Host '[dev] starting Vite on http://localhost:5173'
    if ($Background) {
        $log = Join-Path $root '.tools\frontend.log'
        $cmdLine = '/c set NODE_OPTIONS= && cd /d "' + $frontend + '" && npm run dev > "' + $log + '" 2>&1'
        Start-Process -FilePath 'cmd.exe' -ArgumentList $cmdLine -WindowStyle Hidden
        Write-Host '[dev] started in background, log: .tools\frontend.log'
    } else {
        & npm run dev
    }
} finally {
    Pop-Location
}
