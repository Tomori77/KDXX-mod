// src/domains/enemies.js — enemies@1 域：骨架、字段描述、校验、导入导出与摘要。

import { enemies as enemyCatalog } from "../generated/catalogs.js";

const SCHEMA_FILE = "enemies@1 · enemy.schema.json";
const ENEMY_ID_PATTERN = "^[a-z0-9]+(?:[.-][a-z0-9]+)+:[a-z0-9](?:[a-z0-9_-]*[a-z0-9])?$";
const ENEMY_ID_RE = new RegExp(ENEMY_ID_PATTERN);
const ASSET_PATTERN = "^[a-z0-9][a-z0-9_-]{0,79}$";
const ASSET_RE = new RegExp(ASSET_PATTERN);

const MODES = ["add", "override", "delete"];
const PHASES = ["none", "lower", "middle", "upper", "peak"];
const STAT_KEYS = ["health", "stamina", "mana", "spiritSense", "bloodEssence"];
const KNOWN_ROOT = [
  "mode",
  "enemyId",
  "basedOn",
  "patch",
  "portraitImageBasename",
  "badgeImageBasename",
  "battlePresentation"
];

const ENEMY_OPTIONS = enemyCatalog.map((enemy) => ({ value: enemy.enemyId, label: enemy.name }));
const ENEMY_BY_ID = new Map(enemyCatalog.map((enemy) => [enemy.enemyId, enemy]));

export const meta = {
  key: "enemies",
  labelZh: "敌人",
  schemaVersion: 1,
  schemaFile: SCHEMA_FILE
};

function error(code, path, messageZh) {
  return { code, path, messageZh, severity: "error" };
}

function warning(code, path, messageZh) {
  return { code, path, messageZh, severity: "warning" };
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isBlank(value) {
  return value == null || (typeof value === "string" && value.trim() === "");
}

function isInteger(value) {
  return typeof value === "number" && Number.isInteger(value);
}

function collectEntries(project, domain) {
  if (Array.isArray(project)) {
    return project;
  }
  if (project && isPlainObject(project.content) && Array.isArray(project.content[domain])) {
    return project.content[domain];
  }
  return [];
}

function expectedNamespace(ctx) {
  if (!isPlainObject(ctx)) {
    return null;
  }
  const candidates = [
    ctx.modId,
    ctx.manifestId,
    isPlainObject(ctx.manifest) ? ctx.manifest.id : null,
    isPlainObject(ctx.project) && isPlainObject(ctx.project.meta) && isPlainObject(ctx.project.meta.manifest)
      ? ctx.project.meta.manifest.id
      : null
  ];
  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate !== "") {
      return candidate;
    }
  }
  return null;
}

function namespaceOf(id) {
  if (typeof id !== "string") {
    return null;
  }
  const index = id.indexOf(":");
  return index > 0 ? id.slice(0, index) : null;
}

function localNameOf(id) {
  if (typeof id !== "string") {
    return null;
  }
  const index = id.indexOf(":");
  return index >= 0 ? id.slice(index + 1) : id;
}

function schema(pointer) {
  return SCHEMA_FILE + (pointer ? "#" + pointer : "");
}

export function createEntry(partial = {}) {
  const skeleton = {
    mode: "add",
    enemyId: "",
    basedOn: "",
    patch: {
      name: "",
      primaryStats: { health: 100, stamina: 0, mana: 0, spiritSense: 0, bloodEssence: 0 }
    }
  };
  const next = { ...skeleton, ...partial };
  if (isPlainObject(partial.patch)) {
    next.patch = { ...skeleton.patch, ...partial.patch };
    if (isPlainObject(partial.patch.primaryStats)) {
      next.patch.primaryStats = { ...skeleton.patch.primaryStats, ...partial.patch.primaryStats };
    }
  }
  return next;
}

