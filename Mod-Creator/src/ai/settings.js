export const DEFAULT_SETTINGS = {
  baseUrl: "",
  apiKey: "",
  model: "",
  temperature: 0.7,
  maxTokens: 2048
};

const STORAGE_KEY = "pc_ai_settings";

function hasStorage() {
  return typeof localStorage !== "undefined" && localStorage !== null;
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function getSettings() {
  if (!hasStorage()) {
    return { ...DEFAULT_SETTINGS };
  }
  let raw;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
  if (!raw) {
    return { ...DEFAULT_SETTINGS };
  }
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
  if (!isPlainObject(parsed)) {
    return { ...DEFAULT_SETTINGS };
  }
  return { ...DEFAULT_SETTINGS, ...parsed };
}

export function setSettings(patch) {
  const merged = { ...getSettings(), ...(isPlainObject(patch) ? patch : {}) };
  if (hasStorage()) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
    } catch {
      void 0;
    }
  }
  return merged;
}

export function isConfigured(settings) {
  const value = isPlainObject(settings) ? settings : getSettings();
  const baseUrl = typeof value.baseUrl === "string" ? value.baseUrl.trim() : "";
  const model = typeof value.model === "string" ? value.model.trim() : "";
  return baseUrl !== "" && model !== "";
}

export function clearSettings() {
  if (hasStorage()) {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      void 0;
    }
  }
  return { ...DEFAULT_SETTINGS };
}
