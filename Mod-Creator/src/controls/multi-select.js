import { resolveOptions } from "./select.js";
import { zhCN } from "../i18n/zh-CN.js";

export function createMultiSelect(descriptor, value, onChange) {
  const el = document.createElement("div");
  el.className = "pc-multi-select";
  const list = resolveOptions(descriptor.options, descriptor.optionsGroup);
  const freeform = descriptor.freeform === true || list.length === 0;
  const known = new Set(list.map((opt) => String(opt.value)));
  const selected = new Set(Array.isArray(value) ? value.map(String) : []);

  const boxes = [];
  let tagsWrap = null;

  function emit() {
    onChange(Array.from(selected));
  }

  function syncBoxes() {
    for (const box of boxes) {
      box.checked = selected.has(String(box.value));
    }
  }

  function renderTags() {
    if (!tagsWrap) {
      return;
    }
    tagsWrap.innerHTML = "";
    for (const item of Array.from(selected)) {
      if (known.has(item)) {
        continue;
      }
      const tag = document.createElement("span");
      tag.className = "pc-multi-tag";
      tag.textContent = item;
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "pc-multi-tag-remove";
      remove.textContent = "×";
      remove.addEventListener("click", () => {
        selected.delete(item);
        renderTags();
        syncBoxes();
        emit();
      });
      tag.appendChild(remove);
      tagsWrap.appendChild(tag);
    }
  }

  for (const opt of list) {
    const row = document.createElement("label");
    row.className = "pc-multi-item";
    const box = document.createElement("input");
    box.type = "checkbox";
    box.value = String(opt.value);
    box.checked = selected.has(String(opt.value));
    boxes.push(box);
    box.addEventListener("change", () => {
      const key = String(box.value);
      if (box.checked) {
        selected.add(key);
      } else {
        selected.delete(key);
      }
      emit();
    });
    const text = document.createElement("span");
    text.textContent = opt.label;
    row.appendChild(box);
    row.appendChild(text);
    el.appendChild(row);
  }

  if (freeform) {
    const wrap = document.createElement("div");
    wrap.className = "pc-multi-freeform";
    tagsWrap = document.createElement("div");
    tagsWrap.className = "pc-multi-tags";
    const input = document.createElement("input");
    input.type = "text";
    input.className = "pc-multi-input";
    input.placeholder = zhCN.multiSelectAddPlaceholder;

    function commit() {
      const raw = input.value.trim();
      if (raw === "") {
        return;
      }
      if (selected.has(raw)) {
        input.value = "";
        return;
      }
      selected.add(raw);
      input.value = "";
      renderTags();
      syncBoxes();
      emit();
    }

    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        commit();
      }
    });
    input.addEventListener("blur", commit);

    wrap.appendChild(tagsWrap);
    wrap.appendChild(input);
    el.appendChild(wrap);
    renderTags();
  }

  return el;
}
