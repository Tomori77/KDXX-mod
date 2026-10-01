// src/domains/maps.js — maps@1 域：骨架、字段描述、校验、导入导出与摘要。

import { entrances, officialBackgrounds } from "../generated/catalogs.js";

const SCHEMA_FILE = "maps@1 · map.schema.json";
const LOCAL_ID_PATTERN = "^[a-z0-9]+(?:-[a-z0-9]+)*$";
const LOCAL_ID_RE = new RegExp(LOCAL_ID_PATTERN);
const MOD_ID_PATTERN = "^[a-z0-9]+(?:[.-][a-z0-9]+)+$";
const MOD_ID_RE = new RegExp(MOD_ID_PATTERN);
const OFFICIAL_MAP_RE = /^map_[0-9]{2,3}$/;

const OFFICIAL_ENTRANCE_IDS = ["map_01", "map_05", "map_06", "map_07", "map_08", "map_09", "map_10"];

const ENTRANCE_MAP_IDS = [
  ...new Set([...entrances.map((item) => item.mapId), ...OFFICIAL_ENTRANCE_IDS])
].sort();

const BACKGROUND_MAP_IDS = [
  ...new Set([...entrances.map((item) => item.mapId), ...officialBackgrounds.map((item) => item.mapId)])
].sort();

const ENTRANCE_MAP_OPTIONS = ENTRANCE_MAP_IDS.map((id) => {
  const found = entrances.find((item) => item.mapId === id);
  return { value: id, label: found ? found.displayName + "（" + id + "）" : id };
});

const BACKGROUND_OPTIONS = BACKGROUND_MAP_IDS.map((id) => {
  const found = officialBackgrounds.find((item) => item.mapId === id);
  return { value: id, label: found ? found.displayName + "（" + id + "）" : id };
});

export const meta = {
  key: "maps",
  labelZh: "地图",
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

function prefixOf(mapId) {
  if (typeof mapId !== "string") {
    return "";
  }
  const index = mapId.indexOf(":");
  return index > 0 ? mapId.slice(0, index) : "";
}

function slugOf(mapId) {
  if (typeof mapId !== "string") {
    return "";
  }
  const trimmed = mapId.trim();
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
    mapId: "",
    displayName: "",
    startNodeId: "",
    entrance: { mapId: "map_01", nodeId: "", x: 0.5, y: 0.5 },
    travelDaysPerEdge: 1,
    nodes: [{ id: "start", kind: "site", name: "起点", x: 0.5, y: 0.5 }],
    edges: [],
    backgroundImageBasename: "",
    pools: []
  };
  const next = { ...skeleton, ...partial };
  if (isPlainObject(partial.entrance)) {
    next.entrance = { ...skeleton.entrance, ...partial.entrance };
  }
  if (Array.isArray(partial.nodes)) {
    next.nodes = partial.nodes;
  }
  if (Array.isArray(partial.edges)) {
    next.edges = partial.edges;
  }
  if (Array.isArray(partial.pools)) {
    next.pools = partial.pools;
  }
  return next;
}