function statField(key, label, min) {
  return {
    path: "patch.primaryStats." + key,
    control: "number",
    label: label + "（patch.primaryStats." + key + "，" + min + "–1000000000）",
    required: false,
    min,
    max: 1000000000,
    step: 1,
    modes: ["add", "override"],
    schema: schema("/$defs/primaryStats/properties/" + key)
  };
}

export function fields() {
  return [
    {
      path: "mode",
      control: "select",
      label: "模式",
      required: true,
      options: [
        { value: "add", label: "新增（add）" },
        { value: "override", label: "覆写官方（override）" },
        { value: "delete", label: "删除（delete，仅本包命名空间）" }
      ],
      modes: MODES,
      schema: schema("/oneOf/0/properties/mode")
    },
    {
      path: "enemyId",
      control: "text",
      label: "敌人 ID（add 须为 <mod-id>:<本地-id>，前缀必须等于 manifest.id）",
      required: true,
      pattern: ENEMY_ID_PATTERN,
      modes: ["add"],
      schema: schema("/oneOf/0/properties/enemyId")
    },
    {
      path: "basedOn",
      control: "select",
      label: "继承官方敌人（basedOn，只能选公开目录中的官方敌人，不可自造）",
      required: true,
      options: ENEMY_OPTIONS,
      modes: ["add"],
      schema: schema("/oneOf/0/properties/basedOn")
    },
    {
      path: "enemyId",
      control: "text",
      label: "官方敌人 ID（enemyId，来自公开敌人目录）",
      required: true,
      modes: ["override", "delete"],
      schema: schema("/oneOf/1/properties/enemyId")
    },
    {
      path: "patch.name",
      control: "text",
      label: "名称（patch.name，1–40 字）",
      required: false,
      maxLength: 40,
      modes: ["add", "override"],
      schema: schema("/$defs/patch/properties/name")
    },
    {
      path: "patch.species",
      control: "text",
      label: "种族（patch.species，1–40 字）",
      required: false,
      maxLength: 40,
      modes: ["add", "override"],
      schema: schema("/$defs/patch/properties/species")
    },
    {
      path: "patch.flavor",
      control: "text",
      label: "风味文本（patch.flavor，1–120 字）",
      required: false,
      maxLength: 120,
      modes: ["add", "override"],
      schema: schema("/$defs/patch/properties/flavor")
    },
    {
      path: "patch.detail",
      control: "text",
      label: "详述（patch.detail，1–600 字）",
      required: false,
      multiline: true,
      rows: 4,
      maxLength: 600,
      modes: ["add", "override"],
      schema: schema("/$defs/patch/properties/detail")
    },
    {
      path: "patch.portraitFacing",
      control: "select",
      label: "立绘朝向（patch.portraitFacing）",
      required: false,
      options: [
        { value: "left", label: "朝左（left）" },
        { value: "right", label: "朝右（right）" }
      ],
      modes: ["add", "override"],
      schema: schema("/$defs/patch/properties/portraitFacing")
    },
    {
      path: "patch.threatTags",
      control: "multi-select",
      label: "威胁标签（patch.threatTags，最多 8 个，每项 1–20 字）",
      required: false,
      options: [],
      freeform: true,
      maxItems: 8,
      modes: ["add", "override"],
      schema: schema("/$defs/patch/properties/threatTags")
    },
    {
      path: "patch.rank.tier",
      control: "number",
      label: "境界阶（patch.rank.tier，0–13；tier=0 时 phase 必须为 none）",
      required: false,
      min: 0,
      max: 13,
      step: 1,
      modes: ["add", "override"],
      schema: schema("/$defs/rank/properties/tier")
    },
    {
      path: "patch.rank.phase",
      control: "select",
      label: "境界段（patch.rank.phase）",
      required: false,
      options: [
        { value: "none", label: "无（none）" },
        { value: "lower", label: "初期（lower）" },
        { value: "middle", label: "中期（middle）" },
        { value: "upper", label: "后期（upper）" },
        { value: "peak", label: "巅峰（peak）" }
      ],
      modes: ["add", "override"],
      schema: schema("/$defs/rank/properties/phase")
    },
    {
      path: "patch.escapeBaseDurationSec",
      control: "number",
      label: "逃离基础读条秒数（patch.escapeBaseDurationSec，>0 且 ≤3600）",
      required: false,
      min: 0,
      max: 3600,
      step: 0.1,
      modes: ["add", "override"],
      schema: schema("/$defs/patch/properties/escapeBaseDurationSec")
    },
    {
      path: "patch.lethalOnDefeat",
      control: "toggle",
      label: "一命判死（patch.lethalOnDefeat，默认 false，仅影响一命模式的致命战败）",
      required: false,
      modes: ["add", "override"],
      schema: schema("/$defs/patch/properties/lethalOnDefeat")
    },
    statField("health", "生命", 1),
    statField("stamina", "体力", 0),
    statField("mana", "法力", 0),
    statField("spiritSense", "神识", 0),
    statField("bloodEssence", "精血", 0),
    {
      path: "patch.bagSize",
      control: "number",
      label: "储物袋格数（patch.bagSize，1–10）",
      required: false,
      min: 1,
      max: 10,
      step: 1,
      modes: ["add", "override"],
      schema: schema("/$defs/patch/properties/bagSize")
    },
    {
      path: "patch.bagItemNumericId",
      control: "number",
      label: "储物袋道具编号（patch.bagItemNumericId，≥1）",
      required: false,
      min: 1,
      step: 1,
      modes: ["add", "override"],
      schema: schema("/$defs/patch/properties/bagItemNumericId")
    },
    {
      path: "patch.materialDropNumericIds",
      control: "json",
      label: "材料掉落白名单（patch.materialDropNumericIds，1–32 个不重复编号的 JSON 数组）",
      required: false,
      rows: 3,
      modes: ["add", "override"],
      schema: schema("/$defs/patch/properties/materialDropNumericIds")
    },
    {
      path: "patch.materialDropExpectedSellValue",
      control: "number",
      label: "材料期望出售价值（patch.materialDropExpectedSellValue，>0）",
      required: false,
      min: 0,
      step: 1,
      modes: ["add", "override"],
      schema: schema("/$defs/patch/properties/materialDropExpectedSellValue")
    },
    {
      path: "patch.firstKillMaterialRewardNumericIds",
      control: "json",
      label: "首杀材料奖励（patch.firstKillMaterialRewardNumericIds，≤16 个编号的 JSON 数组，须属于掉落白名单）",
      required: false,
      rows: 3,
      modes: ["add", "override"],
      schema: schema("/$defs/patch/properties/firstKillMaterialRewardNumericIds")
    },
    {
      path: "patch.bagItems",
      control: "json",
      label: "储物袋道具（patch.bagItems，≤100 项的 JSON 数组，结构见 schema /$defs/bagItem）",
      required: false,
      rows: 6,
      modes: ["add", "override"],
      schema: schema("/$defs/patch/properties/bagItems")
    },
    {
      path: "portraitImageBasename",
      control: "text",
      label: "自定义立绘名（portraitImageBasename，不含扩展名）",
      required: false,
      pattern: ASSET_PATTERN,
      modes: ["add", "override"],
      schema: schema("/oneOf/0/properties/portraitImageBasename")
    },
    {
      path: "badgeImageBasename",
      control: "text",
      label: "徽章名（badgeImageBasename，不含扩展名；只替换徽章）",
      required: false,
      pattern: ASSET_PATTERN,
      modes: ["add", "override"],
      schema: schema("/oneOf/0/properties/badgeImageBasename")
    },
    {
      path: "battlePresentation",
      control: "json",
      label: "自定义战斗分层（battlePresentation，仅 NPC；结构见 schema /$defs/battlePresentation）",
      required: false,
      rows: 8,
      modes: ["add", "override"],
      schema: schema("/$defs/battlePresentation")
    }
  ];
}

