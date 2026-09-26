. (Join-Path $PSScriptRoot "workspace-common.ps1")

$workspaceRoot = Get-PocketWorkspaceRoot
$packagePath = Get-PocketPackageDirectory
$sdkPath = Resolve-PocketModSdk

& (Join-Path $sdkPath "bin/prepare-item-icons.ps1") `
  -ModDirectory $packagePath `
  -SourceDirectory (Join-Path $workspaceRoot "assets/icons")
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
