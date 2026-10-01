import { zhCN } from "../i18n/zh-CN.js";
import { createApiHint } from "./api-hint.js";
import { createNumber } from "./number.js";
import { createText } from "./text.js";
import { createMultiSelect } from "./multi-select.js";
import { createEffectEditor } from "./effect-editor.js";

const UI = zhCN.scripture;
const SCHEMA = "items@3 · item-effects.schema.json#/$defs/T900";
const EFFECT_SCHEMA = "items@3 · item-effects.schema.json";

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function finiteOrNull(value) {
  if (value == null || value === "") {
    return null;
  }
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function ensureObject(target, key) {
  if (!isPlainObject(target[key])) {
    target[key] = {};
  }
  return target[key];
}

function ensureArray(target, key) {
  if (!Array.isArray(target[key])) {
    target[key] = [];
  }
  return target[key];
}

export function createScriptureEditor(descriptor, value, onChange) {
  const root = document.createElement("div");
  root.className = "pc-scripture-editor";
  const rawPath =
    descriptor && descriptor.path ? String(descriptor.path) : "item.effectList[].scriptureProgression";
  const path = rawPath.endsWith("[]") ? rawPath.slice(0, -2) : rawPath;
  const schema = descriptor && descriptor.schema ? String(descriptor.schema) : SCHEMA;
  const state = isPlainObject(value) ? clone(value) : {};
  if (!Array.isArray(state.layers)) {
    state.layers = [];
  }
  let messagesEl = null;

  function layerLabel(index) {
    return String(UI.layer).replace("{n}", String(index + 1));
  }

  function validate() {
    const errors = [];
    if (!Array.isArray(state.layers)) {
      errors.push(UI.invalid);
      return errors;
    }
    state.layers.forEach((layer, index) => {
      const tag = layerLabel(index);
      if (!isPlainObject(layer)) {
        errors.push(tag + "：" + UI.invalidLayer);
        return;
      }
      if (layer.requirements !== undefined && !isPlainObject(layer.requirements)) {
        errors.push(tag + "：" + UI.invalidRequirements);
      }
      const req = layer.requirements;
      if (isPlainObject(req) && req.requiredScriptureLayers !== undefined) {
        if (!Array.isArray(req.requiredScriptureLayers)) {
          errors.push(tag + "：" + UI.invalidScriptureLayers);
        } else {
          req.requiredScriptureLayers.forEach((entry, j) => {
            if (
              !isPlainObject(entry) ||
              finiteOrNull(entry.templateNumericId) == null ||
              finiteOrNull(entry.minLayer) == null
            ) {
              errors.push(tag + "：" + UI.invalidScriptureLayerRow + " #" + (j + 1));
            }
          });
        }
      }
      if (layer.effects !== undefined && !isPlainObject(layer.effects)) {
        errors.push(tag + "：" + UI.invalidEffects);
      }
      if (
        isPlainObject(layer.effects) &&
        layer.effects.effectList !== undefined &&
        !Array.isArray(layer.effects.effectList)
      ) {
        errors.push(tag + "：" + UI.invalidEffectList);
      }
      for (const key of ["breakthroughTargetProgress", "breakthroughTimeLimitSec", "breakthroughCooldownSec"]) {
        if (layer[key] !== undefined && layer[key] !== null && finiteOrNull(layer[key]) == null) {
          errors.push(tag + "：" + UI.invalidNumber + " " + key);
        }
      }
    });
    return errors;
  }

  function emit() {
    if (validate().length === 0) {
      onChange(clone(state));
    }
  }

  function updateMessages() {
    if (!messagesEl) {
      return;
    }
    messagesEl.replaceChildren();
    for (const message of validate()) {
      messagesEl.appendChild(noteEl(message, "error"));
    }
  }

  function commit() {
    emit();
    updateMessages();
  }

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

  function button(text, onClick, disabled) {
    const el = document.createElement("button");
    el.type = "button";
    el.className = "pc-btn";
    el.textContent = text;
    if (disabled) {
      el.disabled = true;
    }
    el.addEventListener("click", onClick);
    return el;
  }

  function textField(container, labelText, fieldPath, current, apply, opts) {
    const descriptor2 = Object.assign({}, opts || {});
    const control = createText(descriptor2, current, (next) => {
      apply(next);
      commit();
    });
    container.appendChild(fieldWrap(labelText, control, fieldPath));
  }

  function numberField(container, labelText, fieldPath, current, apply, opts) {
    const control = createNumber(Object.assign({}, opts || {}), current, (next) => {
      apply(next);
      commit();
    });
    container.appendChild(fieldWrap(labelText, control, fieldPath));
  }

  function renderRequirementList(container, req) {
    const list = ensureArray(req, "requiredScriptureLayers");
    const wrap = document.createElement("div");
    wrap.className = "pc-scripture-req-list";
    const title = document.createElement("div");
    title.className = "pc-scripture-section-title";
    title.textContent = UI.requiredScriptureLayers;
    wrap.appendChild(title);
    list.forEach((entry, j) => {
      const row = document.createElement("div");
      row.className = "pc-scripture-req-row";
      numberField(
        row,
        UI.templateNumericId,
        path + ".layers[].requirements.requiredScriptureLayers[].templateNumericId",
        entry.templateNumericId,
        (v) => {
          if (v == null) {
            delete entry.templateNumericId;
          } else {
            entry.templateNumericId = v;
          }
        },
        { min: 1, step: 1 }
      );
      numberField(
        row,
        UI.minLayer,
        path + ".layers[].requirements.requiredScriptureLayers[].minLayer",
        entry.minLayer,
        (v) => {
          if (v == null) {
            delete entry.minLayer;
          } else {
            entry.minLayer = v;
          }
        },
        { min: 1, step: 1 }
      );
      row.appendChild(
        button(zhCN.remove, () => {
          list.splice(j, 1);
          render(false);
          commit();
        })
      );
      wrap.appendChild(row);
    });
    wrap.appendChild(
      button(UI.addRequirement, () => {
        list.push({ templateNumericId: 1, minLayer: 1 });
        render(false);
        commit();
      })
    );
    container.appendChild(wrap);
  }

  function renderLayer(layer, index) {
    const card = document.createElement("div");
    card.className = "pc-scripture-layer";
    const bar = document.createElement("div");
    bar.className = "pc-scripture-layer-head";
    const title = document.createElement("span");
    title.className = "pc-scripture-layer-title";
    title.textContent = layerLabel(index);
    bar.appendChild(title);
    bar.appendChild(button(zhCN.moveUp, () => move(index, -1), index === 0));
    bar.appendChild(button(zhCN.moveDown, () => move(index, 1), index === state.layers.length - 1));
    bar.appendChild(button(zhCN.remove, () => removeLayer(index)));
    card.appendChild(bar);

    card.appendChild(noteEl(UI.layerAuto, ""));
    if (index === 0) {
      card.appendChild(noteEl(UI.noteFirstLayer, "warn"));
    } else {
      card.appendChild(noteEl(UI.noteBreakthrough, "warn"));
    }

    const reqTitle = document.createElement("div");
    reqTitle.className = "pc-scripture-section-title";
    reqTitle.textContent = UI.requirements;
    card.appendChild(reqTitle);
    const req = ensureObject(layer, "requirements");
    textField(
      card,
      UI.requiredRealmId,
      path + ".layers[].requirements.requiredRealmId",
      req.requiredRealmId,
      (v) => {
        if (v === "") {
          delete req.requiredRealmId;
        } else {
          req.requiredRealmId = v;
        }
      },
      { placeholder: UI.requiredRealmIdPlaceholder }
    );
    numberField(
      card,
      UI.requiredRealmLayer,
      path + ".layers[].requirements.requiredRealmLayer",
      req.requiredRealmLayer,
      (v) => {
        if (v == null) {
          delete req.requiredRealmLayer;
        } else {
          req.requiredRealmLayer = v;
        }
      },
      { min: 0, step: 1 }
    );
    numberField(
      card,
      UI.requiredCultivation,
      path + ".layers[].requirements.requiredCultivation",
      req.requiredCultivation,
      (v) => {
        if (v == null) {
          delete req.requiredCultivation;
        } else {
          req.requiredCultivation = v;
        }
      },
      { min: 0, step: 1 }
    );
    renderRequirementList(card, req);

    const btTitle = document.createElement("div");
    btTitle.className = "pc-scripture-section-title";
    btTitle.textContent = UI.breakthrough;
    card.appendChild(btTitle);
    numberField(
      card,
      UI.breakthroughTargetProgress,
      path + ".layers[].breakthroughTargetProgress",
      layer.breakthroughTargetProgress,
      (v) => {
        if (v == null) {
          delete layer.breakthroughTargetProgress;
        } else {
          layer.breakthroughTargetProgress = v;
        }
      },
      { min: 0, step: 1 }
    );
    numberField(
      card,
      UI.breakthroughTimeLimitSec,
      path + ".layers[].breakthroughTimeLimitSec",
      layer.breakthroughTimeLimitSec,
      (v) => {
        if (v == null) {
          delete layer.breakthroughTimeLimitSec;
        } else {
          layer.breakthroughTimeLimitSec = v;
        }
      },
      { min: 0, step: 1 }
    );
    numberField(
      card,
      UI.breakthroughCooldownSec,
      path + ".layers[].breakthroughCooldownSec",
      layer.breakthroughCooldownSec,
      (v) => {
        if (v == null) {
          delete layer.breakthroughCooldownSec;
        } else {
          layer.breakthroughCooldownSec = v;
        }
      },
      { min: 0, step: 1 }
    );

    const effTitle = document.createElement("div");
    effTitle.className = "pc-scripture-section-title";
    effTitle.textContent = UI.effects;
    card.appendChild(effTitle);
    const effects = ensureObject(layer, "effects");
    const labels = ensureArray(effects, "labels");
    const labelsControl = createMultiSelect({ options: [], freeform: true }, labels, (next) => {
      effects.labels = Array.isArray(next) ? next : [];
      commit();
    });
    card.appendChild(fieldWrap(UI.labels, labelsControl, path + ".layers[].effects.labels"));
    const effectList = ensureArray(effects, "effectList");
    const editor = createEffectEditor(
      { path: path + ".layers[].effects.effectList[]", schema: EFFECT_SCHEMA },
      effectList,
      (next) => {
        effects.effectList = Array.isArray(next) ? next : [];
        commit();
      }
    );
    card.appendChild(fieldWrap(UI.effectList, editor, path + ".layers[].effects.effectList[]"));
    return card;
  }

  function move(index, delta) {
    const target = index + delta;
    if (target < 0 || target >= state.layers.length) {
      return;
    }
    const [item] = state.layers.splice(index, 1);
    state.layers.splice(target, 0, item);
    render(false);
    commit();
  }

  function removeLayer(index) {
    state.layers.splice(index, 1);
    render(false);
    commit();
  }

  function addLayer() {
    state.layers.push({ effects: { effectList: [] } });
    render(false);
    commit();
  }

  function render(notify) {
    root.replaceChildren();
    const head = document.createElement("div");
    head.className = "pc-scripture-head";
    head.appendChild(button(UI.addLayer, addLayer));
    head.appendChild(createApiHint({ path: path + ".layers", schema }));
    root.appendChild(head);

    const guidance = document.createElement("div");
    guidance.className = "pc-scripture-guidance";
    guidance.appendChild(noteEl(UI.noteCumulative, "warn"));
    guidance.appendChild(noteEl(UI.noteFirstLayer, "warn"));
    guidance.appendChild(noteEl(UI.noteBreakthrough, "warn"));
    root.appendChild(guidance);

    state.layers.forEach((layer, index) => {
      root.appendChild(renderLayer(layer, index));
    });

    messagesEl = document.createElement("div");
    messagesEl.className = "pc-scripture-messages pc-effect-messages";
    root.appendChild(messagesEl);
    updateMessages();

    if (notify !== false) {
      emit();
    }
  }

  render(false);
  return root;
}
