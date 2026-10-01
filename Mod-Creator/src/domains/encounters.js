import { enemies, practiceBuffs } from "../generated/catalogs.js";

const SCHEMA_FILE = "encounters@1|2 · encounter.schema.json";
const ENCOUNTER_ID_PATTERN = "^[a-z0-9]+(?:[.-][a-z0-9]+)+:[a-z0-9]+(?:-[a-z0-9]+)*$";
const ENCOUNTER_ID_RE = new RegExp(ENCOUNTER_ID_PATTERN);
const MOD_ID_RE = /^[a-z0-9]+(?:[.-][a-z0-9]+)+$/;
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MAP_REF_RE = /^(map_[0-9]{2,3}|[a-z0-9]+(?:[.-][a-z0-9]+)+:[a-z0-9]+(?:-[a-z0-9]+)*)$/;
const BANNER_RE = /^[a-z0-9][a-z0-9_-]{0,79}$/;

const TYPES = ["story", "reward", "battle", "practice"];
const ACTIONS = ["claimRewards", "completeEncounter", "startBattle", "startCultivation"];
const ACTION_BY_TYPE = {
  story: ["claimRewards", "completeEncounter"],
  reward: ["claimRewards"],
  battle: ["startBattle"],
  practice: ["startCultivation"]
};
const REWARD_TYPES = ["item", "spiritStones", "lucky", "cultivation", "restorePrimaryStatsPercent"];
const STATS = ["health", "stamina", "mana", "spiritSense", "bloodEssence"];

const ENEMY_OPTIONS = enemies.map((enemy) => ({
  value: enemy.enemyId,
  label: enemy.name + "（" + enemy.enemyId + "）"
}));
const ENEMY_IDS = new Set(enemies.map((enemy) => enemy.enemyId));
const BUFF_OPTIONS = practiceBuffs.map((buff) => ({
  value: buff.buffId,
  label: buff.label + "（" + buff.buffId + "）"
}));
const BUFF_IDS = new Set(practiceBuffs.map((buff) => buff.buffId));
const MAP_OPTIONS = [
  { value: "map_01", label: "map_01（首图）" },
  ...[5, 6, 7, 8, 9, 10].map((n) => {
    const value = "map_" + String(n).padStart(2, "0");
    return { value, label: value };
  })
];

