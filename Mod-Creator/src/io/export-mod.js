import { domainModules } from "../domains/index.js";
import { writeZip } from "./zip.js";

const MAX_JSON_BYTES = 1024 * 1024;
const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
const MAX_FILES = 2048;
const MAX_TOTAL_BYTES = 256 * 1024 * 1024;

const textEncoder = new TextEncoder();

const MIME_EXT = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/bmp": "bmp",
  "image/svg+xml": "svg",
  "image/x-icon": "ico"
};

const IMAGE_PATH_RE = /\.(png|jpe?g|webp|gif|bmp|svg|ico)$/i;

function error(code, path, messageZh) {
  return { code, path, messageZh, severity: "error" };
}

function warning(code, path, messageZh) {
  return { code, path, messageZh, severity: "warning" };
}

function isBlob(value) {
  return (
    value !== null &&
    typeof value === "object" &&
    typeof value.arrayBuffer === "function" &&
    typeof value.type === "string"
  );
}

function bytesOf(value) {
  if (value instanceof Uint8Array) {
    return value;
  }
  if (value instanceof ArrayBuffer) {
    return new Uint8Array(value);
  }
  if (ArrayBuffer.isView(value)) {
    return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  }
  return null;
}

function base64ToBytes(text) {
  if (typeof Buffer !== "undefined") {
    const buf = Buffer.from(text, "base64");
    return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
  }
  const binary = atob(text);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    out[i] = binary.charCodeAt(i) & 0xff;
  }
  return out;
}

function parseDataUrl(text) {
  const match = /^data:([^;,]*)(;base64)?,(.*)$/s.exec(text);
  if (!match) {
    return null;
  }
  const mime = match[1] || "image/png";
  if (match[2]) {
    return { mime, bytes: base64ToBytes(match[3] || "") };
  }
  const binary = decodeURIComponent(match[3] || "");
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i) & 0xff;
  }
  return { mime, bytes };
}

async function normalizeAssetValue(value) {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === "string") {
    return parseDataUrl(value);
  }
  if (isBlob(value)) {
    const buffer = await value.arrayBuffer();
    return { mime: value.type || "image/png", bytes: new Uint8Array(buffer) };
  }
  const direct = bytesOf(value);
  if (direct) {
    return { mime: "image/png", bytes: direct };
  }
  if (typeof value === "object") {
    if (typeof value.data === "string" && typeof value.mime === "string") {
      return { mime: value.mime, bytes: base64ToBytes(value.data) };
    }
    const inner = bytesOf(value.data);
    if (inner) {
      return { mime: typeof value.mime === "string" ? value.mime : "image/png", bytes: inner };
    }
  }
  return null;
}

function extForMime(mime) {
  return MIME_EXT[String(mime || "").toLowerCase()] || "png";
}

function collectIconBasenames(value, out) {
  if (Array.isArray(value)) {
    for (const item of value) {
      collectIconBasenames(item, out);
    }
    return;
  }
  if (value !== null && typeof value === "object") {
    for (const key of Object.keys(value)) {
      if (key === "iconBasename" && typeof value[key] === "string" && value[key]) {
        out.add(value[key]);
      } else {
        collectIconBasenames(value[key], out);
      }
    }
  }
}

function byteLengthOf(content) {
  if (typeof content === "string") {
    return textEncoder.encode(content).length;
  }
  const bytes = bytesOf(content);
  return bytes ? bytes.byteLength : 0;
}

async function buildIconFiles(basename, asset) {
  const files = [];
  const warnings = [];
  let release = asset;
  let runtime = null;
  if (
    asset !== null &&
    typeof asset === "object" &&
    !Array.isArray(asset) &&
    (Object.prototype.hasOwnProperty.call(asset, "release") ||
      Object.prototype.hasOwnProperty.call(asset, "runtime"))
  ) {
    release = asset.release;
    runtime = asset.runtime;
  }
  const releaseValue = await normalizeAssetValue(release);
  if (releaseValue) {
    files.push({
      path: "icons/release/" + basename + "." + extForMime(releaseValue.mime),
      content: releaseValue.bytes
    });
  } else if (release !== null && release !== undefined) {
    warnings.push(
      warning("icon.unreadable", "assets.icons." + basename + ".release", "图标资源无法解析，已跳过：" + basename)
    );
  }
  const runtimeValue = await normalizeAssetValue(runtime);
  if (runtimeValue) {
    files.push({
      path: "icons/runtime/" + basename + "." + extForMime(runtimeValue.mime),
      content: runtimeValue.bytes
    });
  }
  return { files, warnings };
}

