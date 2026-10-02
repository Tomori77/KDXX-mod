import { domainModules } from "../domains/index.js";
import { readZip } from "./zip.js";

const CONTENT_DOMAINS = [
  "items",
  "buffs",
  "enemies",
  "encounters",
  "encounter-placements",
  "maps",
  "bazaars",
  "adventures",
  "scripts"
];

export const MOD_PACKAGE_FORMAT = "mod-package";
export const DOMAIN_JSON_FORMAT = "domain-json";
export const FORMAT_VERSION = 1;

const textDecoder = new TextDecoder("utf-8");
const textEncoder = new TextEncoder();

const MIME_BY_EXT = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
  bmp: "image/bmp",
  svg: "image/svg+xml",
  ico: "image/x-icon"
};

function warning(code, path, messageZh) {
  return { code, path, messageZh, severity: "warning" };
}

function error(code, path, messageZh) {
  return { code, path, messageZh, severity: "error" };
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function normalizePath(path) {
  return String(path).replace(/\\/g, "/").replace(/^\/+/, "");
}

function toBytes(content) {
  if (typeof content === "string") {
    return textEncoder.encode(content);
  }
  if (content instanceof Uint8Array) {
    return content;
  }
  if (content instanceof ArrayBuffer) {
    return new Uint8Array(content);
  }
  if (ArrayBuffer.isView(content)) {
    return new Uint8Array(content.buffer, content.byteOffset, content.byteLength);
  }
  return new Uint8Array(0);
}

function toText(content) {
  if (typeof content === "string") {
    return content;
  }
  return textDecoder.decode(toBytes(content));
}

function base64Encode(bytes) {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength).toString("base64");
  }
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function normalizeFileMap(fileMap) {
  const entries = [];
  if (fileMap instanceof Map) {
    for (const [path, content] of fileMap) {
      entries.push({ path: normalizePath(path), content });
    }
    return entries;
  }
  if (Array.isArray(fileMap)) {
    for (const item of fileMap) {
      if (!isPlainObject(item) || typeof item.path !== "string") {
        continue;
      }
      entries.push({ path: normalizePath(item.path), content: item.content });
    }
    return entries;
  }
  throw new Error("importFiles: fileMap 必须是 Map 或 [{path, content}]");
}

function findPrefix(entries) {
  if (entries.some((entry) => entry.path === "manifest.json")) {
    return "";
  }
  const candidates = entries
    .filter((entry) => /(^|\/)manifest\.json$/i.test(entry.path))
    .sort((a, b) => a.path.split("/").length - b.path.split("/").length);
  if (candidates.length === 0) {
    return "";
  }
  const parts = candidates[0].path.split("/");
  return parts.slice(0, -1).join("/");
}

function mimeForExt(ext) {
  return MIME_BY_EXT[String(ext).toLowerCase()] || "application/octet-stream";
}

function baseNameOf(path) {
  const parts = path.split("/");
  const file = parts[parts.length - 1];
  const dot = file.lastIndexOf(".");
  if (dot <= 0) {
    return { basename: file, ext: "" };
  }
  return { basename: file.slice(0, dot), ext: file.slice(dot + 1) };
}

