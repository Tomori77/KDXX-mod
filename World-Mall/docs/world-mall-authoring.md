# 万界商行表投稿指南

## 一、这是什么

「万界商行表」是一份约定格式的 JSON（`market.json`），放在投稿 Mod 包内的 `market/` 目录。它不是游戏 Mod domain——**绝不能写进 `manifest.domains`**，否则「未知 domain」会让整个包禁用。

构建期，万界商行工程读取所有投稿的 `market.json`，校验、铸造 ID、并入产物包，并为每个来源生成一家独立店铺。第三方**不需要**自己实现地图或坊市。

## 二、为什么不是运行时自动发现

已用真实 Demo 加载器确认：

| 能力 | 结论 |
| --- | --- |
| 脚本沙箱读其它 Mod 文件 | 不支持（无文件系统 / 网络 / DOM） |
| bazaar 引用别包道具 | 被拒绝（只认官方道具或同包道具） |
| 未声明目录（`market/`） | 被容忍（只计入哈希与容量） |
| 多店铺挂同一节点 | 通过（这就是「独立货架」的实现方式） |

所以只能「构建期聚合」。运行时「进游戏后检索其它 mod 的商行表」做不到。

## 三、market.json 结构

```json
{
  "schemaVersion": 1,
  "publisher": { "id": "com.your.mod-id", "name": "你的Mod名" },
  "stall": {
    "name": "你的货架名",
    "npcName": "你的掌柜名",
    "description": "货架说明",
    "refreshDays": 30
  },
  "goods": [
    {
      "key": "unique-good-key",
      "item": {
        "numericId": 490000,
        "name": "商品名",
        "description": "商品说明",
        "category": "implement",
        "grade": "common",
        "element": "none",
        "shape": [[1]],
        "tags": ["your-mod"],
        "effectList": []
      },
      "icon": "your-icon-basename",
      "offer": {
        "count": 1,
        "stock": 20,
        "cost": { "type": "spiritStones", "amount": 12 }
      }
    }
  ]
}
```

字段权威以 `docs/market-table.schema.json` 为准。要点：

- `goods` 最多 **16** 件（受 bazaar `offers` 上限约束）。
- `item.numericId` 是**期望** ID。构建器会校验它是否落在对应类别的社区号段且未被占用；否则自动重新铸造并回报最终 ID。
- `item.category` 必须是可新增类别：`pill / implement / chest / material / formation / talisman / throwable`。功法、招式、配方、储物袋不可投稿。
- `shape` 是 items@3 的图标格子形状，如 `[[1]]`、`[[1,1]]`。
- `icon` 指向你 `market/icons/<name>.png` 下的母图，边长需 ≥ `列数×128 : 行数×128` 且保持该宽高比。
- `offer.cost` 二选一：
  - `{ "type": "spiritStones", "amount": N }`
  - `{ "type": "item", "templateNumericId": M, "count": K }`（M 可以是官方道具、你同投稿的另一件商品，或商行已聚合的道具；**不可**用灵材/配方/招式作易物成本）

## 四、社区 ID 号段

| category | 范围 |
| --- | --- |
| scripture 功法 | 190001–199999 |
| pill 丹药 | 390001–399999 |
| implement 法器 | 490001–499999 |
| chest 宝箱 | 490001–499999（与法器共享） |
| material 材料 | 590001–599999 |
| formation 阵法 | 690001–699999 |
| talisman 符箓 | 790001–799999 |
| spell 招式 | 890001–899999 |
| throwable 投掷物 | 990001–999999 |

商行不接收功法与招式投稿，但仍会校验类别合法性。

## 五、提交方式

1. 在你的 Mod 包内创建 `market/market.json` 和 `market/icons/*.png`。
2. Fork 本仓库，在 `submissions/<你的-mod-id>/` 放入你的 `market/` 目录内容（即 `submissions/<id>/market.json` + `submissions/<id>/icons/`）。
3. 提交 PR。

## 六、铁律与冲突

- **过户**：上架商品实体归万界商行包。你自己的包不得再声明同一 `numericId`。
- 若两件投稿用了同一 `numericId`，先到者保留，后者被重新铸造（构建日志会显示）。
- 构建器会拒绝：越段类别、非法 shape、缺失图标、非法易物成本、`goods` 超 16 等。
- 每次构建后务必运行 `tools/validate.ps1`，退出码 0 才算通过。

## 七、存档影响

商行包含地图与坊市，属于**改变游戏规则**的 Mod，会绑定存档指纹。增删货品/店铺会改变内容哈希，可能导致旧档无法直接载入。发行升级请遵循 SDK `docs/core/compatibility-and-saves.md`。
