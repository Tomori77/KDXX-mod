# 天神面板（God-panel）

> 工程目录：`D:\1orca\KDXXmod\God-panel`
> Mod ID：`com.tomori77.god-panel`
> 目标：Demo `0.1.19`（ModSDK `0.1.19` / `modApiVersion 2`）
> 状态：**已验证通过**（v1.1.0；`tools/validate.ps1` 退出码 0，`loaded: true`，无 issue）

## 1. 这是什么

一个**游戏内受限调试面板**。入口挂在官方角色总览页与游历页（`ui.entry: "surfaces"`），不新增玩家可达的地图；可以查看状态、发放灵石、按图鉴分类浏览并搜索全部官方本体道具后发放。

## 2. 能力边界（硬约束，已实测）

| 项 | 结论 |
| --- | --- |
| 打开位置 | 官方页面挂点（角色总览页 `actions` / 游历页 `footer`；`ui.entry: "surfaces"`） |
| 灵石 | `spiritStones`，单次 ±1,000,000 |
| 发道具 | `giveItem`，官方**已发布且可获取**（`isPublished && isObtainable`）道具 + 同包道具 |
| 单次数量 | `count` 1–32；每次事务 `effects` ≤16 条、道具合计 ≤32 件 |
| 改数值/境界/属性 | 不支持（`world` 只读） |
| 伪造战斗 | 不支持（`battleSettled` 只读真实战果） |
| 任意 HTML/CSS/DOM/网络/DLL | 不支持 |
| 热加载 | 不支持；须完全重启，且绑定存档指纹（`ruleset`） |

### 2.1 为什么不再需要地图

0.1.19 的 `surfaces` 页面入口只需同包声明 `scripts` 域，无需同包 `maps`（旧的 `node`/`menu` 脚本入口才要求同包地图作锚点）。因此本项目已移除锚点地图，包内仅保留 `scripts` 域。

### 2.2 关于 `queryItemIds`

脚本定义里的 `queryItemIds`（上限 32）只是**加载期声明**（声明了非公开 ID 会让整包被拒）。运行时**不**对 `giveItem` 做白名单限制，因此不声明也能发放任意可获取官方道具——面板据此内联了整个目录。

### 2.3 0.1.19 新接口采用

- 入口：`ui.entry: "surfaces"` + `entryPoints`（`page.overview`/`actions`、`page.journey`/`footer`）。
- 控件：官方 `module`（`primary-stats`、`resources`）渲染属性与资源；`navigation`（`action: close`）提供「关闭」。
- 保持不变：`scripts@1`、`modApiVersion 2`、`panel.view.version 1`。

## 3. 可发放道具范围

依据 `reference/domains/items/base-item-public-catalog.json`：

- 官方目录共 **2002** 件；`isPublished && isObtainable` = **1718** 件（可发放）。
- 被排除 **284** 件（未发布或不可获取）。
- 其中 **69** 件带 `uniquePerSave`（唯一性约束，已拥有时可能不给）。

分类计数（对齐图鉴）：

| 分类 | 数量 | | 分类 | 数量 |
| --- | ---: | --- | --- | ---: |
| 法器 | 856 | | 配方 | 103 |
| 材料 | 246 | | 储物袋 | 62 |
| 招式 | 182 | | 符箓 | 56 |
| 丹药 | 106 | | 投掷物 | 44 |
| 功法 | 28 | | 占卜 | 25 |
| 宝箱 | 10 | | 阵法 | 0 |

> 阵法类官方本体无「已发布且可获取」条目，仍保留分类项但列表为空。

## 4. 面板设计（简要显示 + 图鉴式分类 + 搜索 + 分页）

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

- 属性/资源由官方 `module` 组件（`primary-stats`/`resources`）渲染；底部含「关闭」`navigation`。自定义搜索/分类/分页/发放控件不变。
- 每页 **24** 件；分类：全部 / 丹药 / 法器 / 符箓 / 材料 / 投掷物 / 招式 / 功法 / 配方 / 阵法 / 储物袋 / 占卜 / 宝箱。
- **搜索**匹配「名称 **或** 数字编号」包含关键字；选择项标签形如 `炼体术 #100001`。搜「100」可命中全部编号/名称含 100 的道具（官方共 104 件）。
- 搜索在当前分类内生效；选「全部」则跨全部 13 类。
- 选项下拉值用 `i<数字>` 编码（控件值必须以字母开头）。
- 全部道具数据**内联**在 `panel.js`（脚本无文件系统），约 51 KiB，远低于 256 KiB 上限。

## 5. 目录结构

```
God-panel/
  mod-project.json
  package/com.tomori77.god-panel/
    manifest.json          modApiVersion 2，domains: scripts（surfaces 包无需 maps）
    scripts/panel.json     ui.entry=surfaces + entryPoints（overview/journey）
    code/panel.js          内联 1718 件道具数据 + 分类/搜索/分页/发放
  tools/                   resolve-sdk / validate / deploy / publish（优先 pwsh7、UTF-8）
```

## 6. 命令

> 需要 **PowerShell 7（pwsh）**；在 5.1 下调用会自动改用 pwsh 执行。所有 JSON 以 UTF-8 读写。

```powershell
./tools/resolve-sdk.ps1   # 定位 ModSDK
./tools/validate.ps1      # 调用官方验证器（退出码 0 为通过）
./tools/deploy.ps1        # 验证后部署到游戏用户数据目录（需完全重启）
./tools/publish.ps1       # 上传 Steam 创意工坊（publishedfileid 保持不变以覆盖同一作品）
```

## 7. 存档与发布

带脚本的包属 `ruleset`，绑定精确 ID / 版本 / 内容哈希 / domain 版本。新增该面板到已有存档可能因兼容指纹变化被拒载；正式发布若需兼容旧档，应按 `docs/core/compatibility-and-saves.md` 声明 `saveCompatibility`（当前首版未声明）。所有脚本存档均为 `modded`，不参与官方成绩提交。

## 8. 后续可扩展

- 灵石批量发放、按星级/等级筛选（需另加控件与数据字段）。
- 分类内二级筛选（元素/品阶）。
- 若日后 SDK 放开，可接入更多效果类型。
