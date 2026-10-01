# verify.ps1: gate for Mod-Creator — generated freshness, ES module syntax, entry wiring (exit 0 pass / 1 fail).
$ErrorActionPreference = 'Stop'
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = Split-Path -Parent $scriptDir
$failures = New-Object System.Collections.Generic.List[string]
$passes = New-Object System.Collections.Generic.List[string]

function Write-Report {
  Write-Host ''
  Write-Host '===== Mod-Creator verify =====' -ForegroundColor Cyan
  foreach ($line in $passes) { Write-Host ('  [PASS] ' + $line) -ForegroundColor Green }
  foreach ($line in $failures) { Write-Host ('  [FAIL] ' + $line) -ForegroundColor Red }
  Write-Host ''
  if ($failures.Count -eq 0) {
    Write-Host 'RESULT: PASS' -ForegroundColor Green
  } else {
    Write-Host ('RESULT: FAIL (' + $failures.Count + ' problem(s))') -ForegroundColor Red
  }
}

# (a) VERSION.js freshness against SDK manifest.
try {
  $versionFile = Join-Path $repoRoot 'src\generated\VERSION.js'
  $sdkManifestPath = Join-Path (Split-Path -Parent $repoRoot) 'docs\Reference\ModSDK-0.1.12\sdk-manifest.json'
  if (-not (Test-Path -LiteralPath $versionFile)) {
    $failures.Add('(a) missing src/generated/VERSION.js')
  } elseif (-not (Test-Path -LiteralPath $sdkManifestPath)) {
    $failures.Add('(a) missing SDK manifest: ' + $sdkManifestPath)
  } else {
    $versionText = Get-Content -LiteralPath $versionFile -Raw
    $match = [regex]::Match($versionText, '"sdkVersion"\s*:\s*"([^"]+)"')
    $sdkManifest = Get-Content -LiteralPath $sdkManifestPath -Raw | ConvertFrom-Json
    $expected = $sdkManifest.releaseVersion
    if (-not $match.Success) {
      $failures.Add('(a) VERSION.js has no parseable sdkVersion')
    } elseif ($match.Groups[1].Value -ne $expected) {
      $failures.Add('(a) VERSION.js sdkVersion ' + $match.Groups[1].Value + ' != SDK ' + $expected)
    } else {
      $passes.Add('(a) VERSION.js sdkVersion ' + $expected + ' matches SDK manifest')
    }
  }
} catch {
  $failures.Add('(a) error: ' + $_.Exception.Message)
}

# (b) node --check on every src/**/*.js
try {
  $node = Get-Command node -ErrorAction SilentlyContinue
  if (-not $node) {
    $failures.Add('(b) node not found on PATH')
  } else {
    $srcRoot = Join-Path $repoRoot 'src'
    $jsFiles = @()
    if (Test-Path -LiteralPath $srcRoot) {
      $jsFiles = @(Get-ChildItem -LiteralPath $srcRoot -Recurse -File -Filter '*.js')
    }
    if ($jsFiles.Count -eq 0) {
      $failures.Add('(b) no src/**/*.js files found')
    }
    $bad = New-Object System.Collections.Generic.List[string]
    foreach ($file in $jsFiles) {
      & node --check $file.FullName 2>&1 | Out-Null
      if ($LASTEXITCODE -ne 0) { $bad.Add($file.FullName) }
    }
    if ($bad.Count -gt 0) {
      foreach ($b in $bad) { $failures.Add('(b) node --check failed: ' + $b) }
    } else {
      $passes.Add('(b) node --check passed for ' + $jsFiles.Count + ' file(s)')
    }
  }
} catch {
  $failures.Add('(b) error: ' + $_.Exception.Message)
}

# (c) index.html exists and references src/app/main.js
try {
  $indexFile = Join-Path $repoRoot 'index.html'
  if (-not (Test-Path -LiteralPath $indexFile)) {
    $failures.Add('(c) missing index.html')
  } else {
    $html = Get-Content -LiteralPath $indexFile -Raw
    if ($html -notmatch 'src/app/main\.js') {
      $failures.Add('(c) index.html does not reference src/app/main.js')
    } else {
      $passes.Add('(c) index.html references src/app/main.js')
    }
  }
} catch {
  $failures.Add('(c) error: ' + $_.Exception.Message)
}

Write-Report
if ($failures.Count -eq 0) { exit 0 } else { exit 1 }
