param(
    [string]$Base = 'http://localhost:8080',
    [string]$OutFile = ''
)

# NOTE: keep this file ASCII-only. Windows PowerShell 5.1 reads BOM-less UTF-8
# as ANSI, which corrupts non-ASCII literals and breaks parsing.

$ErrorActionPreference = 'Stop'
$lines = New-Object System.Collections.Generic.List[string]
function Say([string]$text) {
    $lines.Add($text)
    Write-Host $text
}
function Fail([string]$text) {
    Say ("FAIL " + $text)
    if ($OutFile) { $lines -join "`r`n" | Set-Content -LiteralPath $OutFile -Encoding UTF8 }
    exit 1
}

Say ("== smoke test " + (Get-Date -Format 'yyyy-MM-dd HH:mm:ss') + " base=" + $Base)

# 1. system info
$info = Invoke-RestMethod -Uri "$Base/api/system/info" -TimeoutSec 10
if ($info.mode -ne 'MOCK') { Fail 'system/info did not report MOCK mode' }
Say ("PASS system/info mode=" + $info.mode + " jdk=" + $info.jdk + " scenarios=" + $info.scenarioCount)

# 2. scenario list
$scenarioRaw = Invoke-RestMethod -Uri "$Base/api/scenarios" -TimeoutSec 10
$scenarioList = @($scenarioRaw | ForEach-Object { $_ })
if ($scenarioList.Count -lt 1) { Fail 'scenario list is empty' }
$first = $scenarioList[0]
Say ("PASS scenarios count=" + $scenarioList.Count + " first=" + $first.id + " objects=" + $first.objectCount)

# 3. scenario detail carries ground truth
$detail = Invoke-RestMethod -Uri "$Base/api/scenarios/$($first.id)" -TimeoutSec 10
if (@($detail.objects).Count -lt 1) { Fail 'scenario detail has no ground truth' }
Say ("PASS scenario-detail objects=" + @($detail.objects).Count)

# 4. scenario image readable
$img = Invoke-WebRequest -Uri "$Base/api/scenarios/$($first.id)/image?modality=rgb" -UseBasicParsing -TimeoutSec 10
if ($img.RawContentLength -lt 1000) { Fail 'scenario image too small' }
Say ("PASS scenario-image bytes=" + $img.RawContentLength)

# 5. create run
$body = @{ sourceType = 'scenario'; sourceId = $first.id; params = @{ conf = 0.1; iou = 0.58; imgsz = 1024 } } | ConvertTo-Json -Depth 5
$run = Invoke-RestMethod -Uri "$Base/api/runs" -Method Post -Body $body -ContentType 'application/json' -TimeoutSec 10
Say ("PASS run-created " + $run.runId + " status=" + $run.status)

# 6. poll until terminal
$final = $null
for ($i = 0; $i -lt 60; $i++) {
    Start-Sleep -Milliseconds 300
    $cur = Invoke-RestMethod -Uri "$Base/api/runs/$($run.runId)" -TimeoutSec 10
    if ($cur.status -eq 'SUCCESS' -or $cur.status -eq 'FAILED') { $final = $cur; break }
}
if ($null -eq $final) { Fail 'run did not finish within 18s' }
if ($final.status -ne 'SUCCESS') { Fail ("run failed: " + $final.error) }
if (@($final.fused).Count -lt 1) { Fail 'fused detections empty' }
if ($null -eq $final.metrics) { Fail 'scenario run is missing metrics' }
Say ("PASS run-success fused=" + @($final.fused).Count + " elapsedMs=" + $final.elapsedMs +
     " precision=" + $final.metrics.precision + " recall=" + $final.metrics.recall)

# 7. branch structure
if (@($final.branches.dual.models).Count -ne 3) { Fail 'dual branch must contain 3 sub models' }
Say ("PASS branches rgb=" + @($final.branches.rgb.detections).Count +
     " ir=" + @($final.branches.ir.detections).Count +
     " dual=" + @($final.branches.dual.detections).Count +
     " models=" + @($final.branches.dual.models).Count)

# 8. CSV export: BOM, 10 columns, non-ASCII payload survives UTF-8
$csvPath = Join-Path $env:TEMP ("smoke_" + $run.runId + ".csv")
Invoke-WebRequest -Uri "$Base/api/runs/$($run.runId)/export?format=csv" -OutFile $csvPath -UseBasicParsing -TimeoutSec 10
$bytes = [System.IO.File]::ReadAllBytes($csvPath)
if ($bytes.Length -lt 32) { Fail 'csv too small' }
if (-not ($bytes[0] -eq 0xEF -and $bytes[1] -eq 0xBB -and $bytes[2] -eq 0xBF)) { Fail 'csv is missing UTF-8 BOM' }
$text = [System.Text.Encoding]::UTF8.GetString($bytes)
$firstLine = ($text -split "`r`n")[0].TrimStart([char]0xFEFF)
$columns = ($firstLine -split ',').Count
if ($columns -ne 10) { Fail ("csv header column count = " + $columns + ", expected 10") }
$hasNonAscii = $false
foreach ($b in $bytes) { if ($b -gt 0x7F) { $hasNonAscii = $true; break } }
if (-not $hasNonAscii) { Fail 'csv looks ASCII-only, Chinese scene name may be lost' }
[System.IO.File]::Delete($csvPath)
Say ("PASS export-csv bytes=" + $bytes.Length + " columns=" + $columns)

# 9. logs
$logs = @((Invoke-RestMethod -Uri "$Base/api/logs?limit=50" -TimeoutSec 10) | ForEach-Object { $_ })
if ($logs.Count -lt 1) { Fail 'log buffer is empty' }
Say ("PASS logs count=" + $logs.Count + " last scope=" + $logs[$logs.Count - 1].scope)

# 10. batch
$ids = @($scenarioList[0].id, $scenarioList[1].id, $scenarioList[2].id)
$batchBody = @{ scenarioIds = $ids; params = @{ conf = 0.1; iou = 0.58; imgsz = 1024 } } | ConvertTo-Json -Depth 5
$batch = Invoke-RestMethod -Uri "$Base/api/batches" -Method Post -Body $batchBody -ContentType 'application/json' -TimeoutSec 10
for ($i = 0; $i -lt 80; $i++) {
    Start-Sleep -Milliseconds 400
    $batch = Invoke-RestMethod -Uri "$Base/api/batches/$($batch.batchId)" -TimeoutSec 10
    if ($batch.status -ne 'RUNNING') { break }
}
if ($batch.status -eq 'RUNNING') { Fail 'batch did not finish within 32s' }
Say ("PASS batch " + $batch.batchId + " status=" + $batch.status + " completed=" + $batch.completed + "/" + $batch.total)

# 11. list + delete
$list = Invoke-RestMethod -Uri "$Base/api/runs?page=1&size=5" -TimeoutSec 10
if ($list.total -lt 1) { Fail 'run list is empty after creating runs' }
Invoke-RestMethod -Uri "$Base/api/runs/$($run.runId)" -Method Delete -TimeoutSec 10
Say ("PASS run-list total=" + $list.total + " and run-delete")

Say 'SMOKE_RESULT=PASS'
if ($OutFile) { $lines -join "`r`n" | Set-Content -LiteralPath $OutFile -Encoding UTF8 }
