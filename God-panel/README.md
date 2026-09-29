# 天神面板（God-panel）

《口袋修仙》ModSDK 0.1.9f3 的**受限调试面板**：基于 `scripts@1` 自定义弹窗（`ui` + `panel.view`）。

## 能做什么

- 查看状态：境界、灵石、游戏日。
- 灵石：`spiritStones` ±（单次上限 1,000,000）。
- 发道具：`giveItem`，仅限官方公开道具或同包道具，单次 1–32 件。

## 不能做什么

- 改修为/境界/属性、伪造战斗、改官方设置菜单。
- 发别包道具或隐藏道具。
- 任意 HTML/CSS/DOM、网络、DLL。

## 面板布局（简要显示）

```
┌────────────────────────── 天神面板 ──────────────────────────┐
│ 选择下方操作。                                                │
│                                                              │
│  境界：凡人 第1层   灵石：0    第 1 日                        │
│                                                              │
│  ────────────── 灵石 ──────────────                          │
│  [ 灵石 +100 ]   [ 灵石 +1000 ]                              │
│                                                              │
│  ────────────── 道具 ──────────────                          │
│  道具 [ 硬气散 ▾ ]          数量（1-32）[ 1 ▲▼ ]             │
│  [ 发放道具 ]               单次最多 32 件                    │
│                                                              │
│  已发放 3 个「硬气散」。                                      │
├──────────────────────────────────────────────────────────────┤
│         [天神面板] [灵石+100] [灵石+1000] [发放道具]          │
└──────────────────────────────────────────────────────────────┘
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
  scripts/panel.json     ui.entry=menu，queryItemIds 声明 3 个官方道具
  code/panel.js          同步 handle：灵石/发道具/状态
tools/                   resolve-sdk / validate / deploy（优先 pwsh7，UTF-8）
```

## 命令

> 需要 **PowerShell 7（pwsh）**；在 5.1 下调用会自动改用 pwsh 执行。

```powershell
./tools/resolve-sdk.ps1
./tools/validate.ps1
./tools/deploy.ps1
```

## 注意事项

带脚本的包属 `ruleset`，绑定存档指纹。新增调试面板到已有存档可能因兼容指纹变化被拒载；正式发布请按 `saveCompatibility` 规则处理（当前首版未声明）。所有脚本存档均为 `modded`。
