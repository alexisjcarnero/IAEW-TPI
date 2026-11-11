param(
  [string]$HostName = "localhost",
  [int]$Port = 3000
)

$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $PSScriptRoot
$testPlan = Join-Path $projectRoot "tests/load/mesa-ayuda.jmx"
$evidenceDir = Join-Path $projectRoot "docs/evidencias/carga"
$results = Join-Path $evidenceDir "results.jtl"
$htmlReport = Join-Path $evidenceDir "html"

if (-not $env:ACCESS_TOKEN) {
  throw "Defina ACCESS_TOKEN con un JWT valido antes de ejecutar la carga."
}

if (-not (Get-Command jmeter -ErrorAction SilentlyContinue)) {
  throw "JMeter 5.6.3 no esta disponible en PATH. Consulte docs/PRUEBAS.md."
}

New-Item -ItemType Directory -Force -Path $evidenceDir | Out-Null
if (Test-Path $results) { Remove-Item -LiteralPath $results }
if (Test-Path $htmlReport) {
  $resolvedReport = (Resolve-Path -LiteralPath $htmlReport).Path
  $resolvedEvidence = (Resolve-Path -LiteralPath $evidenceDir).Path
  if (-not $resolvedReport.StartsWith($resolvedEvidence, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "Ruta de reporte fuera del directorio de evidencias."
  }
  Remove-Item -LiteralPath $htmlReport -Recurse
}

jmeter -n -t $testPlan -Jhost=$HostName -Jport=$Port -Jaccess_token=$env:ACCESS_TOKEN -l $results -e -o $htmlReport

Write-Host "Reporte HTML generado en $htmlReport/index.html"
