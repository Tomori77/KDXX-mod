import * as enums from "../generated/enums.js";
import { zhCN } from "../i18n/zh-CN.js";

export function resolveOptions(options, labelGroup) {
  if (!options) {
    return [];
  }
  if (typeof options === "string") {
    const values = enums[options];
    if (!Array.isArray(values)) {
      return [];
    }
    return values.map((value) => ({ value, label: labelFor(value, labelGroup || options) }));
  }
  return options.map((item) => {
    if (item && typeof item === "object") {
      return { value: item.value, label: item.label != null ? item.label : String(item.value) };
    }
    return { value: item, label: labelFor(item, labelGroup) };
  });
}

function labelFor(value, group) {
  const table = zhCN.enumLabels && zhCN.enumLabels[group];
  const zh = table && table[value];
  if (zh) {
    return zh + "（`" + value + "`）";
  }
  return String(value);
}

export function createSelect(descriptor, value, onChange) {
  const el = document.createElement("select");
  el.className = "pc-select";
  const list = resolveOptions(descriptor.options, descriptor.optionsGroup);
  if (!descriptor.required) {
    const empty = document.createElement("option");
    empty.value = "";
    empty.textContent = zhCN.none;
    el.appendChild(empty);
  }
  for (const opt of list) {
    const node = document.createElement("option");
    node.value = String(opt.value);
    node.textContent = opt.label;
    el.appendChild(node);
  }
  el.value = value == null ? "" : String(value);
  el.addEventListener("change", () => {
    onChange(el.value === "" ? null : el.value);
  });
  return el;
}
