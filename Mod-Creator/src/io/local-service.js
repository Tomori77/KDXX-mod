const SERVICE_BASE_KEY = "mc_service_base";
const DEFAULT_CAPABILITY = "folder";

let pingCache = null;

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

function serviceError(code, messageZh) {
  const err = new Error(messageZh);
  err.code = code;
  err.messageZh = messageZh;
  return err;
}

export function resolveBase() {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    if (typeof localStorage !== "undefined") {
      const override = localStorage.getItem(SERVICE_BASE_KEY);
      if (override) {
        return override.replace(/\/+$/, "");
      }
    }
  } catch (err) {
    void err;
  }
  const location = window.location;
  if (!location || typeof location.origin !== "string") {
    return null;
  }
  if (location.protocol !== "http:" && location.protocol !== "https:") {
    return null;
  }
  return location.origin;
}

function buildUrl(path, query) {
  const base = resolveBase();
  if (!base) {
    throw serviceError("service.unreachable", "本地服务不可用：请通过「启动.bat」或本地服务打开本页面。");
  }
  let url = base + "/api" + path;
  if (query && typeof query === "object") {
    const params = new URLSearchParams();
    for (const key of Object.keys(query)) {
      const value = query[key];
      if (value === undefined || value === null) {
        continue;
      }
      params.append(key, String(value));
    }
    const qs = params.toString();
    if (qs) {
      url += "?" + qs;
    }
  }
  return url;
}

export async function api(path, options) {
  const opts = options && typeof options === "object" ? options : {};
  const method = (opts.method || "GET").toUpperCase();
  const url = buildUrl(path, opts.query);
  const init = { method, headers: {} };
  if (opts.body !== undefined && method !== "GET" && method !== "HEAD") {
    init.headers["Content-Type"] = "application/json";
    init.body = JSON.stringify(opts.body);
  }

  let response;
  try {
    response = await fetch(url, init);
  } catch (err) {
    throw serviceError("service.unreachable", "无法连接本地服务：请确认服务已启动且页面由它提供。");
  }

  let text;
  try {
    text = await response.text();
  } catch (err) {
    throw serviceError("service.badResponse", "本地服务响应读取失败。");
  }

  let envelope = null;
  if (text) {
    try {
      envelope = JSON.parse(text);
    } catch (err) {
      envelope = null;
    }
  }

  if (!envelope || typeof envelope !== "object") {
    throw serviceError("service.badResponse", "本地服务返回了无法解析的响应（HTTP " + response.status + "）。");
  }

  if (envelope.ok === false) {
    const error = envelope.error && typeof envelope.error === "object" ? envelope.error : {};
    const code = typeof error.code === "string" ? error.code : "service.failed";
    const messageZh = typeof error.messageZh === "string" && error.messageZh ? error.messageZh : "本地服务请求失败。";
    throw serviceError(code, messageZh);
  }

  return envelope.data;
}

export async function ping() {
  if (pingCache) {
    return pingCache;
  }
  try {
    const data = await api("/ping");
    pingCache = { ok: true, data };
    return pingCache;
  } catch (err) {
    return {
      ok: false,
      error: {
        code: err && err.code ? err.code : "service.unreachable",
        messageZh: err && err.messageZh ? err.messageZh : "本地服务不可用。"
      }
    };
  }
}

export async function isAvailable(required) {
  const result = await ping();
  if (!result.ok) {
    return false;
  }
  const caps = result.data && Array.isArray(result.data.capabilities) ? result.data.capabilities : [];
  const needed = required === undefined ? DEFAULT_CAPABILITY : required;
  const list = Array.isArray(needed) ? needed : [needed];
  return list.every((cap) => caps.includes(cap));
}

export function getRoots() {
  return api("/fs/roots");
}

export function browse(path) {
  return api("/fs/browse", { query: { path } });
}

export function mkdir(path) {
  return api("/fs/mkdir", { method: "POST", body: { path } });
}

export function deletePath(path) {
  return api("/fs/delete", { method: "POST", body: { path } });
}

export function reveal(path) {
  return api("/fs/reveal", { method: "POST", body: { path } });
}

export function listProjects() {
  return api("/projects");
}

export function importFolder(source, options) {
  const opts = options && typeof options === "object" ? options : {};
  return api("/projects/import", { method: "POST", body: { source, name: opts.name, overwrite: opts.overwrite } });
}

export function readProject(name) {
  return api("/projects/read", { query: { name } });
}

export function saveProject(name, files, options) {
  const opts = options && typeof options === "object" ? options : {};
  return api("/projects/save", { method: "POST", body: { name, files, deleteStale: opts.deleteStale } });
}

export function deleteProject(name) {
  return api("/projects/delete", { method: "POST", body: { name } });
}

export function mergeReport(name) {
  return api("/projects/merge-report", { method: "POST", body: { name } });
}

export function renameProject(name, newName) {
  return api("/projects/rename", { method: "POST", body: { name, newName } });
}

export function steamStatus(user) {
  const body = {};
  if (user !== undefined && user !== null) {
    body.user = user;
  }
  return api("/steam/status", { method: "POST", body });
}

export function steamLogin(user) {
  return api("/steam/login", { method: "POST", body: { user } });
}

export function steamPublish(payload) {
  return api("/steam/publish", { method: "POST", body: payload });
}

export function fromBytes(value) {
  const bytes = bytesOf(value);
  if (!bytes) {
    throw serviceError("service.invalidBytes", "无法将非二进制数据转换为 base64。");
  }
  return { base64: bytesToBase64(bytes) };
}

export function toFileEntries(files) {
  const list = Array.isArray(files) ? files : [];
  return list.map((file) => {
    const entry = file && typeof file === "object" ? file : {};
    const content = entry.content;
    if (content && typeof content === "object" && typeof content.base64 === "string") {
      return { path: entry.path, content: base64ToBytes(content.base64) };
    }
    const bytes = bytesOf(content);
    if (bytes) {
      return { path: entry.path, content: bytes };
    }
    return { path: entry.path, content };
  });
}

export function toServiceFiles(files) {
  const list = Array.isArray(files) ? files : [];
  return list.map((file) => {
    const entry = file && typeof file === "object" ? file : {};
    const content = entry.content;
    const bytes = bytesOf(content);
    if (bytes) {
      return { path: entry.path, content: fromBytes(bytes) };
    }
    return { path: entry.path, content };
  });
}
