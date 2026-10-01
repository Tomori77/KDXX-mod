import { zhCN } from "../i18n/zh-CN.js";
import { createApiHint } from "./api-hint.js";

const UI = zhCN.starOverrides;
const SCHEMA = "items@3 · item-effects.schema.json#/$defs/T625";
const STAR_KEYS = ["1", "2", "3"];

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function createStarOverridesEditor(descriptor, value, onChange) {
  const root = document.createElement("div");
  root.className = "pc-star-editor";
  const basePath =
    descriptor && descriptor.path ? String(descriptor.path) : "item.effectList[].starOverrides";
  const path = basePath.endsWith("[]") ? basePath.slice(0, -2) : basePath;
  const schema = descriptor && descriptor.schema ? String(descriptor.schema) : SCHEMA;
  const state = isPlainObject(value) ? clone(value) : {};
  const extras = {};
  for (const key of Object.keys(state)) {
    if (!STAR_KEYS.includes(key)) {
      extras[key] = state[key];
    }
  }
  const rows = new Map();

  function noteEl(text, kind) {
    const el = document.createElement("div");
    el.className = "pc-note" + (kind ? " pc-note-" + kind : "");
    el.textContent = text;
    return el;
  }

  function emit() {
    const out = clone(extras);
    let any = false;
    for (const key of STAR_KEYS) {
      const row = rows.get(key);
      if (!row || !row.enabled()) {
        continue;
      }
      const parsed = row.parse();
      if (parsed === null) {
        return;
      }
      out[key] = parsed;
      any = true;
    }
    onChange(any ? out : null);
  }

  function buildRow(key) {
    const wrap = document.createElement("div");
    wrap.className = "pc-star-row";
    const head = document.createElement("label");
    head.className = "pc-star-enable";
    const toggle = document.createElement("input");
    toggle.type = "checkbox";
    toggle.className = "pc-toggle";
    toggle.checked = Object.prototype.hasOwnProperty.call(state, key);
    const text = document.createElement("span");
    text.textContent = UI.starLabel + " " + key;
    head.appendChild(toggle);
    head.appendChild(text);
    wrap.appendChild(head);

    const body = document.createElement("div");
    body.className = "pc-star-body";
    const ta = document.createElement("textarea");
    ta.className = "pc-json pc-star-json";
    ta.rows = descriptor && descriptor.rows != null ? Number(descriptor.rows) : 5;
    ta.disabled = !toggle.checked;
    ta.value =
      Object.prototype.hasOwnProperty.call(state, key) ? JSON.stringify(state[key], null, 2) : "{}";
    ta.addEventListener("input", () => {
      const ok = parseText(ta.value) !== null;
      ta.classList.toggle("invalid", !ok);
      if (ok) {
        emit();
      }
    });
    body.appendChild(ta);
    body.appendChild(createApiHint({ path: path + "." + key, schema }));
    wrap.appendChild(body);

    function enabled() {
      return toggle.checked;
    }

    function parse() {
      return parseText(ta.value);
    }

    toggle.addEventListener("change", () => {
      ta.disabled = !toggle.checked;
      if (toggle.checked) {
        if (parse() !== null) {
          ta.classList.remove("invalid");
        }
      }
      emit();
    });

    rows.set(key, { enabled, parse, element: wrap });
    return wrap;
  }

  function parseText(text) {
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      return null;
    }
    return isPlainObject(parsed) ? parsed : null;
  }

  const head = document.createElement("div");
  head.className = "pc-star-head";
  head.appendChild(createApiHint({ path: path, schema }));
  root.appendChild(head);
  root.appendChild(noteEl(UI.hint, "warn"));
  root.appendChild(noteEl(UI.arrayHint, ""));
  for (const key of STAR_KEYS) {
    root.appendChild(buildRow(key));
  }
  return root;
}
