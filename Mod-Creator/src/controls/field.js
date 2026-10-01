import { zhCN } from "../i18n/zh-CN.js";
import { createApiHint, attachApiHint } from "./api-hint.js";
import { createSelect } from "./select.js";
import { createMultiSelect } from "./multi-select.js";
import { createNumber } from "./number.js";
import { createToggle } from "./toggle.js";
import { createText } from "./text.js";
import { createJson } from "./json.js";
import { createSaveCompatibility } from "./save-compatibility.js";
import { createShapeGrid } from "./shape-grid.js";
import { createEffectEditor } from "./effect-editor.js";
import { createConditionEditor } from "./condition-editor.js";
import { createAssetPicker } from "./asset-picker.js";

const factories = {
  select: createSelect,
  "multi-select": createMultiSelect,
  number: createNumber,
  toggle: createToggle,
  text: createText,
  json: createJson,
  "save-compatibility": createSaveCompatibility,
  "shape-grid": createShapeGrid,
  "effect-editor": createEffectEditor,
  "condition-editor": createConditionEditor,
  "asset-picker": createAssetPicker,
};

export function createField(descriptor, value, onChange, context) {
  const wrapper = document.createElement("div");
  wrapper.className = "pc-field";

  const label = document.createElement("label");
  label.className = "pc-field-label";
  label.textContent = resolveLabel(descriptor);
  const mark = document.createElement("span");
  mark.className = "pc-field-mark";
  mark.textContent = descriptor.required ? zhCN.required : zhCN.optional;
  label.appendChild(mark);
  wrapper.appendChild(label);

  const factory = factories[descriptor.control];
  if (!factory) {
    const note = document.createElement("div");
    note.className = "pc-field-unsupported";
    note.textContent = zhCN.unsupported + "：" + controlLabel(descriptor.control);
    wrapper.appendChild(note);
  } else {
    const control = factory(descriptor, value, onChange, context);
    control.dataset.path = descriptor.path;
    wrapper.appendChild(control);
  }

  attachApiHint(wrapper, createApiHint(descriptor));
  return wrapper;
}

function resolveLabel(descriptor) {
  const raw = descriptor.label;
  if (raw && typeof raw === "object") {
    return raw.zh || raw.label || descriptor.path;
  }
  if (typeof raw === "string" && zhCN[raw]) {
    return zhCN[raw];
  }
  return raw != null ? String(raw) : descriptor.path;
}

function controlLabel(control) {
  return (zhCN.controlLabels && zhCN.controlLabels[control]) || String(control);
}
