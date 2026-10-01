import { zhCN } from "../i18n/zh-CN.js";
import { createApiHint } from "./api-hint.js";
import { createSelect } from "./select.js";
import { createNumber } from "./number.js";
import { createScriptureEditor } from "./scripture-editor.js";
import { createStarOverridesEditor } from "./star-overrides-editor.js";
import { effectKinds, passiveTypes, executorTypes, triggers } from "../generated/mechanism.js";

export const effectNotes = zhCN.effectNotes;

const SCHEMA = "items@3 · item-effects.schema.json";

const SUB_BLOCKS = {
  passive: "passiveEffect",
  triggered: "triggeredEffect",
  periodicPulse: "periodicPulse",
  consumable: "consumable",
  scriptureProgression: "scriptureProgression",
  activationRequirements: "requirements",
  baseCultivationOutputRate: "value",
  baseCultivationOutputRateTimeCurve: "curve",
};

const UI = {
  rootPath: "item.effectList[]",
  kind: "效果类型（kind）",
  topLabel: "显示文案（顶层 label）",
  missingLabel: "缺少顶层 label：游戏内该效果不会显示任何文案（必填）。",
  addEffect: "添加效果",
  copy: "复制",
  executors: "执行器（executors）",
  addExecutor: "添加执行器",
  type: "类型（type）",
  trigger: "触发（trigger）",
  amount: "数值（amount）",
  buffId: "Buff ID（buffId）",
  targetActor: "目标（targetActor）",
  itemRuntimeStatus: "运行时状态（itemRuntimeStatus）",
  durationSec: "持续秒数（durationSec）",
  value: "数值（value）",
  intervalSec: "轮转间隔秒数（intervalSec）",
  cultivationGain: "修为产出（cultivationGain）",
  spiritStoneGain: "灵石产出（spiritStoneGain）",
  subLabel: "子块文案（label）",
  targetScope: "目标范围（targetScope）",
  eventBuffId: "事件 Buff（eventBuffId）",
  condition: "激活条件（activationRequirements）",
  itemRuntimeStatusEffects: "敌方运行时状态（itemRuntimeStatusEffects）",
  jsonFallback: "其余字段（JSON，需可解析）",
  jsonInvalid: "JSON 解析失败，未写入。",
  conditionFallback: "条件编辑器尚未就绪，暂用下方 JSON 编辑激活条件。",
  unknownKind: "请选择效果类型（kind）。",
  scriptureTitle: "功法层级（scriptureProgression）",
  scriptureSchema: "items@3 · item-effects.schema.json#/$defs/T900",
  starSummary: "星级覆写（starOverrides）",
  starEmpty: "未设置星级覆写",
  starSchema: "items@3 · item-effects.schema.json#/$defs/T625",
};

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function enumOptions(list) {
  return list.map((value) => ({ value, label: value }));
}

function normalize(value) {
  return Array.isArray(value) ? clone(value) : [];
}

function ensureObject(target, key) {
  if (!target[key] || typeof target[key] !== "object" || Array.isArray(target[key])) {
    target[key] = {};
  }
  return target[key];
}

function isBlank(value) {
  return value == null || String(value).trim() === "";
}

function replaceInPlace(target, parsed) {
  if (
    target &&
    typeof target === "object" &&
    !Array.isArray(target) &&
    parsed &&
    typeof parsed === "object" &&
    !Array.isArray(parsed)
  ) {
    for (const key of Object.keys(target)) {
      delete target[key];
    }
    Object.assign(target, parsed);
    return true;
  }
  return false;
}

