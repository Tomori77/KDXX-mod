import { zhCN } from "../i18n/zh-CN.js";
import { createApiHint } from "./api-hint.js";
import { createMultiSelect } from "./multi-select.js";
import { createToggle } from "./toggle.js";
import { distributionChannels } from "../generated/enums.js";

const UI = zhCN.distribution;
const SCHEMA = "items@3 · item.schema.json#/$defs/distribution";

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function channelOptions() {
  const labels = (zhCN.enumLabels && zhCN.enumLabels.distributionChannels) || {};
  return distributionChannels.map((value) => {
    const zh = labels[value];
    return { value, label: zh ? zh + "（`" + value + "`）" : value };
  });
}

export function createDistributionEditor(descriptor, value, onChange) {
  const root = document.createElement("div");
  root.className = "pc-distribution-editor";
  const basePath = descriptor && descriptor.path ? String(descriptor.path) : "item.distribution";
  const path = basePath.endsWith("[]") ? basePath.slice(0, -2) : basePath;
  const schema = descriptor && descriptor.schema ? String(descriptor.schema) : SCHEMA;
  const state = isPlainObject(value) ? clone(value) : {};
  const channels = Array.isArray(state.channels) ? state.channels.map(String) : [];
  let uniquePerSave = state.uniquePerSave === true;

  function noteEl(text, kind) {
    const el = document.createElement("div");
    el.className = "pc-note" + (kind ? " pc-note-" + kind : "");
    el.textContent = text;
    return el;
  }

  function fieldWrap(labelText, control, fieldPath) {
    const wrapper = document.createElement("div");
    wrapper.className = "pc-field";
    const label = document.createElement("label");
    label.className = "pc-field-label";
    label.textContent = labelText;
    wrapper.appendChild(label);
    if (control && control.dataset) {
      control.dataset.path = fieldPath;
    }
    wrapper.appendChild(control);
    wrapper.appendChild(createApiHint({ path: fieldPath, schema }));
    return wrapper;
  }

  function emit() {
    const out = {};
    if (channels.length > 0) {
      out.channels = channels.slice();
    }
    if (uniquePerSave) {
      out.uniquePerSave = true;
    }
    onChange(Object.keys(out).length === 0 ? null : out);
  }

  const channelsControl = createMultiSelect({ options: channelOptions() }, channels, (next) => {
    channels.length = 0;
    if (Array.isArray(next)) {
      for (const item of next) {
        channels.push(String(item));
      }
    }
    emit();
  });
  root.appendChild(fieldWrap(UI.channels, channelsControl, path + ".channels"));

  const uniqueControl = createToggle({}, uniquePerSave, (next) => {
    uniquePerSave = next === true;
    emit();
  });
  root.appendChild(fieldWrap(UI.uniquePerSave, uniqueControl, path + ".uniquePerSave"));

  root.appendChild(noteEl(UI.hint, ""));
  return root;
}
