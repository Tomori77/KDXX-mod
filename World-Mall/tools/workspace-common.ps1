$ErrorActionPreference = "Stop"

function Get-PocketWorkspaceRoot {
  return (Split-Path -Parent $PSScriptRoot)
}

# 优先 PowerShell 7（pwsh）：原生 UTF-8 读写、JSON 数组与中文更可靠。
# 在 Windows PowerShell 5.1 下调用入口脚本时，本函数会用 pwsh 重新执行同一脚本并回传退出码。
function Invoke-PocketPreferredShell {
  param(
    [Parameter(Mandatory = $true)][string]$ScriptPath,
    [string[]]$Arguments = @()
  )
  if ($PSVersionTable.PSVersion.Major -ge 7) { return $null }
  $pwsh = Get-Command pwsh -ErrorAction SilentlyContinue
  if (-not $pwsh) {
    Write-Warning "未检测到 PowerShell 7（pwsh），将以 Windows PowerShell $($PSVersionTable.PSVersion) 运行；建议安装 PowerShell 7 以获得完整 UTF-8 支持。"
    return $null
  }
  & $pwsh.Source -NoProfile -ExecutionPolicy Bypass -File $ScriptPath @Arguments | Out-Host
  return $LASTEXITCODE
}

function Read-PocketJson([string]$Path) {
  $text = [System.IO.File]::ReadAllText($Path, [System.Text.Encoding]::UTF8)
  return ($text | ConvertFrom-Json)
}

function Write-PocketJson([string]$Path, $Value) {
  $json = $Value | ConvertTo-Json -Depth 40
  [System.IO.File]::WriteAllText($Path, $json, (New-Object System.Text.UTF8Encoding($false)))
}

function Get-PocketWorkspaceConfig {
  $configPath = Join-Path (Get-PocketWorkspaceRoot) "mod-project.json"
  if (-not (Test-Path -LiteralPath $configPath -PathType Leaf)) {
    throw "找不到 mod-project.json：$configPath"
  }
  $config = Read-PocketJson $configPath
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
  $manifest = Read-PocketJson $manifestPath
  if ($manifest.id -ne $config.modId) {
    throw "package 目录、mod-project.json.modId 与 manifest.json.id 必须一致"
  }
  return (Resolve-Path -LiteralPath $packagePath).Path
}

function Get-PocketSubmissionsRoot {
  return (Join-Path (Get-PocketWorkspaceRoot) "submissions")
}

function Get-PocketSubmissionDirectories {
  $root = Get-PocketSubmissionsRoot
  if (-not (Test-Path -LiteralPath $root -PathType Container)) { return @() }
  return @(
    Get-ChildItem -LiteralPath $root -Directory |
      Where-Object { Test-Path -LiteralPath (Join-Path $_.FullName "market.json") -PathType Leaf } |
      Sort-Object Name
  )
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
    $localConfig = Read-PocketJson $localConfigPath
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
    $manifestText = [System.IO.File]::ReadAllText($manifestPath, [System.Text.Encoding]::UTF8)
    if ($manifestText -notmatch '"installdir"\s+"([^"]+)"') { continue }
    $sdkPath = Join-Path $library "steamapps/common/$($Matches[1])/ModSDK"
    if (Test-Path -LiteralPath (Join-Path $sdkPath "sdk-manifest.json") -PathType Leaf) {
      return [System.IO.Path]::GetFullPath($sdkPath)
    }
  }
  throw "未找到 target=$($config.target) 对应的 ModSDK。请安装游戏，或在被 Git 忽略的 mod-project.local.json 中填写 sdkPath。"
}

function ConvertTo-PocketSlug([string]$value) {
  $slug = ($value.ToLowerInvariant() -replace '[^a-z0-9]+', '-').Trim('-')
  if ([string]::IsNullOrWhiteSpace($slug)) { throw "无法从 '$value' 生成合法 slug" }
  return $slug
}
