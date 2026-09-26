$ErrorActionPreference = "Stop"

. (Join-Path $PSScriptRoot "workspace-common.ps1")

# 万界商行社区号段：category -> 起止（含）。
function Get-PocketCommunityIdRanges {
  return [ordered]@{
    scripture = @(190001, 199999)
    pill      = @(390001, 399999)
    implement = @(490001, 499999)
    chest     = @(490001, 499999)
    material  = @(590001, 599999)
    formation = @(690001, 699999)
    talisman  = @(790001, 799999)
    spell     = @(890001, 899999)
    throwable = @(990001, 999999)
  }
}

function Test-PocketMarketIdInRange([int]$numericId, [string]$category) {
  $ranges = Get-PocketCommunityIdRanges
  if (-not $ranges.Contains($category)) { return $false }
  $range = $ranges[$category]
  return ($numericId -ge $range[0] -and $numericId -le $range[1])
}

function Import-PocketMarketSubmission {
  param([Parameter(Mandatory = $true)][string]$Directory)

  $root = [System.IO.Path]::GetFullPath($Directory)
  $marketPath = Join-Path $root "market.json"
  if (-not (Test-Path -LiteralPath $marketPath -PathType Leaf)) {
    throw "投稿目录缺少 market.json：$root"
  }
  $table = Read-PocketJson $marketPath
  if ($table.schemaVersion -ne 1) {
    throw "$marketPath：只支持 schemaVersion 1"
  }
  if (-not $table.publisher -or -not $table.publisher.id) {
    throw "$marketPath：缺少 publisher.id"
  }
  if ($table.publisher.id -notmatch '^[a-z0-9]+(?:[.-][a-z0-9]+)+$') {
    throw "$marketPath：publisher.id 必须是小写反向域名"
  }
  if (-not $table.goods -or @($table.goods).Count -eq 0) {
    throw "$marketPath：goods 不能为空"
  }
  if (@($table.goods).Count -gt 16) {
    throw "$marketPath：单张商行表最多 16 件商品（受 bazaar offers 上限约束）"
  }

  $stallName = if ($table.stall -and $table.stall.name) { [string]$table.stall.name } else { "$($table.publisher.id) 货架" }
  $npcName = if ($table.stall -and $table.stall.npcName) { [string]$table.stall.npcName } else { "万界商行掌柜" }
  $description = if ($table.stall -and $table.stall.description) { [string]$table.stall.description } else { "由 $($table.publisher.id) 提供的货架。" }
  $refreshDays = if ($table.stall -and $table.stall.refreshDays) { [int]$table.stall.refreshDays } else { 30 }
  if ($refreshDays -lt 1 -or $refreshDays -gt 36000) { throw "$marketPath：stall.refreshDays 必须在 1-36000" }

  return [pscustomobject]@{
    Directory    = $root
    PublisherId  = [string]$table.publisher.id
    PublisherName= if ($table.publisher.name) { [string]$table.publisher.name } else { [string]$table.publisher.id }
    StallName    = $stallName
    NpcName      = $npcName
    Description  = $description
    RefreshDays  = $refreshDays
    Goods        = @($table.goods)
  }
}

function Get-PocketUsedNumericIds {
  param([string]$PackageItemsPath)
  $used = [System.Collections.Generic.HashSet[int]]::new()
  if (Test-Path -LiteralPath $PackageItemsPath -PathType Container) {
    foreach ($file in Get-ChildItem -LiteralPath $PackageItemsPath -Filter "*.json" -File) {
      $entry = Read-PocketJson $file.FullName
      if ($entry.mode -eq "add" -and $entry.item.numericId) { [void]$used.Add([int]$entry.item.numericId) }
      elseif ($entry.numericId) { [void]$used.Add([int]$entry.numericId) }
    }
  }
  return ,$used
}

function New-PocketNumericId {
  param(
    [Parameter(Mandatory = $true)][string]$Category,
    [Parameter(Mandatory = $true)]$Used
  )
  $ranges = Get-PocketCommunityIdRanges
  if (-not $ranges.Contains($Category)) {
    throw "类别 $Category 不在可铸造号段内（仅：$($ranges.Keys -join ', ')）"
  }
  $range = $ranges[$Category]
  for ($id = $range[0]; $id -le $range[1]; $id++) {
    if (-not $Used.Contains($id)) { return $id }
  }
  throw "类别 $Category 的社区号段已用尽"
}