function validateEnemyId(entry, mode, ctx, results) {
  const id = entry.enemyId;
  if (isBlank(id)) {
    results.push(warning("enemyId.required", "enemyId", "尚未填写 enemyId"));
    return;
  }
  if (typeof id !== "string") {
    results.push(error("enemyId.type", "enemyId", "enemyId 必须是字符串"));
    return;
  }
  if (mode !== "add") {
    return;
  }
  if (!ENEMY_ID_RE.test(id)) {
    results.push(
      error("enemyId.invalid", "enemyId", "enemyId 必须是 <mod-id>:<本地-id>（小写反向域名 : 小写短名）")
    );
    return;
  }
  const namespace = expectedNamespace(ctx);
  if (namespace != null && namespaceOf(id) !== namespace) {
    results.push(
      error("enemyId.namespace", "enemyId", "enemyId 前缀必须等于 manifest.id（" + namespace + "）")
    );
  }
}

function validateAssetBasename(value, path, results) {
  if (value === undefined || value === null) {
    return;
  }
  if (typeof value !== "string" || !ASSET_RE.test(value)) {
    results.push(
      error(path + ".invalid", path, path + " 只能含小写字母数字、下划线与短横线，且以小写字母数字开头")
    );
  }
}

function validateRank(rank, results) {
  if (rank === undefined || rank === null) {
    return;
  }
  const path = "patch.rank";
  if (!isPlainObject(rank)) {
    results.push(error("rank.type", path, "rank 必须是对象"));
    return;
  }
  if (rank.tier !== undefined) {
    if (!isInteger(rank.tier) || rank.tier < 0 || rank.tier > 13) {
      results.push(error("rank.tier.range", path + ".tier", "rank.tier 必须是 0–13 的整数"));
    }
  }
  if (rank.phase !== undefined && !PHASES.includes(rank.phase)) {
    results.push(error("rank.phase.invalid", path + ".phase", "rank.phase 只能是 none/lower/middle/upper/peak"));
  }
  if (rank.tier === 0 && rank.phase !== undefined && rank.phase !== "none") {
    results.push(error("rank.phase.tier0", path + ".phase", "tier=0 时 rank.phase 必须为 none"));
  }
  if (isInteger(rank.tier) && rank.tier > 0 && rank.phase === "none") {
    results.push(error("rank.phase.nonzero", path + ".phase", "tier>0 时 rank.phase 不能为 none"));
  }
}

