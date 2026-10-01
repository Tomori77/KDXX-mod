import { zhCN } from "../i18n/zh-CN.js";
import { createField } from "./field.js";
import { createApiHint, attachApiHint } from "./api-hint.js";

const SCHEMA_FILE = "items@3 · item-effects.schema.json";
const SIMPLE_CONTROLS = new Set(["select", "multi-select", "number", "toggle"]);
const PLAIN_TEXT_CONTROL = "text";

export const conditionLabels = zhCN.condition;

const ACTIVATION_PREFIX = "item.effectList[].activationRequirements.";
const BATTLE_PREFIX = "item.effectList[].periodicPulse.battleCondition.";

const ACTIVATION_COMPLEX_KEYS = [
  "sourceEdges",
  "forbiddenEdges",
  "directionalNeighbors",
  "neighborCounts",
  "alignments",
  "lineChains",
  "buffStackThresholds",
  "buffStackCapThresholds",
  "staminaThreshold",
  "primaryStatThreshold",
  "additionalPrimaryStatThresholds",
  "primaryStatMaxThreshold",
  "bagCounts",
  "distinctBagCounts",
  "occupiedCorners",
];

const ACTIVATION_DEFS = [
  { key: "sourceEdges", empty: [], schema: "#/$defs/T3/properties/sourceEdges" },
  { key: "forbiddenEdges", empty: [], schema: "#/$defs/T3/properties/forbiddenEdges" },
  { key: "requireCorner", control: "toggle", schema: "#/$defs/T3/properties/requireCorner" },
  { key: "directionalNeighbors", empty: [], schema: "#/$defs/T3/properties/directionalNeighbors" },
  { key: "neighborCounts", empty: [], schema: "#/$defs/T3/properties/neighborCounts" },
  { key: "alignments", empty: [], schema: "#/$defs/T3/properties/alignments" },
  { key: "lineChains", empty: [], schema: "#/$defs/T3/properties/lineChains" },
  { key: "buffStackThresholds", empty: [], schema: "#/$defs/T3/properties/buffStackThresholds" },
  { key: "buffStackCapThresholds", empty: [], schema: "#/$defs/T3/properties/buffStackCapThresholds" },
  { key: "staminaThreshold", empty: {}, schema: "#/$defs/T3/properties/staminaThreshold" },
  { key: "primaryStatThreshold", empty: {}, schema: "#/$defs/T3/properties/primaryStatThreshold" },
  { key: "additionalPrimaryStatThresholds", empty: [], schema: "#/$defs/T3/properties/additionalPrimaryStatThresholds" },
  { key: "primaryStatMaxThreshold", empty: {}, schema: "#/$defs/T3/properties/primaryStatMaxThreshold" },
  { key: "bagCounts", empty: [], schema: "#/$defs/T3/properties/bagCounts" },
  { key: "distinctBagCounts", empty: [], schema: "#/$defs/T3/properties/distinctBagCounts" },
  { key: "occupiedCorners", empty: [], schema: "#/$defs/T3/properties/occupiedCorners" },
];

const BATTLE_DEFS = [
  { key: "type", control: "select", options: battleTypeOptions, required: true, appliesTo: null },
  {
    key: "stat",
    control: "select",
    options: primaryStatOptions,
    required: true,
    appliesTo: ["sourcePrimaryStatGreaterThan", "sourcePrimaryStatRatioBelow", "targetPrimaryStatRatioBelow"],
  },
  {
    key: "ratio",
    control: "number",
    step: 0.01,
    required: true,
    appliesTo: ["sourcePrimaryStatRatioBelow", "targetPrimaryStatRatioBelow", "sourceBuffStacksAtLeastTargetRatio"],
  },
  {
    key: "buffId",
    control: "text",
    simplified: true,
    required: true,
    appliesTo: [
      "sourceBuffStacksGreaterThan",
      "sourceBuffStacksGreaterThanTarget",
      "targetBuffStacksGreaterThan",
      "targetBuffStacksAtMost",
      "sourceBuffStacksAtLeastTargetRatio",
    ],
  },
  {
    key: "count",
    control: "number",
    step: 1,
    min: 0,
    required: true,
    appliesTo: ["sourceBuffStacksGreaterThan", "targetBuffStacksGreaterThan", "targetBuffStacksAtMost"],
  },
  {
    key: "realmGrowth",
    control: "text",
    simplified: true,
    appliesTo: ["sourceBuffStacksGreaterThan", "targetBuffStacksGreaterThan", "targetBuffStacksAtMost"],
  },
  {
    key: "realmGrowthByField",
    control: "text",
    simplified: true,
    appliesTo: [
      "sourcePrimaryStatRatioBelow",
      "targetPrimaryStatRatioBelow",
      "sourceBuffStacksGreaterThan",
      "targetBuffStacksGreaterThan",
      "targetBuffStacksAtMost",
    ],
  },
];

