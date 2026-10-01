// src/domains/scripts.js — scripts@1 域：骨架、字段描述、校验、导入导出与摘要。

const SCHEMA_FILE = "scripts@1 · script.schema.json";
const RUNTIME_REF = "scripts@1 · runtime.json";

const ENTRY_PATTERN = "^code\\/[a-zA-Z0-9_-]+\\.js$";
const ENTRY_RE = new RegExp(ENTRY_PATTERN);
const ENTRY_CAPTURE_RE = /^code\/([a-zA-Z0-9_-]+)\.js$/;
const SLUG_RE = /^[a-z0-9](?:[a-z0-9_-]*[a-z0-9])?$/;
const TASK_ID_PATTERN = "^[a-zA-Z][a-zA-Z0-9_-]{0,63}$";
const TASK_ID_RE = new RegExp(TASK_ID_PATTERN);
const IMAGE_PATH_RE = /^images\/ui\/[a-zA-Z0-9_-]+\.(png|webp)$/;

const EVENT_VALUES = [
  "enterNode",
  "interact",
  "optionSelected",
  "uiSubmitted",
  "encounterEnded",
  "battleSettled",
  "timeAdvanced",
  "scheduled"
];
const EVENT_SET = new Set(EVENT_VALUES);
const EVENT_OPTIONS = [
  { value: "enterNode", label: "进入节点（enterNode）" },
  { value: "interact", label: "交谈/交互（interact）" },
  { value: "optionSelected", label: "选择选项（optionSelected）" },
  { value: "uiSubmitted", label: "提交弹窗表单（uiSubmitted）" },
  { value: "encounterEnded", label: "遭遇结束（encounterEnded）" },
  { value: "battleSettled", label: "战斗结算（battleSettled）" },
  { value: "timeAdvanced", label: "时间推进（timeAdvanced）" },
  { value: "scheduled", label: "预约到达（scheduled）" }
];
const UI_ENTRY_OPTIONS = [
  { value: "node", label: "绑定节点（node）" },
  { value: "menu", label: "通用入口（menu）" }
];

const SANDBOX_NOTE =
  "脚本代码（__code，运行在受限沙箱：无 async/import/require/网络/DOM；代码 ≤256KiB、输出 ≤64KiB、解释器 100ms、看门狗 2s）";

