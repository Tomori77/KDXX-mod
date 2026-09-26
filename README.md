# KDXX Mod

《口袋修仙》（Pocket Cultivation）Mod 与工具混合仓库。多个相互独立的工程以子目录形式共存于本 monorepo。

## 项目索引

| 目录 | 项目 | 说明 | 原仓库 |
|---|---|---|---|
| [`save-editor/`](./save-editor) | 口袋修仙 · 存档工坊 | 本地存档修改工具，单文件服务，可视化增删改物品、角色信息与灵根 | [Save-Modifier](https://github.com/Tomori77/Save-Modifier)（已归档） |
| [`World-Mall/`](./World-Mall) | 万界商行 | 新增「万界商行」地图的 Mod，同时是第三方商品投稿聚合管线 | [World-Mall](https://github.com/Tomori77/World-Mall)（已归档） |
| [`Shen-Yi-Pin/`](./Shen-Yi-Pin) | 神一品 | 独立 Mod 开发工程 | — |

各子项目保留其自身的 `README.md`、`.gitignore` 与历史提交。开发时进入对应目录，按该目录文档操作。

## 工作方式

- 单一仓库、单一分支 `main`；各子项目互不依赖。
- 提交时请把改动限定在对应子目录内，提交信息以子项目名或 `scope:` 开头，便于 `git log -- <dir>` 追溯。
- 子项目历史已通过 `git subtree` 并入，仍可单独查看，例如 `git log -- save-editor/`。
