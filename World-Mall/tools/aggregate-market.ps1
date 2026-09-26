. (Join-Path $PSScriptRoot "market-common.ps1")

# 构建期聚合：读取 submissions/*/market.json，生成 package/<id>/items、icons 母图与 bazaars。
# 铁律：上架商品的实体 JSON 归万界商行包所有；投稿方自己的包不得再声明同一 numericId。

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing

$workspaceRoot = Get-PocketWorkspaceRoot
$packagePath = Get-PocketPackageDirectory
$sdkPath = Resolve-PocketModSdk
$config = Get-PocketWorkspaceConfig

$itemsDir = Join-Path $packagePath "items"
$bazaarsDir = Join-Path $packagePath "bazaars"
$mapDir = Join-Path $packagePath "maps"
$assetsIcons = Join-Path $workspaceRoot "assets/icons"

$manifest = Read-PocketJson (Join-Path $packagePath "manifest.json")
$mapId = "$($manifest.id):hall"
$stallNodeId = "stalls"

# 载入官方道具目录，用于校验易物成本与发布状态。
$baseCatalogPath = Join-Path $sdkPath "reference/domains/items/base-item-public-catalog.json"
$baseItems = @{}
if (Test-Path -LiteralPath $baseCatalogPath -PathType Leaf) {
  $baseCatalog = Read-PocketJson $baseCatalogPath
  foreach ($it in $baseCatalog.items) { $baseItems[[int]$it.numericId] = $it }
}

New-Item -ItemType Directory -Path $itemsDir, $bazaarsDir, $assetsIcons -Force | Out-Null

# 清空上一次生成物（items/bazaars 全由本脚本生成）。
Get-ChildItem -LiteralPath $itemsDir -Filter "*.json" -File -ErrorAction SilentlyContinue | Remove-Item -Force
Get-ChildItem -LiteralPath $bazaarsDir -Filter "*.json" -File -ErrorAction SilentlyContinue | Remove-Item -Force

$submissions = Get-PocketSubmissionDirectories
if ($submissions.Count -eq 0) {
  throw "submissions/ 下没有任何含 market.json 的投稿目录"
}

$used = Get-PocketUsedNumericIds -PackageItemsPath $itemsDir
$parsed = @()
foreach ($dir in $submissions) {
  $parsed += (Import-PocketMarketSubmission -Directory $dir.FullName)
}

# 第一遍：铸造最终 numericId，并给每个投稿生成唯一 slug。
$assignments = @{}
$publisherSlugs = @{}
foreach ($sub in $parsed) {
  $slug = ConvertTo-PocketSlug $sub.PublisherId
  $base = $slug; $n = 2
  while ($publisherSlugs.Values -contains $slug) { $slug = "$base-$n"; $n++ }
  $publisherSlugs[$sub.PublisherId] = $slug

  foreach ($good in $sub.Goods) {
    $category = [string]$good.item.category
    if (-not (Get-PocketCommunityIdRanges).Contains($category)) {
      throw "$($sub.PublisherId)/$($good.key)：类别 $category 不可由万界商行上架"
    }
    $wanted = [int]$good.item.numericId
    $final = if ((Test-PocketMarketIdInRange $wanted $category) -and -not $used.Contains($wanted)) { $wanted } else { New-PocketNumericId -Category $category -Used $used }
    [void]$used.Add($final)

    $iconBasename = "$slug-$($good.key)"
    $assignments["$($sub.PublisherId)|$($good.key)"] = [pscustomobject]@{
      NumericId = $final
      Category  = $category
      IconBasename = $iconBasename
      PublisherSlug = $slug
      Good = $good
      Submission = $sub
    }
    Write-Output "分配 $($sub.PublisherId)/$($good.key) -> numericId=$final, icon=$iconBasename"
  }
}

