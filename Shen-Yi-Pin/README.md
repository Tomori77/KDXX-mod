# AI Mod Starter

这是可以直接交给 Codex 等 AI Agent 的独立 Mod 开发工程。随游戏发布的 ModSDK 保持只读，成品只来自 `package/<mod-id>/`。

## 开始

推荐从游戏目录运行：

```powershell
./ModSDK/bin/new-ai-mod.ps1 `
  -Destination "D:/MyMods/spirit-items" `
  -ModId "com.example.spirit-items" `
  -Name "灵灯小集" `
  -Target playtest
```

也可以手工复制本模板，然后同时修改 `mod-project.json`、package 目录名和 `manifest.json.id`。

## 命令

```powershell
./tools/resolve-sdk.ps1
./tools/prepare-assets.ps1
./tools/validate.ps1
./tools/deploy.ps1
```

`resolve-sdk.ps1` 优先使用被 Git 忽略的 `mod-project.local.json.sdkPath`，否则从 Steam 库自动发现与 `target` 匹配的游戏。Demo、Playtest 和正式版均支持同一套声明式 Mod 合同；开发和受控测试可按目标选择对应 SDK。把每个 `iconBasename` 对应的高分辨率 PNG 母图放在 `assets/icons/`；`prepare-assets.ps1` 会按道具 `shape` 生成每格 128px 的 runtime 图，并保留 release 原图。`validate.ps1` 和 `deploy.ps1` 都会自动执行此步骤。公共 `mod-project.json` 不包含本机路径，可以安全分享。`deploy.ps1` 会先验证，再部署到目标版本用户数据目录，并将已有版本备份到 `mod-backups/`。

让 AI 修改道具前，请让它读取匹配版本 SDK 的 `docs/domains/items/items-authoring-reference.md`。该文档覆盖增删查改、官方效果查询、软屏蔽、投放、图标、多 Mod 冲突和存档边界。

让 AI 制作遭遇前，请让它读取 `docs/domains/encounters/encounters-authoring-reference.md`，并从 `reference/domains/encounters/region-pool-catalog.json` 选择区域。可复制 SDK 的 `templates/encounters/minimal-encounter-mod/` 作为纯遭遇工程起点。

让 AI 制作敌人前，请让它读取 `docs/domains/enemies/enemies-authoring-reference.md`，并从 `reference/domains/enemies/base-enemy-public-catalog.json` 选择继承模板或合法 override 目标。

发布兼容升级前还要读取 `docs/core/compatibility-and-saves.md`。道具编号迁移文件放在 `package/<mod-id>/migrations/items/`；不要编写任何随 Mod 执行的迁移脚本。