function validatePrimaryStats(stats, mode, results) {
  const base = "patch.primaryStats";
  if (stats === undefined || stats === null) {
    if (mode === "add") {
      results.push(warning("primaryStats.required", base, "尚未填写一级属性（primaryStats）"));
    }
    return;
  }
  if (!isPlainObject(stats)) {
    results.push(error("primaryStats.type", base, "primaryStats 必须是对象"));
    return;
  }
  for (const key of STAT_KEYS) {
    const value = stats[key];
    if (value === undefined || value === null) {
      if (mode === "add") {
        results.push(warning("primaryStats." + key + ".required", base + "." + key, "尚未填写 " + key));
      }
      continue;
    }
    const min = key === "health" ? 1 : 0;
    if (!isInteger(value) || value < min || value > 1000000000) {
      results.push(
        error("primaryStats." + key + ".range", base + "." + key, key + " 必须是 " + min + "–1000000000 的整数")
      );
    }
  }
}

function validateMaterialDropIds(ids, results) {
  const path = "patch.materialDropNumericIds";
  if (ids === undefined || ids === null) {
    return;
  }
  if (!Array.isArray(ids)) {
    results.push(error("materialDropNumericIds.type", path, "materialDropNumericIds 必须是数组"));
    return;
  }
  if (ids.length < 1 || ids.length > 32) {
    results.push(error("materialDropNumericIds.count", path, "materialDropNumericIds 数量必须在 1–32 之间"));
  }
  if (new Set(ids).size !== ids.length) {
    results.push(error("materialDropNumericIds.unique", path, "materialDropNumericIds 不能重复"));
  }
  ids.forEach((id, index) => {
    if (!isInteger(id) || id < 1) {
      results.push(error("materialDropNumericIds.item", path + "[" + index + "]", "材料编号必须是 ≥1 的整数"));
    }
  });
}

