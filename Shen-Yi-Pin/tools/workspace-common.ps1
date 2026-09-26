$ErrorActionPreference = "Stop"

function Get-PocketWorkspaceRoot {
  return (Split-Path -Parent $PSScriptRoot)
}

function Get-PocketWorkspaceConfig {
  $configPath = Join-Path (Get-PocketWorkspaceRoot) "mod-project.json"
  if (-not (Test-Path -LiteralPath $configPath -PathType Leaf)) {
    throw "找不到 mod-project.json：$configPath"
  }
  $config = Get-Content -LiteralPath $configPath -Raw | ConvertFrom-Json
  if ($config.schemaVersion -ne 1) { throw "只支持 mod-project schemaVersion 1" }
  if ($config.target -ne "demo" -and $config.target -ne "playtest" -and $config.target -ne "formal") {
    throw "target 必须是 demo、playtest 或 formal"
  }
  return $config
}

function Get-PocketPackageDirectory {
  $config = Get-PocketWorkspaceConfig
  if ($config.modId -notmatch '^[a-z0-9]+(?:[.-][a-z0-9]+)+$') {
    throw "modId 必须是小写反向域名"
  }
  $packagePath = Join-Path (Get-PocketWorkspaceRoot) "package/$($config.modId)"
  if (-not (Test-Path -LiteralPath $packagePath -PathType Container)) {
    throw "找不到 package/$($config.modId)，目录名必须与 modId 一致"
  }
  $manifestPath = Join-Path $packagePath "manifest.json"
  $manifest = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json
  if ($manifest.id -ne $config.modId) {
    throw "package 目录、mod-project.json.modId 与 manifest.json.id 必须一致"
  }
  return (Resolve-Path -LiteralPath $packagePath).Path
}

function Get-PocketSteamLibraries {
  $candidates = [System.Collections.Generic.List[string]]::new()
  try {
    $steamPath = (Get-ItemProperty -LiteralPath 'HKCU:\Software\Valve\Steam' -ErrorAction Stop).SteamPath
    if ($steamPath) { $candidates.Add([System.IO.Path]::GetFullPath($steamPath)) }
  } catch {}
  if (${env:ProgramFiles(x86)}) {
    $candidates.Add((Join-Path ${env:ProgramFiles(x86)} "Steam"))
  }
  foreach ($steamRoot in @($candidates)) {
    $vdfPath = Join-Path $steamRoot "steamapps/libraryfolders.vdf"
    if (-not (Test-Path -LiteralPath $vdfPath -PathType Leaf)) { continue }
    foreach ($line in Get-Content -LiteralPath $vdfPath) {
      if ($line -match '^\s*"path"\s+"(.+)"') {
        $candidates.Add(($Matches[1] -replace '\\\\', '\'))
      }
    }
  }
  return @($candidates | Where-Object { Test-Path -LiteralPath $_ -PathType Container } | Select-Object -Unique)
}

function Resolve-PocketModSdk {
  $config = Get-PocketWorkspaceConfig
  $configured = ""
  $localConfigPath = Join-Path (Get-PocketWorkspaceRoot) "mod-project.local.json"
  if (Test-Path -LiteralPath $localConfigPath -PathType Leaf) {
    $localConfig = Get-Content -LiteralPath $localConfigPath -Raw | ConvertFrom-Json
    if ($localConfig.schemaVersion -eq 1 -and $localConfig.sdkPath) {
      $configured = [string]$localConfig.sdkPath
    }
  }
  if ($env:POCKET_MOD_SDK) { $configured = $env:POCKET_MOD_SDK }
  if ($configured) {
    $configured = [System.IO.Path]::GetFullPath($configured)
    if (Test-Path -LiteralPath (Join-Path $configured "sdk-manifest.json") -PathType Leaf) {
      return $configured
    }
    throw "本机配置的 sdkPath 无效：$configured。请删除 mod-project.local.json 后重试自动发现。"
  }

  $appId = if ($config.target -eq "demo") { "4777710" } elseif ($config.target -eq "playtest") { "5106860" } else { "4707190" }
  foreach ($library in Get-PocketSteamLibraries) {
    $manifestPath = Join-Path $library "steamapps/appmanifest_$appId.acf"
    if (-not (Test-Path -LiteralPath $manifestPath -PathType Leaf)) { continue }
    $manifestText = Get-Content -LiteralPath $manifestPath -Raw
    if ($manifestText -notmatch '"installdir"\s+"([^"]+)"') { continue }
    $sdkPath = Join-Path $library "steamapps/common/$($Matches[1])/ModSDK"
    if (Test-Path -LiteralPath (Join-Path $sdkPath "sdk-manifest.json") -PathType Leaf) {
      return [System.IO.Path]::GetFullPath($sdkPath)
    }
  }
  throw "未找到 target=$($config.target) 对应的 ModSDK。请安装游戏，或在被 Git 忽略的 mod-project.local.json 中填写 sdkPath。"
}
