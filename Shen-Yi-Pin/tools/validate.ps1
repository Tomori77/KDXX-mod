. (Join-Path $PSScriptRoot "workspace-common.ps1")

$workspaceRoot = Get-PocketWorkspaceRoot
$packagePath = Get-PocketPackageDirectory
$sdkPath = Resolve-PocketModSdk
$validator = Join-Path $sdkPath "bin/validate-mod.ps1"
$reportPath = Join-Path $workspaceRoot "mod-validation-report.json"

& (Join-Path $PSScriptRoot "prepare-assets.ps1")
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
& $validator -ModDirectory $packagePath -ReportPath $reportPath
exit $LASTEXITCODE