function validateFirstKillIds(ids, results) {
  const path = "patch.firstKillMaterialRewardNumericIds";
  if (ids === undefined || ids === null) {
    return;
  }
  if (!Array.isArray(ids)) {
    results.push(error("firstKillMaterialRewardNumericIds.type", path, "firstKillMaterialRewardNumericIds 必须是数组"));
    return;
  }
  if (ids.length > 16) {
    results.push(error("firstKillMaterialRewardNumericIds.count", path, "firstKillMaterialRewardNumericIds 最多 16 项"));
  }
  ids.forEach((id, index) => {
    if (!isInteger(id) || id < 1) {
      results.push(
        error("firstKillMaterialRewardNumericIds.item", path + "[" + index + "]", "首杀材料编号必须是 ≥1 的整数")
      );
    }
  });
}

function validateBagItems(items, results) {
  const path = "patch.bagItems";
  if (items === undefined || items === null) {
    return;
  }
  if (!Array.isArray(items)) {
    results.push(error("bagItems.type", path, "bagItems 必须是数组"));
    return;
  }
  if (items.length > 100) {
    results.push(error("bagItems.count", path, "bagItems 最多 100 项"));
  }
  items.forEach((bagItem, index) => {
    const itemPath = path + "[" + index + "]";
    if (!isPlainObject(bagItem)) {
      results.push(error("bagItems.item", itemPath, "储物袋道具必须是对象"));
      return;
    }
    if (typeof bagItem.instanceId !== "string" || bagItem.instanceId.length < 1 || bagItem.instanceId.length > 120) {
      results.push(error("bagItems.instanceId", itemPath + ".instanceId", "instanceId 长度须为 1–120"));
    }
    if (!isInteger(bagItem.templateNumericId) || bagItem.templateNumericId < 1) {
      results.push(error("bagItems.templateNumericId", itemPath + ".templateNumericId", "templateNumericId 必须是 ≥1 的整数"));
    }
    if (!isInteger(bagItem.row) || bagItem.row < 0) {
      results.push(error("bagItems.row", itemPath + ".row", "row 必须是 ≥0 的整数"));
    }
    if (!isInteger(bagItem.col) || bagItem.col < 0) {
      results.push(error("bagItems.col", itemPath + ".col", "col 必须是 ≥0 的整数"));
    }
    if (bagItem.star !== undefined && (!isInteger(bagItem.star) || bagItem.star < 1 || bagItem.star > 5)) {
      results.push(error("bagItems.star", itemPath + ".star", "star 必须是 1–5 的整数"));
    }
  });
}

