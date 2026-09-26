. (Join-Path $PSScriptRoot "workspace-common.ps1")

$relaunch = Invoke-PocketPreferredShell -ScriptPath $PSCommandPath
if ($null -ne $relaunch) { exit $relaunch }

$workspaceRoot = Get-PocketWorkspaceRoot
$packagePath = Get-PocketPackageDirectory
$sdkPath = Resolve-PocketModSdk

& (Join-Path $PSScriptRoot "aggregate-market.ps1")
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

& (Join-Path $PSScriptRoot "prepare-icons.ps1")
exit $LASTEXITCODE
