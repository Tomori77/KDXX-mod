import { VERSION } from "../generated/VERSION.js";
import { items as officialItems } from "../generated/catalogs.js";
import { zhCN } from "../i18n/zh-CN.js";
import { getState, dispatch, subscribe, reset, undo, redo } from "./store.js";
import { setManifest, setUi, addEntry, removeEntry, updateEntry, setAsset, idOf } from "./actions.js";
import { getRoute, navigate, onRoute } from "./router.js";
import { domainList, domainModules } from "../domains/index.js";
import { createField } from "../controls/field.js";
import { downloadPackage } from "../io/export-mod.js";
import { importArchive, importDomainJson } from "../io/import-mod.js";
import { serializeProject, deserializeProject, projectFileName } from "../io/project-file.js";
import {
  listProjects,
  saveProject,
  loadProject,
  deleteProject,
  getAutosave,
  setAutosave,
  clearAutosave
} from "../io/persistence.js";
import { assessExport } from "../save/impact.js";
import { warnImpact, summarizeForExport } from "../save/notify.js";
import { openAiPanel } from "../ai/panel.js";

function createEl(tag, className, text) {
  const node = document.createElement(tag);
  if (className) {
    node.className = className;
  }
  if (text != null) {
    node.textContent = text;
  }
  return node;
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function readPath(source, path) {
  return path.split(".").reduce((acc, key) => (acc == null ? acc : acc[key]), source);
}

function manifestKey(path) {
  return path.indexOf("manifest.") === 0 ? path.slice("manifest.".length) : path;
}

const ASSET_PICKER_PATHS = {
  items: ["item.iconBasename"],
  enemies: ["portraitImageBasename", "badgeImageBasename"]
};

const assetDeps = {
  getAsset(basename) {
    const content = getState().content;
    const icons = content && content.assets ? content.assets.icons : null;
    return icons ? icons[basename] : undefined;
  },
  setAsset(basename, asset) {
    dispatch(setAsset(basename, asset));
  }
};

function withAssetPicker(domain, descriptors) {
  const paths = ASSET_PICKER_PATHS[domain];
  if (!paths) {
    return descriptors;
  }
  return descriptors.map((descriptor) =>
    paths.includes(descriptor.path)
      ? { ...descriptor, control: "asset-picker", deps: assetDeps }
      : descriptor
  );
}

function dependencyPath(descriptor) {
  if (descriptor.optionsBy) {
    return descriptor.optionsBy;
  }
  if (descriptor.optionsSource && typeof descriptor.optionsSource === "object") {
    const source = descriptor.optionsSource;
    return source.field || source.mapIdPath || source.dependsOn || null;
  }
  return null;
}

function linkedDependencyPaths(descriptors) {
  const paths = new Set();
  for (const descriptor of descriptors) {
    const path = dependencyPath(descriptor);
    if (path) {
      paths.add(path);
    }
  }
  return paths;
}

function mergePatch(base, extra) {
  const out = { ...base };
  for (const key of Object.keys(extra)) {
    if (isPlainObject(base[key]) && isPlainObject(extra[key])) {
      out[key] = mergePatch(base[key], extra[key]);
    } else {
      out[key] = extra[key];
    }
  }
  return out;
}

function prunePatch(patch, source) {
  if (!isPlainObject(patch) || !isPlainObject(source)) {
    return patch;
  }
  const out = {};
  for (const key of Object.keys(patch)) {
    const next = patch[key];
    if (isPlainObject(next) && isPlainObject(source[key])) {
      const pruned = prunePatch(next, source[key]);
      if (Object.keys(pruned).length > 0) {
        out[key] = pruned;
      }
    } else if (next !== undefined) {
      out[key] = next;
    }
  }
  return out;
}

function coerceValue(descriptor, value) {
  if (value == null) {
    return null;
  }
  if (descriptor.control === "select" && Array.isArray(descriptor.options)) {
    const match = descriptor.options.find((option) => {
      const optionValue = option && typeof option === "object" ? option.value : option;
      return String(optionValue) === String(value);
    });
    const optionValue = match && typeof match === "object" ? match.value : match;
    if (typeof optionValue === "number") {
      return Number(value);
    }
  }
  return value;
}

function pathKeys(path) {
  return String(path)
    .replace(/\[\]/g, "")
    .split(".")
    .filter((key) => key.length > 0);
}

export function getByPath(source, path) {
  const keys = pathKeys(path);
  let acc = source;
  for (const key of keys) {
    if (!isPlainObject(acc)) {
      return undefined;
    }
    acc = acc[key];
  }
  return acc;
}

export function setByPath(source, path, value) {
  const keys = pathKeys(path);
  if (keys.length === 0) {
    return null;
  }
  const patch = {};
  let cursor = patch;
  let origin = isPlainObject(source) ? source : {};
  for (let i = 0; i < keys.length - 1; i += 1) {
    const key = keys[i];
    const branch = origin[key];
    if (branch != null && !isPlainObject(branch)) {
      return null;
    }
    cursor[key] = { ...(branch || {}) };
    cursor = cursor[key];
    origin = branch || {};
  }
  cursor[keys[keys.length - 1]] = value;
  return patch;
}

const ITEM_ID_MANUAL_FLAG = Symbol("itemIdManuallyEdited");

function createImeGuardedField(descriptor, value, onChange, context) {
  const textLike = descriptor.control === "text" || descriptor.control === "json";
  let composing = false;
  const guarded = textLike
    ? (next) => {
        if (!composing) {
          onChange(next);
        }
      }
    : onChange;
  const field = createField(descriptor, value, guarded, context);
  if (textLike) {
    field.addEventListener("compositionstart", () => {
      composing = true;
    });
    field.addEventListener("compositionend", () => {
      composing = false;
    });
  }
  return field;
}

function fieldsFor(module, entry) {
  const all = module.fields();
  const mode = entry && entry.mode;
  if (mode == null) {
    return all;
  }
  return all.filter((descriptor) => !Array.isArray(descriptor.modes) || descriptor.modes.includes(mode));
}

function downloadText(text, filename, mime) {
  const blob = new Blob([text], { type: mime || "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

function pickFile(accept) {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = accept;
    input.style.display = "none";
    document.body.appendChild(input);
    let done = false;
    const finish = (value) => {
      if (done) {
        return;
      }
      done = true;
      input.remove();
      resolve(value);
    };
    input.addEventListener("change", () => finish(input.files && input.files[0] ? input.files[0] : null));
    input.addEventListener("cancel", () => finish(null));
    window.addEventListener("focus", () => setTimeout(() => finish(input.files && input.files[0] ? input.files[0] : null), 300), { once: true });
    input.click();
  });
}

function readTextFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
    reader.onerror = () => reject(reader.error || new Error("读取文件失败"));
    reader.readAsText(file);
  });
}

