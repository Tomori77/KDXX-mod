import { regionPools, fixedNodes } from "../generated/catalogs.js";

const SCHEMA_FILE = "encounter-placements@1|2 · placement.schema.json";
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const ENCOUNTER_ID_RE = /^[a-z0-9]+(?:[.-][a-z0-9]+)+:[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MAP_ID_RE = /^map_[0-9]{2,3}$/;
const NODE_ID_RE = /^[a-z0-9][a-z0-9_-]*$/;

const MODES = ["addToRegionPool", "overrideFixedNode"];

const MAP_IDS = [...new Set(regionPools.map((pool) => pool.mapId))];
if (!MAP_IDS.includes("map_01")) {
  MAP_IDS.unshift("map_01");
}
const MAP_OPTIONS = MAP_IDS.map((mapId) => ({
  value: mapId,
  label: mapId === "map_01" ? mapId + "（首图，仅固定节点）" : mapId
}));
const MAP_OPTION_SET = new Set(MAP_IDS);

const REGIONS_BY_MAP = new Map();
for (const pool of regionPools) {
  if (!REGIONS_BY_MAP.has(pool.mapId)) {
    REGIONS_BY_MAP.set(pool.mapId, []);
  }
  REGIONS_BY_MAP.get(pool.mapId).push(pool);
}
const REGION_OPTIONS_BY_MAP = {};
for (const [mapId, pools] of REGIONS_BY_MAP) {
  REGION_OPTIONS_BY_MAP[mapId] = pools.map((pool) => ({
    value: pool.regionId,
    label: (pool.displayName || pool.regionId) + "（" + pool.regionId + "）"
  }));
}
const REGION_IDS = new Set(regionPools.map((pool) => pool.regionId));

const NODES_BY_MAP = new Map();
for (const node of fixedNodes) {
  if (!NODES_BY_MAP.has(node.mapId)) {
    NODES_BY_MAP.set(node.mapId, []);
  }
  NODES_BY_MAP.get(node.mapId).push(node);
}
const NODE_OPTIONS_BY_MAP = {};
for (const [mapId, nodes] of NODES_BY_MAP) {
  NODE_OPTIONS_BY_MAP[mapId] = nodes.map((node) => ({
    value: node.nodeId,
    label: node.nodeId + "（" + (node.type || "?") + "）"
  }));
}
const NODE_IDS = new Set(fixedNodes.map((node) => node.nodeId));

export const meta = {
  key: "encounter-placements",
  labelZh: "遭遇投放",
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
    mode: "addToRegionPool",
    mapId: "map_05",
    regionId: "",
    encounterId: "",
    ...partial
  };
}

export function fields() {
  return [
    {
      path: "mode",
      control: "select",
      label: "投放模式",
      required: true,
      options: [
        { value: "addToRegionPool", label: "追加到区域池（addToRegionPool）" },
        { value: "overrideFixedNode", label: "替换首图固定节点（overrideFixedNode）" }
      ],
      schema: schema("/oneOf/0/properties/mode")
    },
    {
      path: "mapId",
      control: "select",
      label: "地图（mapId；overrideFixedNode 必须为 map_01）",
      required: true,
      options: MAP_OPTIONS,
      schema: schema("/oneOf/0/properties/mapId")
    },
    {
      path: "regionId",
      control: "select",
      label: "区域（regionId；addToRegionPool 必填，来自该地图的公开区域池）",
      required: false,
      options: [],
      optionsBy: "mapId",
      optionsMap: REGION_OPTIONS_BY_MAP,
      freeform: true,
      schema: schema("/oneOf/0/properties/regionId")
    },
    {
      path: "nodeId",
      control: "select",
      label: "固定节点（nodeId；overrideFixedNode 必填，来自 map_01 固定节点目录）",
      required: false,
      options: [],
      optionsBy: "mapId",
      optionsMap: NODE_OPTIONS_BY_MAP,
      schema: schema("/oneOf/1/properties/nodeId")
    },
    {
      path: "encounterId",
      control: "text",
      label: "遭遇 ID（encounterId，必须来自本包 encounters）",
      required: true,
      schema: schema("/oneOf/0/properties/encounterId")
    }
  ];
}

function validateAddToRegionPool(entry, ctx, results) {
  if (isBlank(entry.mapId)) {
    results.push(error("mapId.required", "mapId", "addToRegionPool 必填 mapId"));
  } else if (!MAP_ID_RE.test(entry.mapId)) {
    results.push(error("mapId.invalid", "mapId", "mapId 必须是 map_XX"));
  } else if (!MAP_OPTION_SET.has(entry.mapId)) {
    results.push(error("mapId.unknown", "mapId", "mapId 不在公开区域池目录中：" + entry.mapId));
  } else if (entry.mapId === "map_01") {
    results.push(error("mapId.map01", "mapId", "map_01 不开放区域池，请改用 overrideFixedNode 替换固定节点"));
  }

  if (isBlank(entry.regionId)) {
    results.push(error("regionId.required", "regionId", "addToRegionPool 必填 regionId"));
  } else if (!REGION_IDS.has(entry.regionId)) {
    results.push(error("regionId.unknown", "regionId", "regionId 不在公开目录中：" + entry.regionId));
  } else if (!isBlank(entry.mapId) && MAP_ID_RE.test(entry.mapId)) {
    const pools = REGIONS_BY_MAP.get(entry.mapId) || [];
    if (!pools.some((pool) => pool.regionId === entry.regionId)) {
      results.push(error("regionId.mismatch", "regionId", "regionId " + entry.regionId + " 不属于地图 " + entry.mapId));
    }
  }
}

