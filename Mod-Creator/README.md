# Mod-Creator · 口袋修仙 Mod 制作器

纯前端、零构建的《口袋修仙》Mod 可视化制作工具。用中文表单配置一整个 Mod（道具、功法招式、敌人、遭遇、地图、商店、冒险、脚本、Buff 等），实时生成符合 ModSDK 规范的 JSON，可导入/导出完整 Mod 包，并在改动可能影响旧存档时给出提醒；同时提供 AI 入口，对设计提出建议或生成可预览的 diff 修改。

## 特性

- **纯前端 / 零构建**：原生 HTML/CSS/ES Module，无后端、无打包器、无框架；可直接双击 `index.html` 或经静态服务器打开。
- **全中文界面 + 接口标注**：每个字段旁显示其 JSON 路径与来源 schema，帮助理解「这个选项对应哪个接口」。
- **接口驱动的控件**：下拉栏、多选、开关、数值范围、`shape` 网格、效果编辑器等均按 SDK schema 约束生成，从源头避免非法包。
- **完整 Mod 工作流**：从 `manifest` 到各域内容，一键导出规范 `.zip`（可解压进游戏 `mods/<mod-id>/`），也可导入已有包继续编辑。
- **存档影响提醒**：区分可无损兼容 / 需确认风险 / 需建副本 / 严格拒绝，导出前汇总。
- **AI 入口**：兼容 OpenAI 端点，用户自填；可给设计建议，或产出 diff 预览后由用户确认应用。

## 环境与运行

无需安装依赖。

```powershell
# 方式一：任意静态服务器（推荐）
python -m http.server 8080
# 然后浏览器打开 http://127.0.0.1:8080/Mod-Creator/

# 方式二：直接双击 index.html（file:// 打开）
```

> 仅支持现代 Chromium / Edge 桌面浏览器。所有数据默认只保存在本机浏览器，不上传。

## 目录结构

```
Mod-Creator/
├─ AGENTS.md      # 项目守则（工作前必读）
├─ index.html     # 入口
├─ src/           # 源码（app / domains / controls / io / ai / save / ui / data / i18n / generated）
├─ vendor/        # 第三方单文件 ES module
├─ tools/         # sync-reference.py（提取机读词典）、verify.ps1（校验门禁）
└─ docs/          # 仅本地：架构、决策、任务看板、子 agent 派发模板
```

## 开发

```powershell
# 同步 SDK 机读词典到 src/generated/
python tools/sync-reference.py

# 收尾校验（语法/模块解析/生成物新鲜度）
pwsh -File tools/verify.ps1
```

工作约定与红线见本地项目守则 `AGENTS.md`（随 `docs/` 一并仅本地保存，不随仓库上传）；模块接口与数据流见本地 `docs/ARCHITECTURE.md`。

## 说明

- 本工具生成的包**最终仍需经官方验证器** `ModSDK/bin/validate-mod.ps1` 校验（退出码 `0`）后才会被游戏加载。
- `docs/Reference/ModSDK-0.1.12/` 为只读快照，属于本地参考资料，不随本工具上传。