export function fields() {
  return [
    {
      path: "mapId",
      control: "text",
      label: "地图 ID（<本包ID>:<短名>）",
      required: true,
      pattern: MOD_ID_PATTERN + ":" + LOCAL_ID_PATTERN,
      schema: schema("/properties/mapId")
    },
    {
      path: "displayName",
      control: "text",
      label: "地图名称",
      required: true,
      schema: schema("/properties/displayName")
    },
    {
      path: "startNodeId",
      control: "text",
      label: "起点节点 ID（必须是 site，且不挂遭遇/传送）",
      required: true,
      pattern: LOCAL_ID_PATTERN,
      schema: schema("/properties/startNodeId")
    },
    {
      path: "travelDaysPerEdge",
      control: "number",
      label: "每段行程天数（travelDaysPerEdge）",
      required: true,
      min: 1,
      max: 360,
      step: 1,
      schema: schema("/properties/travelDaysPerEdge")
    },
    {
      path: "entrance.mapId",
      control: "select",
      label: "接入官方地图（entrance.mapId，必须 map_XX）",
      required: true,
      options: ENTRANCE_MAP_OPTIONS,
      schema: schema("/properties/entrance/properties/mapId")
    },
    {
      path: "entrance.nodeId",
      control: "select",
      label: "接入官方节点（entrance.nodeId，取自对应官方地图）",
      required: true,
      options: [],
      freeform: true,
      optionsSource: {
        catalog: "entrances",
        mapIdPath: "entrance.mapId",
        valueField: "id",
        labelField: "name"
      },
      schema: schema("/properties/entrance/properties/nodeId")
    },
    {
      path: "entrance.x",
      control: "number",
      label: "接入点 X（0–1）",
      required: true,
      min: 0,
      max: 1,
      step: 0.01,
      schema: schema("/properties/entrance/properties/x")
    },
    {
      path: "entrance.y",
      control: "number",
      label: "接入点 Y（0–1）",
      required: true,
      min: 0,
      max: 1,
      step: 0.01,
      schema: schema("/properties/entrance/properties/y")
    },
    {
      path: "backgroundImageBasename",
      control: "text",
      label: "背景图名（backgroundImageBasename，与官方背景二选一）",
      required: false,
      pattern: LOCAL_ID_PATTERN,
      schema: schema("/properties/backgroundImageBasename")
    },
    {
      path: "officialBackgroundMapId",
      control: "select",
      label: "官方背景地图（officialBackgroundMapId，与自备背景二选一）",
      required: false,
      options: BACKGROUND_OPTIONS,
      schema: schema("/properties/officialBackgroundMapId")
    },
    {
      path: "nodes",
      control: "json",
      label: "节点（nodes：id/kind(site|path)/name/x/y/encounter{fixed|pool}/target{mapId,nodeId}）",
      required: true,
      rows: 10,
      schema: schema("/$defs/nodes")
    },
    {
      path: "edges",
      control: "json",
      label: "边（edges：from/to，均为本图节点 id）",
      required: true,
      rows: 6,
      schema: schema("/$defs/edges")
    },
    {
      path: "pools",
      control: "json",
      label: "遭遇池（pools：id/encounterIds/cooldownDays）",
      required: false,
      rows: 5,
      schema: schema("/$defs/pools")
    }
  ];
}

function validateMapId(mapId, results) {
  if (isBlank(mapId)) {
    results.push(warning("mapId.required", "mapId", "尚未填写地图 ID"));
    return;
  }
  if (OFFICIAL_MAP_RE.test(mapId)) {
    return;
  }
  const index = mapId.indexOf(":");
  if (index > 0) {
    const namespace = mapId.slice(0, index);
    const slug = mapId.slice(index + 1);
    if (!MOD_ID_RE.test(namespace) || !LOCAL_ID_RE.test(slug)) {
      results.push(
        error(
          "mapId.invalid",
          "mapId",
          "地图 ID 必须是 <本包ID>:<短名>，本包 ID 为小写反向域名，短名为小写短横线串"
        )
      );
    }
    return;
  }
  results.push(error("mapId.invalid", "mapId", "地图 ID 必须是 <本包ID>:<短名>（或官方 map_XX）"));
}