function validatePatch(patch, mode, results) {
  const base = "patch";
  if (!isPlainObject(patch)) {
    results.push(error("patch.type", base, "patch 必须是对象"));
    return;
  }
  if (mode === "override" && Object.keys(patch).length === 0) {
    results.push(error("patch.empty", base, "patch 至少包含一个字段"));
  }

  for (const [key, max] of [["name", 40], ["species", 40], ["flavor", 120], ["detail", 600]]) {
    const value = patch[key];
    if (value === undefined || value === null) {
      continue;
    }
    if (typeof value !== "string") {
      results.push(error(base + "." + key + ".type", base + "." + key, key + " 必须是字符串"));
    } else if (value.length === 0) {
      results.push(warning(base + "." + key + ".empty", base + "." + key, key + " 为空，导出会被官方验证器拒绝"));
    } else if (value.length > max) {
      results.push(error(base + "." + key + ".max", base + "." + key, key + " 最多 " + max + " 字"));
    }
  }

  if (patch.portraitFacing !== undefined && patch.portraitFacing !== "left" && patch.portraitFacing !== "right") {
    results.push(error("patch.portraitFacing.invalid", base + ".portraitFacing", "portraitFacing 只能是 left 或 right"));
  }

  if (patch.threatTags !== undefined && patch.threatTags !== null) {
    if (!Array.isArray(patch.threatTags)) {
      results.push(error("patch.threatTags.type", base + ".threatTags", "threatTags 必须是字符串数组"));
    } else {
      if (patch.threatTags.length > 8) {
        results.push(error("patch.threatTags.max", base + ".threatTags", "threatTags 最多 8 项"));
      }
      patch.threatTags.forEach((tag, index) => {
        if (typeof tag !== "string" || tag.length < 1 || tag.length > 20) {
          results.push(error("patch.threatTags.item", base + ".threatTags[" + index + "]", "每个威胁标签长度须为 1–20"));
        }
      });
    }
  }

  validateRank(patch.rank, results);
  validatePrimaryStats(patch.primaryStats, mode, results);

  if (patch.escapeBaseDurationSec !== undefined && patch.escapeBaseDurationSec !== null) {
    const value = patch.escapeBaseDurationSec;
    if (typeof value !== "number" || !(value > 0) || value > 3600) {
      results.push(
        error("patch.escapeBaseDurationSec.range", base + ".escapeBaseDurationSec", "escapeBaseDurationSec 必须是 >0 且 ≤3600 的数值")
      );
    }
  }

  if (patch.lethalOnDefeat !== undefined && patch.lethalOnDefeat !== null && typeof patch.lethalOnDefeat !== "boolean") {
    results.push(error("patch.lethalOnDefeat.type", base + ".lethalOnDefeat", "lethalOnDefeat 必须是布尔值"));
  } else if (mode === "add" && patch.lethalOnDefeat === undefined) {
    results.push(
      warning(
        "patch.lethalOnDefeat.default",
        base + ".lethalOnDefeat",
        "未填写 lethalOnDefeat，新增敌人默认 false：仅在一命模式的致命战败中判定，普通模式不受影响"
      )
    );
  }

  if (patch.bagSize !== undefined && patch.bagSize !== null) {
    if (!isInteger(patch.bagSize) || patch.bagSize < 1 || patch.bagSize > 10) {
      results.push(error("patch.bagSize.range", base + ".bagSize", "bagSize 必须是 1–10 的整数"));
    }
  }

  if (patch.bagItemNumericId !== undefined && patch.bagItemNumericId !== null) {
    if (!isInteger(patch.bagItemNumericId) || patch.bagItemNumericId < 1) {
      results.push(error("patch.bagItemNumericId.range", base + ".bagItemNumericId", "bagItemNumericId 必须是 ≥1 的整数"));
    }
  }

  validateMaterialDropIds(patch.materialDropNumericIds, results);
  validateFirstKillIds(patch.firstKillMaterialRewardNumericIds, results);
  validateBagItems(patch.bagItems, results);

  if (patch.materialDropExpectedSellValue !== undefined && patch.materialDropExpectedSellValue !== null) {
    const value = patch.materialDropExpectedSellValue;
    if (typeof value !== "number" || !(value > 0)) {
      results.push(
        error("patch.materialDropExpectedSellValue.range", base + ".materialDropExpectedSellValue", "materialDropExpectedSellValue 必须大于 0")
      );
    }
  }
}

