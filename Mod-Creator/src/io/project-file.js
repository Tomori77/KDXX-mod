const FORMAT = "modcreator-project";
const FORMAT_VERSION = 1;

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

function bytesToBase64(bytes) {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength).toString("base64");
  }
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
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
  const mime = match[1] || "application/octet-stream";
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

async function encodeAssetValue(value) {
  if (value === null || value === undefined) {
    return undefined;
  }
  if (typeof value === "string") {
    const parsed = parseDataUrl(value);
    if (parsed) {
      return { mime: parsed.mime, data: bytesToBase64(parsed.bytes) };
    }
    return { mime: "application/octet-stream", data: value };
  }
  if (isBlob(value)) {
    const buffer = await value.arrayBuffer();
    return { mime: value.type || "application/octet-stream", data: bytesToBase64(new Uint8Array(buffer)) };
  }
  const direct = bytesOf(value);
  if (direct) {
    return { mime: "application/octet-stream", data: bytesToBase64(direct) };
  }
  if (typeof value === "object") {
    const mime = typeof value.mime === "string" ? value.mime : "application/octet-stream";
    if (typeof value.data === "string") {
      return { mime, data: value.data };
    }
    const inner = bytesOf(value.data);
    if (inner) {
      return { mime, data: bytesToBase64(inner) };
    }
  }
  return undefined;
}

async function encodeIconAsset(asset) {
  if (asset === null || asset === undefined) {
    return asset;
  }
  if (typeof asset !== "object" || Array.isArray(asset)) {
    const encoded = await encodeAssetValue(asset);
    return encoded === undefined ? asset : { release: encoded };
  }
  const out = { ...asset };
  const release = await encodeAssetValue(asset.release);
  if (release !== undefined) {
    out.release = release;
  }
  const runtime = await encodeAssetValue(asset.runtime);
  if (runtime !== undefined) {
    out.runtime = runtime;
  }
  return out;
}

function toBlobOrBytes(bytes, mime) {
  if (typeof Blob === "function") {
    return new Blob([bytes], { type: mime || "application/octet-stream" });
  }
  return bytes;
}

function decodeAssetValue(record) {
  if (record === null || record === undefined) {
    return undefined;
  }
  if (typeof record === "string") {
    const parsed = parseDataUrl(record);
    return parsed ? toBlobOrBytes(parsed.bytes, parsed.mime) : record;
  }
  if (typeof record !== "object") {
    return record;
  }
  if (typeof record.data !== "string") {
    return record;
  }
  const bytes = base64ToBytes(record.data);
  return toBlobOrBytes(bytes, record.mime);
}

function decodeIconAsset(asset) {
  if (asset === null || asset === undefined) {
    return asset;
  }
  if (typeof asset !== "object" || Array.isArray(asset)) {
    return asset;
  }
  if (!Object.prototype.hasOwnProperty.call(asset, "release") && !Object.prototype.hasOwnProperty.call(asset, "runtime")) {
    const decoded = decodeAssetValue(asset);
    return decoded;
  }
  const out = { ...asset };
  if (Object.prototype.hasOwnProperty.call(asset, "release")) {
    out.release = decodeAssetValue(asset.release);
  }
  if (Object.prototype.hasOwnProperty.call(asset, "runtime")) {
    out.runtime = decodeAssetValue(asset.runtime);
  }
  return out;
}

export async function serializeProject(project) {
  const source = project && typeof project === "object" ? project : {};
  const content = source.content && typeof source.content === "object" ? source.content : {};
  const assets = content.assets && typeof content.assets === "object" ? content.assets : { icons: {} };
  const icons = assets.icons && typeof assets.icons === "object" ? assets.icons : {};

  const encodedIcons = {};
  for (const basename of Object.keys(icons)) {
    encodedIcons[basename] = await encodeIconAsset(icons[basename]);
  }

  const payload = {
    ...source,
    meta: source.meta && typeof source.meta === "object" ? { ...source.meta } : source.meta,
    content: {
      ...content,
      assets: { ...assets, icons: encodedIcons }
    }
  };
  delete payload.history;

  return JSON.stringify({ format: FORMAT, version: FORMAT_VERSION, project: payload }, null, 2);
}

export async function deserializeProject(text) {
  if (typeof text !== "string") {
    throw new Error("deserializeProject: 需要 JSON 字符串");
  }
  const parsed = JSON.parse(text);
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("deserializeProject: 工程 JSON 顶层必须是对象");
  }
  let project = parsed;
  if (parsed.format === FORMAT && parsed.project && typeof parsed.project === "object") {
    project = parsed.project;
  }

  const content = project.content && typeof project.content === "object" ? project.content : {};
  const assets = content.assets && typeof content.assets === "object" ? content.assets : { icons: {} };
  const icons = assets.icons && typeof assets.icons === "object" ? assets.icons : {};

  const decodedIcons = {};
  for (const basename of Object.keys(icons)) {
    decodedIcons[basename] = decodeIconAsset(icons[basename]);
  }

  return {
    ...project,
    content: {
      ...content,
      assets: { ...assets, icons: decodedIcons }
    }
  };
}

export function projectFileName(project) {
  const manifest =
    project && project.meta && typeof project.meta === "object" ? project.meta.manifest : null;
  const rawId = manifest && typeof manifest.id === "string" && manifest.id ? manifest.id : "project";
  const rawVersion =
    manifest && typeof manifest.version === "string" && manifest.version ? manifest.version : "0.0.0";
  const safeId = rawId.replace(/[\\/:*?"<>|\s]+/g, "-");
  const safeVersion = rawVersion.replace(/[\\/:*?"<>|\s]+/g, "-");
  return safeId + "." + safeVersion + ".modcreator.json";
}
