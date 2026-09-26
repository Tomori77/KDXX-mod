# 万界商行（World-Mall）

《口袋修仙》Mod：新增一处「万界商行」地图，汇聚各方投稿的货签，按来源分设独立货架。

本仓库既是**成品 Mod 工程**，也是**投稿聚合管线**。第三方 Mod 通过一份「万界商行表」投稿自己的商品，构建期由本工程把它们聚合成一个合法可分发的 Mod 包。

## 原理（为什么必须构建期聚合）

口袋修仙 ModSDK 的硬约束（已用真实 Demo 加载器验证）：

- `scripts@1` 沙箱无文件系统 / 网络 / DOM，运行时**无法枚举或读取其它 Mod**。
- `bazaars@1` 的 `templateNumericId` 只接受「官方道具或**同包**道具」，**跨 Mod 引用被拒绝**。
- 多个包声明同一 `numericId` → 相关包**全部禁用**。

因此「进游戏后自动检索其它 mod 商品」不可行。可行形态是：**投稿规范 + 构建期聚合 + 一来源一店铺**，商品实体归万界商行包所有。

## 目录结构

```
mod-project.json                 工程配置（target: demo）
package/com.tomori77.world-mall/ 唯一会部署到游戏的成品包
  manifest.json                  只声明商行自身的域
  maps/        商行地图（正厅 + 诸方货架）
  adventures/  正厅迎客 interaction
  items/       [生成] 聚合后的道具定义
  bazaars/     [生成] 每个投稿来源一家店铺
  icons/       [生成] 双规格图标
  images/maps/ 地图背景
submissions/                     投稿区（不进游戏）
  _home/                         商行自营柜（示例）
  com.example.sample-mod/        第三方示例投稿
assets/icons/                    [生成] 图标母图工作区
docs/market-table.schema.json    「万界商行表」JSON Schema
tools/                           构建/验证/部署脚本
```

## 命令

> 需要 **PowerShell 7（pwsh）**。若在 Windows PowerShell 5.1 下调用入口脚本，脚本会自动改用 `pwsh` 重新执行。所有 JSON 均以 UTF-8 读写。

```powershell
./tools/resolve-sdk.ps1   # 定位匹配 target 的 ModSDK
./tools/build.ps1         # 聚合投稿 + 生成图标（只改 package/，不进游戏）
./tools/validate.ps1      # build + 调用官方验证器
./tools/deploy.ps1        # validate + 部署到游戏用户数据目录（需完全重启）
```

## 投稿（第三方 Mod 作者）

1. 在你自己的 Mod 包里新建 `market/` 目录（**不要**写进 `manifest.domains`）。
2. 放入 `market.json`（格式见 `docs/market-table.schema.json`）与 `market/icons/<名>.png` 图标母图。
3. 向本仓库提 PR，把 `market/` 目录放到 `submissions/<你的-mod-id>/`。

**铁律**：上架商品的实体 JSON 归万界商行包所有。投稿方自己的包**不得**再声明同一 `numericId`，否则冲突双双禁用。想同时保留独立道具，请用另一个 ID。

详见 `docs/world-mall-authoring.md`。
