. (Join-Path $PSScriptRoot "workspace-common.ps1")

# 按 items@3 的 shape 生成双规格图标：assets/icons/<basename>.png -> package/icons/{runtime,release}。
# 这是 SDK bin/prepare-item-icons.ps1 的等价实现，改由本工程控制编码，避免 GBK 下的中文 JSON 读取问题。

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing

$workspaceRoot = Get-PocketWorkspaceRoot
$packagePath = Get-PocketPackageDirectory
$sdkPath = Resolve-PocketModSdk

$manifest = Read-PocketJson (Join-Path $packagePath "manifest.json")
$itemsSchema = $manifest.domains.items.schemaVersion
if ($itemsSchema -notin @(2, 3)) {
  Write-Output "items@1 使用单图兼容模式，跳过双规格图标生成。"
  exit 0
}

$baseShapes = @{}
$catalogPath = Join-Path $sdkPath "reference/domains/items/base-item-public-catalog.json"
if (Test-Path -LiteralPath $catalogPath -PathType Leaf) {
  $catalog = Read-PocketJson $catalogPath
  foreach ($item in $catalog.items) { $baseShapes[[string]$item.numericId] = $item.shape }
}

$itemsRoot = Join-Path $packagePath ([string]$manifest.domains.items.path)
$iconShapes = @{}
foreach ($itemFile in Get-ChildItem -LiteralPath $itemsRoot -Filter "*.json" -File) {
  $entry = Read-PocketJson $itemFile.FullName
  if ($entry.mode -eq "add" -and $entry.item.iconBasename) {
    $iconShapes[[string]$entry.item.iconBasename] = $entry.item.shape
  } elseif ($entry.mode -eq "override" -and $entry.patch.iconBasename) {
    $shape = $baseShapes[[string]$entry.numericId]
    if (-not $shape) { throw "无法确定覆写道具 $($entry.numericId) 的官方 shape。" }
    $iconShapes[[string]$entry.patch.iconBasename] = $shape
  }
}

$runtimeRoot = Join-Path $packagePath "icons/runtime"
$releaseRoot = Join-Path $packagePath "icons/release"
New-Item -ItemType Directory -Path $runtimeRoot, $releaseRoot -Force | Out-Null
Get-ChildItem -LiteralPath $runtimeRoot -File -ErrorAction SilentlyContinue | Remove-Item -Force
Get-ChildItem -LiteralPath $releaseRoot -File -ErrorAction SilentlyContinue | Remove-Item -Force

$sourceRoot = Join-Path $workspaceRoot "assets/icons"
foreach ($iconBasename in ($iconShapes.Keys | Sort-Object)) {
  $sourcePath = Join-Path $sourceRoot "$iconBasename.png"
  if (-not (Test-Path -LiteralPath $sourcePath -PathType Leaf)) {
    throw "缺少 PNG 图标母图：$sourcePath"
  }
  $shape = $iconShapes[$iconBasename]
  $rows = @($shape).Count
  $columns = 0
  foreach ($row in $shape) { $columns = [Math]::Max($columns, @($row).Count) }
  $targetWidth = $columns * 128
  $targetHeight = $rows * 128

  $source = [System.Drawing.Image]::FromFile($sourcePath)
  try {
    if ($source.Width -lt $targetWidth -or $source.Height -lt $targetHeight) {
      throw "图标母图 $iconBasename 至少需要 ${targetWidth}x${targetHeight}px。"
    }
    if ($source.Width * $targetHeight -ne $source.Height * $targetWidth) {
      throw "图标母图 $iconBasename 必须保持 ${columns}:${rows} 宽高比。"
    }
    Copy-Item -LiteralPath $sourcePath -Destination (Join-Path $releaseRoot "$iconBasename.png") -Force
    $runtimePath = Join-Path $runtimeRoot "$iconBasename.png"
    if (Test-Path -LiteralPath $runtimePath) { Remove-Item -LiteralPath $runtimePath -Force }
    $runtime = New-Object System.Drawing.Bitmap($targetWidth, $targetHeight, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    try {
      $graphics = [System.Drawing.Graphics]::FromImage($runtime)
      try {
        $graphics.CompositingMode = [System.Drawing.Drawing2D.CompositingMode]::SourceCopy
        $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
        $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
        $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
        $graphics.DrawImage($source, 0, 0, $targetWidth, $targetHeight)
      } finally { $graphics.Dispose() }
      $runtime.Save($runtimePath, [System.Drawing.Imaging.ImageFormat]::Png)
    } finally { $runtime.Dispose() }
  } finally { $source.Dispose() }
  Write-Output "已生成 $iconBasename：runtime ${targetWidth}x${targetHeight}px + release 原图"
}
exit 0
