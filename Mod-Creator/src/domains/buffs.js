// src/domains/buffs.js — buffs@1 域：骨架、字段描述、校验、导入导出与摘要。

import { buffDict } from "../generated/buffDict.js";

const SCHEMA_FILE = "buffs@1 · buff.schema.json";
const ID_PATTERN = "^[a-z0-9]+(?:[.-][a-z0-9]+)+:[a-z0-9](?:[a-z0-9_-]*[a-z0-9])?$";
const ID_RE = new RegExp(ID_PATTERN);
const COLOR_PATTERN = "^#[0-9a-fA-F]{6}$";
const COLOR_RE = new RegExp(COLOR_PATTERN);

const KNOWN_FIELDS = [
  "id",
  "label",
  "description",
  "polarity",
  "consumeOn",
  "defaultDurationMs",
  "maxStacks",
  "defaultStackCap",
  "color"
];

const POLARITIES = ["beneficial", "detrimental", "dual"];
const CONSUME_ON = ["manual", "time"];
const POLARITY_OPTIONS = [
  { value: "beneficial", label: "增益（beneficial）" },
  { value: "detrimental", label: "减益（detrimental）" },
  { value: "dual", label: "双重（dual）" }
];
const CONSUME_OPTIONS = [
  { value: "manual", label: "手动（manual）" },
  { value: "time", label: "计时（time）" }
];

const BASE_IDS = new Set(Object.keys(buffDict));