function validateBackground(entry, results) {
  const hasImage = !isBlank(entry.backgroundImageBasename);
  const hasOfficial = !isBlank(entry.officialBackgroundMapId);
  if (hasImage && hasOfficial) {
    results.push(
      error(
        "background.conflict",
        "officialBackgroundMapId",
        "backgroundImageBasename 与 officialBackgroundMapId 只能选其一，不能同时提供"
      )
    );
  } else if (!hasImage && !hasOfficial) {
    results.push(
      error(
        "background.missing",
        "backgroundImageBasename",
        "必须提供 backgroundImageBasename（自备 256–2048 方形图）或 officialBackgroundMapId（官方背景）之一"
      )
    );
  }
  if (hasImage && !LOCAL_ID_RE.test(entry.backgroundImageBasename)) {
    results.push(
      error(
        "backgroundImageBasename.invalid",
        "backgroundImageBasename",
        "backgroundImageBasename 只能是小写字母数字与短横线，且不能含扩展名/路径"
      )
    );
  }
  if (hasOfficial && !OFFICIAL_MAP_RE.test(entry.officialBackgroundMapId)) {
    results.push(
      error("officialBackgroundMapId.invalid", "officialBackgroundMapId", "officialBackgroundMapId 必须形如 map_05")
    );
  } else if (hasOfficial && !BACKGROUND_MAP_IDS.includes(entry.officialBackgroundMapId)) {
    results.push(
      warning(
        "officialBackgroundMapId.unknown",
        "officialBackgroundMapId",
        "该官方背景 ID 不在背景目录中，请核对 official-background-catalog.json"
      )
    );
  }
}

function validateCoordinate(value, path, results) {
  if (typeof value !== "number" || Number.isNaN(value) || value < 0 || value > 1) {
    results.push(error("coordinate.invalid", path, "坐标必须是 0–1 之间的数值"));
  }
}

function validateEntrance(entrance, results) {
  if (!isPlainObject(entrance)) {
    results.push(error("entrance.type", "entrance", "entrance 必须是对象"));
    return;
  }
  for (const key of ["mapId", "nodeId", "x", "y"]) {
    if (entrance[key] === undefined || entrance[key] === null) {
      results.push(warning("entrance.required", "entrance." + key, "entrance." + key + " 为必填"));
    }
  }
  if (!isBlank(entrance.mapId) && !OFFICIAL_MAP_RE.test(entrance.mapId)) {
    results.push(
      error(
        "entrance.mapId.official",
        "entrance.mapId",
        "entrance.mapId 必须是官方地图（map_XX），不能指向本包地图"
      )
    );
  }
  validateCoordinate(entrance.x, "entrance.x", results);
  validateCoordinate(entrance.y, "entrance.y", results);
}

function validateNodes(entry, results) {
  const nodes = entry.nodes;
  if (!Array.isArray(nodes)) {
    results.push(error("nodes.type", "nodes", "nodes 必须是数组"));
    return new Set();
  }
  if (nodes.length < 2) {
    results.push(warning("nodes.minItems", "nodes", "地图至少需要 2 个节点（起点 + 至少一个可达节点）"));
  }
  const ids = new Set();
  const startPrefix = prefixOf(entry.mapId);
  nodes.forEach((node, index) => {
    const path = "nodes[" + index + "]";
    if (!isPlainObject(node)) {
      results.push(error("node.type", path, "节点必须是对象"));
      return;
    }
    if (isBlank(node.id)) {
      results.push(warning("node.id.required", path + ".id", "节点缺少 id"));
    } else if (ids.has(node.id)) {
      results.push(error("node.id.duplicate", path + ".id", "节点 id 在本图内重复：" + node.id));
    } else {
      ids.add(node.id);
      if (!LOCAL_ID_RE.test(node.id)) {
        results.push(error("node.id.invalid", path + ".id", "节点 id 必须是小写字母数字与短横线"));
      }
    }
    if (node.kind !== "site" && node.kind !== "path") {
      results.push(error("node.kind.invalid", path + ".kind", "节点 kind 只能是 site 或 path"));
    }
    if (isBlank(node.name)) {
      results.push(warning("node.name.required", path + ".name", "节点缺少名称"));
    }
    validateCoordinate(node.x, path + ".x", results);
    validateCoordinate(node.y, path + ".y", results);

    if (node.encounter !== undefined && node.encounter !== null) {
      if (!isPlainObject(node.encounter)) {
        results.push(error("node.encounter.type", path + ".encounter", "encounter 必须是对象"));
      } else {
        const hasFixed = !isBlank(node.encounter.fixed);
        const hasPool = !isBlank(node.encounter.pool);
        if (hasFixed === hasPool) {
          results.push(
            error(
              "node.encounter.oneOf",
              path + ".encounter",
              "encounter 必须且只能提供 fixed（本包ID:遭遇）或 pool（池名）之一"
            )
          );
        }
      }
    }

    if (node.target !== undefined && node.target !== null) {
      if (!isPlainObject(node.target)) {
        results.push(error("node.target.type", path + ".target", "target 必须是对象"));
      } else {
        if (isBlank(node.target.mapId) || isBlank(node.target.nodeId)) {
          results.push(error("node.target.required", path + ".target", "target 必须同时提供 mapId 与 nodeId"));
        }
        if (OFFICIAL_MAP_RE.test(node.target.mapId)) {
          results.push(
            error(
              "node.target.official",
              path + ".target.mapId",
              "target 不能指向官方地图，只能指向同包地图节点"
            )
          );
        } else if (!isBlank(node.target.mapId)) {
          const targetPrefix = prefixOf(node.target.mapId);
          if (!targetPrefix || !startPrefix || targetPrefix !== startPrefix) {
            results.push(
              error(
                "node.target.crossPackage",
                path + ".target.mapId",
                "target 只能指向同包地图（需与本图 mapId 使用相同的本包 ID 前缀）"
              )
            );
          }
        }
      }
    }
  });
  return ids;
}