export async function buildPackage(project) {
  const errors = [];
  const warnings = [];
  const manifest = project && project.meta ? project.meta.manifest : null;
  if (manifest === null || manifest === undefined || typeof manifest !== "object") {
    errors.push(error("manifest.missing", "meta.manifest", "缺少 manifest，无法导出"));
    return { files: [], errors, warnings };
  }

  const manifestModule = domainModules.manifest;
  const issues = [...manifestModule.validateEntry(manifest), ...manifestModule.validateDomains(manifest)];
  for (const issue of issues) {
    if (issue.severity === "error") {
      errors.push(issue);
    } else {
      warnings.push(issue);
    }
  }

  const modId = typeof manifest.id === "string" ? manifest.id : "";
  if (modId === "") {
    errors.push(error("manifest.id.missing", "id", "导出需要有效的 manifest.id 作为目录名，请先填写 ID"));
  }
  if (errors.length > 0) {
    return { files: [], errors, warnings };
  }

  const root = modId + "/";
  const files = [];

  const manifestFiles = manifestModule.toFiles(manifest, { modId });
  for (const file of manifestFiles) {
    files.push({ path: root + file.path, content: file.content });
  }

  const content = project.content && typeof project.content === "object" ? project.content : {};
  const declared =
    manifest.domains && typeof manifest.domains === "object" ? Object.keys(manifest.domains) : [];

  for (const domain of declared) {
    if (domain === "manifest") {
      continue;
    }
    const module = domainModules[domain];
    const entries = Array.isArray(content[domain]) ? content[domain] : [];
    if (!module || typeof module.toFiles !== "function") {
      if (entries.length > 0) {
        errors.push(
          error(
            "domain.unsupported",
            "content." + domain,
            "域 " + domain + " 尚未实现，其 " + entries.length + " 项内容不会导出"
          )
        );
      }
      continue;
    }
    const generated = module.toFiles(entries, { modId });
    for (const file of generated) {
      files.push({ path: root + file.path, content: file.content });
    }
  }

  const icons =
    content.assets && typeof content.assets === "object" && content.assets.icons
      ? content.assets.icons
      : {};
  for (const basename of Object.keys(icons)) {
    const result = await buildIconFiles(basename, icons[basename]);
    for (const item of result.warnings) {
      warnings.push(item);
    }
    for (const file of result.files) {
      files.push({ path: root + file.path, content: file.content });
    }
  }

  const referenced = new Set();
  for (const key of Object.keys(content)) {
    if (key === "assets" || key === "unknown") {
      continue;
    }
    if (Array.isArray(content[key])) {
      collectIconBasenames(content[key], referenced);
    }
  }
  for (const basename of referenced) {
    if (!Object.prototype.hasOwnProperty.call(icons, basename)) {
      warnings.push(
        warning("icon.missing", "assets.icons." + basename, "图标 " + basename + " 未提供资源，游戏内会缺图")
      );
    }
  }

  let total = 0;
  for (const file of files) {
    const size = byteLengthOf(file.content);
    total += size;
    if (file.path.toLowerCase().endsWith(".json") && size > MAX_JSON_BYTES) {
      errors.push(error("file.jsonTooLarge", file.path, "JSON 文件超过 1 MiB：" + file.path));
    } else if (IMAGE_PATH_RE.test(file.path) && size > MAX_IMAGE_BYTES) {
      errors.push(error("file.imageTooLarge", file.path, "图片超过 2 MiB：" + file.path));
    }
  }
  if (files.length > MAX_FILES) {
    errors.push(error("package.tooManyFiles", "", "文件数超过 " + MAX_FILES + "：" + files.length));
  }
  if (total > MAX_TOTAL_BYTES) {
    errors.push(error("package.tooLarge", "", "包总体积超过 256 MiB"));
  }

  return { files, errors, warnings };
}

export async function exportToZip(project) {
  const result = await buildPackage(project);
  if (result.errors.length > 0) {
    const failure = new Error("导出校验未通过：" + result.errors[0].messageZh);
    failure.errors = result.errors;
    failure.warnings = result.warnings;
    throw failure;
  }
  return writeZip(result.files);
}

export async function downloadPackage(project, filename) {
  if (typeof document === "undefined") {
    throw new Error("downloadPackage 仅在浏览器环境可用：当前不存在 document");
  }
  const bytes = await exportToZip(project);
  const modId =
    project && project.meta && project.meta.manifest && project.meta.manifest.id
      ? project.meta.manifest.id
      : "mod";
  const name = filename || modId + ".zip";
  const blob = new Blob([bytes], { type: "application/zip" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
