param(
  [string]$HostName = "localhost",
  [int]$Port = 3000,
  [string]$JMeterExecutable = "jmeter"
)

$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $PSScriptRoot
$testPlan = Join-Path $projectRoot "tests/load/mesa-ayuda.jmx"
$evidenceDir = Join-Path $projectRoot "docs/evidencias/carga"

if (-not (Test-Path -LiteralPath $testPlan -PathType Leaf)) {
  throw "No se encontro el plan JMeter: $testPlan"
}

if (-not $env:ACCESS_TOKEN) {
  throw "Defina ACCESS_TOKEN con un JWT valido antes de ejecutar la carga."
}

if (-not (Get-Command $JMeterExecutable -ErrorAction SilentlyContinue)) {
  throw "JMeter 5.6.3 no esta disponible en la ruta indicada. Consulte docs/PRUEBAS.md."
}

New-Item -ItemType Directory -Force -Path $evidenceDir | Out-Null
$runDir = Join-Path $evidenceDir ("run-" + (Get-Date -Format "yyyyMMdd-HHmmss"))
if (Test-Path -LiteralPath $runDir) { throw "La carpeta de esta corrida ya existe: $runDir" }
New-Item -ItemType Directory -Path $runDir | Out-Null
$results = Join-Path $runDir "results.jtl"
$htmlReport = Join-Path $runDir "html"

$jmeterArgs = @('-n', '-t', $testPlan, "-Jhost=$HostName", "-Jport=$Port", '-l', $results, '-e', '-o', $htmlReport)
& $JMeterExecutable @jmeterArgs
if ($LASTEXITCODE -ne 0) { throw "JMeter termino con codigo $LASTEXITCODE" }
if (-not (Test-Path -LiteralPath $results -PathType Leaf)) {
  throw "JMeter no genero el archivo de resultados: $results"
}

$samples = @(Import-Csv -LiteralPath $results)
$failures = @($samples | Where-Object { $_.success -ne 'true' })
$non200 = @($samples | Where-Object { $_.responseCode -ne '200' })
Write-Host "Muestras: $($samples.Count); errores: $($failures.Count)"
if ($samples.Count -ne 600) { throw "Se esperaban 600 muestras y se obtuvieron $($samples.Count)." }
if (($failures.Count / $samples.Count) -ge 0.01) { throw "La tasa de errores supera el umbral de 1 %." }
if ($non200.Count -gt 0) { throw "Se esperaban solo respuestas HTTP 200 y hubo $($non200.Count) distintas." }

$statisticsPath = Join-Path $htmlReport "statistics.json"
$indexPath = Join-Path $htmlReport "index.html"
if (-not (Test-Path -LiteralPath $statisticsPath -PathType Leaf) -or -not (Test-Path -LiteralPath $indexPath -PathType Leaf)) {
  throw "JMeter no genero el reporte HTML completo."
}
$total = (Get-Content -Raw -LiteralPath $statisticsPath | ConvertFrom-Json).Total
if (-not $total -or [int]$total.sampleCount -ne 600) {
  throw "El reporte HTML no coincide con las 600 muestras esperadas."
}
$p95 = [double]::Parse([string]$total.pct2ResTime, [System.Globalization.CultureInfo]::InvariantCulture)
if ($p95 -ge 500) { throw "El p95 de $p95 ms supera el umbral local de 500 ms." }

Write-Host "Resultados JTL: $results"
Write-Host "p95: $p95 ms; throughput: $($total.throughput) req/s"
Write-Host "Reporte HTML: $indexPath"
