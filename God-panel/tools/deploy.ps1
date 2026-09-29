. (Join-Path $PSScriptRoot "workspace-common.ps1")

$relaunch = Invoke-PocketPreferredShell -ScriptPath $PSCommandPath
if ($null -ne $relaunch) { exit $relaunch }

$config = Get-PocketWorkspaceConfig
$packagePath = Get-PocketPackageDirectory
$sdkPath = Resolve-PocketModSdk
$workspaceRoot = Get-PocketWorkspaceRoot
$reportPath = Join-Path $workspaceRoot "mod-validation-report.json"

& (Join-Path $sdkPath "bin/validate-mod.ps1") -ModDirectory $packagePath -ReportPath $reportPath
if ($LASTEXITCODE -ne 0) {
  throw "Mod 验证未通过，已停止部署。报告：$reportPath"
}
if (-not $env:APPDATA) { throw "APPDATA 不可用，无法确定游戏用户数据目录" }

$userDataName = if ($config.target -eq "demo") { "Pocket Cultivation Demo" } elseif ($config.target -eq "playtest") { "Pocket Cultivation Playtest" } else { "Pocket Cultivation" }
$userDataRoot = Join-Path $env:APPDATA $userDataName
$modsRoot = Join-Path $userDataRoot "mods"
$stagingRoot = Join-Path $userDataRoot "mod-staging/$($config.modId)-$PID"
$targetPath = Join-Path $modsRoot $config.modId
$backupRoot = Join-Path $userDataRoot "mod-backups"
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$backupPath = Join-Path $backupRoot "$($config.modId)-$timestamp"

New-Item -ItemType Directory -Path $modsRoot, $backupRoot, (Split-Path -Parent $stagingRoot) -Force | Out-Null
if (Test-Path -LiteralPath $stagingRoot) { Remove-Item -LiteralPath $stagingRoot -Recurse -Force }
Copy-Item -LiteralPath $packagePath -Destination $stagingRoot -Recurse

$movedPrevious = $false
try {
  if (Test-Path -LiteralPath $targetPath) {
    Move-Item -LiteralPath $targetPath -Destination $backupPath
    $movedPrevious = $true
  }
  Move-Item -LiteralPath $stagingRoot -Destination $targetPath
} catch {
  if ($movedPrevious -and -not (Test-Path -LiteralPath $targetPath)) {
    Move-Item -LiteralPath $backupPath -Destination $targetPath
  }
  throw
} finally {
  if (Test-Path -LiteralPath $stagingRoot) { Remove-Item -LiteralPath $stagingRoot -Recurse -Force }
}

Write-Output "部署完成：$targetPath"
if ($movedPrevious) { Write-Output "上一版本备份：$backupPath" }
Write-Output "请完全关闭并重新启动游戏。"
