import * as enums from "../generated/enums.js";
import * as catalogs from "../generated/catalogs.js";
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

function asList(value) {
  if (value === null || value === undefined) {
    return [];
  }
  return Array.isArray(value) ? value : [value];
}

function normalizeOption(item, valueKey, labelKey) {
  if (item && typeof item === "object") {
    const key = valueKey || "value";
    const value = item[key] != null ? item[key] : item.value;
    let label;
    if (labelKey && item[labelKey] != null) {
      label = item[labelKey];
    } else if (item.label != null) {
      label = item.label;
    } else if (item.displayName != null) {
      label = item.displayName;
    } else if (item.name != null) {
      label = item.name;
    } else {
      label = value;
    }
    return { value, label: label != null ? String(label) : String(value) };
  }
  return { value: item, label: String(item) };
}

function normalizeList(list, valueKey, labelKey) {
  return asList(list).map((item) => normalizeOption(item, valueKey, labelKey));
}

function flattenNodes(list, valueKey) {
  if (!Array.isArray(list) || list.length === 0) {
    return list;
  }
  const first = list[0];
  const key = valueKey || "value";
  if (first && typeof first === "object" && Array.isArray(first.nodes) && first[key] === undefined) {
    const out = [];
    for (const item of list) {
      for (const node of asList(item.nodes)) {
        out.push(node);
      }
    }
    return out;
  }
  return list;
}

function flattenAll(object) {
  const out = [];
  for (const key of Object.keys(object)) {
    for (const item of asList(object[key])) {
      out.push(item);
    }
  }
  return out;
}

function catalogByName(name) {
  if (typeof name !== "string") {
    return null;
  }
  const value = catalogs[name];
  return Array.isArray(value) ? value : null;
}

export function resolveLinkedOptions(descriptor, context) {
  if (!descriptor) {
    return null;
  }
  const getValue = (path) => {
    if (path === null || path === undefined || path === "") {
      return undefined;
    }
    if (descriptor.getFieldValue && typeof descriptor.getFieldValue === "function") {
      return descriptor.getFieldValue(path);
    }
    if (context && typeof context.getValue === "function") {
      return context.getValue(path);
    }
    return undefined;
  };
  const src = descriptor.optionsSource;
  if (src && typeof src === "object") {
    const depPath = src.field || src.mapIdPath || src.dependsOn;
    const depValue = getValue(depPath);
    const valueKey = src.value || src.valueField || "value";
    const labelKey = src.label || src.labelField || null;
    if (Array.isArray(src.options)) {
      return normalizeList(src.options, valueKey, labelKey);
    }
    if (Array.isArray(src.values)) {
      return normalizeList(src.values, valueKey, labelKey);
    }
    const flatCatalog = catalogByName(src.source) || catalogByName(src.catalog);
    if (flatCatalog) {
      let list = flatCatalog;
      const groupBy = src.groupBy || (depPath ? String(depPath).split(".").pop() : null);
      if (groupBy && depValue != null) {
        list = flatCatalog.filter((item) => item && item[groupBy] === depValue);
      }
      return normalizeList(flattenNodes(list, valueKey), valueKey, labelKey);
    }
    const objectCatalog =
      src.catalog && typeof src.catalog === "object" && !Array.isArray(src.catalog)
        ? src.catalog
        : src.optionsMap && typeof src.optionsMap === "object"
          ? src.optionsMap
          : src.map && typeof src.map === "object"
            ? src.map
            : null;
    if (objectCatalog) {
      const bucket = depValue == null ? flattenAll(objectCatalog) : asList(objectCatalog[depValue]);
      return normalizeList(flattenNodes(bucket, valueKey), valueKey, labelKey);
    }
    return [];
  }
  if (descriptor.optionsMap && typeof descriptor.optionsMap === "object") {
    const depPath =
      descriptor.optionsBy ||
      (descriptor.path ? descriptor.path.replace(/\.[^.]+$/, ".mapId") : null);
    const depValue = getValue(depPath);
    return depValue == null ? [] : normalizeList(asList(descriptor.optionsMap[depValue]));
  }
  return null;
}

export function optionsFor(descriptor, context) {
  const linked = resolveLinkedOptions(descriptor, context);
  if (Array.isArray(linked)) {
    return linked;
  }
  return resolveOptions(descriptor.options, descriptor.optionsGroup);
}

export function createSelect(descriptor, value, onChange, context) {
  const el = document.createElement("select");
  el.className = "pc-select";
  const list = optionsFor(descriptor, context);
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