function finiteOrNull(value) {
  if (value == null || value === "") {
    return null;
  }
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

let conditionEditorPromise = null;

function loadConditionEditor() {
  if (!conditionEditorPromise) {
    conditionEditorPromise = import("./condition-editor.js")
      .then((mod) => (typeof mod.createConditionEditor === "function" ? mod.createConditionEditor : null))
      .catch(() => null);
  }
  return conditionEditorPromise;
}

export function createEffectEditor(descriptor, value, onChange) {
  const root = document.createElement("div");
  root.className = "pc-effect-editor";
  const rawPath = descriptor && descriptor.path ? String(descriptor.path) : UI.rootPath;
  const rootPath = rawPath.endsWith("[]") ? rawPath.slice(0, -2) : rawPath;
  const schema = descriptor && descriptor.schema ? String(descriptor.schema) : SCHEMA;
  const state = normalize(value);
  let messagesEl = null;

  function validateList(list) {
    const errors = [];
    list.forEach((effect, index) => {
      const tag = "效果 #" + (index + 1);
      if (!effect || typeof effect !== "object") {
        errors.push(tag + "：不是有效对象。");
        return;
      }
      if (isBlank(effect.kind)) {
        errors.push(tag + "：" + UI.unknownKind);
      }
      if (isBlank(effect.label)) {
        errors.push(tag + "：" + UI.missingLabel);
      }
      if (effect.kind === "passive") {
        if (!effect.passiveEffect || isBlank(effect.passiveEffect.type)) {
          errors.push(tag + "：passiveEffect.type 必填。");
        }
      } else if (effect.kind === "triggered") {
        if (!effect.triggeredEffect || isBlank(effect.triggeredEffect.trigger)) {
          errors.push(tag + "：triggeredEffect.trigger 必填。");
        }
        if (!effect.triggeredEffect || isBlank(effect.triggeredEffect.type)) {
          errors.push(tag + "：triggeredEffect.type 必填。");
        }
      } else if (effect.kind === "periodicPulse") {
        if (!effect.periodicPulse || finiteOrNull(effect.periodicPulse.intervalSec) == null) {
          errors.push(tag + "：periodicPulse.intervalSec 必须是数值。");
        }
      } else if (effect.kind === "effectNote") {
        const executors = Array.isArray(effect.executors) ? effect.executors : [];
        executors.forEach((executor, j) => {
          const exTag = tag + " 执行器 #" + (j + 1);
          if (isBlank(executor.type)) {
            errors.push(exTag + "：type 必填。");
          }
          if (isBlank(executor.trigger)) {
            errors.push(exTag + "：trigger 必填。");
          }
          if (executor.type === "itemRuntimeStatus" && !(finiteOrNull(executor.amount) > 0)) {
            errors.push(exTag + "：itemRuntimeStatus 必须显式写 amount（正数）。");
          }
        });
      } else if (!Object.prototype.hasOwnProperty.call(SUB_BLOCKS, effect.kind)) {
        errors.push(tag + "：未知 kind（" + effect.kind + "）。");
      }
    });
    return errors;
  }

  function emit() {
    if (validateList(state).length === 0) {
      onChange(clone(state));
    }
  }

  function updateMessages() {
    if (!messagesEl) {
      return;
    }
    messagesEl.replaceChildren();
    for (const message of validateList(state)) {
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

  function fieldWrap(labelText, control, path, apiSchema) {
    const wrapper = document.createElement("div");
    wrapper.className = "pc-field";
    const label = document.createElement("label");
    label.className = "pc-field-label";
    label.textContent = labelText;
    wrapper.appendChild(label);
    if (control && control.dataset) {
      control.dataset.path = path;
    }
    wrapper.appendChild(control);
    wrapper.appendChild(createApiHint({ path, schema: apiSchema || schema }));
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

  function textInput(current, onInput) {
    const el = document.createElement("input");
    el.type = "text";
    el.className = "pc-text";
    el.value = current == null ? "" : String(current);
    el.addEventListener("input", () => onInput(el.value));
    return el;
  }

  function textField(container, labelText, path, current, apply) {
    const control = textInput(current, (v) => {
      apply(v);
      commit();
    });
    container.appendChild(fieldWrap(labelText, control, path));
  }

  function numberField(container, labelText, path, current, apply, opts) {
    const control = createNumber(Object.assign({}, opts || {}), current, (next) => {
      apply(next);
      commit();
    });
    container.appendChild(fieldWrap(labelText, control, path));
  }

  function jsonEditor(container, labelText, path, current, apply) {
    const ta = document.createElement("textarea");
    ta.className = "pc-json";
    ta.rows = 4;
    ta.value = current === undefined ? "{}" : JSON.stringify(current, null, 2);
    ta.addEventListener("input", () => {
      try {
        const parsed = JSON.parse(ta.value);
        ta.classList.remove("invalid");
        apply(parsed);
        commit();
      } catch (err) {
        ta.classList.add("invalid");
      }
    });
    container.appendChild(fieldWrap(labelText, ta, path));
    return ta;
  }

  function applyKind(effect) {
    for (const key of Object.keys(SUB_BLOCKS)) {
      if (key !== effect.kind) {
        delete effect[SUB_BLOCKS[key]];
      }
    }
    if (effect.kind === "passive") {
      ensureObject(effect, "passiveEffect");
    } else if (effect.kind === "triggered") {
      ensureObject(effect, "triggeredEffect");
    } else if (effect.kind === "periodicPulse") {
      const block = ensureObject(effect, "periodicPulse");
      if (block.intervalSec == null) {
        block.intervalSec = 1;
      }
    } else if (effect.kind === "effectNote") {
      if (!Array.isArray(effect.executors)) {
        effect.executors = [];
      }
    } else if (effect.kind === "consumable") {
      ensureObject(effect, "consumable");
    } else if (effect.kind === "scriptureProgression") {
      const block = ensureObject(effect, "scriptureProgression");
      if (!Array.isArray(block.layers)) {
        block.layers = [];
      }
    } else if (effect.kind === "activationRequirements") {
      ensureObject(effect, "requirements");
    } else if (effect.kind === "baseCultivationOutputRate") {
      if (effect.value == null) {
        effect.value = 0;
      }
    } else if (effect.kind === "baseCultivationOutputRateTimeCurve") {
      ensureObject(effect, "curve");
    }
  }

  function move(index, delta) {
    const target = index + delta;
    if (target < 0 || target >= state.length) {
      return;
    }
    const [item] = state.splice(index, 1);
    state.splice(target, 0, item);
    render();
  }

  function copyEffect(index) {
    state.splice(index + 1, 0, clone(state[index]));
    render();
  }

  function renderPassive(effect, index, container) {
    const block = ensureObject(effect, "passiveEffect");
    const typeSelect = createSelect(
      { options: enumOptions(passiveTypes), required: true },
      block.type,
      (next) => {
        block.type = next == null ? "" : next;
        render();
      }
    );
    container.appendChild(fieldWrap(UI.type, typeSelect, rootPath + "[].passiveEffect.type"));
    if (block.type === "globalOutputModifier") {
      container.appendChild(noteEl(effectNotes.globalOutputModifier, "warn"));
    }
    numberField(container, UI.value, rootPath + "[].passiveEffect.value", block.value, (v) => {
      if (v == null) {
        delete block.value;
      } else {
        block.value = v;
      }
    });
    textField(container, UI.buffId, rootPath + "[].passiveEffect.buffId", block.buffId, (v) => {
      if (v === "") {
        delete block.buffId;
      } else {
        block.buffId = v;
      }
    });
    textField(container, UI.targetScope, rootPath + "[].passiveEffect.targetScope", block.targetScope, (v) => {
      if (v === "") {
        delete block.targetScope;
      } else {
        block.targetScope = v;
      }
    });
    textField(container, UI.subLabel, rootPath + "[].passiveEffect.label", block.label, (v) => {
      if (v === "") {
        delete block.label;
      } else {
        block.label = v;
      }
    });
    jsonEditor(container, UI.jsonFallback, rootPath + "[].passiveEffect.#json", block, (parsed) => {
      if (!replaceInPlace(block, parsed)) {
        effect.passiveEffect = parsed;
      }
    });
  }

  function renderTriggered(effect, index, container) {
    const block = ensureObject(effect, "triggeredEffect");
    const triggerSelect = createSelect(
      { options: enumOptions(triggers), required: true },
      block.trigger,
      (next) => {
        block.trigger = next == null ? "" : next;
        commit();
      }
    );
    container.appendChild(fieldWrap(UI.trigger, triggerSelect, rootPath + "[].triggeredEffect.trigger"));
    const typeSelect = createSelect(
      { options: enumOptions(executorTypes), required: true },
      block.type,
      (next) => {
        block.type = next == null ? "" : next;
        commit();
      }
    );
    container.appendChild(fieldWrap(UI.type, typeSelect, rootPath + "[].triggeredEffect.type"));
    numberField(container, UI.amount, rootPath + "[].triggeredEffect.amount", block.amount, (v) => {
      if (v == null) {
        delete block.amount;
      } else {
        block.amount = v;
      }
    });
    textField(container, UI.buffId, rootPath + "[].triggeredEffect.buffId", block.buffId, (v) => {
      if (v === "") {
        delete block.buffId;
      } else {
        block.buffId = v;
      }
    });
    textField(container, UI.eventBuffId, rootPath + "[].triggeredEffect.eventBuffId", block.eventBuffId, (v) => {
      if (v === "") {
        delete block.eventBuffId;
      } else {
        block.eventBuffId = v;
      }
    });
    textField(container, UI.targetActor, rootPath + "[].triggeredEffect.targetActor", block.targetActor, (v) => {
      if (v === "") {
        delete block.targetActor;
      } else {
        block.targetActor = v;
      }
    });
    jsonEditor(container, UI.jsonFallback, rootPath + "[].triggeredEffect.#json", block, (parsed) => {
      if (!replaceInPlace(block, parsed)) {
        effect.triggeredEffect = parsed;
      }
    });
  }

  function mountCondition(container, effect, index) {
    const path = rootPath + "[].periodicPulse.activationRequirements";
    const holder = document.createElement("div");
    holder.className = "pc-condition-holder";
    const fallback = document.createElement("div");
    jsonEditor(fallback, UI.condition, path, effect.periodicPulse.activationRequirements, (parsed) => {
      if (!replaceInPlace(effect.periodicPulse.activationRequirements, parsed)) {
        effect.periodicPulse.activationRequirements = parsed;
      }
    });
    container.appendChild(holder);
    container.appendChild(fallback);
    loadConditionEditor().then((factory) => {
      if (!factory || !holder.isConnected) {
        return;
      }
      let editor = null;
      try {
        editor = factory(
          { path, schema, conditionKind: "activationRequirements", label: UI.condition },
          effect.periodicPulse.activationRequirements,
          (next) => {
            if (next == null) {
              delete effect.periodicPulse.activationRequirements;
            } else {
              effect.periodicPulse.activationRequirements = next;
            }
            commit();
          }
        );
      } catch (err) {
        editor = null;
      }
      if (editor) {
        fallback.remove();
        holder.appendChild(editor);
      } else {
        fallback.insertBefore(noteEl(UI.conditionFallback), fallback.firstChild);
      }
    });
  }

  function renderPeriodicPulse(effect, index, container) {
    const block = ensureObject(effect, "periodicPulse");
    numberField(container, UI.intervalSec, rootPath + "[].periodicPulse.intervalSec", block.intervalSec, (v) => {
      block.intervalSec = v;
    }, { min: 0, step: 1 });
    numberField(container, UI.cultivationGain, rootPath + "[].periodicPulse.cultivationGain", block.cultivationGain, (v) => {
      if (v == null) {
        delete block.cultivationGain;
      } else {
        block.cultivationGain = v;
      }
    });
    numberField(container, UI.spiritStoneGain, rootPath + "[].periodicPulse.spiritStoneGain", block.spiritStoneGain, (v) => {
      if (v == null) {
        delete block.spiritStoneGain;
      } else {
        block.spiritStoneGain = v;
      }
    });
    textField(container, UI.subLabel, rootPath + "[].periodicPulse.label", block.label, (v) => {
      if (v === "") {
        delete block.label;
      } else {
        block.label = v;
      }
    });
    mountCondition(container, effect, index);
    jsonEditor(container, UI.itemRuntimeStatusEffects, rootPath + "[].periodicPulse.itemRuntimeStatusEffects", block.itemRuntimeStatusEffects, (parsed) => {
      block.itemRuntimeStatusEffects = parsed;
    });
    container.appendChild(noteEl(effectNotes.periodicPulseItemRuntimeStatus, "warn"));
    jsonEditor(container, UI.jsonFallback, rootPath + "[].periodicPulse.#json", block, (parsed) => {
      if (!replaceInPlace(block, parsed)) {
        effect.periodicPulse = parsed;
      }
    });
  }

  function renderExecutors(effect, index, container) {
    container.appendChild(noteEl(effectNotes.activeItemRuntimeStatusAmount, "warn"));
    const list = effect.executors = Array.isArray(effect.executors) ? effect.executors : [];
    list.forEach((executor, j) => {
      const row = document.createElement("div");
      row.className = "pc-executor";
      const head = document.createElement("div");
      head.className = "pc-executor-head";
      const title = document.createElement("span");
      title.className = "pc-executor-title";
      title.textContent = UI.executors + " #" + (j + 1);
      head.appendChild(title);
      head.appendChild(button(zhCN.remove, () => {
        list.splice(j, 1);
        render();
      }));
      row.appendChild(head);
      const typeSelect = createSelect(
        { options: enumOptions(executorTypes), required: true },
        executor.type,
        (next) => {
          executor.type = next == null ? "" : next;
          render();
        }
      );
      row.appendChild(fieldWrap(UI.type, typeSelect, rootPath + "[].effectNote.executors[].type"));
      const triggerSelect = createSelect(
        { options: enumOptions(triggers), required: true },
        executor.trigger,
        (next) => {
          executor.trigger = next == null ? "" : next;
          commit();
        }
      );
      row.appendChild(fieldWrap(UI.trigger, triggerSelect, rootPath + "[].effectNote.executors[].trigger"));
      numberField(row, UI.amount, rootPath + "[].effectNote.executors[].amount", executor.amount, (v) => {
        if (v == null) {
          delete executor.amount;
        } else {
          executor.amount = v;
        }
      });
      if (executor.type === "itemRuntimeStatus") {
        textField(row, UI.itemRuntimeStatus, rootPath + "[].effectNote.executors[].itemRuntimeStatus", executor.itemRuntimeStatus, (v) => {
          if (v === "") {
            delete executor.itemRuntimeStatus;
          } else {
            executor.itemRuntimeStatus = v;
          }
        });
        row.appendChild(noteEl(effectNotes.activeItemRuntimeStatusAmount, "warn"));
      }
      textField(row, UI.buffId, rootPath + "[].effectNote.executors[].buffId", executor.buffId, (v) => {
        if (v === "") {
          delete executor.buffId;
        } else {
          executor.buffId = v;
        }
      });
      textField(row, UI.targetActor, rootPath + "[].effectNote.executors[].targetActor", executor.targetActor, (v) => {
        if (v === "") {
          delete executor.targetActor;
        } else {
          executor.targetActor = v;
        }
      });
      numberField(row, UI.durationSec, rootPath + "[].effectNote.executors[].durationSec", executor.durationSec, (v) => {
        if (v == null) {
          delete executor.durationSec;
        } else {
          executor.durationSec = v;
        }
      });
      jsonEditor(row, UI.jsonFallback, rootPath + "[].effectNote.executors[#" + j + "].#json", executor, (parsed) => {
        if (!replaceInPlace(executor, parsed)) {
          list[j] = parsed;
        }
      });
      container.appendChild(row);
    });
    container.appendChild(button(UI.addExecutor, () => {
      list.push({ type: "", trigger: "" });
      render();
    }));
  }

  function renderFallback(effect, index, container) {
    const key = SUB_BLOCKS[effect.kind];
    jsonEditor(container, UI.jsonFallback, rootPath + "[][" + key + "]", effect[key], (parsed) => {
      if (!replaceInPlace(effect[key], parsed)) {
        effect[key] = parsed;
      }
    });
  }

  function renderScriptureProgression(effect, index, container) {
    const block = ensureObject(effect, "scriptureProgression");
    if (!Array.isArray(block.layers)) {
      block.layers = [];
    }
    container.appendChild(noteEl(UI.scriptureTitle, "warn"));
    const editor = createScriptureEditor(
      { path: rootPath + "[].scriptureProgression", schema: UI.scriptureSchema },
      block,
      (next) => {
        if (next == null) {
          delete effect.scriptureProgression;
        } else {
          effect.scriptureProgression = next;
        }
        commit();
      }
    );
    container.appendChild(editor);
  }

  function renderStarOverrides(effect) {
    const section = document.createElement("details");
    section.className = "pc-effect-star";
    const summary = document.createElement("summary");
    summary.className = "pc-effect-star-summary";
    const hasStar =
      effect.starOverrides && typeof effect.starOverrides === "object" && !Array.isArray(effect.starOverrides);
    summary.textContent = UI.starSummary + (hasStar ? "" : "（" + UI.starEmpty + "）");
    section.appendChild(summary);
    const editor = createStarOverridesEditor(
      { path: rootPath + "[].starOverrides", schema: UI.starSchema },
      hasStar ? effect.starOverrides : null,
      (next) => {
        if (next == null) {
          delete effect.starOverrides;
        } else {
          effect.starOverrides = next;
        }
        commit();
      }
    );
    section.appendChild(editor);
    return section;
  }

  function renderSubForm(effect, index, container) {
    if (isBlank(effect.kind)) {
      container.appendChild(noteEl(UI.unknownKind, "warn"));
      return;
    }
    if (effect.kind === "passive") {
      renderPassive(effect, index, container);
    } else if (effect.kind === "triggered") {
      renderTriggered(effect, index, container);
    } else if (effect.kind === "periodicPulse") {
      renderPeriodicPulse(effect, index, container);
    } else if (effect.kind === "effectNote") {
      renderExecutors(effect, index, container);
    } else if (effect.kind === "scriptureProgression") {
      renderScriptureProgression(effect, index, container);
    } else if (Object.prototype.hasOwnProperty.call(SUB_BLOCKS, effect.kind)) {
      renderFallback(effect, index, container);
    } else {
      container.appendChild(noteEl(UI.unknownKind, "warn"));
    }
  }

  function renderItem(effect, index) {
    const card = document.createElement("div");
    card.className = "pc-effect-card";
    const bar = document.createElement("div");
    bar.className = "pc-effect-bar";
    const title = document.createElement("span");
    title.className = "pc-effect-title";
    title.textContent = "#" + (index + 1);
    bar.appendChild(title);
    const kindSelect = createSelect(
      { options: enumOptions(effectKinds), required: true },
      effect.kind,
      (next) => {
        effect.kind = next == null ? "" : next;
        applyKind(effect);
        render();
      }
    );
    bar.appendChild(fieldWrap(UI.kind, kindSelect, rootPath + "[].kind"));
    bar.appendChild(button(zhCN.moveUp, () => move(index, -1), index === 0));
    bar.appendChild(button(zhCN.moveDown, () => move(index, 1), index === state.length - 1));
    bar.appendChild(button(UI.copy, () => copyEffect(index)));
    bar.appendChild(button(zhCN.remove, () => {
      state.splice(index, 1);
      render();
    }));
    card.appendChild(bar);
    const labelInput = textInput(effect.label, (v) => {
      effect.label = v;
      commit();
    });
    card.appendChild(fieldWrap(UI.topLabel + "（" + zhCN.required + "）", labelInput, rootPath + "[].label"));
    if (isBlank(effect.label)) {
      card.appendChild(noteEl(UI.missingLabel, "error"));
    }
    const sub = document.createElement("div");
    sub.className = "pc-effect-sub";
    renderSubForm(effect, index, sub);
    card.appendChild(sub);
    card.appendChild(renderStarOverrides(effect));
    return card;
  }

  function render(notify) {
    root.replaceChildren();
    const head = document.createElement("div");
    head.className = "pc-effect-editor-head";
    head.appendChild(button(UI.addEffect, () => {
      state.push({ kind: "", label: "" });
      render();
    }));
    head.appendChild(createApiHint({ path: rootPath, schema }));
    root.appendChild(head);
    state.forEach((effect, index) => {
      root.appendChild(renderItem(effect, index));
    });
    messagesEl = document.createElement("div");
    messagesEl.className = "pc-effect-messages";
    root.appendChild(messagesEl);
    updateMessages();
    if (notify !== false) {
      emit();
    }
  }

  render(false);
  return root;
}