export const meta = {
  key: "buffs",
  labelZh: "Buff",
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

function isMissing(value) {
  return value === undefined || value === null;
}

function isInteger(value) {
  return typeof value === "number" && Number.isInteger(value);
}

function expectedNamespace(entry, ctx) {
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

function collectEntries(project, domain) {
  if (Array.isArray(project)) {
    return project;
  }
  if (project && isPlainObject(project.content) && Array.isArray(project.content[domain])) {
    return project.content[domain];
  }
  return [];
}

export function createEntry(partial = {}) {
  const skeleton = {
    id: "",
    label: "",
    description: "",
    polarity: "beneficial",
    consumeOn: "time",
    defaultDurationMs: 15000,
    maxStacks: 100,
    defaultStackCap: 100,
    color: "#c9a24a"
  };
  return { ...skeleton, ...partial };
}

export function fields() {
  const schema = (pointer) => SCHEMA_FILE + (pointer ? "#" + pointer : "");
  return [
    {
      path: "buff.id",
      control: "text",
      label: "Buff ID（命名空间须等于 manifest.id，形如 <manifest.id>:短名）",
      required: true,
      pattern: ID_PATTERN,
      schema: schema("/properties/id")
    },
    {
      path: "buff.label",
      control: "text",
      label: "名称（1–40 字）",
      required: true,
      maxLength: 40,
      schema: schema("/properties/label")
    },
    {
      path: "buff.description",
      control: "text",
      label: "描述（1–1000 字）",
      required: true,
      multiline: true,
      rows: 4,
      maxLength: 1000,
      schema: schema("/properties/description")
    },
    {
      path: "buff.polarity",
      control: "select",
      label: "极性",
      required: true,
      options: POLARITY_OPTIONS,
      schema: schema("/properties/polarity")
    },
    {
      path: "buff.consumeOn",
      control: "select",
      label: "消耗方式",
      required: true,
      options: CONSUME_OPTIONS,
      schema: schema("/properties/consumeOn")
    },
    {
      path: "buff.defaultDurationMs",
      control: "number",
      label: "默认持续时间（毫秒）",
      required: true,
      min: 1,
      max: 86400000,
      step: 1,
      schema: schema("/properties/defaultDurationMs")
    },
    {
      path: "buff.maxStacks",
      control: "number",
      label: "最大层数（硬上限）",
      required: true,
      min: 1,
      max: 10000,
      step: 1,
      schema: schema("/properties/maxStacks")
    },
    {
      path: "buff.defaultStackCap",
      control: "number",
      label: "默认上限（不可超过最大层数）",
      required: true,
      min: 0,
      max: 10000,
      step: 1,
      schema: schema("/properties/defaultStackCap")
    },
    {
      path: "buff.color",
      control: "text",
      label: "颜色",
      required: true,
      placeholder: "#RRGGBB",
      pattern: COLOR_PATTERN,
      schema: schema("/properties/color")
    }
  ];
}

export function validateEntry(entry, ctx = {}) {
  const results = [];
  if (!isPlainObject(entry)) {
    results.push(error("entry.type", "", "条目必须是对象"));
    return results;
  }

  for (const key of KNOWN_FIELDS) {
    if (isMissing(entry[key])) {
      results.push(warning("required." + key, "buff." + key, "尚未填写必填字段：" + key));
    }
  }

  const namespace = expectedNamespace(entry, ctx);

  if (!isMissing(entry.id)) {
    if (typeof entry.id !== "string") {
      results.push(error("id.invalid", "buff.id", "id 必须是字符串"));
    } else if (entry.id.length === 0) {
      results.push(warning("id.required", "buff.id", "尚未填写 ID"));
    } else if (!ID_RE.test(entry.id)) {
      results.push(
        error("id.invalid", "buff.id", "id 必须是 <命名空间>:<短名>（如 com.example.mod:intent），不可自造未登记前缀")
      );
    } else if (namespace != null && namespaceOf(entry.id) !== namespace) {
      results.push(
        error("id.namespace", "buff.id", "id 命名空间必须等于 manifest.id（" + namespace + "）")
      );
    }
  }

  if (!isMissing(entry.label)) {
    if (typeof entry.label !== "string") {
      results.push(error("label.invalid", "buff.label", "label 必须是字符串"));
    } else if (entry.label.length === 0) {
      results.push(warning("label.required", "buff.label", "尚未填写名称"));
    } else if (entry.label.length > 40) {
      results.push(error("label.length", "buff.label", "label 长度须为 1–40"));
    }
  }

  if (!isMissing(entry.description)) {
    if (typeof entry.description !== "string") {
      results.push(error("description.invalid", "buff.description", "description 必须是字符串"));
    } else if (entry.description.length === 0) {
      results.push(warning("description.required", "buff.description", "尚未填写描述"));
    } else if (entry.description.length > 1000) {
      results.push(error("description.length", "buff.description", "description 长度须为 1–1000"));
    }
  }

  if (!isMissing(entry.polarity) && !POLARITIES.includes(entry.polarity)) {
    results.push(error("polarity.invalid", "buff.polarity", "polarity 只能是 beneficial/detrimental/dual"));
  }

  if (!isMissing(entry.consumeOn) && !CONSUME_ON.includes(entry.consumeOn)) {
    results.push(error("consumeOn.invalid", "buff.consumeOn", "consumeOn 只能是 manual/time"));
  }

  if (!isMissing(entry.defaultDurationMs)) {
    if (!isInteger(entry.defaultDurationMs) || entry.defaultDurationMs < 1 || entry.defaultDurationMs > 86400000) {
      results.push(
        error("defaultDurationMs.range", "buff.defaultDurationMs", "defaultDurationMs 必须是 1–86400000 的整数")
      );
    }
  }

  if (!isMissing(entry.maxStacks)) {
    if (!isInteger(entry.maxStacks) || entry.maxStacks < 1 || entry.maxStacks > 10000) {
      results.push(error("maxStacks.range", "buff.maxStacks", "maxStacks 必须是 1–10000 的整数"));
    }
  }

  if (!isMissing(entry.defaultStackCap)) {
    if (!isInteger(entry.defaultStackCap) || entry.defaultStackCap < 0 || entry.defaultStackCap > 10000) {
      results.push(
        error("defaultStackCap.range", "buff.defaultStackCap", "defaultStackCap 必须是 0–10000 的整数")
      );
    } else if (isInteger(entry.maxStacks) && entry.defaultStackCap > entry.maxStacks) {
      results.push(
        error("defaultStackCap.exceedsMaxStacks", "buff.defaultStackCap", "默认上限 defaultStackCap 不可超过 maxStacks")
      );
    }
  }

  if (!isMissing(entry.color) && (typeof entry.color !== "string" || !COLOR_RE.test(entry.color))) {
    results.push(error("color.invalid", "buff.color", "color 必须是 #RRGGBB 十六进制颜色"));
  }

  return results;
}

export function validateProject(project, domain = "buffs") {
  const results = [];
  const entries = collectEntries(project, domain);

  if (entries.length > 128) {
    results.push(error("count.exceeded", "content." + domain, "每包最多 128 个 Buff，当前 " + entries.length + " 个"));
  }

  const seen = new Map();
  entries.forEach((entry, index) => {
    if (!isPlainObject(entry) || typeof entry.id !== "string" || entry.id === "") {
      return;
    }
    const path = "content." + domain + "[" + index + "]";
    if (seen.has(entry.id)) {
      results.push(
        error("id.duplicate", path + ".id", "Buff ID " + entry.id + " 在本 Mod 内重复声明")
      );
    } else {
      seen.set(entry.id, index);
    }
    const local = localNameOf(entry.id);
    if (BASE_IDS.has(entry.id) || (local != null && BASE_IDS.has(local))) {
      results.push(
        warning(
          "id.baseConflict",
          path + ".id",
          "Buff ID " + entry.id + " 与本体 Buff 重名，不得覆盖本体行为，请改用包内独有短名"
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
  if (typeof entry.id !== "string" || entry.id === "") {
    throw new Error("toFiles: 条目缺少 id");
  }
  const name = localNameOf(entry.id);
  const output = {};
  for (const key of KNOWN_FIELDS) {
    if (entry[key] !== undefined) {
      output[key] = entry[key];
    }
  }
  if (isPlainObject(entry.__raw)) {
    Object.assign(output, entry.__raw);
  }
  return { path: "buffs/" + name + ".json", content: JSON.stringify(output, null, 2) };
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
    if (!/(^|\/)buffs\/[^/]+\.json$/i.test(normalized)) {
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
    for (const key of KNOWN_FIELDS) {
      if (key in parsed) {
        entry[key] = parsed[key];
      }
    }
    const raw = {};
    let hasRaw = false;
    for (const key of Object.keys(parsed)) {
      if (!KNOWN_FIELDS.includes(key)) {
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

const POLARITY_ZH = { beneficial: "增益", detrimental: "减益", dual: "双重" };
const CONSUME_ZH = { manual: "手动", time: "计时" };

export function summarize(entry) {
  if (!isPlainObject(entry)) {
    return "（无效 Buff）";
  }
  const label = entry.label || entry.id || "未命名";
  const polarity = POLARITY_ZH[entry.polarity] || entry.polarity || "?";
  const consume = CONSUME_ZH[entry.consumeOn] || entry.consumeOn || "?";
  const cap = entry.defaultStackCap != null ? entry.defaultStackCap : "?";
  const max = entry.maxStacks != null ? entry.maxStacks : "?";
  return label + " · " + polarity + " · " + consume + " · 上限 " + cap + "/" + max + " · " + (entry.color || "?");
}
