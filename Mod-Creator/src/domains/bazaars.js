// src/domains/bazaars.js — bazaars@1 域：骨架、字段描述、校验、导入导出与摘要。

import { items as officialItems } from "../generated/catalogs.js";

const SCHEMA_FILE = "bazaars@1 · bazaar.schema.json";
const LOCAL_ID_PATTERN = "^[a-z0-9]+(?:-[a-z0-9]+)*$";
const LOCAL_ID_RE = new RegExp(LOCAL_ID_PATTERN);

const OFFER_MIN = 1;
const OFFER_MAX = 16;
const COUNT_MIN = 1;
const COUNT_MAX = 100;
const STOCK_MIN = 1;
const STOCK_MAX = 1000;
const COST_TYPES = ["spiritStones", "item"];
const FORBIDDEN_COST_CATEGORIES = ["material", "recipe", "spell"];

const CATEGORY_BY_NUMERIC_ID = new Map(officialItems.map((item) => [item.numericId, item.category]));

export const meta = {
  key: "bazaars",
  labelZh: "商店",
  schemaVersion: 1,
  schemaFile: SCHEMA_FILE
};

function schema(pointer) {
  return SCHEMA_FILE + (pointer ? "#" + pointer : "");
}

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

function slugOf(id) {
  if (typeof id !== "string") {
    return "";
  }
  const trimmed = id.trim();
  if (trimmed.includes(":")) {
    return trimmed.slice(trimmed.lastIndexOf(":") + 1).toLowerCase();
  }
  const dot = trimmed.lastIndexOf(".");
  if (dot >= 0) {
    return trimmed.slice(dot + 1).toLowerCase();
  }
  return trimmed.toLowerCase();
}

export function createEntry(partial = {}) {
  const skeleton = {
    id: "",
    mapId: "",
    nodeId: "",
    name: "",
    npcName: "",
    description: "",
    refreshDays: 7,
    offers: [
      {
        id: "offer1",
        label: "",
        templateNumericId: 0,
        count: 1,
        stock: 10,
        cost: { type: "spiritStones", amount: 10 }
      }
    ]
  };
  const next = { ...skeleton, ...partial };
  if (Array.isArray(partial.offers)) {
    next.offers = partial.offers;
  }
  return next;
}

export function fields() {
  return [
    {
      path: "id",
      control: "text",
      label: "商店 ID（本包名称空间）",
      required: true,
      schema: schema("/properties/id")
    },
    {
      path: "mapId",
      control: "text",
      label: "所属地图 ID（须为同包 maps 的 mapId）",
      required: true,
      schema: schema("/properties/mapId")
    },
    {
      path: "nodeId",
      control: "text",
      label: "驻点节点 ID（图内短名，须为独立 site）",
      required: true,
      pattern: LOCAL_ID_PATTERN,
      schema: schema("/properties/nodeId")
    },
    {
      path: "name",
      control: "text",
      label: "商店名称",
      required: true,
      schema: schema("/properties/name")
    },
    {
      path: "npcName",
      control: "text",
      label: "掌柜名称（npcName）",
      required: true,
      schema: schema("/properties/npcName")
    },
    {
      path: "description",
      control: "text",
      label: "商店描述",
      required: true,
      multiline: true,
      rows: 3,
      schema: schema("/properties/description")
    },
    {
      path: "refreshDays",
      control: "number",
      label: "补货间隔（天）",
      required: true,
      min: 1,
      max: 36000,
      step: 1,
      schema: schema("/properties/refreshDays")
    },
    {
      path: "offers",
      control: "json",
      label: "货签（offers：id/label/templateNumericId/count(1–100)/stock(1–1000)/cost{type,amount|templateNumericId,count}）",
      required: true,
      rows: 8,
      schema: schema("/properties/offers")
    }
  ];
}