function importStateFrom(result) {
  const content = result && result.content ? result.content : {};
  const manifest = result && result.manifest ? result.manifest : {};
  const previous = getState();
  const next = {
    meta: { ...previous.meta, manifest },
    content: { ...content },
    ui: { activeDomain: "manifest", selectedId: null, dirty: true, warnings: [] }
  };
  reset(next);
}

function currentProjectId() {
  const manifest = getState().meta.manifest;
  const id = manifest && typeof manifest.id === "string" ? manifest.id.trim() : "";
  return id.length > 0 ? id : null;
}

function projectHasContent(project) {
  return Object.keys(project.content || {}).some((key) => {
    if (key === "assets" || key === "unknown") {
      return false;
    }
    const list = project.content[key];
    return Array.isArray(list) && list.length > 0;
  });
}

async function makeSnapshot(project) {
  const id = currentProjectId();
  if (!id || !projectHasContent(project)) {
    return false;
  }
  const stamp = new Date().toISOString();
  const record = await saveProject(id + "@snapshot-" + stamp, project);
  return record !== null;
}

export function bootstrap() {
  if (typeof document === "undefined") {
    return;
  }
  const root = document.getElementById("app");
  if (!root) {
    return;
  }
  root.innerHTML = "";
  root.classList.add("mc-root");

  const state = {
    renderedRoute: undefined,
    renderedIndex: null,
    renderedCount: null,
    renderedMode: undefined,
    selectedRoute: undefined,
    selectedIndex: null,
    activeIndex: null,
    pendingFocusIndex: null,
    validationEl: null,
    validationTarget: null,
    listRows: [],
    navButtons: new Map()
  };

  const shell = createEl("div", "mc-shell");
  shell.style.display = "flex";
  shell.style.flexDirection = "column";
  shell.style.minHeight = "100vh";

  const topbar = createEl("header", "mc-topbar card");
  topbar.style.display = "flex";
  topbar.style.alignItems = "center";
  topbar.style.justifyContent = "space-between";
  topbar.style.margin = "0";
  topbar.style.borderRadius = "0";
  topbar.style.borderLeft = "none";
  topbar.style.borderRight = "none";
  topbar.style.borderTop = "none";

  const brand = createEl("h1", "mc-brand", zhCN.appTitle);
  brand.style.margin = "0";
  const meta = createEl("div", "mc-meta");
  meta.style.display = "flex";
  meta.style.gap = "8px";
  const versionChip = createEl("span", "chip", "SDK " + VERSION.sdkVersion);
  const itemsChip = createEl(
    "span",
    "chip",
    zhCN.officialItems + " " + (Array.isArray(officialItems) ? officialItems.length : 0)
  );
  meta.appendChild(versionChip);
  meta.appendChild(itemsChip);

  const toolbar = createEl("div", "pc-toolbar");
  const importModInput = createEl("input", "pc-toolbar-file");
  importModInput.type = "file";
  importModInput.accept = ".zip";
  importModInput.addEventListener("change", () => {
    const file = importModInput.files && importModInput.files[0];
    importModInput.value = "";
    if (file) {
      handleImportMod(file);
    }
  });

  const importModBtn = createEl("button", "pillbtn pc-toolbar-btn", zhCN.importMod);
  importModBtn.addEventListener("click", () => importModInput.click());

  const exportModBtn = createEl("button", "pillbtn pc-toolbar-btn", zhCN.exportMod);
  exportModBtn.addEventListener("click", handleExportMod);

  const importProjectBtn = createEl("button", "pillbtn pc-toolbar-btn", zhCN.importProject);
  importProjectBtn.addEventListener("click", handleImportProject);

  const exportProjectBtn = createEl("button", "pillbtn pc-toolbar-btn", zhCN.exportProject);
  exportProjectBtn.addEventListener("click", handleExportProject);

  const importDomainBtn = createEl("button", "pillbtn pc-toolbar-btn", zhCN.importDomainJson);
  importDomainBtn.addEventListener("click", handleImportDomainJson);

  const aiDeps = {
    getProject: () => getState(),
    applyProject: (project) => reset(project)
  };
  function openModalPanel(mode) {
    const trigger = document.activeElement;
    const panel = openAiPanel(mode, aiDeps);
    if (!panel) {
      return null;
    }
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-modal", "true");
    panel.setAttribute("aria-label", mode === "diff" ? zhCN.aiDiffTitle : zhCN.aiAdviceTitle);
    panel.tabIndex = -1;
    const overlay = panel.parentNode;
    if (overlay && typeof overlay.setAttribute === "function") {
      overlay.setAttribute("role", "presentation");
    }
    const focusables = panel.querySelectorAll("button, input, textarea, select, a[href], [tabindex]");
    const first = focusables.length > 0 ? focusables[0] : panel;
    setTimeout(() => {
      if (typeof first.focus === "function") {
        first.focus();
      }
    }, 0);
    if (overlay && typeof MutationObserver !== "undefined") {
      const observer = new MutationObserver(() => {
        if (!overlay.isConnected) {
          observer.disconnect();
          if (trigger && typeof trigger.focus === "function") {
            trigger.focus();
          }
        }
      });
      observer.observe(document.body, { childList: true });
    }
    return panel;
  }
  const aiAdviceBtn = createEl("button", "pillbtn pc-toolbar-btn", zhCN.aiAdvice);
  aiAdviceBtn.addEventListener("click", () => openModalPanel("advice"));
  const aiDiffBtn = createEl("button", "pillbtn pc-toolbar-btn", zhCN.aiDiff);
  aiDiffBtn.addEventListener("click", () => openModalPanel("diff"));

  const newProjectBtn = createEl("button", "pillbtn pc-toolbar-btn pc-project-new", zhCN.newProject);
  newProjectBtn.addEventListener("click", handleNewProject);

  const openProjectBtn = createEl("button", "pillbtn pc-toolbar-btn pc-project-open", zhCN.openProject);
  openProjectBtn.addEventListener("click", handleOpenProject);

  const saveAsProjectBtn = createEl("button", "pillbtn pc-toolbar-btn pc-project-saveas", zhCN.saveAsProject);
  saveAsProjectBtn.addEventListener("click", handleSaveAsProject);

  const deleteProjectBtn = createEl("button", "pillbtn pc-toolbar-btn pc-project-delete", zhCN.deleteProject);
  deleteProjectBtn.addEventListener("click", handleDeleteProject);

  toolbar.appendChild(newProjectBtn);
  toolbar.appendChild(openProjectBtn);
  toolbar.appendChild(saveAsProjectBtn);
  toolbar.appendChild(deleteProjectBtn);
  toolbar.appendChild(importModBtn);
  toolbar.appendChild(exportModBtn);
  toolbar.appendChild(importProjectBtn);
  toolbar.appendChild(exportProjectBtn);
  toolbar.appendChild(importDomainBtn);
  toolbar.appendChild(aiAdviceBtn);
  toolbar.appendChild(aiDiffBtn);
  toolbar.appendChild(importModInput);

  topbar.appendChild(brand);
  topbar.appendChild(meta);
  topbar.appendChild(toolbar);

  const body = createEl("div", "mc-body");
  body.style.display = "flex";
  body.style.flex = "1";
  body.style.alignItems = "stretch";
  body.style.gap = "0";

  const nav = createEl("nav", "mc-nav");
  nav.setAttribute("role", "navigation");
  nav.setAttribute("aria-label", zhCN.navLabel);
  nav.style.minWidth = "180px";
  nav.style.padding = "12px";
  nav.style.borderRight = "1px solid var(--line)";

  const main = createEl("main", "mc-main");
  main.setAttribute("role", "main");
  main.setAttribute("aria-label", zhCN.mainLabel);
  main.style.flex = "1";
  main.style.padding = "16px";

  for (const domain of domainList) {
    const button = createEl("button", "pillbtn mc-nav-item", domain.labelZh);
    button.style.display = "block";
    button.style.width = "100%";
    button.style.margin = "0 0 8px";
    button.style.textAlign = "left";
    if (!domain.available) {
      button.disabled = true;
      button.style.opacity = "0.4";
      button.style.cursor = "not-allowed";
    } else {
      button.addEventListener("click", () => {
        navigate(domain.key);
      });
    }
    state.navButtons.set(domain.key, button);
    nav.appendChild(button);
  }

  const keyHint = createEl("p", "pc-key-hint", zhCN.hintKeys);
  keyHint.setAttribute("role", "note");
  nav.appendChild(keyHint);

  body.appendChild(nav);
  body.appendChild(main);
  shell.appendChild(topbar);
  shell.appendChild(body);
  root.appendChild(shell);

  function updateNav(route) {
    for (const [key, button] of state.navButtons) {
      const active = key === route;
      button.classList.toggle("is-active", active);
      if (active) {
        button.setAttribute("aria-current", "page");
      } else {
        button.removeAttribute("aria-current");
      }
      button.style.background = active ? "var(--jin)" : "var(--mo3)";
      button.style.color = active ? "var(--mo)" : "var(--jin-hi)";
    }
  }

  function domainEntries(domain) {
    const content = getState().content;
    const list = content && content[domain];
    return Array.isArray(list) ? list : [];
  }

  function syncSelectedId(route, list, index) {
    const entry = index == null ? null : list[index];
    const id = entry ? idOf(entry, route) : null;
    if (getState().ui.selectedId !== id) {
      dispatch(setUi({ selectedId: id == null ? null : id }));
    }
  }

  function selectRow(domain, list, index) {
    state.selectedRoute = domain;
    state.selectedIndex = index;
    state.activeIndex = index;
    syncSelectedId(domain, list, index);
    render();
  }

  function removeRowByIndex(domain, list, index, needsConfirm) {
    const selected = list[index];
    if (!selected) {
      return;
    }
    if (needsConfirm && !window.confirm(zhCN.removeEntryConfirm)) {
      return;
    }
    dispatch(removeEntry(domain, idOf(selected, domain)));
    const nextList = domainEntries(domain);
    state.selectedIndex = nextList.length === 0 ? null : Math.min(index, nextList.length - 1);
    state.activeIndex = state.selectedIndex;
    syncSelectedId(domain, nextList, state.selectedIndex);
    state.pendingFocusIndex = state.selectedIndex;
    render();
  }

  function resolveSelection(route) {
    const list = domainEntries(route);
    if (state.selectedRoute !== route) {
      state.selectedRoute = route;
      state.selectedIndex = list.length > 0 ? 0 : null;
      return state.selectedIndex;
    }
    if (state.selectedIndex != null && state.selectedIndex >= list.length) {
      state.selectedIndex = list.length > 0 ? list.length - 1 : null;
    }
    return state.selectedIndex;
  }

  function resolveActiveIndex(route, list) {
    if (list.length === 0) {
      state.activeIndex = null;
      return null;
    }
    if (state.selectedRoute === route && state.selectedIndex != null && state.selectedIndex < list.length) {
      state.activeIndex = state.selectedIndex;
      return state.activeIndex;
    }
    if (state.activeIndex == null || state.activeIndex >= list.length) {
      state.activeIndex = 0;
    }
    return state.activeIndex;
  }

  function refreshValidation() {
    if (!state.validationEl || !state.validationTarget) {
      return;
    }
    renderValidation(state.validationEl, state.validationTarget.module, state.validationTarget.entry);
  }

  function refreshList() {
    if (state.listRows.length === 0) {
      return;
    }
    const module = state.validationTarget ? state.validationTarget.module : null;
    if (!module) {
      return;
    }
    for (const row of state.listRows) {
      row.label.textContent = module.summarize(row.entry);
    }
  }

  function validationRow(kind, issue) {
    const item = createEl("li", "pc-validate-" + kind);
    const prefix = kind === "warning" ? zhCN.validationWarning : zhCN.validationError;
    item.textContent = prefix + " · " + (issue.path || "") + "：" + issue.messageZh;
    return item;
  }

  function renderValidation(container, module, entry) {
    container.innerHTML = "";
    container.setAttribute("role", "status");
    container.setAttribute("aria-live", "polite");
    container.setAttribute("aria-label", zhCN.validationTitle);
    container.appendChild(createEl("h3", null, zhCN.validationTitle));
    if (entry == null) {
      container.appendChild(createEl("p", "pc-validate-empty", zhCN.validationNoSelection));
      return;
    }
    const results = module.validateEntry(entry);
    if (results.length === 0) {
      container.appendChild(createEl("p", "pc-validate-ok", zhCN.validationOk));
      return;
    }
    const errors = results.filter((issue) => issue.severity !== "warning");
    const warnings = results.filter((issue) => issue.severity === "warning");
    const list = createEl("ul", "pc-validate-list");
    for (const issue of errors) {
      list.appendChild(validationRow("error", issue));
    }
    for (const issue of warnings) {
      list.appendChild(validationRow("warning", issue));
    }
    container.appendChild(list);
  }

  function renderManifest(container, manifestModule) {
    const data = getState().meta.manifest;
    const fieldsWrap = createEl("div", "mc-fields");
    for (const descriptor of manifestModule.fields()) {
      const value = readPath(data, descriptor.path);
      const field = createImeGuardedField(descriptor, value, (next) => {
        dispatch(setManifest({ [manifestKey(descriptor.path)]: coerceValue(descriptor, next) }));
      });
      fieldsWrap.appendChild(field);
    }
    container.appendChild(fieldsWrap);

    state.validationTarget = { module: manifestModule, entry: data };
    state.validationEl = createEl("div", "mc-validation card");
    container.appendChild(state.validationEl);
    refreshValidation();
  }

  function renderDomain(container, domain, domainEntry, index) {
    const module = domainEntry.module;
    const list = domainEntries(domain);
    const selected = index == null ? null : list[index] || null;

    const titleCard = createEl("div", "card pc-domain-header");
    titleCard.appendChild(createEl("h2", null, domainEntry.labelZh));

    const toolbar = createEl("div", "pc-domain-toolbar");
    const addBtn = createEl("button", "pillbtn pc-domain-add", zhCN.addEntry);
    addBtn.addEventListener("click", () => {
      const entry = domain === "items" ? module.createEntry({ existingEntries: domainEntries("items") }) : module.createEntry();
      dispatch(addEntry(domain, entry));
      state.selectedRoute = domain;
      state.selectedIndex = domainEntries(domain).length - 1;
      state.activeIndex = state.selectedIndex;
      state.pendingFocusIndex = state.selectedIndex;
      syncSelectedId(domain, domainEntries(domain), state.selectedIndex);
      render();
    });
    const removeBtn = createEl("button", "pillbtn pc-domain-remove", zhCN.removeEntry);
    removeBtn.disabled = !selected;
    removeBtn.addEventListener("click", () => {
      if (!selected) {
        return;
      }
      removeRowByIndex(domain, list, index, true);
    });
    toolbar.appendChild(addBtn);
    toolbar.appendChild(removeBtn);
    titleCard.appendChild(toolbar);
    container.appendChild(titleCard);

    const listCard = createEl("div", "card pc-domain-list-card");
    listCard.appendChild(createEl("h3", null, zhCN.entryListTitle));
    state.listRows = [];
    if (list.length === 0) {
      listCard.appendChild(createEl("p", "pc-entry-empty", zhCN.entryEmpty));
    } else {
      const ul = createEl("ul", "pc-domain-list");
      ul.setAttribute("role", "listbox");
      ul.setAttribute("aria-label", zhCN.listboxLabel);
      const activeIndex = resolveActiveIndex(domain, list);
      list.forEach((entry, rowIndex) => {
        const li = createEl("li", "pc-entry-item");
        li.setAttribute("role", "option");
        const isSelected = rowIndex === index;
        const isActive = rowIndex === activeIndex;
        li.tabIndex = isActive ? 0 : -1;
        li.classList.toggle("selected", isSelected);
        li.classList.toggle("is-focus", isActive);
        li.setAttribute("aria-selected", isSelected ? "true" : "false");
        const label = createEl("span", "pc-entry-label", module.summarize(entry));
        li.appendChild(label);
        li.addEventListener("click", () => {
          selectRow(domain, list, rowIndex);
        });
        li.addEventListener("keydown", (event) => {
          if (event.key === "Enter" || event.key === " " || event.key === "Spacebar") {
            event.preventDefault();
            state.pendingFocusIndex = rowIndex;
            selectRow(domain, list, rowIndex);
            return;
          }
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            if (list.length === 0) {
              return;
            }
            event.preventDefault();
            const delta = event.key === "ArrowDown" ? 1 : -1;
            const next = Math.max(0, Math.min(list.length - 1, rowIndex + delta));
            if (next === state.activeIndex) {
              return;
            }
            const rows = state.listRows;
            if (next !== rowIndex && rows[rowIndex]) {
              rows[rowIndex].li.tabIndex = -1;
              rows[rowIndex].li.classList.remove("is-focus");
            }
            if (rows[next]) {
              rows[next].li.tabIndex = 0;
              rows[next].li.classList.add("is-focus");
            }
            state.activeIndex = next;
            state.pendingFocusIndex = next;
            selectRow(domain, list, next);
            return;
          }
          if (event.key === "Delete") {
            event.preventDefault();
            removeRowByIndex(domain, list, rowIndex, true);
          }
        });
        state.listRows.push({ entry, label, li });
        ul.appendChild(li);
      });
      listCard.appendChild(ul);
      if (state.pendingFocusIndex != null) {
        const focusRow = state.listRows[state.pendingFocusIndex];
        state.pendingFocusIndex = null;
        if (focusRow) {
          setTimeout(() => focusRow.li.focus(), 0);
        }
      }
    }
    container.appendChild(listCard);

    if (!selected) {
      return;
    }

    const fieldsCard = createEl("div", "card pc-domain-fields");
    fieldsCard.appendChild(createEl("h3", null, module.summarize(selected)));
    const fieldsWrap = createEl("div", "mc-fields");
    const descriptors = withAssetPicker(domain, fieldsFor(module, selected));
    const linkedPaths = linkedDependencyPaths(descriptors);
    const fieldContext = {
      getValue: (path) => getByPath(selected, path),
      deps: assetDeps
    };
    for (const descriptor of descriptors) {
      const value = getByPath(selected, descriptor.path);
      const field = createImeGuardedField(descriptor, value, (next) => {
        let patch = setByPath(selected, descriptor.path, next);
        if (!patch) {
          return;
        }
        if (domain === "items" && descriptor.path === "item.category") {
          if (!selected[ITEM_ID_MANUAL_FLAG]) {
            patch = mergePatch(patch, { item: { numericId: module.nextNumericId(domainEntries("items"), next) } });
          }
          state.renderedIndex = undefined;
        }
        if (domain === "items" && descriptor.path === "item.numericId") {
          selected[ITEM_ID_MANUAL_FLAG] = true;
          state.renderedIndex = undefined;
        }
        if (linkedPaths.has(descriptor.path)) {
          for (const linked of descriptors) {
            if (dependencyPath(linked) !== descriptor.path) {
              continue;
            }
            const linkedPatch = prunePatch(setByPath(selected, linked.path, undefined), selected);
            if (Object.keys(linkedPatch).length > 0) {
              patch = mergePatch(patch, linkedPatch);
            }
          }
        }
        dispatch(updateEntry(domain, idOf(selected, domain), patch));
      }, fieldContext);
      fieldsWrap.appendChild(field);
    }
    fieldsCard.appendChild(fieldsWrap);
    container.appendChild(fieldsCard);

    state.validationTarget = { module, entry: selected };
    state.validationEl = createEl("div", "mc-validation card pc-validate");
    container.appendChild(state.validationEl);
    refreshValidation();
  }

  function renderHome(container) {
    const card = createEl("div", "card");
    card.appendChild(createEl("h2", null, zhCN.appTitle));
    card.appendChild(createEl("p", null, zhCN.skeletonReady));
    const count = Array.isArray(officialItems) ? officialItems.length : 0;
    card.appendChild(createEl("p", null, zhCN.officialItems + "：" + count));
    card.appendChild(createEl("p", null, zhCN.homePickDomain));
    container.appendChild(card);
  }

  function renderMain(route, index) {
    main.innerHTML = "";
    state.validationEl = null;
    state.validationTarget = null;
    state.listRows = [];
    if (route == null) {
      renderHome(main);
      return;
    }
    const domainEntry = domainList.find((domain) => domain.key === route);
    if (!domainEntry || !domainEntry.available || !domainEntry.module) {
      const card = createEl("div", "card");
      card.appendChild(createEl("h2", null, domainEntry ? domainEntry.labelZh : String(route)));
      card.appendChild(createEl("p", null, zhCN.domainUnavailable));
      main.appendChild(card);
      return;
    }
    if (route === "manifest") {
      const card = createEl("div", "card");
      card.appendChild(createEl("h2", null, domainEntry.labelZh));
      main.appendChild(card);
      renderManifest(main, domainEntry.module);
      return;
    }
    renderDomain(main, route, domainEntry, index);
  }

  function render() {
    const route = getRoute();
    updateNav(route);
    const domainEntry = domainList.find((domain) => domain.key === route);
    const generic = route != null && route !== "manifest" && domainEntry && domainEntry.available;

    let index = null;
    let count = 0;
    let mode = undefined;
    if (domainEntry && domainEntry.available && route === "manifest") {
      count = 1;
    } else if (generic) {
      const list = domainEntries(route);
      count = list.length;
      index = resolveSelection(route);
      const selected = index == null ? null : list[index] || null;
      mode = selected && selected.mode;
    }

    const changed =
      route !== state.renderedRoute ||
      index !== state.renderedIndex ||
      count !== state.renderedCount ||
      mode !== state.renderedMode;

    if (changed) {
      state.renderedRoute = route;
      state.renderedIndex = index;
      state.renderedCount = count;
      state.renderedMode = mode;
      renderMain(route, index);
    } else {
      state.pendingFocusIndex = null;
      refreshList();
      refreshValidation();
    }
  }

  function importableDomains() {
    return Object.keys(getState().content).filter((key) => key !== "assets" && key !== "unknown");
  }

  function chooseDomain() {
    const domains = importableDomains();
    const lines = domains.map((key, index) => index + 1 + ". " + key).join("\n");
    const answer = window.prompt(zhCN.selectDomain + "\n" + lines, "1");
    if (answer == null) {
      return null;
    }
    const trimmed = answer.trim();
    if (domains.includes(trimmed)) {
      return trimmed;
    }
    const index = Number(trimmed);
    if (Number.isInteger(index) && index >= 1 && index <= domains.length) {
      return domains[index - 1];
    }
    return null;
  }

  function chooseProject(records, promptText) {
    if (records.length === 0) {
      window.alert(zhCN.projectListEmpty);
      return null;
    }
    const lines = records
      .map((record, index) => index + 1 + ". " + record.name + "（" + record.id + "） · " + record.updatedAt)
      .join("\n");
    const answer = window.prompt(promptText + "\n" + lines, "1");
    if (answer == null) {
      return null;
    }
    const trimmed = answer.trim();
    const byId = records.find((record) => record.id === trimmed);
    if (byId) {
      return byId.id;
    }
    const index = Number(trimmed);
    if (Number.isInteger(index) && index >= 1 && index <= records.length) {
      return records[index - 1].id;
    }
    return null;
  }

  async function handleNewProject() {
    if (projectHasContent(getState()) && !window.confirm(zhCN.newProjectConfirm)) {
      return;
    }
    const id = currentProjectId();
    if (id) {
      await saveProject(id, getState());
    }
    reset();
    await clearAutosave();
    window.alert(zhCN.newProjectDone);
  }

  async function handleOpenProject() {
    const currentId = currentProjectId();
    if (currentId && projectHasContent(getState())) {
      await saveProject(currentId, getState());
    }
    const records = await listProjects();
    const chosen = chooseProject(records, zhCN.openProjectPrompt);
    if (!chosen) {
      return;
    }
    const project = await loadProject(chosen);
    if (!project) {
      window.alert(zhCN.projectLoadFailed);
      return;
    }
    reset(project);
    window.alert(zhCN.projectLoaded);
  }

  async function handleSaveAsProject() {
    const project = getState();
    const suggested = currentProjectId() || "";
    const answer = window.prompt(zhCN.saveAsProjectPrompt, suggested);
    if (answer == null) {
      return;
    }
    const id = answer.trim();
    if (!id) {
      return;
    }
    const record = await saveProject(id, project);
    if (!record) {
      window.alert(zhCN.projectSaveFailed);
      return;
    }
    dispatch(setManifest({ id }));
    window.alert(zhCN.projectSaved);
  }

  async function handleDeleteProject() {
    const records = await listProjects();
    const chosen = chooseProject(records, zhCN.deleteProjectPrompt);
    if (!chosen) {
      return;
    }
    const record = records.find((item) => item.id === chosen);
    const label = record ? record.name + "（" + record.id + "）" : chosen;
    if (!window.confirm(zhCN.deleteProjectConfirm + "：" + label)) {
      return;
    }
    await deleteProject(chosen);
    window.alert(zhCN.projectDeleted);
  }

  async function snapshotSafely() {
    try {
      await makeSnapshot(getState());
    } catch {
      void 0;
    }
  }

  async function handleImportMod(file) {
    await snapshotSafely();
    try {
      const result = await importArchive(file);
      const warnings = Array.isArray(result.warnings) ? result.warnings : [];
      importStateFrom(result);
      importModInput.value = "";
      const base = zhCN.importSuccess;
      window.alert(warnings.length > 0 ? base + "；" + zhCN.importWarnings + "：" + warnings.length : base);
    } catch (error) {
      window.alert(zhCN.importFailed + "：" + (error && error.message ? error.message : String(error)));
    }
  }

  async function handleImportDomainJson() {
    const domain = chooseDomain();
    if (domain == null) {
      return;
    }
    const file = await pickFile(".json,application/json");
    if (!file) {
      return;
    }
    await snapshotSafely();
    try {
      const entry = await importDomainJson(file, domain);
      if (entry && typeof entry === "object" && !Array.isArray(entry)) {
        dispatch(addEntry(domain, entry));
      }
      window.alert(zhCN.importSuccess);
    } catch (error) {
      window.alert(zhCN.importFailed + "：" + (error && error.message ? error.message : String(error)));
    }
  }

  function confirmExport(assessment) {
    const text = summarizeForExport(getState()).text;
    const body = zhCN.exportConfirmBody + "\n" + text;
    return window.confirm(zhCN.exportConfirmTitle + "\n" + body);
  }

  async function handleExportMod() {
    const project = getState();
    const assessment = assessExport(project);
    if (assessment.level !== "compatible" && !confirmExport(assessment)) {
      return;
    }
    await snapshotSafely();
    try {
      await downloadPackage(project);
    } catch (error) {
      window.alert(zhCN.exportFailed + "：" + (error && error.message ? error.message : String(error)));
    }
  }

  async function handleExportProject() {
    const project = getState();
    await snapshotSafely();
    try {
      const text = await serializeProject(project);
      downloadText(text, projectFileName(project), "application/json");
    } catch (error) {
      window.alert(zhCN.exportFailed + "：" + (error && error.message ? error.message : String(error)));
    }
  }

  async function handleImportProject() {
    const file = await pickFile(".json,application/json");
    if (!file) {
      return;
    }
    await snapshotSafely();
    try {
      const text = await readTextFile(file);
      const project = await deserializeProject(text);
      importStateFrom({ manifest: project.meta ? project.meta.manifest : {}, content: project.content });
      window.alert(zhCN.importSuccess);
    } catch (error) {
      window.alert(zhCN.importFailed + "：" + (error && error.message ? error.message : String(error)));
    }
  }

  const AUTOSAVE_DEBOUNCE_MS = 1500;
  let autosaveTimer = null;
  let autosaveSignature = null;

  function projectSignature(project) {
    try {
      return JSON.stringify({ meta: project.meta, content: project.content });
    } catch {
      return null;
    }
  }

  function scheduleAutosave() {
    if (autosaveTimer !== null) {
      clearTimeout(autosaveTimer);
    }
    autosaveTimer = setTimeout(async () => {
      autosaveTimer = null;
      const project = getState();
      const signature = projectSignature(project);
      if (signature !== null && signature === autosaveSignature) {
        return;
      }
      const saved = await setAutosave(project);
      if (saved) {
        autosaveSignature = signature;
      }
    }, AUTOSAVE_DEBOUNCE_MS);
  }

  async function restoreAutosave() {
    let project;
    try {
      project = await getAutosave();
    } catch {
      project = null;
    }
    if (!project || !projectHasContent(project)) {
      return;
    }
    if (!window.confirm(zhCN.restoreAutosave)) {
      await clearAutosave();
      return;
    }
    autosaveSignature = projectSignature(project);
    reset(project);
    window.alert(zhCN.autosaveRestored);
  }

  let lastImpactLevel = null;
  function refreshImpact() {
    const project = getState();
    const assessment = assessExport(project);
    const hasContent = projectHasContent(project);
    if (!hasContent || assessment.level === "compatible") {
      if (lastImpactLevel !== null) {
        warnImpact(null);
        lastImpactLevel = null;
      }
      return;
    }
    if (assessment.level !== lastImpactLevel) {
      lastImpactLevel = assessment.level;
    }
    warnImpact(assessment);
  }

  function isEditableTarget(target) {
    if (!target || typeof target.tagName !== "string") {
      return false;
    }
    const tag = target.tagName.toLowerCase();
    if (tag === "input" || tag === "textarea" || tag === "select") {
      return true;
    }
    return target.isContentEditable === true;
  }

  function onGlobalKeyDown(event) {
    if (event.defaultPrevented) {
      return;
    }
    if (!(event.ctrlKey || event.metaKey) || event.altKey) {
      return;
    }
    const key = typeof event.key === "string" ? event.key.toLowerCase() : "";
    if (key !== "z" && key !== "y") {
      return;
    }
    if (key === "y" || event.shiftKey) {
      event.preventDefault();
      redo();
      return;
    }
    if (key === "z" && !isEditableTarget(event.target)) {
      event.preventDefault();
      undo();
    }
  }

  document.addEventListener("keydown", onGlobalKeyDown);

  let autosaveReady = false;
  subscribe(() => {
    render();
    refreshImpact();
    if (autosaveReady) {
      scheduleAutosave();
    }
  });
  onRoute(render);
  render();
  restoreAutosave().finally(() => {
    autosaveReady = true;
  });
}

try {
  bootstrap();
} catch (error) {
  const root = document.getElementById("app");
  if (root) {
    root.textContent =
      zhCN.startupError + "：" + (error && error.message ? error.message : String(error));
  }
}
