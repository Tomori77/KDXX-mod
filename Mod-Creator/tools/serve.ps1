param(
  [int]$Port = 8765,
  [switch]$NoBrowser
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot

$py = $null
if (Get-Command py -ErrorAction SilentlyContinue) {
  $py = @('py', '-3')
} elseif (Get-Command python -ErrorAction SilentlyContinue) {
  $py = @('python')
}

if (-not $py) {
  Write-Host '[错误] 未找到 Python 3。' -ForegroundColor Red
  Write-Host '请安装 Python 3 并加入 PATH，或改用其它静态服务器打开 index.html。'
  Write-Host "示例: python -m http.server $Port"
  exit 1
}

$url = "http://127.0.0.1:$Port/index.html"
Write-Host '============================================================'
Write-Host '  口袋修仙 Mod 制作器 - 本地服务器 (PowerShell)'
Write-Host '------------------------------------------------------------'
Write-Host "  目录: $root"
Write-Host "  端口: $Port"
Write-Host "  地址: $url"
Write-Host ''
Write-Host '  按 Ctrl+C 停止服务器。'
Write-Host '============================================================'

if (-not $NoBrowser) {
  Start-Job -ScriptBlock {
    param($u)
    Start-Sleep -Seconds 2
    Start-Process $u
  } -ArgumentList $url | Out-Null
}

Set-Location -LiteralPath $root
$exe = $py[0]
$args = @()
if ($py.Count -gt 1) { $args += $py[1] }
$args += @('-m', 'http.server', "$Port", '--bind', '127.0.0.1')
& $exe @args