function validateCost(cost, path, results) {
  if (!isPlainObject(cost)) {
    results.push(error("cost.type", path, "cost 必须是对象"));
    return;
  }
  if (!COST_TYPES.includes(cost.type)) {
    results.push(error("cost.type.invalid", path + ".type", "cost.type 只能是 spiritStones 或 item"));
    return;
  }
  if (cost.type === "spiritStones") {
    if (
      typeof cost.amount !== "number" ||
      !Number.isInteger(cost.amount) ||
      cost.amount < 1 ||
      cost.amount > 1000000
    ) {
      results.push(error("cost.amount.invalid", path + ".amount", "灵石报价 amount 必须是 1–1000000 的整数"));
    }
    return;
  }
  if (
    typeof cost.templateNumericId !== "number" ||
    !Number.isInteger(cost.templateNumericId) ||
    cost.templateNumericId < 1
  ) {
    results.push(
      error("cost.templateNumericId.invalid", path + ".templateNumericId", "易物成本必须提供正整数 templateNumericId")
    );
    return;
  }
  if (
    cost.count !== undefined &&
    (typeof cost.count !== "number" || !Number.isInteger(cost.count) || cost.count < 1 || cost.count > 100)
  ) {
    results.push(error("cost.count.invalid", path + ".count", "易物成本 count 必须是 1–100 的整数"));
  }
  const category = CATEGORY_BY_NUMERIC_ID.get(cost.templateNumericId);
  if (FORBIDDEN_COST_CATEGORIES.includes(category)) {
    results.push(
      error(
        "cost.forbiddenCategory",
        path + ".templateNumericId",
        "灵材（material）、配方（recipe）、招式（spell）不能作为易物成本（bazaars-authoring-reference）"
      )
    );
  } else if (category === undefined) {
    results.push(
      warning(
        "cost.dangling",
        path + ".templateNumericId",
        "易物引用的道具编号不在官方目录中，需确认其为同包新增道具"
      )
    );
  }
}

function validateOffers(offers, results) {
  if (!Array.isArray(offers)) {
    results.push(error("offers.type", "offers", "offers 必须是数组"));
    return;
  }
  if (offers.length < OFFER_MIN || offers.length > OFFER_MAX) {
    results.push(error("offers.length", "offers", "offers 数量必须在 " + OFFER_MIN + "–" + OFFER_MAX + " 之间"));
  }
  offers.forEach((offer, index) => {
    const path = "offers[" + index + "]";
    if (!isPlainObject(offer)) {
      results.push(error("offer.type", path, "货签必须是对象"));
      return;
    }
    if (isBlank(offer.id) || !LOCAL_ID_RE.test(offer.id)) {
      results.push(error("offer.id.invalid", path + ".id", "货签 id 必须是小写字母数字与短横线"));
    } else if (offers.some((other, j) => j < index && isPlainObject(other) && other.id === offer.id)) {
      results.push(error("offer.id.duplicate", path + ".id", "货签 id 在本店内重复：" + offer.id));
    }
    if (isBlank(offer.label)) {
      results.push(error("offer.label.required", path + ".label", "货签 label 必填"));
    }
    if (
      typeof offer.templateNumericId !== "number" ||
      !Number.isInteger(offer.templateNumericId) ||
      offer.templateNumericId < 1
    ) {
      results.push(error("offer.templateNumericId.invalid", path + ".templateNumericId", "templateNumericId 必须是正整数"));
    }
    if (
      typeof offer.count !== "number" ||
      !Number.isInteger(offer.count) ||
      offer.count < COUNT_MIN ||
      offer.count > COUNT_MAX
    ) {
      results.push(error("offer.count.invalid", path + ".count", "count 必须是 " + COUNT_MIN + "–" + COUNT_MAX + " 的整数"));
    }
    if (
      typeof offer.stock !== "number" ||
      !Number.isInteger(offer.stock) ||
      offer.stock < STOCK_MIN ||
      offer.stock > STOCK_MAX
    ) {
      results.push(error("offer.stock.invalid", path + ".stock", "stock 必须是 " + STOCK_MIN + "–" + STOCK_MAX + " 的整数"));
    }
    validateCost(offer.cost, path + ".cost", results);
  });
}