export const meta = {
  key: "encounters",
  labelZh: "遭遇",
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

function collectEntries(project, domain) {
  if (Array.isArray(project)) {
    return project;
  }
  if (project && isPlainObject(project.content) && Array.isArray(project.content[domain])) {
    return project.content[domain];
  }
  return [];
}

function schema(pointer) {
  return SCHEMA_FILE + (pointer ? "#" + pointer : "");
}

export function createEntry(partial = {}) {
  return {
    encounterId: "",
    allowedMapIds: [],
    type: "story",
    title: "",
    body: "",
    rewards: [],
    options: [{ id: "ok", label: "确认", action: "completeEncounter" }],
    ...partial
  };
}

export function fields() {
  return [
    {
      path: "encounterId",
      control: "text",
      label: "遭遇 ID（<mod-id>:<slug>，如 com.example.moss-encounters:moss-ambush）",
      required: true,
      pattern: ENCOUNTER_ID_PATTERN,
      schema: schema()
    },
    {
      path: "allowedMapIds",
      control: "multi-select",
      label: "允许地图（可用 map_01、官方 map_05–map_10，或同包地图 ID）",
      required: true,
      options: MAP_OPTIONS,
      freeform: true,
      schema: schema("/properties/allowedMapIds")
    },
    {
      path: "type",
      control: "select",
      label: "遭遇类型",
      required: true,
      options: [
        { value: "story", label: "剧情（story）" },
        { value: "reward", label: "奖励（reward）" },
        { value: "battle", label: "战斗（battle）" },
        { value: "practice", label: "修行（practice）" }
      ],
      schema: schema("/properties/type")
    },
    {
      path: "title",
      control: "text",
      label: "标题（title，1–40 字）",
      required: true,
      schema: schema("/properties/title")
    },
    {
      path: "summary",
      control: "text",
      label: "简述（summary，1–80 字）",
      required: false,
      schema: schema("/properties/summary")
    },
    {
      path: "completedSummary",
      control: "text",
      label: "完成简述（completedSummary，1–80 字）",
      required: false,
      schema: schema("/properties/completedSummary")
    },
    {
      path: "bannerTone",
      control: "text",
      label: "横幅色调（bannerTone，1–40 字）",
      required: false,
      schema: schema("/properties/bannerTone")
    },
    {
      path: "bannerImageBasename",
      control: "text",
      label: "横幅图名（bannerImageBasename，不含扩展名）",
      required: false,
      schema: schema("/properties/bannerImageBasename")
    },
    {
      path: "body",
      control: "text",
      label: "正文（body，1–1200 字）",
      required: true,
      multiline: true,
      rows: 6,
      schema: schema("/properties/body")
    },
    {
      path: "rewards",
      control: "json",
      label: "奖励列表（rewards，最多 8 条；type 见 schema /$defs/reward）",
      required: false,
      rows: 6,
      schema: schema("/$defs/reward")
    },
    {
      path: "options",
      control: "json",
      label: "选项（options，1–6 条；action 必须与 type 匹配：story→claimRewards/completeEncounter、reward→claimRewards、battle→startBattle、practice→startCultivation）",
      required: true,
      rows: 6,
      schema: schema("/$defs/option")
    },
    {
      path: "battle.enemyId",
      control: "select",
      label: "战斗敌人（battle.enemyId，battle 类型必填，来自公开敌人目录）",
      required: false,
      options: ENEMY_OPTIONS,
      schema: schema("/properties/battle/properties/enemyId")
    },
    {
      path: "battle.lootMode",
      control: "select",
      label: "掉落模式（battle.lootMode，默认 full）",
      required: false,
      options: [
        { value: "full", label: "完整掉落（full）" },
        { value: "none", label: "无自动掉落（none，切磋/擒拿）" }
      ],
      schema: schema("/properties/battle/properties/lootMode")
    },
    {
      path: "battle.bagItemDropChance",
      control: "number",
      label: "袋内道具独立掉率（battle.bagItemDropChance，0–1）",
      required: false,
      min: 0,
      max: 1,
      step: 0.01,
      schema: schema("/properties/battle/properties/bagItemDropChance")
    },
    {
      path: "battle.survivalVictoryElapsedSec",
      control: "number",
      label: "生存胜利秒数（battle.survivalVictoryElapsedSec，>0 且 ≤3600）",
      required: false,
      min: 0,
      max: 3600,
      step: 1,
      schema: schema("/properties/battle/properties/survivalVictoryElapsedSec")
    },
    {
      path: "practiceBuffIds",
      control: "multi-select",
      label: "修行 Buff（practiceBuffIds，1–4 项，来自公开修行 Buff 目录）",
      required: false,
      options: BUFF_OPTIONS,
      schema: schema("/properties/practiceBuffIds")
    }
  ];
}

function validateEncounterId(entry, ctx, results) {
  const id = entry.encounterId;
  if (isBlank(id)) {
    results.push(warning("encounterId.required", "encounterId", "尚未填写 encounterId（格式 <mod-id>:<slug>）"));
    return;
  }
  if (typeof id !== "string" || !ENCOUNTER_ID_RE.test(id)) {
    results.push(error("encounterId.invalid", "encounterId", "encounterId 必须是 <mod-id>:<slug>（小写反向域名 : 小写短名）"));
    return;
  }
  if (ctx.modId) {
    const prefix = id.slice(0, id.lastIndexOf(":"));
    if (prefix !== ctx.modId) {
      results.push(error("encounterId.prefix", "encounterId", "encounterId 必须以 manifest.id（" + ctx.modId + "）为前缀"));
    }
  }
}

function validateAllowedMapIds(ids, results) {
  if (ids === undefined || ids === null || (Array.isArray(ids) && ids.length === 0)) {
    results.push(warning("allowedMapIds.required", "allowedMapIds", "尚未填写 allowedMapIds（至少一个地图）"));
    return;
  }
  if (!Array.isArray(ids)) {
    results.push(error("allowedMapIds.type", "allowedMapIds", "allowedMapIds 必须是数组"));
    return;
  }
  if (ids.length > 16) {
    results.push(error("allowedMapIds.max", "allowedMapIds", "allowedMapIds 最多 16 项"));
  }
  if (new Set(ids).size !== ids.length) {
    results.push(error("allowedMapIds.unique", "allowedMapIds", "allowedMapIds 不能重复"));
  }
  ids.forEach((mapId, index) => {
    if (typeof mapId !== "string" || !MAP_REF_RE.test(mapId)) {
      results.push(
        error(
          "allowedMapIds.invalid",
          "allowedMapIds[" + index + "]",
          "地图 ID 非法：" + mapId + "（须为 map_XX 或同包 <mod-id>:<slug>）"
        )
      );
    }
  });
}

function validateOptions(options, type, results) {
  if (!Array.isArray(options)) {
    results.push(error("options.type", "options", "options 必须是数组"));
    return;
  }
  if (options.length < 1 || options.length > 6) {
    results.push(error("options.count", "options", "options 数量必须在 1–6 之间"));
  }
  const allowed = ACTION_BY_TYPE[type];
  options.forEach((option, index) => {
    const path = "options[" + index + "]";
    if (!isPlainObject(option)) {
      results.push(error("options.item", path, "选项必须是对象"));
      return;
    }
    if (typeof option.id !== "string" || !SLUG_RE.test(option.id)) {
      results.push(error("options.id", path + ".id", "选项 id 必须是小写短名"));
    }
    if (typeof option.label !== "string" || option.label.length === 0) {
      results.push(warning("options.label", path + ".label", "尚未填写选项文案（label）"));
    } else if (option.label.length > 30) {
      results.push(error("options.label.max", path + ".label", "选项文案最多 30 字"));
    }
    if (typeof option.action !== "string" || !ACTIONS.includes(option.action)) {
      results.push(
        error("options.action", path + ".action", "action 非法（claimRewards/completeEncounter/startBattle/startCultivation）")
      );
    } else if (allowed && !allowed.includes(option.action)) {
      results.push(
        error(
          "options.action.mismatch",
          path + ".action",
          "type=" + type + " 只允许 action " + allowed.join("/") + "，当前为 " + option.action
        )
      );
    }
  });
}

function validateRewards(rewards, type, results) {
  if (rewards === undefined || rewards === null) {
    if (type === "reward") {
      results.push(error("rewards.required", "rewards", "reward 类型至少需要一项奖励"));
    }
    return;
  }
  if (!Array.isArray(rewards)) {
    results.push(error("rewards.type", "rewards", "rewards 必须是数组"));
    return;
  }
  if (rewards.length > 8) {
    results.push(error("rewards.max", "rewards", "rewards 最多 8 项"));
  }
  if (type === "reward" && rewards.length === 0) {
    results.push(error("rewards.required", "rewards", "reward 类型至少需要一项奖励"));
  }
  rewards.forEach((reward, index) => {
    const path = "rewards[" + index + "]";
    if (!isPlainObject(reward)) {
      results.push(error("rewards.item", path, "奖励必须是对象"));
      return;
    }
    if (typeof reward.key !== "string" || !SLUG_RE.test(reward.key)) {
      results.push(error("rewards.key", path + ".key", "奖励 key 必须是小写短名"));
    }
    if (reward.dropChance !== undefined) {
      if (typeof reward.dropChance !== "number" || reward.dropChance <= 0 || reward.dropChance > 1) {
        results.push(error("rewards.dropChance", path + ".dropChance", "dropChance 必须在 (0,1] 之间"));
      }
    }
    if (!REWARD_TYPES.includes(reward.type)) {
      results.push(
        error(
          "rewards.type.invalid",
          path + ".type",
          "奖励类型非法（item/spiritStones/lucky/cultivation/restorePrimaryStatsPercent）"
        )
      );
      return;
    }
    if (reward.type === "item") {
      if (!Number.isInteger(reward.templateNumericId) || reward.templateNumericId < 1) {
        results.push(
          error("rewards.templateNumericId", path + ".templateNumericId", "item 奖励必须提供正整数 templateNumericId")
        );
      }
      return;
    }
    if (reward.type === "spiritStones" || reward.type === "lucky" || reward.type === "cultivation") {
      if (!Number.isInteger(reward.amount) || reward.amount < 1) {
        results.push(error("rewards.amount", path + ".amount", "amount 必须是大于等于 1 的整数"));
      }
      return;
    }
    if (typeof reward.percent !== "number" || reward.percent <= 0 || reward.percent > 1) {
      results.push(error("rewards.percent", path + ".percent", "percent 必须在 (0,1] 之间"));
    }
    if (reward.stats !== undefined) {
      if (
        !Array.isArray(reward.stats) ||
        reward.stats.length === 0 ||
        reward.stats.some((stat) => !STATS.includes(stat))
      ) {
        results.push(
          error("rewards.stats", path + ".stats", "stats 必须是 health/stamina/mana/spiritSense/bloodEssence 的非空子集")
        );
      }
    }
  });
}

function validateBattle(entry, type, results) {
  const battle = isPlainObject(entry.battle) ? entry.battle : null;
  if (type === "battle") {
    if (!battle || isBlank(battle.enemyId)) {
      results.push(
        error("battle.enemyId.required", "battle.enemyId", "battle 类型必填 battle.enemyId，且必须来自公开敌人目录")
      );
    } else if (!ENEMY_IDS.has(battle.enemyId)) {
      results.push(error("battle.enemyId.unknown", "battle.enemyId", "enemyId 不在公开敌人目录中：" + battle.enemyId));
    }
  }
  if (!battle) {
    return;
  }
  if (battle.lootMode !== undefined && battle.lootMode !== "full" && battle.lootMode !== "none") {
    results.push(error("battle.lootMode", "battle.lootMode", "lootMode 只能是 full 或 none"));
  }
  if (
    battle.bagItemDropChance !== undefined &&
    (typeof battle.bagItemDropChance !== "number" || battle.bagItemDropChance < 0 || battle.bagItemDropChance > 1)
  ) {
    results.push(error("battle.bagItemDropChance", "battle.bagItemDropChance", "bagItemDropChance 必须在 0–1 之间"));
  }
  if (
    battle.survivalVictoryElapsedSec !== undefined &&
    (typeof battle.survivalVictoryElapsedSec !== "number" ||
      battle.survivalVictoryElapsedSec <= 0 ||
      battle.survivalVictoryElapsedSec > 3600)
  ) {
    results.push(
      error(
        "battle.survivalVictoryElapsedSec",
        "battle.survivalVictoryElapsedSec",
        "survivalVictoryElapsedSec 必须大于 0 且不超过 3600"
      )
    );
  }
  if (battle.lootMode === "none" && (!Array.isArray(entry.rewards) || entry.rewards.length === 0)) {
    results.push(
      warning(
        "battle.lootMode.none",
        "battle.lootMode",
        "lootMode 为 none 会关闭敌人自动掉落（切磋/擒拿），建议把指定道具写入 rewards，否则无任何结算奖励"
      )
    );
  }
}

function validatePractice(entry, type, results) {
  if (type !== "practice") {
    return;
  }
  const ids = entry.practiceBuffIds;
  if (!Array.isArray(ids) || ids.length === 0) {
    results.push(error("practiceBuffIds.required", "practiceBuffIds", "practice 类型至少提供一项 practiceBuffIds"));
    return;
  }
  if (ids.length > 4) {
    results.push(error("practiceBuffIds.max", "practiceBuffIds", "practiceBuffIds 最多 4 项"));
  }
  if (new Set(ids).size !== ids.length) {
    results.push(error("practiceBuffIds.unique", "practiceBuffIds", "practiceBuffIds 不能重复"));
  }
  ids.forEach((buffId, index) => {
    if (!BUFF_IDS.has(buffId)) {
      results.push(
        error("practiceBuffIds.unknown", "practiceBuffIds[" + index + "]", "buffId 不在公开修行 Buff 目录中：" + buffId)
      );
    }
  });
}

export function validateEntry(entry, ctx = {}) {
  const results = [];
  if (!isPlainObject(entry)) {
    results.push(error("entry.type", "", "条目必须是对象"));
    return results;
  }

  validateEncounterId(entry, ctx, results);

  const type = entry.type;
  if (type === undefined || type === null || !TYPES.includes(type)) {
    results.push(error("type.invalid", "type", "type 必须是 story/reward/battle/practice"));
  }

  validateAllowedMapIds(entry.allowedMapIds, results);

  if (isBlank(entry.title)) {
    results.push(warning("title.required", "title", "尚未填写标题（title）"));
  } else if (typeof entry.title === "string" && entry.title.length > 40) {
    results.push(error("title.max", "title", "标题最多 40 字"));
  }
  if (isBlank(entry.body)) {
    results.push(warning("body.required", "body", "尚未填写正文（body）"));
  } else if (typeof entry.body === "string" && entry.body.length > 1200) {
    results.push(error("body.max", "body", "正文最多 1200 字"));
  }
  if (
    entry.bannerImageBasename !== undefined &&
    entry.bannerImageBasename !== null &&
    (typeof entry.bannerImageBasename !== "string" || !BANNER_RE.test(entry.bannerImageBasename))
  ) {
    results.push(
      error("bannerImageBasename.invalid", "bannerImageBasename", "bannerImageBasename 只能含小写字母数字、下划线与短横线")
    );
  }

  validateOptions(entry.options, type, results);
  validateRewards(entry.rewards, type, results);
  validateBattle(entry, type, results);
  validatePractice(entry, type, results);

  return results;
}

export function validateProject(project, domain = "encounters") {
  const results = [];
  const entries = collectEntries(project, domain);
  const manifest = project && isPlainObject(project.meta) ? project.meta.manifest : null;
  const modId = manifest && typeof manifest.id === "string" ? manifest.id : undefined;
  const seen = new Map();

  entries.forEach((entry, index) => {
    const id = isPlainObject(entry) ? entry.encounterId : null;
    if (typeof id !== "string" || id === "") {
      return;
    }
    const path = "content." + domain + "[" + index + "].encounterId";
    if (seen.has(id)) {
      results.push(error("encounterId.duplicate", path, "encounterId " + id + " 在本 Mod 内重复声明"));
    } else {
      seen.set(id, index);
    }
    if (modId && ENCOUNTER_ID_RE.test(id)) {
      const prefix = id.slice(0, id.lastIndexOf(":"));
      if (prefix !== modId) {
        results.push(error("encounterId.prefix", path, "encounterId 必须以 manifest.id（" + modId + "）为前缀"));
      }
    }
  });

  return results;
}

function slugOf(encounterId) {
  const index = encounterId.lastIndexOf(":");
  return index >= 0 ? encounterId.slice(index + 1) : encounterId;
}

function toFile(entry) {
  if (!isPlainObject(entry)) {
    throw new Error("toFiles: 条目必须是对象");
  }
  const id = entry.encounterId;
  if (typeof id !== "string" || id === "" || !ENCOUNTER_ID_RE.test(id)) {
    throw new Error("toFiles: 条目缺少合法的 encounterId（<mod-id>:<slug>）");
  }
  const slug = slugOf(id);
  if (!SLUG_RE.test(slug)) {
    throw new Error("toFiles: encounterId 短名非法：" + id);
  }
  return { path: "encounters/" + slug + ".json", content: JSON.stringify(entry, null, 2) };
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
    if (!/(^|\/)encounters\/[^/]+\.json$/i.test(normalized)) {
      continue;
    }
    let parsed;
    try {
      parsed = JSON.parse(file.content);
    } catch {
      throw new Error("fromFiles: " + normalized + " 不是合法 JSON");
    }
    entries.push(parsed);
  }
  return entries;
}

export function summarize(entry) {
  if (!isPlainObject(entry)) {
    return "（无效遭遇）";
  }
  const id = typeof entry.encounterId === "string" && entry.encounterId ? entry.encounterId : "未命名";
  const short = slugOf(id);
  const type = entry.type || "?";
  const title = entry.title || short;
  return "遭遇 " + type + "·" + title + "（" + short + "）";
}