function validateStartNode(entry, results) {
  if (isBlank(entry.startNodeId)) {
    results.push(warning("startNodeId.required", "startNodeId", "尚未填写起点节点 ID"));
    return;
  }
  const nodes = Array.isArray(entry.nodes) ? entry.nodes : [];
  const found = nodes.find((node) => isPlainObject(node) && node.id === entry.startNodeId);
  if (!found) {
    results.push(error("startNodeId.missing", "startNodeId", "startNodeId 指向的节点不存在：" + entry.startNodeId));
    return;
  }
  if (found.kind !== "site") {
    results.push(error("startNodeId.kind", "startNodeId", "起点必须是 kind=site 的节点"));
  }
  if (found.encounter != null || found.target != null) {
    results.push(
      error("startNodeId.attached", "startNodeId", "起点节点不能挂 encounter 或 target")
    );
  }
}

function validateEdges(entry, ids, results) {
  const edges = entry.edges;
  const nodes = Array.isArray(entry.nodes) ? entry.nodes : [];
  if (!Array.isArray(edges)) {
    results.push(error("edges.type", "edges", "edges 必须是数组"));
    return;
  }
  if (nodes.length > 1 && edges.length === 0) {
    results.push(error("edges.required", "edges", "多节点地图至少需要一条 edge"));
  }
  edges.forEach((edge, index) => {
    const path = "edges[" + index + "]";
    if (!isPlainObject(edge)) {
      results.push(error("edge.type", path, "edge 必须是对象"));
      return;
    }
    if (isBlank(edge.from) || isBlank(edge.to)) {
      results.push(error("edge.required", path, "edge 必须同时提供 from 与 to"));
      return;
    }
    if (!ids.has(edge.from)) {
      results.push(error("edge.from.missing", path + ".from", "edge.from 指向不存在的节点：" + edge.from));
    }
    if (!ids.has(edge.to)) {
      results.push(error("edge.to.missing", path + ".to", "edge.to 指向不存在的节点：" + edge.to));
    }
  });

  if (nodes.length > 1) {
    const incident = new Set();
    edges.forEach((edge) => {
      if (isPlainObject(edge)) {
        incident.add(edge.from);
        incident.add(edge.to);
      }
    });
    nodes.forEach((node, index) => {
      if (isPlainObject(node) && !isBlank(node.id) && !incident.has(node.id)) {
        results.push(
          error("node.unconnected", "nodes[" + index + "].id", "节点未连通（至少需要被一条 edge 连接）：" + node.id)
        );
      }
    });
  }
}

