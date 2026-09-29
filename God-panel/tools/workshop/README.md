# 创意工坊发布说明

## AppID 对照

| AppID | 版本 | 本账号是否有授权 | 能否上传 |
| --- | --- | --- | --- |
| `4777710` | 口袋修仙 Demo | 有 | 可以 |
| `5106860` | 口袋修仙 Playtest | 有 | 可以 |
| `4707190` | 口袋修仙 正式版 | **无**（未发售） | **Access Denied** |

## 已发布作品

- **Demo（4777710）**：publishedfileid `3810027645`「天神面板」
  - https://steamcommunity.com/sharedfiles/filedetails/?id=3810027645
  - VDF：`workshop.vdf`（`visibility 0` = 公开）
  - 内容：`package/com.tomori77.god-panel`，预览图 `tools/workshop/preview.png`

## 发布 / 更新

```powershell
./tools/publish.ps1
```

steamcmd 交互控制台依次输入：`login s2997968660`（使用缓存凭据）→ `workshop_build_item "…\workshop.vdf"` → `quit`。

本机已有缓存登录（账号 `s2997968660`），可直接用：

```powershell
& "D:\1orca\KDXXmod\docs\Upload\steamcmd.exe" +login s2997968660 +workshop_build_item "D:\1orca\KDXXmod\God-panel\tools\workshop\workshop.vdf" +quit
```

更新时把 `changenote` 与「更新公告」区按 `docs/God-panel/更新简介.md` 的手册同步，`publishedfileid` 保持不变即可覆盖同一作品。
