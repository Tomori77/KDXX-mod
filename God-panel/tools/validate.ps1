. (Join-Path $PSScriptRoot "workspace-common.ps1")

$relaunch = Invoke-PocketPreferredShell -ScriptPath $PSCommandPath
if ($null -ne $relaunch) { exit $relaunch }

$workspaceRoot = Get-PocketWorkspaceRoot
$packagePath = Get-PocketPackageDirectory
$sdkPath = Resolve-PocketModSdk
$validator = Join-Path $sdkPath "bin/validate-mod.ps1"
$reportPath = Join-Path $workspaceRoot "mod-validation-report.json"

& $validator -ModDirectory $packagePath -ReportPath $reportPath
exit $LASTEXITCODE