function validateAdd(entry, results) {
  const basedOn = entry.basedOn;
  if (isBlank(basedOn)) {
    results.push(warning("basedOn.required", "basedOn", "尚未选择继承的官方敌人（basedOn）"));
  } else if (typeof basedOn !== "string") {
    results.push(error("basedOn.type", "basedOn", "basedOn 必须是字符串"));
  } else if (!ENEMY_BY_ID.has(basedOn)) {
    results.push(
      error("basedOn.unknown", "basedOn", "basedOn 必须来自公开敌人目录，官方敌人不可自造：" + basedOn)
    );
  }
  validatePatch(entry.patch, "add", results);
}

function validateOverride(entry, results) {
  const id = entry.enemyId;
  if (typeof id === "string" && id !== "") {
    const target = ENEMY_BY_ID.get(id);
    if (target && target.modOverridePolicy !== "allowed") {
      results.push(
        error(
          "enemyId.onboardingProtected",
          "enemyId",
          "官方敌人 " + id + " 为新手保护敌人（modOverridePolicy=" + target.modOverridePolicy + "），禁止覆写"
        )
      );
    } else if (!target) {
      results.push(
        warning("enemyId.unknown", "enemyId", "enemyId 不在公开敌人目录中：" + id + "，override 目标应为官方敌人")
      );
    }
  }
  validatePatch(entry.patch, "override", results);
}

function validateDelete(entry, ctx, results) {
  const id = entry.enemyId;
  if (isBlank(id)) {
    return;
  }
  if (typeof id !== "string") {
    return;
  }
  if (ENEMY_BY_ID.has(id)) {
    results.push(
      error("enemyId.officialDelete", "enemyId", "官方敌人一律禁止删除（包括固定守门战中的敌人）：" + id)
    );
    return;
  }
  const namespace = namespaceOf(id);
  if (namespace == null) {
    results.push(error("enemyId.namespace", "enemyId", "delete 目标必须是本 Mod 命名空间 ID（<manifest.id>:<本地-id>）"));
    return;
  }
  const expected = expectedNamespace(ctx);
  if (expected != null && namespace !== expected) {
    results.push(error("enemyId.namespace", "enemyId", "delete 只能删除本包命名空间（" + expected + "）的敌人"));
  }
}

export function validateEntry(entry, ctx = {}) {
  const results = [];
  if (!isPlainObject(entry)) {
    results.push(error("entry.type", "", "条目必须是对象"));
    return results;
  }
  const mode = entry.mode;
  if (!MODES.includes(mode)) {
    results.push(error("mode.invalid", "mode", "mode 必须是 add/override/delete"));
    return results;
  }
  validateEnemyId(entry, mode, ctx, results);
  if (mode === "add") {
    validateAdd(entry, results);
  } else if (mode === "override") {
    validateOverride(entry, results);
  } else {
    validateDelete(entry, ctx, results);
  }
  validateAssetBasename(entry.portraitImageBasename, "portraitImageBasename", results);
  validateAssetBasename(entry.badgeImageBasename, "badgeImageBasename", results);
  return results;
}

export function validateProject(project, domain = "enemies") {
  const results = [];
  const entries = collectEntries(project, domain);
  const manifest = project && isPlainObject(project.meta) ? project.meta.manifest : null;
  const modId = manifest && typeof manifest.id === "string" && manifest.id !== "" ? manifest.id : null;
  const seen = new Map();

  entries.forEach((entry, index) => {
    if (!isPlainObject(entry)) {
      return;
    }
    const id = entry.enemyId;
    if (typeof id !== "string" || id === "") {
      return;
    }
    const path = "content." + domain + "[" + index + "].enemyId";
    if (seen.has(id)) {
      results.push(error("enemyId.duplicate", path, "enemyId " + id + " 在本 Mod 内重复声明"));
    } else {
      seen.set(id, index);
    }
    if (modId && entry.mode === "add" && namespaceOf(id) !== null && namespaceOf(id) !== modId) {
      results.push(error("enemyId.namespace", path, "enemyId 前缀必须等于 manifest.id（" + modId + "）"));
    }
    if (entry.mode === "delete") {
      if (ENEMY_BY_ID.has(id)) {
        results.push(error("enemyId.officialDelete", path, "官方敌人一律禁止删除：" + id));
      } else if (modId && namespaceOf(id) !== modId) {
        results.push(error("enemyId.namespace", path, "delete 只能删除本包命名空间（" + modId + "）的敌人"));
      }
    }
  });

  return results;
}

