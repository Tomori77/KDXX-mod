param(
  [string]$VdfPath = (Join-Path $PSScriptRoot "workshop\workshop.vdf")
)

$ErrorActionPreference = "Stop"

$workspaceRoot = Split-Path -Parent $PSScriptRoot
$steamcmd = Join-Path (Split-Path -Parent (Split-Path -Parent $PSScriptRoot)) "docs\Upload\steamcmd.exe"

if (-not (Test-Path -LiteralPath $VdfPath -PathType Leaf)) {
  throw "找不到工坊 VDF：$VdfPath"
}
if (-not (Test-Path -LiteralPath $steamcmd -PathType Leaf)) {
  throw "找不到 steamcmd：$steamcmd"
}

Write-Host ">> 上传前校验 Mod 包..." -ForegroundColor Cyan
& (Join-Path $PSScriptRoot "validate.ps1")
if ($LASTEXITCODE -ne 0) {
  throw "Mod 校验未通过，已停止上传。报告：$(Join-Path $workspaceRoot 'mod-validation-report.json')"
}
Write-Host ">> 校验通过。" -ForegroundColor Green
Write-Host ""

Write-Host "==================== 发布指引 ====================" -ForegroundColor Yellow
Write-Host "接下来 steamcmd 会进入交互控制台，请依次输入：" -ForegroundColor White
Write-Host ""
Write-Host "  1) login 你的Steam账号名" -ForegroundColor White
Write-Host "     （随后按提示输入密码和 Steam Guard 令牌）" -ForegroundColor DarkGray
Write-Host "  2) workshop_build_item `"$VdfPath`"" -ForegroundColor White
Write-Host "  3) quit" -ForegroundColor White
Write-Host ""
Write-Host "首次发布会打印新的 publishedfileid。" -ForegroundColor DarkGray
Write-Host "请把它写回 VDF 的 publishedfileid，以便下次更新同一作品。" -ForegroundColor DarkGray
Write-Host "===================================================" -ForegroundColor Yellow
Write-Host ""

& $steamcmd
