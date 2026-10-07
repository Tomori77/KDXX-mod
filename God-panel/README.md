# 天神面板（God-panel）

《口袋修仙》Demo `0.1.9f3`（ModSDK `0.1.10-hotfix.3` / commit `c9c6db1a` / `modApiVersion 2`）的**受限调试面板**：基于 `scripts@1` 自定义弹窗（`ui` + `panel.view`）。

## 能做什么

- 查看状态：境界、灵石、游戏日。
- 浏览/搜索：按图鉴 13 类浏览全部 1718 件可发放官方道具，支持按名称或编号搜索、分页（每页 24 件）。
- 灵石：`spiritStones` ±（单次上限 1,000,000）。
- 发道具：`giveItem`，仅限官方公开道具或同包道具，单次 1–32 件。

## 不能做什么

- 改修为/境界/属性、伪造战斗、改官方设置菜单。
- 发别包道具或隐藏道具。
- 任意 HTML/CSS/DOM、网络、DLL。

## 面板布局（简要显示 + 图鉴式分类 + 搜索 + 分页）

```
┌──────────────────────────── 天神面板 ────────────────────────────┐
│ 境界 凡人·1层    灵石 0    第 1 日                                │
│ 搜索名称或编号 [________________________]                        │
│ 分类 [全部 ▾]                                                     │
│ 共 1718 件 · 第 1/72 页                                           │
│ 选择道具 [炼体术 #100001 ▾]                                       │
│ 数量（1-32）[ 1 ▲▼ ]                                              │
│ [ 上一页 ]  [ 下一页 ]                                            │
│ [ 搜索/刷新 ] [ 发放道具 ] [ 清空搜索 ]                           │
│ 选择分类或搜索，再选道具发放。                                    │
├──────────────────────────────────────────────────────────────────┤
│ [搜索/刷新] [发放道具] [上一页] [下一页] [清空搜索]               │
└──────────────────────────────────────────────────────────────────┘
```

## 入口

只走系统面板，不新增玩家可达的地图：

- 角色界面 →「模组界面」→ 天神面板 → 打开界面（`ui.entry: "menu"`）。

> **为什么仍有一个地图文件**：SDK 硬性要求 `scripts@1` 必须同包声明 `maps@1`（否则报 `SCRIPTS_REQUIRES_API_V2_AND_MAPS`）。而系统「模组界面」全局入口只有脚本域的 `ui.entry: "menu"` 能做，没有纯菜单式的 domain。因此地图只作为脚本的**锚点**存在，玩家无需进入，入口完全在系统菜单。

## 目录

```
mod-project.json
package/com.tomori77.god-panel/
  manifest.json          modApiVersion 2，domains: maps + scripts
  maps/anchor.json       仅作脚本锚点，无对外入口说明（官方背景 map_05）
  scripts/panel.json     ui.entry=menu，stateVersion 1
  code/panel.js          内联 1718 件道具数据 + 分类/搜索/分页/发放
tools/                   resolve-sdk / validate / deploy / publish（优先 pwsh7，UTF-8）
```

## 命令

> 需要 **PowerShell 7（pwsh）**；在 5.1 下调用会自动改用 pwsh 执行。

```powershell
./tools/resolve-sdk.ps1
./tools/validate.ps1
./tools/deploy.ps1
./tools/publish.ps1    # 上传 Steam 创意工坊；publishedfileid 保持不变以覆盖同一作品
```

## 注意事项

带脚本的包属 `ruleset`，绑定存档指纹。新增调试面板到已有存档可能因兼容指纹变化被拒载；正式发布请按 `saveCompatibility` 规则处理（当前首版未声明）。所有脚本存档均为 `modded`。