const BATTLE_REQUIRED = {
  sourcePrimaryStatGreaterThan: ["type", "stat"],
  sourcePrimaryStatRatioBelow: ["type", "stat", "ratio"],
  targetPrimaryStatRatioBelow: ["type", "stat", "ratio"],
  sourceBuffStacksGreaterThan: ["type", "buffId", "count"],
  sourceBuffStacksGreaterThanTarget: ["type", "buffId"],
  targetBuffStacksGreaterThan: ["type", "buffId", "count"],
  targetBuffStacksAtMost: ["type", "buffId", "count"],
  sourceBuffStacksAtLeastTargetRatio: ["type", "buffId", "ratio"],
};

function battleTypeOptions() {
  return Object.keys(conditionLabels.battleConditionTypes).map((value) => ({
    value,
    label: conditionLabels.battleConditionTypes[value] + "（`" + value + "`）",
  }));
}

function primaryStatOptions() {
  return Object.keys(conditionLabels.primaryStats).map((value) => ({
    value,
    label: conditionLabels.primaryStats[value] + "（`" + value + "`）",
  }));
}

export function conditionFields(conditionKind) {
  if (conditionKind === "activationRequirements") {
    return ACTIVATION_DEFS.map((def) =>
      describeConditionField(conditionKind, def, ACTIVATION_PREFIX)
    );
  }
  if (conditionKind === "battleCondition") {
    return BATTLE_DEFS.map((def) => describeConditionField(conditionKind, def, BATTLE_PREFIX));
  }
  return [];
}

function describeConditionField(kind, def, prefix) {
  const descriptor = {
    path: prefix + def.key,
    control: def.control || "text",
    label: conditionLabels.fields[def.key] || def.key,
    required: def.required === true,
    schema: SCHEMA_FILE + def.schema,
  };
  if (def.options) {
    descriptor.options = typeof def.options === "function" ? def.options() : def.options;
  }
  if (def.min != null) {
    descriptor.min = def.min;
  }
  if (def.max != null) {
    descriptor.max = def.max;
  }
  if (def.step != null) {
    descriptor.step = def.step;
  }
  if (def.empty !== undefined) {
    descriptor.empty = cloneValue(def.empty);
  }
  if (def.appliesTo) {
    descriptor.appliesTo = def.appliesTo.slice();
  }
  if (def.simplified || (kind === "activationRequirements" && ACTIVATION_COMPLEX_KEYS.indexOf(def.key) !== -1)) {
    descriptor.simplified = true;
  }
  descriptor.conditionKind = kind;
  return descriptor;
}