export const meta = {
  key: "scripts",
  labelZh: "脚本",
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

function slugOf(id) {
  if (typeof id !== "string") {
    return "";
  }
  const index = id.lastIndexOf(":");
  return index >= 0 ? id.slice(index + 1) : id;
}

function expectedModApiVersion(ctx) {
  if (!isPlainObject(ctx)) {
    return null;
  }
  const manifest = isPlainObject(ctx.manifest)
    ? ctx.manifest
    : isPlainObject(ctx.project) && isPlainObject(ctx.project.meta) && isPlainObject(ctx.project.meta.manifest)
      ? ctx.project.meta.manifest
      : null;
  return manifest && typeof manifest.modApiVersion === "number" ? manifest.modApiVersion : null;
}

export function createEntry(partial = {}) {
  const skeleton = {
    id: "",
    name: "",
    mapId: "",
    nodeId: "",
    entry: "code/main.js",
    events: ["interact"],
    stateVersion: 1,
    queryItemIds: [],
    gatedNodeIds: [],
    npcDescription: "",
    ui: null,
    boardListing: null,
    __code: "// 在此编写脚本\n"
  };
  return { ...skeleton, ...partial };
}

export function fields() {
  const schema = (pointer) => SCHEMA_FILE + (pointer ? "#" + pointer : "");
  return [
    {
      path: "id",
      control: "text",
      label: "脚本 ID（建议 <manifest.id>:短名）",
      required: true,
      schema: schema("/properties/id")
    },
    {
      path: "name",
      control: "text",
      label: "脚本名称（≤160 字）",
      required: true,
      schema: schema("/properties/name")
    },
    {
      path: "mapId",
      control: "text",
      label: "所属地图 mapId（必须同包 maps 中的地图 ID）",
      required: true,
      schema: schema("/properties/mapId")
    },
    {
      path: "nodeId",
      control: "text",
      label: "绑定节点 nodeId（该地图已有节点的局部 ID）",
      required: true,
      schema: schema("/properties/nodeId")
    },
    {
      path: "entry",
      control: "text",
      label: "入口代码路径（entry，形如 code/main.js）",
      required: true,
      pattern: ENTRY_PATTERN,
      schema: schema("/properties/entry")
    },
    {
      path: "events",
      control: "multi-select",
      label: "监听事件（events，1–8 个）",
      required: true,
      options: EVENT_OPTIONS,
      optionsGroup: "scriptEvents",
      schema: schema("/properties/events")
    },
    {
      path: "stateVersion",
      control: "number",
      label: "状态版本（stateVersion，1–1000000）",
      required: true,
      min: 1,
      max: 1000000,
      step: 1,
      schema: schema("/properties/stateVersion")
    },
    {
      path: "queryItemIds",
      control: "json",
      label: "可查询道具编号（queryItemIds，最多 32 个正整数）",
      required: false,
      rows: 4,
      schema: schema("/properties/queryItemIds")
    },
    {
      path: "gatedNodeIds",
      control: "json",
      label: "门控节点（gatedNodeIds，最多 32 个局部节点 ID）",
      required: false,
      rows: 4,
      schema: schema("/properties/gatedNodeIds")
    },
    {
      path: "npcDescription",
      control: "text",
      label: "NPC 说明（npcDescription，≤1000 字）",
      required: false,
      multiline: true,
      rows: 4,
      schema: schema("/properties/npcDescription")
    },
    {
      path: "ui.entry",
      control: "select",
      label: "弹窗入口（ui.entry：node 绑定节点 / menu 通用入口）",
      required: false,
      options: UI_ENTRY_OPTIONS,
      schema: schema("/properties/ui/properties/entry")
    },
    {
      path: "ui.label",
      control: "text",
      label: "弹窗名称（ui.label，1–160 字）",
      required: false,
      schema: schema("/properties/ui/properties/label")
    },
    {
      path: "ui.images",
      control: "json",
      label: "弹窗图片别名（ui.images：别名 → images/ui/<名称>.png|webp，最多 16 张）",
      required: false,
      rows: 4,
      schema: schema("/properties/ui/properties/images")
    },
    {
      path: "boardListing.title",
      control: "text",
      label: "任务板标题（boardListing.title，≤160 字）",
      required: false,
      schema: schema("/properties/boardListing/properties/title")
    },
    {
      path: "boardListing.summary",
      control: "text",
      label: "任务板概要（boardListing.summary，≤500 字）",
      required: false,
      schema: schema("/properties/boardListing/properties/summary")
    },
    {
      path: "boardListing.rewardText",
      control: "text",
      label: "任务板奖励说明（boardListing.rewardText，≤500 字）",
      required: false,
      schema: schema("/properties/boardListing/properties/rewardText")
    },
    {
      path: "boardListing.taskId",
      control: "text",
      label: "任务板任务 ID（boardListing.taskId，对应脚本返回的 tasks[].id）",
      required: false,
      pattern: TASK_ID_PATTERN,
      schema: schema("/properties/boardListing/properties/taskId")
    },
    {
      path: "__code",
      control: "text",
      label: SANDBOX_NOTE,
      required: true,
      multiline: true,
      rows: 18,
      schema: RUNTIME_REF
    }
  ];
}

function validateRequiredStrings(entry, results) {
  const required = [
    ["id", "id", "脚本 ID"],
    ["name", "name", "脚本名称"],
    ["mapId", "mapId", "所属地图 mapId"],
    ["nodeId", "nodeId", "绑定节点 nodeId"],
    ["entry", "entry", "入口代码路径 entry"]
  ];
  for (const [key, path, label] of required) {
    if (isBlank(entry[key])) {
      results.push(warning("required." + key, path, "尚未填写 " + label));
    } else if (typeof entry[key] !== "string") {
      results.push(error(key + ".invalid", path, label + "必须是字符串"));
    }
  }
  for (const key of ["id", "name", "mapId", "nodeId"]) {
    if (typeof entry[key] === "string" && entry[key].length > 160) {
      results.push(error(key + ".length", key, "长度须为 1–160"));
    }
  }
}

function validateEvents(entry, results) {
  const events = entry.events;
  if (isBlank(events) || (Array.isArray(events) && events.length === 0)) {
    results.push(error("events.required", "events", "events 至少声明 1 个事件"));
    return;
  }
  if (!Array.isArray(events)) {
    results.push(error("events.type", "events", "events 必须是数组"));
    return;
  }
  if (events.length > 8) {
    results.push(error("events.max", "events", "events 最多 8 个"));
  }
  events.forEach((value, index) => {
    if (typeof value !== "string" || !EVENT_SET.has(value)) {
      results.push(
        error("events.invalid", "events[" + index + "]", "事件名非法：" + value + "（仅限 8 个公开事件）")
      );
    }
  });
}

function validateUi(entry, events, results) {
  const ui = entry.ui;
  if (ui === undefined || ui === null) {
    if (Array.isArray(events) && events.includes("uiSubmitted")) {
      results.push(
        warning("ui.missing", "ui", "声明了 uiSubmitted 事件但未声明 ui（自定义弹窗需同时声明 ui 定义）")
      );
    }
    return;
  }
  if (!isPlainObject(ui)) {
    results.push(error("ui.type", "ui", "ui 必须是对象"));
    return;
  }
  if (!Array.isArray(events) || !events.includes("interact")) {
    results.push(error("ui.interact", "events", "声明 ui 时必须同时声明 interact 事件"));
  }
  if (Array.isArray(events) && !events.includes("uiSubmitted")) {
    results.push(
      warning("ui.uiSubmitted", "events", "含自定义弹窗表单的界面通常还需声明 uiSubmitted 事件以接收提交")
    );
  }
  if (ui.entry !== undefined && ui.entry !== null && ui.entry !== "node" && ui.entry !== "menu") {
    results.push(error("ui.entry.invalid", "ui.entry", "ui.entry 只能是 node 或 menu"));
  } else if (isBlank(ui.entry)) {
    results.push(warning("ui.entry.required", "ui.entry", "尚未填写 ui.entry"));
  }
  if (isBlank(ui.label)) {
    results.push(warning("ui.label.required", "ui.label", "尚未填写 ui.label"));
  } else if (typeof ui.label !== "string" || ui.label.length > 160) {
    results.push(error("ui.label.length", "ui.label", "ui.label 长度须为 1–160"));
  }
  if (ui.images !== undefined && ui.images !== null) {
    if (!isPlainObject(ui.images)) {
      results.push(error("ui.images.type", "ui.images", "ui.images 必须是「别名 → 路径」对象"));
    } else {
      const keys = Object.keys(ui.images);
      if (keys.length > 16) {
        results.push(error("ui.images.max", "ui.images", "ui.images 最多 16 张"));
      }
      keys.forEach((key) => {
        if (!/^[a-zA-Z][a-zA-Z0-9_-]{0,63}$/.test(key)) {
          results.push(error("ui.images.key", "ui.images." + key, "图片别名非法：" + key));
        }
        const value = ui.images[key];
        if (typeof value !== "string" || !IMAGE_PATH_RE.test(value)) {
          results.push(
            error("ui.images.value", "ui.images." + key, "图片路径须为 images/ui/<名称>.png|webp：" + value)
          );
        }
      });
    }
  }
}

function validateBoardListing(entry, results) {
  const board = entry.boardListing;
  if (board === undefined || board === null) {
    return;
  }
  if (!isPlainObject(board)) {
    results.push(error("boardListing.type", "boardListing", "boardListing 必须是对象"));
    return;
  }
  for (const [key, max] of [["title", 160], ["summary", 500], ["rewardText", 500]]) {
    if (isBlank(board[key])) {
      results.push(warning("boardListing." + key + ".required", "boardListing." + key, "尚未填写 boardListing." + key));
    } else if (typeof board[key] !== "string" || board[key].length > max) {
      results.push(error("boardListing." + key, "boardListing." + key, "boardListing." + key + " 长度非法"));
    }
  }
  if (board.taskId !== undefined && board.taskId !== null && !TASK_ID_RE.test(board.taskId)) {
    results.push(error("boardListing.taskId", "boardListing.taskId", "taskId 必须以字母开头，仅含字母数字、下划线、短横线（≤64）"));
  }
}

function validateIdsArray(value, path, limit, kind, results) {
  if (value === undefined || value === null) {
    return;
  }
  if (!Array.isArray(value)) {
    results.push(error(path + ".type", path, path + " 必须是数组"));
    return;
  }
  if (value.length > limit) {
    results.push(error(path + ".max", path, path + " 最多 " + limit + " 项"));
  }
  value.forEach((item, index) => {
    if (kind === "integer") {
      if (!isInteger(item) || item < 1) {
        results.push(error(path + ".invalid", path + "[" + index + "]", "必须是正整数"));
      }
    } else if (typeof item !== "string" || item.length === 0 || item.length > 160) {
      results.push(error(path + ".invalid", path + "[" + index + "]", "必须是非空字符串（≤160）"));
    }
  });
}

export function validateEntry(entry, ctx = {}) {
  const results = [];
  if (!isPlainObject(entry)) {
    results.push(error("entry.type", "", "条目必须是对象"));
    return results;
  }

  validateRequiredStrings(entry, results);

  if (!isBlank(entry.entry) && (typeof entry.entry !== "string" || !ENTRY_RE.test(entry.entry))) {
    results.push(
      error("entry.invalid", "entry", "entry 必须是 code/<字母数字下划线或短横线>.js（如 code/main.js）")
    );
  }

  validateEvents(entry, results);
  validateUi(entry, entry.events, results);
  validateBoardListing(entry, results);

  if (entry.stateVersion !== undefined && entry.stateVersion !== null) {
    if (!isInteger(entry.stateVersion) || entry.stateVersion < 1 || entry.stateVersion > 1000000) {
      results.push(error("stateVersion.range", "stateVersion", "stateVersion 必须是 1–1000000 的整数"));
    }
  }

  if (isBlank(entry.npcDescription) && entry.npcDescription !== undefined && entry.npcDescription !== null) {
    results.push(warning("npcDescription.required", "npcDescription", "尚未填写 npcDescription"));
  } else if (typeof entry.npcDescription === "string" && entry.npcDescription.length > 1000) {
    results.push(error("npcDescription.length", "npcDescription", "npcDescription 最多 1000 字"));
  }

  validateIdsArray(entry.queryItemIds, "queryItemIds", 32, "integer", results);
  validateIdsArray(entry.gatedNodeIds, "gatedNodeIds", 32, "string", results);

  if (typeof entry.__code !== "string" || entry.__code.trim() === "") {
    results.push(warning("__code.required", "__code", "尚未编写脚本代码（__code 不能为空）"));
  } else if (entry.__code.length > 262144) {
    results.push(error("__code.size", "__code", "脚本代码不得超过 256KiB"));
  }

  const modApiVersion = expectedModApiVersion(ctx);
  if (modApiVersion !== null && modApiVersion !== 2) {
    results.push(error("modApiVersion.scripts", "modApiVersion", "声明 scripts 域时 manifest.modApiVersion 必须为 2"));
  }

  return results;
}

export function validateProject(project, domain = "scripts") {
  const results = [];
  const entries = collectEntries(project, domain);
  const manifest = project && isPlainObject(project.meta) ? project.meta.manifest : null;

  if (entries.length > 16) {
    results.push(error("count.exceeded", "content." + domain, "每包最多 16 个脚本定义，当前 " + entries.length + " 个"));
  }

  if (isPlainObject(manifest) && manifest.modApiVersion !== 2) {
    results.push(error("modApiVersion.scripts", "meta.manifest.modApiVersion", "声明 scripts 域时 manifest.modApiVersion 必须为 2"));
  }

  const mapEntries = collectEntries(project, "maps");
  const mapIds = new Set(
    mapEntries
      .filter((map) => isPlainObject(map) && typeof map.mapId === "string" && map.mapId !== "")
      .map((map) => map.mapId)
  );
  const mapsDeclared = isPlainObject(manifest) && isPlainObject(manifest.domains)
    ? Object.prototype.hasOwnProperty.call(manifest.domains, "maps")
    : false;
  if (!mapsDeclared && mapEntries.length === 0) {
    results.push(warning("maps.dependency", "meta.manifest.domains", "scripts 依赖同包 maps 与 modApiVersion 2，请同时声明 maps 域"));
  }

  const seenIds = new Map();
  const seenEntries = new Map();
  entries.forEach((entry, index) => {
    if (!isPlainObject(entry)) {
      return;
    }
    const path = "content." + domain + "[" + index + "]";

    if (typeof entry.id === "string" && entry.id !== "") {
      if (seenIds.has(entry.id)) {
        results.push(error("id.duplicate", path + ".id", "脚本 ID " + entry.id + " 在本 Mod 内重复声明"));
      } else {
        seenIds.set(entry.id, index);
      }
    }

    if (typeof entry.entry === "string" && ENTRY_RE.test(entry.entry)) {
      if (seenEntries.has(entry.entry)) {
        results.push(
          error("entry.conflict", path + ".entry", "入口路径 " + entry.entry + " 已被其它脚本占用，不能多个脚本共用同一文件")
        );
      } else {
        seenEntries.set(entry.entry, index);
      }
    }

    if (typeof entry.mapId === "string" && entry.mapId !== "" && mapIds.size > 0 && !mapIds.has(entry.mapId)) {
      results.push(
        warning("mapId.dangling", path + ".mapId", "mapId " + entry.mapId + " 不在同包 maps 中，可能是悬空引用（scripts 必须绑定同包地图）")
      );
    }
  });

  return results;
}

function toFile(entry, ctx = {}) {
  if (!isPlainObject(entry)) {
    throw new Error("toFiles: 条目必须是对象");
  }
  const id = entry.id;
  if (typeof id !== "string" || id === "") {
    throw new Error("toFiles: 条目缺少 id");
  }
  const slug = slugOf(id);
  if (!SLUG_RE.test(slug)) {
    throw new Error("toFiles: 脚本 ID 短名非法：" + id);
  }
  const entryPath = entry.entry;
  const match = typeof entryPath === "string" ? ENTRY_CAPTURE_RE.exec(entryPath) : null;
  if (!match) {
    throw new Error("toFiles: 条目缺少合法的 entry（code/<名称>.js）");
  }
  const code = typeof entry.__code === "string" ? entry.__code : "";
  if (typeof ctx.modId === "string" && ctx.modId !== "" && id.indexOf(":") > 0) {
    if (id.slice(0, id.lastIndexOf(":")) !== ctx.modId) {
      throw new Error("toFiles: ctx.modId（" + ctx.modId + "）与脚本 id 命名空间不一致（" + id + "）");
    }
  }
  const definition = {};
  for (const key of Object.keys(entry)) {
    if (key === "__code") {
      continue;
    }
    definition[key] = entry[key];
  }
  return [
    { path: "scripts/" + slug + ".json", content: JSON.stringify(definition, null, 2) },
    { path: entryPath, content: code }
  ];
}

export function toFiles(entriesOrEntry, ctx = {}) {
  const list = Array.isArray(entriesOrEntry) ? entriesOrEntry : [entriesOrEntry];
  const files = [];
  for (const entry of list) {
    files.push(...toFile(entry, ctx));
  }
  return files;
}

export function fromFiles(files, ctx = {}) {
  void ctx;
  if (!Array.isArray(files)) {
    return [];
  }
  const codeByPath = new Map();
  const definitions = [];
  for (const file of files) {
    if (!file || typeof file.path !== "string") {
      continue;
    }
    const normalized = file.path.replace(/\\/g, "/");
    const codeMatch = /(^|\/)code\/[^/]+\.js$/i.exec(normalized);
    if (codeMatch) {
      const key = normalized.replace(/^.*?(?=code\/)/i, "");
      codeByPath.set(normalized, file.content);
      codeByPath.set(key, file.content);
      continue;
    }
    if (!/(^|\/)scripts\/[^/]+\.json$/i.test(normalized)) {
      continue;
    }
    let parsed;
    try {
      parsed = JSON.parse(typeof file.content === "string" ? file.content : String(file.content));
    } catch {
      throw new Error("fromFiles: " + normalized + " 不是合法 JSON");
    }
    if (!isPlainObject(parsed)) {
      continue;
    }
    definitions.push(parsed);
  }

  for (const definition of definitions) {
    const entryPath = typeof definition.entry === "string" ? definition.entry.replace(/\\/g, "/") : "";
    if (entryPath !== "" && codeByPath.has(entryPath)) {
      definition.__code = String(codeByPath.get(entryPath));
    } else if (typeof definition.__code !== "string") {
      definition.__code = "";
    }
  }

  return definitions;
}

export function summarize(entry) {
  if (!isPlainObject(entry)) {
    return "（无效脚本）";
  }
  const name = typeof entry.name === "string" && entry.name ? entry.name : entry.id || "未命名";
  const slug = slugOf(entry.id) || "?";
  const events = Array.isArray(entry.events) ? entry.events.length : 0;
  const place = (entry.mapId || "?") + "/" + (entry.nodeId || "?");
  return "脚本 " + name + "（" + slug + "）· 事件 " + events + " · " + place;
}
