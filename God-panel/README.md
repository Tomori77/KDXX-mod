# 天神面板（God-panel）

《口袋修仙》Demo `0.1.19`（ModSDK `0.1.19` / `modApiVersion 2`）的**受限调试面板**：基于 `scripts@1` 自定义弹窗（`ui` + `panel.view`）。

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
│ [官方 module] 属性总览（境界等）                                  │
│ [官方 module] 资源（灵石等）                                      │
│ 搜索名称或编号 [________________________]                        │
│ 分类 [全部 ▾]                                                     │
│ 共 1718 件 · 第 1/72 页                                           │
│ 选择道具 [炼体术 #100001 ▾]                                       │
│ 数量（1-32）[ 1 ▲▼ ]                                              │
│ [ 上一页 ]  [ 下一页 ]                                            │
│ [ 搜索/刷新 ] [ 发放道具 ] [ 清空搜索 ]                           │
│ 选择分类或搜索，再选道具发放。                                    │
├──────────────────────────────────────────────────────────────────┤
│ [搜索/刷新] [发放道具] [上一页] [下一页] [清空搜索]  [关闭]       │
└──────────────────────────────────────────────────────────────────┘
```

## 入口

入口按钮直接挂在官方页面，不再经旧「模组界面」选择器：

- `ui.entry: "surfaces"` + `entryPoints`：`page.overview` 槽位 `actions`、`page.journey` 槽位 `footer`。
- 在官方角色总览页与游历页点击「天神面板」按钮，直接打开面板。

> **为什么不再需要地图**：0.1.19 起 `surfaces` 页面入口只需同包声明 `scripts` 域，无需 `maps`。本项目已移除锚点地图。

## 目录

```
mod-project.json
package/com.tomori77.god-panel/
  manifest.json          modApiVersion 2，domains: scripts（surfaces 包无需 maps）
  scripts/panel.json     ui.entry=surfaces + entryPoints（overview/journey）
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
