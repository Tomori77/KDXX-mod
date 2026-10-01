// src/domains/manifest.js — manifest 域：骨架、字段描述、校验、导入导出与摘要。

import { domainSchemaVersions } from "../generated/enums.js";

const SCHEMA_REF = "manifest@2 · manifest.schema.json";
const ID_PATTERN = "^[a-z0-9]+(?:[.-][a-z0-9]+)+$";
const ID_RE = new RegExp(ID_PATTERN);
const SEMVER_RE = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z-.]+)?(?:\+[0-9A-Za-z-.]+)?$/;
const COMPATIBLE_FROM_RE = /^(?:>=|>|<=|<|=)\d+\.\d+\.\d+(?:\s+(?:>=|>|<=|<|=)\d+\.\d+\.\d+)*$/;
const DOMAIN_PATH_RE = /^[a-z0-9][a-z0-9._/-]*$/;

export const meta = {
  key: "manifest",
  labelZh: "清单",
  schemaFile: "manifest.schema.json"
};

const ALLOWED_DOMAINS = Object.keys(domainSchemaVersions);

const DOMAIN_DEPENDENCIES = {
  "encounter-placements": ["encounters"],
  scripts: ["maps"]
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

function allowedVersions(domain) {
  const raw = domainSchemaVersions[domain];
  return Array.isArray(raw) ? raw : [raw];
}

export function createEntry(partial = {}) {
  const skeleton = {
    id: "",
    name: "",
    version: "1.0.0",
    modApiVersion: 1,
    enabled: true,
    author: "",
    description: "",
    saveCompatibility: null,
    domains: {}
  };
  return { ...skeleton, ...partial };
}

export function fields() {
  return [
    {
      path: "manifest.id",
      control: "text",
      label: "模组 ID（反向域名）",
      required: true,
      pattern: ID_PATTERN,
      schema: SCHEMA_REF + "#/properties/id"
    },
    {
      path: "manifest.name",
      control: "text",
      label: "模组名称",
      required: true,
      schema: SCHEMA_REF + "#/properties/name"
    },
    {
      path: "manifest.version",
      control: "text",
      label: "作者版本（SemVer）",
      required: true,
      schema: SCHEMA_REF + "#/properties/version"
    },
    {
      path: "manifest.author",
      control: "text",
      label: "作者",
      required: false,
      schema: SCHEMA_REF + "#/properties/author"
    },
    {
      path: "manifest.description",
      control: "text",
      label: "简介",
      required: false,
      schema: SCHEMA_REF + "#/properties/description"
    },
    {
      path: "manifest.modApiVersion",
      control: "select",
      label: "Mod API 版本",
      required: true,
      options: [
        { value: 1, label: "1（数据包）" },
        { value: 2, label: "2（冒险脚本包）" }
      ],
      schema: SCHEMA_REF + "#/properties/modApiVersion"
    },
    {
      path: "manifest.enabled",
      control: "toggle",
      label: "启用",
      required: true,
      schema: SCHEMA_REF + "#/properties/enabled"
    },
    {
      path: "manifest.saveCompatibility",
      control: "save-compatibility",
      label: "存档兼容声明",
      required: false,
      schema: SCHEMA_REF + "#/properties/saveCompatibility"
    }
  ];
}

function validateSaveCompatibility(save, results) {
  if (save == null) {
    return;
  }
  if (!isPlainObject(save)) {
    results.push(error("saveCompatibility.type", "saveCompatibility", "存档兼容声明必须是对象"));
    return;
  }
  if (typeof save.compatibleFrom !== "string" || !COMPATIBLE_FROM_RE.test(save.compatibleFrom)) {
    results.push(
      error(
        "saveCompatibility.compatibleFrom.invalid",
        "saveCompatibility.compatibleFrom",
        "compatibleFrom 必须是空格连接的比较式（如 >=1.0.0 <1.2.0），不支持 ^ ~ * 与预发布"
      )
    );
  }
  if (
    typeof save.contentRevision !== "number" ||
    !Number.isInteger(save.contentRevision) ||
    save.contentRevision < 1
  ) {
    results.push(
      error(
        "saveCompatibility.contentRevision.invalid",
        "saveCompatibility.contentRevision",
        "contentRevision 必须是大于等于 1 的整数"
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

  if (typeof entry.id !== "string") {
    results.push(error("id.invalid", "id", "ID 必须是小写反向域名（如 com.example.spirit-items）"));
  } else if (entry.id.length === 0) {
    results.push(warning("id.required", "id", "尚未填写 ID"));
  } else if (!ID_RE.test(entry.id)) {
    results.push(error("id.invalid", "id", "ID 必须是小写反向域名（如 com.example.spirit-items）"));
  }
  if (typeof entry.name !== "string") {
    results.push(error("name.invalid", "name", "名称必须是字符串"));
  } else if (entry.name.length === 0) {
    results.push(warning("name.required", "name", "尚未填写名称"));
  }
  if (typeof entry.version !== "string" || !SEMVER_RE.test(entry.version)) {
    results.push(error("version.invalid", "version", "版本必须是 SemVer（如 1.0.0）"));
  }
  if (entry.modApiVersion !== 1 && entry.modApiVersion !== 2) {
    results.push(error("modApiVersion.invalid", "modApiVersion", "Mod API 版本只能是 1 或 2"));
  }
  if (typeof entry.enabled !== "boolean") {
    results.push(error("enabled.invalid", "enabled", "enabled 必须是布尔值"));
  }

  if (isPlainObject(entry.domains) && Object.prototype.hasOwnProperty.call(entry.domains, "scripts")) {
    if (entry.modApiVersion !== 2) {
      results.push(
        error("modApiVersion.scripts", "modApiVersion", "声明 scripts 域时 modApiVersion 必须为 2")
      );
    }
  }

  validateSaveCompatibility(entry.saveCompatibility, results);
  return results;
}

export function validateDomains(manifest) {
  const results = [];
  const domains = isPlainObject(manifest) ? manifest.domains : null;
  if (!isPlainObject(domains)) {
    results.push(error("domains.type", "domains", "domains 必须是对象"));
    return results;
  }
  if (Object.keys(domains).length === 0) {
    results.push(error("domains.empty", "domains", "至少声明一个域"));
  }

  for (const key of Object.keys(domains)) {
    const path = "domains." + key;
    if (!Object.prototype.hasOwnProperty.call(domainSchemaVersions, key)) {
      results.push(error("domains.unknown", path, "未知的域：" + key));
      continue;
    }
    const def = domains[key];
    if (!isPlainObject(def)) {
      results.push(error("domains.definition", path, "域声明必须是对象"));
      continue;
    }
    const versions = allowedVersions(key);
    if (typeof def.schemaVersion !== "number" || !versions.includes(def.schemaVersion)) {
      results.push(
        error("domains.schemaVersion", path + ".schemaVersion", "域 " + key + " 的 schemaVersion 必须为 " + versions.join("/"))
      );
    }
    if (typeof def.path !== "string" || !DOMAIN_PATH_RE.test(def.path)) {
      results.push(error("domains.path", path + ".path", "域 " + key + " 的 path 非法"));
    }
  }

  for (const domain of Object.keys(domains)) {
    const deps = DOMAIN_DEPENDENCIES[domain];
    if (!deps) {
      continue;
    }
    for (const dep of deps) {
      if (!Object.prototype.hasOwnProperty.call(domains, dep)) {
        results.push(
          error("domains.dependency", "domains." + domain, "声明 " + domain + " 时必须同时声明 " + dep)
        );
      }
    }
  }

  return results;
}

export function validateProject(project) {
  const results = [];
  const manifest = project && isPlainObject(project.meta) ? project.meta.manifest : null;
  if (!isPlainObject(manifest)) {
    results.push(error("manifest.missing", "meta.manifest", "缺少 manifest"));
    return results;
  }
  results.push(...validateEntry(manifest));
  results.push(...validateDomains(manifest));
  return results;
}

export function toFiles(entriesOrEntry, ctx = {}) {
  const entry = Array.isArray(entriesOrEntry) ? entriesOrEntry[0] : entriesOrEntry;
  if (!isPlainObject(entry)) {
    throw new Error("toFiles: entry 必须是对象");
  }
  if (ctx.modId !== undefined && ctx.modId !== entry.id) {
    throw new Error("toFiles: ctx.modId 与 entry.id 不一致（" + ctx.modId + " != " + entry.id + "）");
  }
  return [{ path: "manifest.json", content: JSON.stringify(entry, null, 2) }];
}

export function fromFiles(files, ctx = {}) {
  if (!Array.isArray(files)) {
    return null;
  }
  const found = files.find((file) => {
    if (!file || typeof file.path !== "string") {
      return false;
    }
    const normalized = file.path.replace(/\\/g, "/");
    return /(^|\/)manifest\.json$/.test(normalized);
  });
  if (!found) {
    return null;
  }
  let parsed;
  try {
    parsed = JSON.parse(found.content);
  } catch {
    throw new Error("fromFiles: manifest.json 不是合法 JSON");
  }
  return parsed;
}

export function summarize(entry) {
  if (!isPlainObject(entry)) {
    return "（无效清单）";
  }
  const name = typeof entry.name === "string" && entry.name ? entry.name : entry.id || "未命名";
  const version = entry.version || "0.0.0";
  const domains = isPlainObject(entry.domains) ? entry.domains : {};
  const parts = Object.keys(domains)
    .sort()
    .map((key) => key + "@" + domains[key].schemaVersion);
  const domainText = parts.length > 0 ? parts.join(", ") : "无域";
  return name + " v" + version + " · 域 " + domainText;
}