export function importFiles(fileMap) {
  const entries = normalizeFileMap(fileMap);
  const warnings = [];
  const errors = [];
  const prefix = findPrefix(entries);
  const prefixSlash = prefix ? prefix + "/" : "";

  let manifest = null;
  let manifestFound = false;
  const domainFiles = new Map();
  const unknown = [];
  const icons = {};

  for (const entry of entries) {
    let path = entry.path;
    if (prefix && path.startsWith(prefixSlash)) {
      path = path.slice(prefixSlash.length);
    }
    if (path === "manifest.json") {
      manifestFound = true;
      try {
        manifest = JSON.parse(toText(entry.content));
      } catch {
        errors.push(error("package.manifest.invalid", entry.path, "manifest.json 不是合法 JSON"));
        manifest = null;
      }
      continue;
    }

    const segments = path.split("/");
    const top = segments[0];
    if (segments.length === 1) {
      unknown.push({ path: entry.path, content: toBytes(entry.content) });
      warnings.push(warning("import.unknownFile", entry.path, "无法识别的文件，已保留在 content.unknown：" + entry.path));
      continue;
    }

    if (top === "icons") {
      const sub = segments[1];
      const { basename, ext } = baseNameOf(path);
      if (basename && (sub === "release" || sub === "runtime")) {
        const bytes = toBytes(entry.content);
        const record = { mime: mimeForExt(ext), data: base64Encode(bytes) };
        if (!icons[basename]) {
          icons[basename] = {};
        }
        icons[basename][sub] = record;
        continue;
      }
    }

    if (CONTENT_DOMAINS.includes(top)) {
      const module = domainModules[top];
      if (module && typeof module.fromFiles === "function") {
        if (!domainFiles.has(top)) {
          domainFiles.set(top, []);
        }
        domainFiles.get(top).push({ path, content: toText(entry.content) });
        continue;
      }
    }

    unknown.push({ path: entry.path, content: toBytes(entry.content) });
    warnings.push(
      warning("import.unknownFile", entry.path, "未识别目录/文件，已保留在 content.unknown：" + entry.path)
    );
  }

  if (!manifestFound) {
    errors.push(error("package.manifest.missing", "manifest.json", "包内未找到 manifest.json"));
  } else if (manifest !== null && isPlainObject(manifest)) {
    const issues = domainModules.manifest.validateEntry(manifest);
    for (const issue of issues) {
      const mapped = {
        code: "import." + issue.code,
        path: issue.path || "manifest",
        messageZh: issue.messageZh,
        severity: issue.severity === "error" ? "error" : "warning"
      };
      if (mapped.severity === "error") {
        errors.push(mapped);
      } else {
        warnings.push(mapped);
      }
    }
  } else if (manifest !== null) {
    errors.push(error("package.manifest.type", "manifest.json", "manifest.json 顶层必须是对象"));
  }

  const content = {
    assets: { icons },
    unknown
  };
  for (const domain of CONTENT_DOMAINS) {
    content[domain] = [];
  }

  for (const [domain, files] of domainFiles) {
    const module = domainModules[domain];
    let parsed;
    try {
      parsed = module.fromFiles(files, {});
    } catch (err) {
      warnings.push(
        warning("import.domain.failed", domain, "域 " + domain + " 解析失败：" + (err && err.message ? err.message : err))
      );
      parsed = [];
    }
    content[domain] = Array.isArray(parsed) ? parsed : parsed == null ? [] : [parsed];
  }

  return { format: MOD_PACKAGE_FORMAT, formatVersion: FORMAT_VERSION, manifest, content, warnings, errors };
}

async function fileToBytes(file) {
  if (file === null || file === undefined) {
    throw new Error("importArchive: 缺少输入文件");
  }
  if (typeof file === "string") {
    return textEncoder.encode(file);
  }
  if (file instanceof ArrayBuffer) {
    return new Uint8Array(file);
  }
  if (file instanceof Uint8Array) {
    return file;
  }
  if (ArrayBuffer.isView(file)) {
    return new Uint8Array(file.buffer, file.byteOffset, file.byteLength);
  }
  if (typeof file.arrayBuffer === "function") {
    const buffer = await file.arrayBuffer();
    return new Uint8Array(buffer);
  }
  throw new Error("importArchive: 不支持的输入类型，需要 File/Blob/ArrayBuffer/Uint8Array");
}

export async function importArchive(file) {
  const bytes = await fileToBytes(file);
  const files = await readZip(bytes);
  return importFiles(files);
}

export async function importDomainJson(file, domain) {
  const warnings = [];
  const errors = [];
  const result = {
    format: DOMAIN_JSON_FORMAT,
    formatVersion: FORMAT_VERSION,
    domain: domain,
    total: 0,
    entries: [],
    warnings,
    errors
  };

  if (!CONTENT_DOMAINS.includes(domain)) {
    errors.push(error("domain.unknown", "domain", "未知的域：" + String(domain)));
    return result;
  }

  const module = domainModules[domain];
  const text = typeof file === "string" ? file : toText(await fileToBytes(file));
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (err) {
    errors.push(error("domain.json.invalid", "", "JSON 解析失败：" + (err && err.message ? err.message : err)));
    return result;
  }

  let list;
  if (Array.isArray(parsed)) {
    list = parsed;
  } else if (isPlainObject(parsed)) {
    list = [parsed];
  } else {
    errors.push(error("domain.empty", "", "域 JSON 必须是条目对象或条目数组"));
    return result;
  }

  if (list.length === 0) {
    errors.push(error("domain.empty", "", "域 JSON 不含任何条目"));
    return result;
  }

  result.total = list.length;

  for (let i = 0; i < list.length; i++) {
    const entry = list[i];
    const path = list.length > 1 ? "[" + i + "]." + domain : domain;
    if (!isPlainObject(entry)) {
      errors.push(error("domain.empty", path, "条目必须是对象"));
      continue;
    }
    const issues = module && typeof module.validateEntry === "function" ? module.validateEntry(entry) : [];
    let hasError = false;
    for (const issue of issues) {
      const mapped = {
        code: issue.code,
        path: issue.path ? path + "." + issue.path : path,
        messageZh: issue.messageZh,
        severity: issue.severity === "error" ? "error" : "warning"
      };
      if (mapped.severity === "error") {
        errors.push(mapped);
        hasError = true;
      } else {
        warnings.push(mapped);
      }
    }
    if (!hasError) {
      result.entries.push(entry);
    }
  }

  return result;
}