function validatePools(entry, results) {
  const pools = entry.pools;
  if (pools === undefined || pools === null) {
    return;
  }
  if (!Array.isArray(pools)) {
    results.push(error("pools.type", "pools", "pools 必须是数组"));
    return;
  }
  if (pools.length > 64) {
    results.push(error("pools.maxItems", "pools", "pools 最多 64 项"));
  }
  pools.forEach((pool, index) => {
    const path = "pools[" + index + "]";
    if (!isPlainObject(pool)) {
      results.push(error("pool.type", path, "池必须是对象"));
      return;
    }
    if (isBlank(pool.id) || !LOCAL_ID_RE.test(pool.id)) {
      results.push(error("pool.id.invalid", path + ".id", "池 id 必须是小写字母数字与短横线"));
    }
    if (!Array.isArray(pool.encounterIds) || pool.encounterIds.length < 1 || pool.encounterIds.length > 64) {
      results.push(error("pool.encounterIds", path + ".encounterIds", "encounterIds 需要 1–64 个遭遇引用"));
    }
    if (!Number.isInteger(pool.cooldownDays) || pool.cooldownDays < 1 || pool.cooldownDays > 36000) {
      results.push(error("pool.cooldownDays", path + ".cooldownDays", "cooldownDays 必须是 1–36000 的整数"));
    }
  });
}

export function validateEntry(entry) {
  const results = [];
  if (!isPlainObject(entry)) {
    results.push(error("entry.type", "", "条目必须是对象"));
    return results;
  }
  validateMapId(entry.mapId, results);
  if (isBlank(entry.displayName)) {
    results.push(warning("displayName.required", "displayName", "尚未填写地图名称"));
  }
  if (
    entry.travelDaysPerEdge !== undefined &&
    (typeof entry.travelDaysPerEdge !== "number" ||
      !Number.isInteger(entry.travelDaysPerEdge) ||
      entry.travelDaysPerEdge < 1 ||
      entry.travelDaysPerEdge > 360)
  ) {
    results.push(
      error("travelDaysPerEdge.invalid", "travelDaysPerEdge", "travelDaysPerEdge 必须是 1–360 的整数")
    );
  } else if (entry.travelDaysPerEdge === undefined) {
    results.push(warning("travelDaysPerEdge.required", "travelDaysPerEdge", "尚未填写每段行程天数"));
  }

  validateBackground(entry, results);
  validateEntrance(entry.entrance, results);
  const ids = validateNodes(entry, results);
  validateStartNode(entry, results);
  validateEdges(entry, ids, results);
  validatePools(entry, results);
  return results;
}

export function validateProject(project, domain = "maps") {
  const results = [];
  const entries = collectEntries(project, domain);
  const seen = new Map();
  entries.forEach((entry, index) => {
    const mapId = isPlainObject(entry) ? entry.mapId : null;
    if (isBlank(mapId)) {
      return;
    }
    const path = "content." + domain + "[" + index + "].mapId";
    if (seen.has(mapId)) {
      results.push(error("mapId.duplicate", path, "地图 ID 在本 Mod 内重复声明：" + mapId));
    } else {
      seen.set(mapId, index);
    }
  });
  return results;
}

function toFile(entry) {
  if (!isPlainObject(entry)) {
    throw new Error("toFiles: 条目必须是对象");
  }
  const slug = slugOf(entry.mapId);
  if (isBlank(slug)) {
    throw new Error("toFiles: 条目缺少 mapId");
  }
  return { path: "maps/" + slug + ".json", content: JSON.stringify(entry, null, 2) };
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
    if (!/(^|\/)maps\/[^/]+\.json$/i.test(normalized)) {
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
    return "（无效地图）";
  }
  const name = entry.displayName || entry.mapId || "未命名";
  const slug = slugOf(entry.mapId);
  const nodes = Array.isArray(entry.nodes) ? entry.nodes.length : 0;
  const edges = Array.isArray(entry.edges) ? entry.edges.length : 0;
  return name + " " + (slug || "?") + " · " + nodes + " 节点/" + edges + " 边";
}
