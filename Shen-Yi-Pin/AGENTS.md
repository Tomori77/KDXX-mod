# Pocket Cultivation AI Mod 工程约束

本目录是独立开发工程。只允许把 `package/<mod-id>/` 部署为成品 Mod；工程文档、工具、验证报告、缓存和 SDK 不得复制进游戏 Mods 目录。

## 开始前

1. 阅读 `README.md`、`mod-project.json`、匹配版本 ModSDK 的 `AGENTS.md` 和 `docs/domains/items/items-authoring-reference.md`。
2. 使用 `tools/resolve-sdk.ps1` 定位 ModSDK；不得凭记忆猜测字段或机制。
3. 只使用 SDK `schema/`、`reference/` 和 `docs/` 已公开的 domain/version。

## 当前能力

- 地图与坊市使用 `maps@1` 和 `bazaars@1`，先读匹配 SDK 的两个 domain 作者指南。入口只选公开目录，同包地图可以互联；NPC 驻点/巡逻、分支流程与声明式面板使用 `adventures@1`，先读 `docs/domains/adventures/adventures-authoring-reference.md`。

- 数据包使用 `modApiVersion: 1`；受限冒险脚本使用 V2 + scripts@1 + maps@1，先读 SDK 的 `docs/domains/scripts/scripts-authoring-reference.md`。
- 开放域为 `items@3`、`enemies@1`、`encounters@1|2` 与 `encounter-placements@1|2`；游戏保留 `items@1|2` 兼容。
- 功法/招式新增、层级、绑定、境界和删除先读道具作者指南第 13 节；复制 `examples/items/com.example.scripture-school`，并显式把 manifest 的 items 版本改为 3。
- V2 可替换 SDK 固定节点目录中的首图非教程固定槽，并修改四个新手固定遭遇的可见文案；不得改教程链、奖励、动作、敌人或 story-scene。完整边界见遭遇 authoring reference。
- 单个 Mod 最多包含 2048 个文件/目录条目、2048 个普通文件，总包不超过 256 MiB；其它单文件和图片限制见 SDK `docs/core/mod-package-spec.md`。
- 可以新增或白名单覆写道具，并使用 Mod 自带 PNG/WebP 图标。
- 禁止未声明脚本、DLL、网络资源、新 effect kind 和未公开领域。

遇到新增、查询、修改、覆写、隐藏、屏蔽、删除、恢复、效果增删改、投放、图标、多 Mod 冲突或存档兼容问题时，必须先查询匹配版本 SDK 的完整道具指南，不凭通用游戏知识推断。

## 完成门禁

1. 目录名必须等于 `manifest.json.id`。
2. 每件道具一个 JSON；PNG 母图放在 `assets/icons/`，验证会生成包内双规格图标。
3. 运行 `tools/validate.ps1`，退出码必须为 `0`。
4. **本工程只通过 Steam 工坊订阅投放，不做本地部署**：禁止运行 `tools\deploy.ps1`；若 `%APPDATA%\Pocket Cultivation Demo\mods\com.tomori77.shenyipin` 已存在，先删除以免与工坊内容重复冲突。公开发布用 `tools\publish.ps1` 上传工坊。
5. 不编辑存档或 Mod 选择文件绕过兼容性检查。
6. 只有旧档实测通过后才声明 `saveCompatibility`；道具编号变化只写 `migrations/items/*.json`，禁止迁移脚本。
