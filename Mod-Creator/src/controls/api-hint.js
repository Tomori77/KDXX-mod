import { zhCN } from "../i18n/zh-CN.js";

export function createApiHint({ path, schema }) {
  const el = document.createElement("span");
  el.className = "pc-hint";
  const text = zhCN.apiHint + "：" + path + (schema ? " · " + schema : "");
  el.textContent = text;
  el.title = text;
  return el;
}

export function attachApiHint(el, hint) {
  if (el && hint) {
    el.appendChild(hint);
  }
  return el;
}
