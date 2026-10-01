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
        warnings.push(warning("import.manifest.invalid", entry.path, "manifest.json 不是合法 JSON，已忽略"));
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
    warnings.push(warning("import.manifest.missing", "manifest.json", "包内未找到 manifest.json"));
  } else if (isPlainObject(manifest)) {
    const issues = domainModules.manifest.validateEntry(manifest);
    for (const issue of issues) {
      warnings.push(warning("import." + issue.code, issue.path || "manifest", issue.messageZh));
    }
  } else if (manifest !== null) {
    warnings.push(warning("import.manifest.type", "manifest.json", "manifest.json 顶层必须是对象"));
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

  return { manifest, content, warnings };
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
  if (!CONTENT_DOMAINS.includes(domain)) {
    throw new Error("importDomainJson: 未知的域 " + domain);
  }
  const text = typeof file === "string" ? file : toText(await fileToBytes(file));
  const parsed = JSON.parse(text);
  return Array.isArray(parsed) ? parsed[0] : parsed;
}
