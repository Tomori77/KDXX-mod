. (Join-Path $PSScriptRoot "workspace-common.ps1")

$relaunch = Invoke-PocketPreferredShell -ScriptPath $PSCommandPath
if ($null -ne $relaunch) { exit $relaunch }

$sdkPath = Resolve-PocketModSdk
Write-Output $sdkPath