export function createConditionEditor(descriptor, value, onChange) {
  const spec = descriptor || {};
  const kind = spec.conditionKind;
  const prefix = spec.path || (kind === "battleCondition" ? BATTLE_PREFIX : ACTIVATION_PREFIX);
  const emit = typeof onChange === "function" ? onChange : () => {};

  const root = document.createElement("div");
  root.className = "pc-condition";
  root.dataset.conditionKind = kind || "";

  const fields = conditionFields(kind);
  if (fields.length === 0) {
    const note = document.createElement("div");
    note.className = "pc-condition-unsupported";
    note.textContent = zhCN.unsupported + "：" + (kind || conditionLabels.unsupportedKind);
    root.appendChild(note);
    return root;
  }

  let draft = cloneObject(value);
  const invalid = new Set();
  const body = document.createElement("div");
  body.className = "pc-condition-body";
  root.appendChild(body);

  function emitIfValid() {
    if (invalid.size > 0) {
      root.classList.add("invalid");
      return;
    }
    if (!isDraftValid()) {
      root.classList.add("invalid");
      return;
    }
    root.classList.remove("invalid");
    emit(cloneObject(draft));
  }

  function isDraftValid() {
    if (kind !== "battleCondition") {
      return true;
    }
    if (!draft || !draft.type) {
      return false;
    }
    const required = BATTLE_REQUIRED[draft.type] || ["type"];
    return required.every((key) => draft[key] != null && draft[key] !== "");
  }

  function setField(key, next, fieldName) {
    if (kind === "battleCondition" && key === "type") {
      draft = next == null ? {} : { type: next };
      invalid.clear();
      render();
      emitIfValid();
      return;
    }
    if (next == null || next === "") {
      delete draft[key];
    } else {
      draft[key] = next;
    }
    if (!invalid.has(fieldName)) {
      emitIfValid();
    }
  }

  function render() {
    body.textContent = "";
    const activeType = kind === "battleCondition" ? draft.type : null;
    for (const field of fields) {
      if (field.appliesTo && activeType && field.appliesTo.indexOf(activeType) === -1) {
        continue;
      }
      const key = lastPathSegment(field.path);
      if (SIMPLE_CONTROLS.has(field.control)) {
        body.appendChild(
          createField(field, draft[key], (next) => setField(key, next, field.path))
        );
      } else if (field.control === PLAIN_TEXT_CONTROL && !field.simplified) {
        body.appendChild(
          createField(field, draft[key], (next) => setField(key, next, field.path))
        );
      } else {
        body.appendChild(renderJsonField(field, key));
      }
    }
  }

  function renderJsonField(field, key) {
    const wrapper = document.createElement("div");
    wrapper.className = "pc-condition-field";

    const label = document.createElement("label");
    label.className = "pc-condition-label";
    label.textContent = field.label;
    const mark = document.createElement("span");
    mark.className = "pc-condition-mark";
    mark.textContent = field.required ? zhCN.required : zhCN.optional;
    label.appendChild(mark);
    wrapper.appendChild(label);

    const input = document.createElement("textarea");
    input.className = "pc-condition-text";
    input.dataset.path = field.path;
    const present = draft[key];
    const seed = present != null ? present : field.empty;
    input.value = seed != null ? JSON.stringify(seed, null, 2) : "";
    if (invalid.has(field.path)) {
      input.classList.add("invalid");
    }
    input.addEventListener("input", () => {
      const raw = input.value.trim();
      if (raw === "") {
        delete draft[key];
        invalid.delete(field.path);
        input.classList.remove("invalid");
        input.title = "";
        emitIfValid();
        return;
      }
      let parsed;
      try {
        parsed = JSON.parse(raw);
      } catch (error) {
        invalid.add(field.path);
        input.classList.add("invalid");
        input.title = conditionLabels.invalidJson;
        root.classList.add("invalid");
        return;
      }
      draft[key] = parsed;
      invalid.delete(field.path);
      input.classList.remove("invalid");
      input.title = "";
      emitIfValid();
    });
    wrapper.appendChild(input);

    attachApiHint(wrapper, createApiHint(field));
    return wrapper;
  }

  render();
  return root;
}

function lastPathSegment(path) {
  const parts = String(path).split(".");
  return parts[parts.length - 1];
}

function cloneObject(value) {
  if (value == null || typeof value !== "object") {
    return {};
  }
  return JSON.parse(JSON.stringify(value));
}

function cloneValue(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}