function buildOutput(entry) {
  const mode = entry.mode || "add";
  const output = { mode };
  if (entry.enemyId !== undefined) {
    output.enemyId = entry.enemyId;
  }
  if (mode === "add" && entry.basedOn !== undefined) {
    output.basedOn = entry.basedOn;
  }
  if (mode === "add" || mode === "override") {
    if (entry.patch !== undefined) {
      output.patch = entry.patch;
    }
    for (const key of ["portraitImageBasename", "badgeImageBasename", "battlePresentation"]) {
      if (entry[key] !== undefined) {
        output[key] = entry[key];
      }
    }
  }
  if (isPlainObject(entry.__raw)) {
    Object.assign(output, entry.__raw);
  }
  return output;
}

function toFile(entry) {
  if (!isPlainObject(entry)) {
    throw new Error("toFiles: 条目必须是对象");
  }
  const id = entry.enemyId;
  if (typeof id !== "string" || id === "") {
    throw new Error("toFiles: 条目缺少 enemyId");
  }
  const localId = localNameOf(id);
  if (typeof localId !== "string" || localId === "") {
    throw new Error("toFiles: enemyId 本地名非法：" + id);
  }
  return { path: "enemies/" + localId + ".json", content: JSON.stringify(buildOutput(entry), null, 2) };
}

export function toFiles(entriesOrEntry, ctx = {}) {
  void ctx;
  const list = Array.isArray(entriesOrEntry) ? entriesOrEntry : [entriesOrEntry];
  return list.map((entry) => toFile(entry));
}

export function fromFiles(files, ctx = {}) {
  void ctx;
  if (!Array.isArray(files)) {
    return [];
  }
  const entries = [];
  for (const file of files) {
    if (!file || typeof file.path !== "string") {
      continue;
    }
    const normalized = file.path.replace(/\\/g, "/");
    if (!/(^|\/)enemies\/[^/]+\.json$/i.test(normalized)) {
      continue;
    }
    let parsed;
    try {
      parsed = JSON.parse(file.content);
    } catch {
      throw new Error("fromFiles: " + normalized + " 不是合法 JSON");
    }
    if (!isPlainObject(parsed)) {
      continue;
    }
    const entry = {};
    for (const key of KNOWN_ROOT) {
      if (key in parsed) {
        entry[key] = parsed[key];
      }
    }
    const raw = {};
    let hasRaw = false;
    for (const key of Object.keys(parsed)) {
      if (!KNOWN_ROOT.includes(key)) {
        raw[key] = parsed[key];
        hasRaw = true;
      }
    }
    if (hasRaw) {
      entry.__raw = raw;
    }
    entries.push(entry);
  }
  return entries;
}

export function summarize(entry) {
  if (!isPlainObject(entry)) {
    return "（无效敌人）";
  }
  const mode = entry.mode || "add";
  const id = typeof entry.enemyId === "string" && entry.enemyId ? entry.enemyId : "未命名";
  const patch = isPlainObject(entry.patch) ? entry.patch : {};
  const official = ENEMY_BY_ID.get(id);
  const name = patch.name || (official ? official.name : "") || id;
  if (mode === "add") {
    const rank = isPlainObject(patch.rank) ? " tier" + patch.rank.tier + "/" + patch.rank.phase : "";
    return "新增 " + name + "（" + id + "）继承 " + (entry.basedOn || "?") + rank;
  }
  if (mode === "override") {
    return "覆写 " + name + "（" + id + "）";
  }
  return "删除 " + name + "（" + id + "）";
}
