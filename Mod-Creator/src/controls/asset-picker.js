import { zhCN } from "../i18n/zh-CN.js";

function hasOwn(object, key) {
  return Object.prototype.hasOwnProperty.call(object, key);
}

function isBlob(value) {
  return (
    value !== null &&
    typeof value === "object" &&
    typeof value.arrayBuffer === "function" &&
    typeof value.type === "string"
  );
}

function toBytes(value) {
  if (value instanceof Uint8Array) {
    return value;
  }
  if (typeof ArrayBuffer !== "undefined" && value instanceof ArrayBuffer) {
    return new Uint8Array(value);
  }
  if (typeof ArrayBuffer !== "undefined" && ArrayBuffer.isView(value)) {
    return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  }
  return null;
}

function baseFromFileName(name) {
  if (typeof name !== "string") {
    return "";
  }
  const slash = Math.max(name.lastIndexOf("/"), name.lastIndexOf("\\"));
  const file = slash >= 0 ? name.slice(slash + 1) : name;
  const dot = file.lastIndexOf(".");
  return dot > 0 ? file.slice(0, dot) : file;
}

function sanitizeBasename(raw) {
  return String(raw)
    .trim()
    .replace(/[^A-Za-z0-9_-]+/g, "_")
    .replace(/^[^A-Za-z0-9]+/, "");
}

function resolveDeps(descriptor, context) {
  if (descriptor && descriptor.deps) {
    return descriptor.deps;
  }
  if (context && context.deps) {
    return context.deps;
  }
  return null;
}

function assetToPreview(asset) {
  if (asset === null || asset === undefined) {
    return null;
  }
  let candidate = asset;
  if (
    typeof asset === "object" &&
    !Array.isArray(asset) &&
    (hasOwn(asset, "release") || hasOwn(asset, "runtime"))
  ) {
    candidate = hasOwn(asset, "release") ? asset.release : asset.runtime;
  }
  if (candidate === null || candidate === undefined) {
    return null;
  }
  if (typeof candidate === "string") {
    if (candidate.indexOf("data:") === 0) {
      return { url: candidate, revoke: false };
    }
    return null;
  }
  if (isBlob(candidate)) {
    return { url: URL.createObjectURL(candidate), revoke: true };
  }
  const bytes = toBytes(candidate);
  if (bytes) {
    return { url: URL.createObjectURL(new Blob([bytes])), revoke: true };
  }
  if (
    typeof candidate === "object" &&
    typeof candidate.data === "string" &&
    typeof candidate.mime === "string"
  ) {
    return { url: "data:" + candidate.mime + ";base64," + candidate.data, revoke: false };
  }
  return null;
}

export function createAssetPicker(descriptor, value, onChange, context) {
  const deps = resolveDeps(descriptor, context);
  const el = document.createElement("div");
  el.className = "pc-asset-picker";

  const nameInput = document.createElement("input");
  nameInput.type = "text";
  nameInput.className = "pc-asset-picker-name";
  nameInput.placeholder = zhCN.assetNamePlaceholder;
  nameInput.value = value == null ? "" : String(value);

  const chooseBtn = document.createElement("button");
  chooseBtn.type = "button";
  chooseBtn.className = "pc-asset-picker-choose";
  chooseBtn.textContent = zhCN.chooseImage;

  const fileInput = document.createElement("input");
  fileInput.type = "file";
  fileInput.accept = "image/png,image/webp";
  fileInput.className = "pc-asset-picker-file";
  fileInput.style.display = "none";

  const preview = document.createElement("div");
  preview.className = "pc-asset-preview";

  const status = document.createElement("div");
  status.className = "pc-asset-picker-status";

  const row = document.createElement("div");
  row.className = "pc-asset-picker-row";
  row.appendChild(nameInput);
  row.appendChild(chooseBtn);
  row.appendChild(fileInput);

  el.appendChild(row);
  el.appendChild(preview);
  el.appendChild(status);

  let previewUrl = null;
  let previewRevoke = false;

  function clearPreview() {
    if (previewUrl && previewRevoke && typeof URL.revokeObjectURL === "function") {
      URL.revokeObjectURL(previewUrl);
    }
    previewUrl = null;
    previewRevoke = false;
  }

  function renderPreview(asset) {
    clearPreview();
    preview.textContent = "";
    const result = assetToPreview(asset);
    if (!result) {
      preview.appendChild(document.createTextNode(zhCN.assetMissing));
      return;
    }
    previewUrl = result.url;
    previewRevoke = result.revoke;
    const img = document.createElement("img");
    img.className = "pc-asset-preview-img";
    img.alt = zhCN.assetPreview;
    img.src = result.url;
    preview.appendChild(img);
  }

  function readCurrentAsset(basename) {
    if (!deps || typeof deps.getAsset !== "function" || !basename) {
      return null;
    }
    return deps.getAsset(basename);
  }

  nameInput.addEventListener("change", () => {
    const next = nameInput.value.trim();
    onChange(next === "" ? null : next);
    renderPreview(readCurrentAsset(next));
  });

  chooseBtn.addEventListener("click", () => {
    fileInput.click();
  });

  fileInput.addEventListener("change", () => {
    const file = fileInput.files && fileInput.files[0] ? fileInput.files[0] : null;
    fileInput.value = "";
    if (!file) {
      return;
    }
    let basename = nameInput.value.trim();
    if (basename === "") {
      basename = sanitizeBasename(baseFromFileName(file.name));
    }
    if (basename === "") {
      status.textContent = zhCN.assetFileError;
      return;
    }
    nameInput.value = basename;
    onChange(basename);
    if (!deps || typeof deps.setAsset !== "function") {
      status.textContent = zhCN.assetNoDeps;
      renderPreview(file);
      return;
    }
    deps.setAsset(basename, { release: file, runtime: file });
    status.textContent = zhCN.assetStored + "：" + basename;
    renderPreview(file);
  });

  renderPreview(readCurrentAsset(nameInput.value.trim()));
  return el;
}