# 第二遍：写 items、复制图标母图、生成 bazaars。
foreach ($sub in $parsed) {
  $slug = $publisherSlugs[$sub.PublisherId]
  $offers = @()

  foreach ($good in $sub.Goods) {
    $a = $assignments["$($sub.PublisherId)|$($good.key)"]

    # 图标母图
    $iconSrc = Join-Path $sub.Directory "icons/$($good.icon).png"
    if (-not (Test-Path -LiteralPath $iconSrc -PathType Leaf)) {
      throw "$($sub.PublisherId)/$($good.key)：缺少图标母图 $iconSrc"
    }
    $iconDst = Join-Path $assetsIcons "$($a.IconBasename).png"
    Copy-Item -LiteralPath $iconSrc -Destination $iconDst -Force

    # 道具定义
    $tags = @()
    if ($good.item.PSObject.Properties.Name -contains "tags" -and $good.item.tags) { $tags = @($good.item.tags) }
    $effectList = @()
    if ($good.item.PSObject.Properties.Name -contains "effectList" -and $good.item.effectList) { $effectList = @($good.item.effectList) }
    $shape = @($good.item.shape)
    $price = 0.0
    if ($good.offer.cost.type -eq "spiritStones") { $price = [double]$good.offer.cost.amount }
    $itemDoc = [ordered]@{
      mode = "add"
      item = [ordered]@{
        numericId   = $a.NumericId
        iconBasename= $a.IconBasename
        name        = [string]$good.item.name
        description = [string]$good.item.description
        isPublished = $true
        isObtainable= $true
        category    = $a.Category
        grade       = [string]$good.item.grade
        element     = [string]$good.item.element
        shape       = $shape
        tags        = $tags
        effectList  = $effectList
        distribution= [ordered]@{ channels = @("bazaar") }
        price       = $price
      }
    }
    $itemFile = Join-Path $itemsDir "$($a.NumericId).json"
    Write-PocketJson $itemFile $itemDoc

    # 货签成本
    $cost = $good.offer.cost
    if ($cost.type -eq "spiritStones") {
      $costDoc = [ordered]@{ type = "spiritStones"; amount = [int]$cost.amount }
    }
    else {
      $tid = [int]$cost.templateNumericId
      $resolved = $tid
      $own = $assignments.Values | Where-Object { $_.Good.item.numericId -eq $tid -and $_.Submission.PublisherId -eq $sub.PublisherId }
      if ($own) { $resolved = $own.NumericId }
      if (-not $baseItems.ContainsKey($resolved) -and -not ($assignments.Values.NumericId -contains $resolved)) {
        throw "$($sub.PublisherId)/$($good.key)：易物成本 $tid 既非官方道具，也非本投稿/商行道具"
      }
      if ($baseItems.ContainsKey($resolved)) {
        $cat = [string]$baseItems[$resolved].category
        if (@("material", "recipe", "spell") -contains $cat) {
          throw "$($sub.PublisherId)/$($good.key)：易物成本不可使用 $cat 类别"
        }
      }
      $costDoc = [ordered]@{ type = "item"; templateNumericId = $resolved; count = [int]$cost.count }
    }

    $offers += [ordered]@{
      id = [string]$good.key
      label = [string]$good.item.name
      templateNumericId = $a.NumericId
      count = [int]$good.offer.count
      stock = [int]$good.offer.stock
      cost = $costDoc
    }
  }

  $bazaarDoc = [ordered]@{
    id = "$($manifest.id):$slug"
    mapId = $mapId
    nodeId = $stallNodeId
    name = $sub.StallName
    npcName = $sub.NpcName
    description = $sub.Description
    refreshDays = $sub.RefreshDays
    offers = $offers
  }
  $bazaarFile = Join-Path $bazaarsDir "$slug.json"
  Write-PocketJson $bazaarFile $bazaarDoc
  Write-Output "生成货架 $slug.json：$($offers.Count) 条货签（$($sub.PublisherId)）"
}

Write-Output "聚合完成：$($parsed.Count) 个投稿、$($assignments.Count) 件商品。"
exit 0
