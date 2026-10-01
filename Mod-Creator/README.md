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

## 使用指南

### 打开方式

- **静态服务器（推荐）**：在仓库根目录执行 `python -m http.server 8080`，浏览器打开 `http://127.0.0.1:8080/Mod-Creator/`。
- **直接打开**：双击 `Mod-Creator/index.html`（`file://` 方式）也可运行，无需安装任何依赖。

两种方式能力一致：本地大词典已编译为 ES module，运行时不发 `fetch` 读取本地 JSON。

### 创建第一个 Mod

1. 打开工具后，在 **清单（manifest）** 域填写 `id` / `name` / `version` / `modApiVersion`，并确认依赖的域。
2. 依次到各域点击「新增」，用中文表单（下拉、多选、数值、开关、效果编辑器等）配置内容；每个字段旁标注了它对应的 JSON 接口路径。
3. 编辑过程会自动保存到浏览器 `IndexedDB`，支持多工程；关闭页面后重新打开可继续。
4. 点击 **导出**，得到标准 `.zip`（解压即为 `mods/<mod-id>/`）。
5. 用官方验证器 `ModSDK/bin/validate-mod.ps1` 复核导出包。

### 各域用途

| 域 | 用途 |
|---|---|
| 清单 manifest | Mod 的 `id`、名称、版本、API 版本、依赖域、存档兼容声明 |
| 道具 items | 道具、功法、招式的字段与 `effectList` 效果链 |
| Buff buffs | 自定义/覆写 Buff 定义 |
| 敌人 enemies | 敌人属性、技能与掉落 |
| 遭遇 encounters | 战斗遭遇编排 |
| 遭遇投放 encounter-placements | 把遭遇投放到地图/区域 |
| 地图 maps | 地图与区域结构 |
| 商店 bazaars | 易物/商店货架 |
| 冒险 adventures | 冒险流程与节点 |
| 脚本 scripts | 事件脚本与弹窗 |

### 导入 / 导出

- **导出**：生成规范 `.zip`，包根为 `manifest.json`，域内容按 `items/<id>.json` 等目录组织，含 `icons/`。
- **导入**：支持选择 `.zip` 完整包、工程 JSON 或单个域 JSON；解析后进入编辑器，并保留未识别字段以避免破坏性丢失。

### 存档影响提醒

每次结构性改动后会自动判定影响，导出前再汇总一次，分为四级：

| 等级 | 含义 |
|---|---|
| 可无损兼容 | 仅表现/数值变化或纯新增，旧存档可继续使用 |
| 需确认风险后载入 | 属规则集变更（如删除、override/delete），旧档需确认风险 |
| 需建独立角色副本 | 改动触碰受保护内容，建议为旧档另建角色副本 |
| 严格拒绝 | 该改动无法与旧存档共存，应避免 |

### AI 入口

- 在 AI 面板中自行填写 `baseUrl` / `apiKey` / `model`，请求 `POST {baseUrl}/chat/completions`（OpenAI 兼容）。
- **安全提示**：`apiKey` 仅保存在本机浏览器 `localStorage`，不会自动上传；请勿使用主账号或高权限密钥。
- AI 可给出设计建议，或返回结构化补丁；补丁会先以 **diff 预览** 展示，由你确认后才应用，应用失败可回滚。

### 导出后仍需复核

工具内置客户端校验只能尽量提前发现问题。导出的包**最终仍需经官方验证器** `ModSDK/bin/validate-mod.ps1` 校验（退出码 `0`）后才会被游戏加载。

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