function validateOverrideFixedNode(entry, results) {
  if (entry.mapId !== "map_01") {
    results.push(error("mapId.fixedNode", "mapId", "overrideFixedNode 的 mapId 必须为 map_01"));
  }
  if (isBlank(entry.nodeId)) {
    results.push(error("nodeId.required", "nodeId", "overrideFixedNode 必填 nodeId"));
  } else if (typeof entry.nodeId !== "string" || !NODE_ID_RE.test(entry.nodeId)) {
    results.push(error("nodeId.invalid", "nodeId", "nodeId 非法：" + entry.nodeId));
  } else if (!NODE_IDS.has(entry.nodeId)) {
    results.push(error("nodeId.unknown", "nodeId", "nodeId 不在 map_01 固定节点目录中：" + entry.nodeId));
  }
}

function validateEncounterRef(entry, ctx, results) {
  if (isBlank(entry.encounterId)) {
    results.push(error("encounterId.required", "encounterId", "必填 encounterId（须来自本包 encounters）"));
    return;
  }
  if (typeof entry.encounterId !== "string" || !ENCOUNTER_ID_RE.test(entry.encounterId)) {
    results.push(error("encounterId.invalid", "encounterId", "encounterId 必须是 <mod-id>:<slug>"));
    return;
  }
  if (Array.isArray(ctx.encounterIds) && !ctx.encounterIds.includes(entry.encounterId)) {
    results.push(
      warning("encounterId.dangling", "encounterId", "投放引用的遭遇不在本包 encounters 中：" + entry.encounterId)
    );
  }
}

export function validateEntry(entry, ctx = {}) {
  const results = [];
  if (!isPlainObject(entry)) {
    results.push(error("entry.type", "", "条目必须是对象"));
    return results;
  }
  if (!MODES.includes(entry.mode)) {
    results.push(error("mode.invalid", "mode", "mode 必须是 addToRegionPool 或 overrideFixedNode"));
    return results;
  }
  if (entry.mode === "addToRegionPool") {
    validateAddToRegionPool(entry, ctx, results);
  } else {
    validateOverrideFixedNode(entry, results);
  }
  validateEncounterRef(entry, ctx, results);
  return results;
}

export function validateProject(project, domain = "encounter-placements") {
  const results = [];
  const entries = collectEntries(project, domain);
  const encounterEntries = collectEntries(project, "encounters");
  const encounterIds = new Set(
    encounterEntries
      .filter((item) => isPlainObject(item) && typeof item.encounterId === "string")
      .map((item) => item.encounterId)
  );
  const targets = new Map();

  entries.forEach((entry, index) => {
    if (!isPlainObject(entry)) {
      return;
    }
    const path = "content." + domain + "[" + index + "]";

    if (typeof entry.encounterId === "string" && entry.encounterId !== "" && !encounterIds.has(entry.encounterId)) {
      results.push(
        warning("encounterId.dangling", path + ".encounterId", "投放引用的遭遇不在本包 encounters 中：" + entry.encounterId)
      );
    }

    const target = entry.mode + ":" + entry.mapId + ":" + (entry.mode === "overrideFixedNode" ? entry.nodeId : entry.regionId);
    if (targets.has(target)) {
      results.push(
        error("placement.duplicate", path, "同一投放目标重复声明（" + target + "），与第 " + (targets.get(target) + 1) + " 项冲突")
      );
    } else {
      targets.set(target, index);
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
  if (typeof entry.encounterId !== "string" || entry.encounterId === "" || !ENCOUNTER_ID_RE.test(entry.encounterId)) {
    throw new Error("toFiles: 条目缺少合法的 encounterId（<mod-id>:<slug>）");
  }
  const slug = slugOf(entry.encounterId);
  if (!SLUG_RE.test(slug)) {
    throw new Error("toFiles: encounterId 短名非法：" + entry.encounterId);
  }
  return { path: "encounter-placements/" + slug + ".json", content: JSON.stringify(entry, null, 2) };
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
    if (!/(^|\/)encounter-placements\/[^/]+\.json$/i.test(normalized)) {
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
    return "（无效投放）";
  }
  const encounterId = typeof entry.encounterId === "string" && entry.encounterId ? slugOf(entry.encounterId) : "未指定遭遇";
  if (entry.mode === "overrideFixedNode") {
    return "投放 固定节点 " + (entry.mapId || "?") + "/" + (entry.nodeId || "?") + " → " + encounterId;
  }
  return "投放 区域池 " + (entry.mapId || "?") + "/" + (entry.regionId || "?") + " → " + encounterId;
}