export function validateEntry(entry) {
  const results = [];
  if (!isPlainObject(entry)) {
    results.push(error("entry.type", "", "条目必须是对象"));
    return results;
  }
  const required = [
    ["id", "id", "商店 ID"],
    ["mapId", "mapId", "所属地图 ID"],
    ["nodeId", "nodeId", "驻点节点 ID"],
    ["name", "name", "商店名称"],
    ["npcName", "npcName", "掌柜名称"],
    ["description", "description", "商店描述"]
  ];
  for (const [key, path, label] of required) {
    if (entry[key] === undefined || entry[key] === null) {
      results.push(warning("required." + key, path, "尚未填写 " + label + "（必填）"));
    } else if (typeof entry[key] === "string" && entry[key].trim() === "") {
      results.push(warning("required." + key, path, "尚未填写 " + label + "（必填）"));
    } else if (typeof entry[key] !== "string") {
      results.push(error(key + ".invalid", path, label + "必须是字符串"));
    }
  }
  if (!isBlank(entry.nodeId) && !LOCAL_ID_RE.test(entry.nodeId)) {
    results.push(error("nodeId.invalid", "nodeId", "nodeId 必须是小写字母数字与短横线"));
  }
  if (
    entry.refreshDays === undefined ||
    entry.refreshDays === null ||
    typeof entry.refreshDays !== "number" ||
    !Number.isInteger(entry.refreshDays) ||
    entry.refreshDays < 1 ||
    entry.refreshDays > 36000
  ) {
    results.push(error("refreshDays.invalid", "refreshDays", "refreshDays 必须是 1–36000 的整数"));
  }
  validateOffers(entry.offers, results);
  return results;
}

export function validateProject(project, domain = "bazaars") {
  const results = [];
  const entries = collectEntries(project, domain);
  const mapIds = new Set(
    collectEntries(project, "maps")
      .filter((entry) => isPlainObject(entry) && !isBlank(entry.mapId))
      .map((entry) => entry.mapId)
  );

  const seen = new Map();
  entries.forEach((entry, index) => {
    if (!isPlainObject(entry)) {
      return;
    }
    const path = "content." + domain + "[" + index + "]";
    if (!isBlank(entry.id)) {
      if (seen.has(entry.id)) {
        results.push(error("id.duplicate", path + ".id", "商店 ID 在本 Mod 内重复声明：" + entry.id));
      } else {
        seen.set(entry.id, index);
      }
    }
    if (!isBlank(entry.mapId) && !mapIds.has(entry.mapId)) {
      results.push(
        warning("mapId.dangling", path + ".mapId", "mapId 未在本包 maps 域中声明，可能是悬空引用：" + entry.mapId)
      );
    }
  });

  if (entries.length > 0) {
    const domains = project && isPlainObject(project.meta) && isPlainObject(project.meta.manifest)
      ? project.meta.manifest.domains
      : null;
    const hasMaps = isPlainObject(domains) && Object.prototype.hasOwnProperty.call(domains, "maps");
    if (!hasMaps) {
      results.push(
        warning("domains.maps", "meta.manifest.domains.maps", "使用 bazaars 时必须在 manifest.domains 同时声明 maps 域")
      );
    }
  }

  return results;
}

function toFile(entry) {
  if (!isPlainObject(entry)) {
    throw new Error("toFiles: 条目必须是对象");
  }
  const slug = slugOf(entry.id);
  if (isBlank(slug)) {
    throw new Error("toFiles: 条目缺少 id");
  }
  return { path: "bazaars/" + slug + ".json", content: JSON.stringify(entry, null, 2) };
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
    if (!/(^|\/)bazaars\/[^/]+\.json$/i.test(normalized)) {
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
    return "（无效商店）";
  }
  const name = entry.name || entry.id || "未命名";
  const slug = slugOf(entry.id);
  const offers = Array.isArray(entry.offers) ? entry.offers.length : 0;
  return name + " " + (slug || "?") + " · " + offers + " 货签/" + (entry.refreshDays != null ? entry.refreshDays : "?") + "天";
}
