// src/domains/items.js — items@3 域：骨架、字段描述、校验、导入导出与摘要。

import {
  addableCategories,
  grades,
  elements,
  distributionChannels,
  itemModes,
  spellTriggerMode,
  spellRole,
  spellRewardKind
} from "../generated/enums.js";
import { effectKinds } from "../generated/mechanism.js";
import { items as officialItems } from "../generated/catalogs.js";

const SCHEMA_FILE = "items@3 · item.schema.json";
const EFFECTS_SCHEMA = "items@3 · item-effects.schema.json";
const ICON_PATTERN = "^[A-Za-z0-9][A-Za-z0-9_-]*$";
const ICON_RE = new RegExp(ICON_PATTERN);

const CATEGORY_RANGES = {
  scripture: [190001, 199999],
  pill: [390001, 399999],
  implement: [490001, 499999],
  chest: [490001, 499999],
  material: [590001, 599999],
  formation: [690001, 699999],
  talisman: [790001, 799999],
  spell: [890001, 899999],
  throwable: [990001, 999999]
};

const DELETE_RANGES = [
  [190001, 199999],
  [890001, 899999]
];

const OFFICIAL_IDS = new Set(officialItems.map((item) => item.numericId));

export const meta = {
  key: "items",
  labelZh: "道具",
  schemaVersion: 3,
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

function inRange(id, range) {
  return id >= range[0] && id <= range[1];
}

function rangeText(range) {
  return range[0] + "–" + range[1];
}

function numericIdOf(entry) {
  if (!isPlainObject(entry)) {
    return null;
  }
  if (isPlainObject(entry.item) && entry.item.numericId != null) {
    return entry.item.numericId;
  }
  if (entry.numericId != null) {
    return entry.numericId;
  }
  return null;
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

function isValidShape(shape) {
  if (!Array.isArray(shape) || shape.length === 0) {
    return false;
  }
  if (!Array.isArray(shape[0]) || shape[0].length === 0) {
    return false;
  }
  const width = shape[0].length;
  return shape.every(
    (row) =>
      Array.isArray(row) &&
      row.length === width &&
      row.every((cell) => cell === 0 || cell === 1)
  );
}

export function nextNumericId(existingEntries, category) {
  const range = CATEGORY_RANGES[category] || CATEGORY_RANGES.material;
  const used = new Set(OFFICIAL_IDS);
  const list = Array.isArray(existingEntries)
    ? existingEntries
    : collectEntries(existingEntries, "items");
  for (const entry of list) {
    const id = numericIdOf(entry);
    if (id != null) {
      used.add(id);
    }
  }
  for (let id = range[0]; id <= range[1]; id++) {
    if (!used.has(id)) {
      return id;
    }
  }
  return range[0];
}

export function createEntry(partial = {}) {
  const { existingEntries, ...rest } = isPlainObject(partial) ? partial : {};
  const partialItem = isPlainObject(rest.item) ? rest.item : {};
  const category = partialItem.category || "material";
  const skeleton = {
    mode: "add",
    item: {
      numericId: nextNumericId(existingEntries, category),
      iconBasename: "",
      name: "",
      description: "",
      isPublished: true,
      isObtainable: true,
      category: "material",
      grade: "common",
      element: "none",
      shape: [[1]],
      tags: [],
      effectList: []
    }
  };
  const next = { ...skeleton, ...rest };
  if (isPlainObject(rest.item)) {
    next.item = { ...skeleton.item, ...rest.item };
  }
  return next;
}

export function fields() {
  const schema = (pointer) => SCHEMA_FILE + (pointer ? "#" + pointer : "");
  return [
    {
      path: "mode",
      control: "select",
      label: "模式",
      required: true,
      options: "itemModes",
      optionsGroup: "itemModes",
      modes: ["add", "override", "delete"],
      schema: schema("/oneOf/0/properties/mode")
    },
    {
      path: "item.numericId",
      control: "number",
      label: "道具编号（numericId）",
      required: true,
      min: 1,
      step: 1,
      modes: ["add"],
      schema: schema("/$defs/addItem/allOf/1/properties/numericId")
    },
    {
      path: "item.iconBasename",
      control: "text",
      label: "图标名（iconBasename，不含扩展名）",
      required: true,
      pattern: ICON_PATTERN,
      modes: ["add"],
      schema: schema("/$defs/commonFields/properties/iconBasename")
    },
    {
      path: "item.name",
      control: "text",
      label: "名称",
      required: true,
      modes: ["add"],
      schema: schema("/$defs/commonFields/properties/name")
    },
    {
      path: "item.description",
      control: "text",
      label: "描述",
      required: true,
      multiline: true,
      rows: 4,
      modes: ["add"],
      schema: schema("/$defs/commonFields/properties/description")
    },
    {
      path: "item.isPublished",
      control: "toggle",
      label: "发布（isPublished）",
      required: true,
      modes: ["add"],
      schema: schema("/$defs/commonFields/properties/isPublished")
    },
    {
      path: "item.isObtainable",
      control: "toggle",
      label: "可获取（isObtainable）",
      required: true,
      modes: ["add"],
      schema: schema("/$defs/commonFields/properties/isObtainable")
    },
    {
      path: "item.category",
      control: "select",
      label: "类别",
      required: true,
      options: "addableCategories",
      optionsGroup: "addableCategories",
      modes: ["add"],
      schema: schema("/$defs/addItem/allOf/1/properties/category")
    },
    {
      path: "item.grade",
      control: "select",
      label: "品阶",
      required: true,
      options: "grades",
      optionsGroup: "grades",
      modes: ["add"],
      schema: schema("/$defs/commonFields/properties/grade")
    },
    {
      path: "item.element",
      control: "select",
      label: "元素",
      required: true,
      options: "elements",
      optionsGroup: "elements",
      modes: ["add"],
      schema: schema("/$defs/commonFields/properties/element")
    },
    {
      path: "item.shape",
      control: "shape-grid",
      label: "占格形状（0/1 网格）",
      required: true,
      max: 10,
      modes: ["add"],
      schema: schema("/$defs/shape")
    },
    {
      path: "item.tags",
      control: "multi-select",
      label: "标签",
      required: true,
      options: [],
      freeform: true,
      modes: ["add"],
      schema: schema("/$defs/commonFields/properties/tags")
    },
    {
      path: "item.effectList[]",
      control: "effect-editor",
      label: "效果列表（effectList）",
      required: true,
      modes: ["add"],
      schema: EFFECTS_SCHEMA
    },
    {
      path: "item.features",
      control: "multi-select",
      label: "特性（features，仅复用官方 token）",
      required: false,
      options: [],
      freeform: true,
      modes: ["add"],
      schema: schema("/$defs/commonFields/properties/features")
    },
    {
      path: "item.baseElements",
      control: "multi-select",
      label: "复合基础元素（baseElements）",
      required: false,
      options: "elements",
      optionsGroup: "elements",
      modes: ["add"],
      schema: schema("/$defs/commonFields/properties/baseElements")
    },
    {
      path: "item.price",
      control: "number",
      label: "价格（price）",
      required: false,
      min: 0,
      step: 1,
      modes: ["add", "override"],
      schema: schema("/$defs/commonFields/properties/price")
    },
    {
      path: "item.distribution",
      control: "distribution-editor",
      label: "投放（distribution：channels/uniquePerSave）",
      required: false,
      modes: ["add", "override"],
      schema: schema("/$defs/distribution")
    },
    {
      path: "item.iconTone",
      control: "json",
      label: "图标色调（iconTone：hueRotate/saturate/brightness）",
      required: false,
      rows: 3,
      modes: ["add", "override"],
      schema: schema("/$defs/commonFields/properties/iconTone")
    },
    {
      path: "item.resonanceNote",
      control: "text",
      label: "共鸣说明（resonanceNote，不产生效果）",
      required: false,
      modes: ["add", "override"],
      schema: schema("/$defs/commonFields/properties/resonanceNote")
    },
    {
      path: "item.formationLockDurationSec",
      control: "number",
      label: "阵法锁定秒数（formationLockDurationSec）",
      required: false,
      min: 0,
      step: 1,
      modes: ["add", "override"],
      schema: schema("/$defs/commonFields/properties/formationLockDurationSec")
    },
    {
      path: "item.formationLockDurationSecByStar",
      control: "json",
      label: "分星阵法锁定秒数（四元素数组，对应 0–3 星）",
      required: false,
      rows: 3,
      modes: ["add", "override"],
      schema: schema("/$defs/commonFields/properties/formationLockDurationSecByStar")
    },
    {
      path: "item.spell.sourceScriptureNumericId",
      control: "number",
      label: "来源功法编号（spell.sourceScriptureNumericId）",
      required: true,
      min: 1,
      step: 1,
      modes: ["add"],
      schema: schema("/$defs/spell/properties/sourceScriptureNumericId")
    },
    {
      path: "item.spell.unlockLayer",
      control: "number",
      label: "解锁层（spell.unlockLayer，必须 ≥2）",
      required: true,
      min: 2,
      step: 1,
      modes: ["add"],
      schema: schema("/$defs/spell/properties/unlockLayer")
    },
    {
      path: "item.spell.triggerMode",
      control: "select",
      label: "触发方式（spell.triggerMode）",
      required: true,
      options: "spellTriggerMode",
      optionsGroup: "spellTriggerMode",
      modes: ["add"],
      schema: schema("/$defs/spell/properties/triggerMode")
    },
    {
      path: "item.spell.role",
      control: "select",
      label: "角色（spell.role）",
      required: true,
      options: "spellRole",
      optionsGroup: "spellRole",
      modes: ["add"],
      schema: schema("/$defs/spell/properties/role")
    },
    {
      path: "item.spell.rewardKind",
      control: "select",
      label: "奖励类型（spell.rewardKind）",
      required: false,
      options: "spellRewardKind",
      optionsGroup: "spellRewardKind",
      modes: ["add"],
      schema: schema("/$defs/spell/properties/rewardKind")
    },
    {
      path: "item.spell.activeCast.cooldownSec",
      control: "number",
      label: "主动冷却秒数（activeCast.cooldownSec，triggerMode=active 时必填正数）",
      required: false,
      min: 0,
      step: 0.1,
      modes: ["add"],
      schema: schema("/$defs/spell/properties/activeCast/properties/cooldownSec")
    },
    {
      path: "item.spell",
      control: "json",
      label: "招式完整配置（spell，整段替换；结构权威见 item.schema.json#/$defs/spell）",
      required: false,
      rows: 6,
      modes: ["add"],
      schema: schema("/$defs/spell")
    },
    {
      path: "numericId",
      control: "number",
      label: "道具编号（numericId）",
      required: true,
      min: 1,
      step: 1,
      modes: ["override", "delete"],
      schema: schema("/oneOf/1/properties/numericId")
    },
    {
      path: "patch",
      control: "json",
      label: "覆写内容（patch，整字段替换，至少一个字段）",
      required: true,
      rows: 8,
      modes: ["override"],
      schema: schema("/$defs/overridePatch")
    },
    {
      path: "patch.name",
      control: "text",
      label: "覆写名称（patch.name）",
      required: false,
      modes: ["override"],
      schema: schema("/$defs/commonFields/properties/name")
    },
    {
      path: "patch.description",
      control: "text",
      label: "覆写描述（patch.description）",
      required: false,
      multiline: true,
      rows: 4,
      modes: ["override"],
      schema: schema("/$defs/commonFields/properties/description")
    },
    {
      path: "patch.effectList[]",
      control: "effect-editor",
      label: "覆写效果列表（patch.effectList，整数组替换，遗漏即消失）",
      required: false,
      modes: ["override"],
      schema: EFFECTS_SCHEMA
    }
  ];
}

function validateDistribution(dist, results) {
  if (dist === undefined || dist === null) {
    return;
  }
  if (!isPlainObject(dist)) {
    results.push(error("distribution.type", "item.distribution", "distribution 必须是对象"));
    return;
  }
  if (!Array.isArray(dist.channels)) {
    results.push(error("distribution.channels", "item.distribution.channels", "distribution.channels 必须是数组"));
  } else {
    dist.channels.forEach((channel, index) => {
      if (!distributionChannels.includes(channel)) {
        results.push(
          error("distribution.channel", "item.distribution.channels[" + index + "]", "投放渠道非法：" + channel)
        );
      }
    });
  }
  if (dist.uniquePerSave !== undefined && typeof dist.uniquePerSave !== "boolean") {
    results.push(error("distribution.uniquePerSave", "item.distribution.uniquePerSave", "uniquePerSave 必须是布尔值"));
  }
}

function validateIconTone(tone, results) {
  if (tone === undefined || tone === null) {
    return;
  }
  if (!isPlainObject(tone)) {
    results.push(error("iconTone.type", "item.iconTone", "iconTone 必须是对象"));
    return;
  }
  for (const key of ["hueRotate", "saturate", "brightness"]) {
    if (tone[key] !== undefined && typeof tone[key] !== "number") {
      results.push(error("iconTone.value", "item.iconTone." + key, "iconTone." + key + " 必须是数值"));
    }
  }
  for (const key of ["saturate", "brightness"]) {
    if (tone[key] !== undefined && typeof tone[key] === "number" && tone[key] < 0) {
      results.push(error("iconTone.negative", "item.iconTone." + key, "iconTone." + key + " 必须非负"));
    }
  }
}

function validateEffectList(list, results) {
  if (!Array.isArray(list)) {
    if (list !== undefined && list !== null) {
      results.push(error("effectList.type", "item.effectList", "effectList 必须是数组"));
    }
    return;
  }
  list.forEach((effect, index) => {
    const path = "item.effectList[" + index + "]";
    if (!isPlainObject(effect)) {
      results.push(error("effectList.item", path, "效果必须是对象"));
      return;
    }
    if (typeof effect.kind !== "string" || !effectKinds.includes(effect.kind)) {
      results.push(error("effectList.kind", path + ".kind", "效果根必须含合法 kind（9 类之一，不可自造）"));
    }
    if (typeof effect.label !== "string" || effect.label.trim() === "") {
      results.push(
        error(
          "effectList.label",
          path + ".label",
          "效果顶层 label 不能为空：0.1.9 起文案只读顶层 label，为空游戏内不显示（《招式效果速查》铁律）"
        )
      );
    }
    if (effect.kind === "periodicPulse" && Array.isArray(effect.executors)) {
      effect.executors.forEach((executor, j) => {
        if (
          isPlainObject(executor) &&
          executor.type === "itemRuntimeStatus" &&
          executor.targetScope != null &&
          executor.targetScope !== "self"
        ) {
          results.push(
            warning(
              "periodicPulse.itemRuntimeStatus",
              path + ".executors[" + j + "].targetScope",
              "periodicPulse 的敌方状态应写进 periodicPulse.itemRuntimeStatusEffects；executors[].itemRuntimeStatus 的 targetScope 只允许 self（《确认可行路径参考》一）"
            )
          );
        }
      });
    }
    if (effect.kind === "scriptureProgression") {
      validateScriptureProgression(effect.scriptureProgression, path + ".scriptureProgression", results);
    }
  });
}

function validateScriptureProgression(progression, path, results) {
  if (!isPlainObject(progression) || !Array.isArray(progression.layers)) {
    results.push(
      error(
        "scriptureProgression.layers",
        path + ".layers",
        "scriptureProgression 必须提供 layers 数组"
      )
    );
    return;
  }
  progression.layers.forEach((layer, index) => {
    const layerPath = path + ".layers[" + index + "]";
    const tag = "功法第 " + (index + 1) + " 层";
    if (!isPlainObject(layer)) {
      results.push(error("scriptureProgression.layer", layerPath, tag + "必须是对象"));
      return;
    }
    if (layer.effects !== undefined && !isPlainObject(layer.effects)) {
      results.push(error("scriptureProgression.effects", layerPath + ".effects", tag + "的 effects 必须是对象"));
    } else if (isPlainObject(layer.effects) && !Array.isArray(layer.effects.effectList)) {
      results.push(
        error(
          "scriptureProgression.effectList",
          layerPath + ".effects.effectList",
          tag + "的 effects.effectList 必须是数组（各层写累计值，运行时只保留当前层效果）"
        )
      );
    }
    const req = layer.requirements;
    if (req !== undefined && req !== null && !isPlainObject(req)) {
      results.push(error("scriptureProgression.requirements", layerPath + ".requirements", tag + "的 requirements 必须是对象"));
    } else if (index === 0 && isPlainObject(req)) {
      if (req.requiredRealmId != null || req.requiredRealmLayer != null || req.requiredCultivation != null) {
        results.push(
          warning(
            "scriptureProgression.firstLayerRequirement",
            layerPath + ".requirements",
            tag + "是免费入门层，不应写境界/修为要求（《确认可行路径参考》〇）"
          )
        );
      }
    }
    if (index >= 1) {
      for (const key of ["breakthroughTargetProgress", "breakthroughTimeLimitSec"]) {
        const value = layer[key];
        if (typeof value !== "number" || !(value > 0)) {
          results.push(
            error(
              "scriptureProgression.breakthrough",
              layerPath + "." + key,
              tag + "（第 2 层起）的 " + key + " 必须为正数（《确认可行路径参考》一）"
            )
          );
        }
      }
    }
    if (layer.breakthroughCooldownSec !== undefined && typeof layer.breakthroughCooldownSec !== "number") {
      results.push(
        error(
          "scriptureProgression.breakthroughCooldownSec",
          layerPath + ".breakthroughCooldownSec",
          tag + "的 breakthroughCooldownSec 必须是数值"
        )
      );
    }
  });
}

function validateSpell(item, results) {
  const spell = item.spell;
  if (item.category === "spell") {
    if (!isPlainObject(spell)) {
      results.push(error("spell.required", "item.spell", "spell 类别必须提供 spell 对象"));
      return;
    }
    const required = [
      ["sourceScriptureNumericId", "来源功法编号"],
      ["unlockLayer", "解锁层"],
      ["triggerMode", "触发方式"],
      ["role", "角色"]
    ];
    for (const [key, label] of required) {
      if (spell[key] === undefined || spell[key] === null) {
        results.push(error("spell." + key, "item.spell." + key, label + "（" + key + "）必填"));
      }
    }
    if (spell.triggerMode != null && !spellTriggerMode.includes(spell.triggerMode)) {
      results.push(error("spell.triggerMode", "item.spell.triggerMode", "triggerMode 取值非法"));
    }
    if (spell.role != null && !spellRole.includes(spell.role)) {
      results.push(error("spell.role", "item.spell.role", "role 取值非法"));
    }
    if (spell.rewardKind != null && !spellRewardKind.includes(spell.rewardKind)) {
      results.push(error("spell.rewardKind", "item.spell.rewardKind", "rewardKind 取值非法"));
    }
    if (spell.unlockLayer != null) {
      if (!Number.isInteger(spell.unlockLayer) || spell.unlockLayer < 1) {
        results.push(error("spell.unlockLayer", "item.spell.unlockLayer", "unlockLayer 必须是正整数"));
      } else if (spell.unlockLayer < 2) {
        results.push(
          warning(
            "spell.unlockLayer.firstLayer",
            "item.spell.unlockLayer",
            "unlockLayer 应 ≥2：功法第 1 层是免费入门层，不授予任何招式（《确认可行路径参考》〇）"
          )
        );
      }
    }
    if (spell.triggerMode === "active") {
      const cooldown = isPlainObject(spell.activeCast) ? spell.activeCast.cooldownSec : undefined;
      if (typeof cooldown !== "number" || !(cooldown > 0)) {
        results.push(
          error(
            "spell.activeCast.cooldownSec",
            "item.spell.activeCast.cooldownSec",
            "主动招式必须提供正数 activeCast.cooldownSec（其它类型不配置 activeCast）"
          )
        );
      }
    }
  }
}

function validateAdd(item, results) {
  if (!isPlainObject(item)) {
    results.push(error("item.type", "item", "add 模式必须提供 item 对象"));
    return;
  }
  const required = [
    ["numericId", "item.numericId", "道具编号（numericId）"],
    ["iconBasename", "item.iconBasename", "图标名（iconBasename）"],
    ["name", "item.name", "名称"],
    ["description", "item.description", "描述"],
    ["isPublished", "item.isPublished", "发布开关"],
    ["isObtainable", "item.isObtainable", "可获取开关"],
    ["category", "item.category", "类别"],
    ["grade", "item.grade", "品阶"],
    ["element", "item.element", "元素"],
    ["shape", "item.shape", "占格形状"],
    ["tags", "item.tags", "标签"],
    ["effectList", "item.effectList", "效果列表"]
  ];
  for (const [key, path, label] of required) {
    if (item[key] === undefined || item[key] === null) {
      results.push(warning("required." + key, path, "尚未填写 " + label + "（必填）"));
    }
  }

  if (item.numericId !== undefined && item.numericId !== null) {
    if (typeof item.numericId !== "number" || !Number.isInteger(item.numericId) || item.numericId < 1) {
      results.push(error("numericId.invalid", "item.numericId", "numericId 必须是正整数"));
    } else if (typeof item.category === "string" && CATEGORY_RANGES[item.category]) {
      const range = CATEGORY_RANGES[item.category];
      if (!inRange(item.numericId, range)) {
        results.push(
          error(
            "numericId.range",
            "item.numericId",
            "新增 " + item.category + " 的 numericId 必须落在社区号段 " + rangeText(range) + "（items-authoring-reference §3.1）"
          )
        );
      }
    }
  }

  if (!isBlank(item.iconBasename)) {
    if (typeof item.iconBasename !== "string" || !ICON_RE.test(item.iconBasename)) {
      results.push(
        error("iconBasename.invalid", "item.iconBasename", "iconBasename 只能含字母数字、下划线与短横线，且以字母数字开头")
      );
    }
  }

  if (item.isPublished !== undefined && item.isPublished !== null && typeof item.isPublished !== "boolean") {
    results.push(error("isPublished.invalid", "item.isPublished", "isPublished 必须是布尔值"));
  }
  if (item.isObtainable !== undefined && item.isObtainable !== null && typeof item.isObtainable !== "boolean") {
    results.push(error("isObtainable.invalid", "item.isObtainable", "isObtainable 必须是布尔值"));
  }
  if (item.category != null && !addableCategories.includes(item.category)) {
    results.push(
      error("category.invalid", "item.category", "category 必须是可新增类别之一：" + addableCategories.join("/"))
    );
  }
  if (item.grade != null && !grades.includes(item.grade)) {
    results.push(error("grade.invalid", "item.grade", "grade 取值非法"));
  }
  if (item.element != null && !elements.includes(item.element)) {
    results.push(error("element.invalid", "item.element", "element 取值非法"));
  }

  if (Array.isArray(item.baseElements)) {
    item.baseElements.forEach((el, index) => {
      if (!elements.includes(el)) {
        results.push(error("baseElements.invalid", "item.baseElements[" + index + "]", "baseElements 只能使用公开元素"));
      }
    });
  } else if (item.baseElements !== undefined && item.baseElements !== null) {
    results.push(error("baseElements.type", "item.baseElements", "baseElements 必须是元素数组"));
  }

  if (item.shape !== undefined && item.shape !== null && !isValidShape(item.shape)) {
    results.push(error("shape.invalid", "item.shape", "shape 必须是非空矩形的 0/1 二维数组（至少 1×1）"));
  }

  if (item.tags !== undefined && item.tags !== null) {
    if (!Array.isArray(item.tags) || item.tags.some((tag) => typeof tag !== "string")) {
      results.push(error("tags.invalid", "item.tags", "tags 必须是字符串数组"));
    }
  }

  if (item.price !== undefined && item.price !== null && (typeof item.price !== "number" || item.price < 0)) {
    results.push(error("price.invalid", "item.price", "price 必须是非负数"));
  }
  if (
    item.formationLockDurationSec !== undefined &&
    item.formationLockDurationSec !== null &&
    (typeof item.formationLockDurationSec !== "number" || item.formationLockDurationSec < 0)
  ) {
    results.push(
      error("formationLockDurationSec.invalid", "item.formationLockDurationSec", "formationLockDurationSec 必须是非负数")
    );
  }

  validateDistribution(item.distribution, results);
  validateIconTone(item.iconTone, results);
  validateEffectList(item.effectList, results);
  validateSpell(item, results);
}

function validateOverride(entry, results) {
  if (typeof entry.numericId !== "number" || !Number.isInteger(entry.numericId) || entry.numericId < 1) {
    results.push(error("numericId.invalid", "numericId", "override 的 numericId 必须是正整数"));
  }
  if (!isPlainObject(entry.patch)) {
    results.push(error("patch.type", "patch", "override 必须提供 patch 对象"));
    return;
  }
  if (Object.keys(entry.patch).length === 0) {
    results.push(error("patch.empty", "patch", "patch 至少包含一个字段"));
  }
  for (const key of ["numericId", "category", "shape"]) {
    if (Object.prototype.hasOwnProperty.call(entry.patch, key)) {
      results.push(error("patch.forbidden", "patch." + key, "override 禁止修改 " + key + "（身份/类别/占格不可迁移）"));
    }
  }
}

function validateDelete(entry, results) {
  if (typeof entry.numericId !== "number" || !Number.isInteger(entry.numericId)) {
    results.push(error("numericId.invalid", "numericId", "delete 的 numericId 必须是整数"));
    return;
  }
  if (!DELETE_RANGES.some((range) => inRange(entry.numericId, range))) {
    results.push(
      error(
        "numericId.deleteRange",
        "numericId",
        "delete 仅允许社区功法（190001–199999）或招式（890001–899999）编号；官方道具不能真正删除"
      )
    );
  }
}

export function validateEntry(entry) {
  const results = [];
  if (!isPlainObject(entry)) {
    results.push(error("entry.type", "", "条目必须是对象"));
    return results;
  }
  if (!itemModes.includes(entry.mode)) {
    results.push(error("mode.invalid", "mode", "mode 必须是 add/override/delete"));
    return results;
  }
  if (entry.mode === "add") {
    validateAdd(entry.item, results);
  } else if (entry.mode === "override") {
    validateOverride(entry, results);
  } else {
    validateDelete(entry, results);
  }
  return results;
}

export function validateProject(project, domain = "items") {
  const results = [];
  const entries = collectEntries(project, domain);
  const seen = new Map();
  const addIds = new Set();

  entries.forEach((entry, index) => {
    const id = numericIdOf(entry);
    if (id == null) {
      return;
    }
    const path = "content." + domain + "[" + index + "]";
    if (seen.has(id)) {
      results.push(
        error(
          "numericId.duplicate",
          path + ".numericId",
          "编号 " + id + " 在本 Mod 内重复声明（add/override/delete 不能引用同一编号）"
        )
      );
    } else {
      seen.set(id, index);
    }
    if (isPlainObject(entry) && entry.mode === "add") {
      addIds.add(id);
      if (OFFICIAL_IDS.has(id)) {
        results.push(
          error(
            "numericId.officialConflict",
            path + ".numericId",
            "编号 " + id + " 与官方道具目录冲突，会与官方或其它 Mod 冲突（官方没有覆盖优先级）"
          )
        );
      }
    }
  });

  entries.forEach((entry, index) => {
    if (!isPlainObject(entry) || entry.mode !== "override") {
      return;
    }
    const id = numericIdOf(entry);
    if (id == null) {
      return;
    }
    if (!OFFICIAL_IDS.has(id) && !addIds.has(id)) {
      results.push(
        warning(
          "override.dangling",
          "content." + domain + "[" + index + "].numericId",
          "override 的编号 " + id + " 既不在官方目录也不是本 Mod 新增，可能是悬空引用"
        )
      );
    }
  });

  return results;
}

function toFile(entry) {
  if (!isPlainObject(entry)) {
    throw new Error("toFiles: 条目必须是对象");
  }
  const id = numericIdOf(entry);
  if (id == null) {
    throw new Error("toFiles: 条目缺少 numericId");
  }
  return { path: "items/" + id + ".json", content: JSON.stringify(entry, null, 2) };
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
    if (!/(^|\/)items\/[^/]+\.json$/i.test(normalized)) {
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
    return "（无效道具）";
  }
  const mode = entry.mode || "add";
  if (mode === "add") {
    const item = isPlainObject(entry.item) ? entry.item : {};
    const name = item.name || "未命名";
    const id = item.numericId != null ? item.numericId : "?";
    return "add " + name + " " + (item.category || "?") + "·" + (item.grade || "?") + " " + id;
  }
  if (mode === "override") {
    const patch = isPlainObject(entry.patch) ? entry.patch : {};
    return "override " + (patch.name || "覆写") + " " + (entry.numericId != null ? entry.numericId : "?");
  }
  return "delete " + (entry.numericId != null ? entry.numericId : "?");
}
