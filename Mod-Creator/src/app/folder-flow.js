import { zhCN } from "../i18n/zh-CN.js";
import { importFiles } from "../io/import-mod.js";
import { serializeProject, deserializeProject, projectFileName } from "../io/project-file.js";
import { buildPackage } from "../io/export-mod.js";

let activeCopy = null;

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

function clear(node) {
  node.textContent = "";
}

function errorText(prefix, error) {
  const detail =
    error && error.messageZh ? error.messageZh : error && error.message ? error.message : String(error);
  return prefix ? prefix + "：" + detail : String(detail);
}

function baseName(path) {
  return String(path || "")
    .replace(/[\\/]+$/, "")
    .split(/[\\/]/)
    .pop();
}

function detectKind(files) {
  const list = Array.isArray(files) ? files : [];
  if (list.some((file) => String(file.path).replace(/\\/g, "/") === "manifest.json")) {
    return "mod";
  }
  if (list.some((file) => /\.modcreator\.json$/i.test(String(file.path)))) {
    return "project";
  }
  return "unknown";
}

function textOf(service, entry) {
  if (typeof entry.content === "string") {
    return entry.content;
  }
  const converted = service.toFileEntries([entry])[0];
  const bytes = converted ? converted.content : null;
  if (typeof bytes === "string") {
    return bytes;
  }
  if (bytes instanceof Uint8Array) {
    return new TextDecoder("utf-8").decode(bytes);
  }
  return "";
}

function mountModal(className, title, opts) {
  const options = opts && typeof opts === "object" ? opts : {};
  const overlay = createEl("div", className + "-overlay");
  const panel = createEl("div", className);
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-modal", "true");
  overlay.appendChild(panel);

  const header = createEl("div", className + "-header");
  header.appendChild(createEl("h3", className + "-title", title));
  const closeBtn = createEl("button", "pc-btn " + className + "-close", options.closeLabel || zhCN.folder.close);
  header.appendChild(closeBtn);
  panel.appendChild(header);

  let closed = false;
  function close(result) {
    if (closed) {
      return;
    }
    closed = true;
    overlay.remove();
    document.removeEventListener("keydown", onKeyDown);
    if (typeof options.onClose === "function") {
      options.onClose(result);
    }
  }
  function onKeyDown(event) {
    if (event.key === "Escape") {
      event.preventDefault();
      close(null);
    }
  }
  closeBtn.addEventListener("click", () => close(null));
  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) {
      close(null);
    }
  });
  document.addEventListener("keydown", onKeyDown);
  document.body.appendChild(overlay);
  return { overlay, panel, close, isClosed: () => closed };
}

function statusLabel(status) {
  if (status === "added") {
    return zhCN.merge.added;
  }
  if (status === "modified") {
    return zhCN.merge.modified;
  }
  if (status === "removed") {
    return zhCN.merge.removed;
  }
  return String(status || "");
}

function changeList(changed) {
  const box = createEl("div", "pc-merge-changes");
  const list = Array.isArray(changed) ? changed : [];
  if (list.length === 0) {
    box.appendChild(createEl("p", "pc-merge-empty", zhCN.merge.noChanges));
    return box;
  }
  for (const status of ["added", "modified", "removed"]) {
    const items = list.filter((item) => item && item.status === status);
    if (items.length === 0) {
      continue;
    }
    const group = createEl("div", "pc-merge-group");
    group.appendChild(createEl("h4", "pc-merge-group-title", statusLabel(status) + "（" + items.length + "）"));
    const ul = createEl("ul", "pc-merge-list");
    for (const item of items) {
      ul.appendChild(createEl("li", "pc-merge-item", String(item.path || "")));
    }
    group.appendChild(ul);
    box.appendChild(group);
  }
  return box;
}

function pathRow(label, value) {
  const row = createEl("div", "pc-merge-pathrow");
  row.appendChild(createEl("span", "pc-merge-pathlabel", label));
  row.appendChild(createEl("code", "pc-merge-pathvalue", String(value || "")));
  return row;
}

function showMergeModal(ctx, report) {
  const modal = mountModal("pc-merge", zhCN.merge.title, { closeLabel: zhCN.merge.close });
  const panel = modal.panel;
  panel.appendChild(createEl("p", "pc-merge-summary", report.summaryZh || ""));
  panel.appendChild(pathRow(zhCN.merge.workingPath, report.workingPath));
  panel.appendChild(pathRow(zhCN.merge.sourcePath, report.sourcePath));
  panel.appendChild(changeList(report.changed));

  const howto = createEl("div", "pc-merge-howto");
  howto.appendChild(createEl("h4", null, zhCN.merge.howToTitle));
  const text = String(zhCN.merge.howTo || "")
    .replace("{working}", String(report.workingPath || ""))
    .replace("{source}", String(report.sourcePath || ""));
  howto.appendChild(createEl("pre", "pc-merge-howto-text", text));
  panel.appendChild(howto);

  const actions = createEl("div", "pc-merge-actions");
  const okBtn = createEl("button", "pc-btn pc-merge-ok", zhCN.merge.close);
  okBtn.addEventListener("click", () => modal.close());
  actions.appendChild(okBtn);
  panel.appendChild(actions);
}

async function openFolderPicker(ctx, options) {
  const opts = options && typeof options === "object" ? options : {};
  if (!ctx.service || typeof ctx.service.browse !== "function") {
    ctx.notify(zhCN.copy.notAvailable);
    return null;
  }

  let roots;
  try {
    roots = await ctx.service.getRoots();
  } catch (error) {
    ctx.notify(errorText(zhCN.folder.rootsFailed, error));
    return null;
  }

  return new Promise((resolve) => {
    let settled = false;
    let current = "";
    let lastData = null;

    const modal = mountModal("pc-folder-picker", opts.title || zhCN.folder.pickerTitle, {
      closeLabel: zhCN.folder.close,
      onClose: (result) => {
        if (!settled) {
          settled = true;
          resolve(result || null);
        }
      }
    });
    const panel = modal.panel;

    const drivesBox = createEl("div", "pc-folder-picker-drives");
    const drives = Array.isArray(roots.drives) ? roots.drives : [];
    for (const drive of drives) {
      const driveBtn = createEl("button", "pc-btn pc-folder-picker-drive", drive);
      driveBtn.type = "button";
      driveBtn.addEventListener("click", () => load(drive));
      drivesBox.appendChild(driveBtn);
    }
    panel.appendChild(drivesBox);

    const pathRow = createEl("div", "pc-folder-picker-pathrow");
    const upBtn = createEl("button", "pc-btn pc-folder-picker-up", zhCN.folder.up);
    upBtn.type = "button";
    const pathInput = createEl("input", "pc-folder-picker-path");
    pathInput.type = "text";
    pathInput.placeholder = zhCN.folder.pathPlaceholder;
    const goBtn = createEl("button", "pc-btn pc-folder-picker-go", zhCN.folder.go);
    goBtn.type = "button";
    pathRow.appendChild(upBtn);
    pathRow.appendChild(pathInput);
    pathRow.appendChild(goBtn);
    panel.appendChild(pathRow);

    const listBox = createEl("div", "pc-folder-picker-list");
    panel.appendChild(listBox);

    const errorEl = createEl("p", "pc-folder-picker-error");
    errorEl.hidden = true;
    panel.appendChild(errorEl);

    const actions = createEl("div", "pc-folder-picker-actions");
    const chooseBtn = createEl("button", "pc-btn pc-folder-picker-choose", zhCN.folder.choose);
    const cancelBtn = createEl("button", "pc-btn pc-folder-picker-cancel", zhCN.folder.cancel);
    actions.appendChild(chooseBtn);
    actions.appendChild(cancelBtn);
    panel.appendChild(actions);

    function setError(message) {
      if (message) {
        errorEl.textContent = message;
        errorEl.hidden = false;
      } else {
        errorEl.textContent = "";
        errorEl.hidden = true;
      }
    }

    function renderDirs(data) {
      clear(listBox);
      const dirs = Array.isArray(data.dirs) ? data.dirs : [];
      if (dirs.length === 0) {
        listBox.appendChild(createEl("p", "pc-folder-picker-empty", zhCN.folder.empty));
        return;
      }
      for (const dir of dirs) {
        const dirBtn = createEl("button", "pc-folder-picker-dir", dir.name);
        dirBtn.type = "button";
        dirBtn.addEventListener("click", () => load(dir.path));
        listBox.appendChild(dirBtn);
      }
    }

    async function load(path) {
      setError("");
      clear(listBox);
      listBox.appendChild(createEl("p", "pc-folder-picker-loading", zhCN.folder.loading));
      try {
        const data = await ctx.service.browse(path);
        current = data.path;
        lastData = data;
        pathInput.value = data.path;
        renderDirs(data);
      } catch (error) {
        clear(listBox);
        setError(errorText(zhCN.folder.loadFailed, error));
      }
    }

    upBtn.addEventListener("click", () => {
      if (lastData && lastData.parent) {
        load(lastData.parent);
      }
    });
    goBtn.addEventListener("click", () => load(pathInput.value.trim()));
    pathInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        load(pathInput.value.trim());
      }
    });
    chooseBtn.addEventListener("click", () => {
      if (current) {
        modal.close(current);
      }
    });
    cancelBtn.addEventListener("click", () => modal.close(null));

    load(roots.workspaceRoot);
  });
}

async function loadWorkingCopy(ctx, result, kindHint) {
  const files = Array.isArray(result.files) ? result.files : [];
  const kind =
    result.kind && result.kind !== "unknown" ? result.kind : detectKind(files) || kindHint || "unknown";
  if (kind === "mod") {
    let imported;
    try {
      imported = importFiles(ctx.service.toFileEntries(files));
    } catch (error) {
      ctx.notify(errorText(zhCN.copy.importFailed, error));
      return false;
    }
    if (Array.isArray(imported.errors) && imported.errors.length > 0) {
      ctx.notify(errorText(zhCN.copy.importFailed, imported.errors[0]));
      return false;
    }
    const current = ctx.getProject();
    ctx.applyProject({
      meta: { ...current.meta, manifest: imported.manifest },
      content: imported.content
    });
    return true;
  }
  if (kind === "project") {
    const file = files.find((entry) => /\.modcreator\.json$/i.test(String(entry.path)));
    if (!file) {
      ctx.notify(zhCN.copy.unknownKind);
      return false;
    }
    try {
      const project = await deserializeProject(textOf(ctx.service, file));
      ctx.applyProject(project);
      return true;
    } catch (error) {
      ctx.notify(errorText(zhCN.copy.importFailed, error));
      return false;
    }
  }
  ctx.notify(zhCN.copy.unknownKind);
  return false;
}

async function importWorkingCopy(ctx, kindHint) {
  const source = await openFolderPicker(ctx, { title: zhCN.importFolder });
  if (!source) {
    return null;
  }
  const answer = ctx.prompt(zhCN.copy.namePrompt, baseName(source));
  if (answer == null) {
    return null;
  }
  const name = String(answer).trim();
  if (!name) {
    return null;
  }
  let result;
  try {
    result = await ctx.service.importFolder(source, { name });
  } catch (error) {
    ctx.notify(errorText(zhCN.copy.importFailed, error));
    return null;
  }
  const loaded = await loadWorkingCopy(ctx, result, kindHint);
  if (!loaded) {
    return null;
  }
  activeCopy = {
    name: result.name,
    kind: result.kind && result.kind !== "unknown" ? result.kind : detectKind(result.files),
    sourcePath: result.sourcePath,
    workshop: result.workshop || null
  };
  ctx.refreshUi();
  ctx.notify(zhCN.copy.importSuccess + "：" + activeCopy.name);
  return result;
}

async function saveWorkingCopy(ctx) {
  if (!activeCopy) {
    ctx.notify(zhCN.copy.noActive);
    return false;
  }
  const project = ctx.getProject();
  try {
    if (activeCopy.kind === "project") {
      const text = await serializeProject(project);
      const files = [{ path: projectFileName(project), content: text }];
      await ctx.service.saveProject(activeCopy.name, ctx.service.toServiceFiles(files));
    } else {
      const result = await buildPackage(project);
      if (Array.isArray(result.errors) && result.errors.length > 0) {
        ctx.notify(errorText(zhCN.copy.saveFailed, result.errors[0]));
        return false;
      }
      const manifest = project && project.meta ? project.meta.manifest : null;
      const modId = manifest && typeof manifest.id === "string" ? manifest.id : "";
      const prefix = modId ? modId + "/" : "";
      const files = (result.files || []).map((file) => ({
        path: prefix && file.path.startsWith(prefix) ? file.path.slice(prefix.length) : file.path,
        content: file.content
      }));
      await ctx.service.saveProject(activeCopy.name, ctx.service.toServiceFiles(files), { deleteStale: true });
    }
    ctx.refreshUi();
    ctx.notify(zhCN.copy.saveSuccess + "：" + activeCopy.name);
    return true;
  } catch (error) {
    ctx.notify(errorText(zhCN.copy.saveFailed, error));
    return false;
  }
}

async function makeWorkingCopyFromProject(ctx) {
  if (!ctx.service || typeof ctx.service.getRoots !== "function") {
    ctx.notify(zhCN.copy.notAvailable);
    return null;
  }
  let roots;
  try {
    roots = await ctx.service.getRoots();
  } catch (error) {
    ctx.notify(errorText(zhCN.folder.rootsFailed, error));
    return null;
  }
  const answer = ctx.prompt(zhCN.makeCopy.prompt, currentManifestId(ctx));
  if (answer == null) {
    return null;
  }
  const name = String(answer).trim();
  if (!name) {
    return null;
  }
  try {
    await ctx.service.mkdir(roots.editRoot + "\\" + name);
    const project = ctx.getProject();
    const manifest = project && project.meta ? project.meta.manifest : null;
    const modId = manifest && typeof manifest.id === "string" ? manifest.id : "";
    let files;
    if (modId) {
      const result = await buildPackage(project);
      if (Array.isArray(result.errors) && result.errors.length > 0) {
        ctx.notify(errorText(zhCN.makeCopy.failed, result.errors[0]));
        return null;
      }
      const prefix = modId + "/";
      files = (result.files || []).map((file) => ({
        path: file.path.startsWith(prefix) ? file.path.slice(prefix.length) : file.path,
        content: file.content
      }));
    } else {
      files = [{ path: projectFileName(project), content: await serializeProject(project) }];
    }
    await ctx.service.saveProject(name, ctx.service.toServiceFiles(files));
    activeCopy = { name, kind: modId ? "mod" : "project", sourcePath: null, workshop: null };
    ctx.refreshUi();
    ctx.notify(zhCN.makeCopy.done + "：" + name);
    return name;
  } catch (error) {
    ctx.notify(errorText(zhCN.makeCopy.failed, error));
    return null;
  }
}

function currentManifestId(ctx) {
  const project = ctx.getProject();
  const manifest = project && project.meta ? project.meta.manifest : null;
  return manifest && typeof manifest.id === "string" ? manifest.id : "project";
}

async function openMergeGuide(ctx) {
  if (!activeCopy) {
    ctx.notify(zhCN.copy.noActive);
    return null;
  }
  let report;
  try {
    report = await ctx.service.mergeReport(activeCopy.name);
  } catch (error) {
    ctx.notify(errorText(zhCN.merge.failed, error));
    return null;
  }
  showMergeModal(ctx, report);
  return report;
}

async function publishToWorkshop(ctx) {
  if (!activeCopy) {
    ctx.notify(zhCN.publish.noActive);
    return null;
  }

  let report = null;
  let loggedIn = false;
  let steamUser = "";

  const modal = mountModal("pc-publish", zhCN.publish.title, { closeLabel: zhCN.publish.close });
  const panel = modal.panel;

  const manifest = ctx.getProject().meta ? ctx.getProject().meta.manifest : null;
  const defaultTitle =
    manifest && typeof manifest.name === "string" && manifest.name
      ? manifest.name
      : activeCopy.name;
  const defaultId =
    activeCopy.workshop && activeCopy.workshop.publishedFileId ? activeCopy.workshop.publishedFileId : "";

  function field(labelText, input) {
    const wrap = createEl("label", "pc-publish-field");
    wrap.appendChild(createEl("span", "pc-publish-label", labelText));
    wrap.appendChild(input);
    return wrap;
  }

  const titleInput = createEl("input", "pc-publish-input");
  titleInput.type = "text";
  titleInput.value = defaultTitle;
  const descriptionInput = createEl("textarea", "pc-publish-input pc-publish-textarea");
  const changenoteInput = createEl("textarea", "pc-publish-input pc-publish-textarea");
  const idInput = createEl("input", "pc-publish-input");
  idInput.type = "text";
  idInput.value = defaultId;
  const previewInput = createEl("input", "pc-publish-input");
  previewInput.type = "text";
  previewInput.placeholder = zhCN.publish.fieldPreview;

  panel.appendChild(field(zhCN.publish.fieldTitle, titleInput));
  panel.appendChild(field(zhCN.publish.fieldDescription, descriptionInput));
  panel.appendChild(field(zhCN.publish.fieldChangenote, changenoteInput));
  panel.appendChild(field(zhCN.publish.fieldId, idInput));
  panel.appendChild(field(zhCN.publish.fieldPreview, previewInput));

  const statusRow = createEl("div", "pc-publish-statusrow");
  const statusText = createEl("span", "pc-publish-status", zhCN.publish.checking);
  statusRow.appendChild(statusText);
  panel.appendChild(statusRow);

  const changesWrap = createEl("div", "pc-publish-changes");
  changesWrap.appendChild(createEl("h4", "pc-publish-changes-title", zhCN.publish.changesTitle));
  const changesBox = createEl("div", "pc-publish-changes-body");
  changesBox.appendChild(createEl("p", "pc-publish-hint", zhCN.folder.loading));
  changesWrap.appendChild(changesBox);
  panel.appendChild(changesWrap);

  const confirmLabel = createEl("label", "pc-publish-confirm");
  const confirmCheck = createEl("input", "pc-publish-confirm-check");
  confirmCheck.type = "checkbox";
  confirmLabel.appendChild(confirmCheck);
  confirmLabel.appendChild(createEl("span", null, zhCN.publish.confirmCheck));
  panel.appendChild(confirmLabel);

  const errorEl = createEl("p", "pc-publish-error");
  errorEl.hidden = true;
  panel.appendChild(errorEl);

  const resultEl = createEl("pre", "pc-publish-result");
  resultEl.hidden = true;
  panel.appendChild(resultEl);

  const actions = createEl("div", "pc-publish-actions");
  const statusBtn = createEl("button", "pc-btn pc-publish-refresh", zhCN.publish.refreshStatus);
  const confirmBtn = createEl("button", "pc-btn pc-publish-confirm-btn pc-publish-primary", zhCN.publish.confirm);
  const cancelBtn = createEl("button", "pc-btn pc-publish-cancel", zhCN.publish.cancel);
  actions.appendChild(statusBtn);
  actions.appendChild(confirmBtn);
  actions.appendChild(cancelBtn);
  panel.appendChild(actions);

  function setError(message) {
    if (message) {
      errorEl.textContent = message;
      errorEl.hidden = false;
    } else {
      errorEl.textContent = "";
      errorEl.hidden = true;
    }
  }

  function updateConfirm() {
    confirmBtn.disabled = !(loggedIn && report && confirmCheck.checked);
  }

  async function loadChanges() {
    clear(changesBox);
    changesBox.appendChild(createEl("p", "pc-publish-hint", zhCN.folder.loading));
    try {
      report = await ctx.service.mergeReport(activeCopy.name);
      clear(changesBox);
      changesBox.appendChild(changeList(report.changed));
    } catch (error) {
      report = null;
      clear(changesBox);
      changesBox.appendChild(createEl("p", "pc-publish-hint", errorText(zhCN.merge.failed, error)));
    }
    updateConfirm();
  }

  async function refreshStatus() {
    setError("");
    statusText.textContent = zhCN.publish.checking;
    try {
      let status = await ctx.service.steamStatus(steamUser || undefined);
      if (status.needUser) {
        const entered = ctx.prompt(zhCN.publish.needUser);
        if (entered == null || !String(entered).trim()) {
          statusText.textContent = "";
          return;
        }
        steamUser = String(entered).trim();
        status = await ctx.service.steamStatus(steamUser);
      }
      if (status.user) {
        steamUser = status.user;
      }
      if (status.loggedIn) {
        loggedIn = true;
        statusText.textContent = zhCN.publish.loggedIn + (steamUser ? "（" + steamUser + "）" : "");
      } else {
        loggedIn = false;
        statusText.textContent = zhCN.publish.notLoggedIn;
        await ctx.service.steamLogin(steamUser);
        statusText.textContent = zhCN.publish.loginOpened;
      }
    } catch (error) {
      loggedIn = false;
      statusText.textContent = "";
      setError(errorText(zhCN.steam.error, error));
    }
    updateConfirm();
  }

  async function doPublish() {
    if (!report) {
      setError(zhCN.publish.needReport);
      return;
    }
    setError("");
    confirmBtn.disabled = true;
    statusText.textContent = zhCN.publish.uploading;
    const payload = {
      name: activeCopy.name,
      user: steamUser,
      title: titleInput.value.trim() || activeCopy.name,
      description: descriptionInput.value,
      changenote: changenoteInput.value,
      previewPath: previewInput.value.trim(),
      publishedFileId: idInput.value.trim(),
      confirm: true
    };
    try {
      const result = await ctx.service.steamPublish(payload);
      activeCopy.workshop = {
        publishedFileId: result.publishedFileId,
        title: payload.title
      };
      if (result.publishedFileId && !idInput.value.trim()) {
        idInput.value = result.publishedFileId;
      }
      resultEl.textContent =
        zhCN.publish.resultId +
        "：" +
        String(result.publishedFileId || "") +
        "\n" +
        zhCN.publish.resultOutput +
        "：\n" +
        String(result.output || "").slice(-4000);
      resultEl.hidden = false;
      statusText.textContent = zhCN.publish.success;
      ctx.refreshUi();
      ctx.notify(zhCN.publish.success);
    } catch (error) {
      setError(errorText(zhCN.publish.failed, error));
      statusText.textContent = "";
    }
    updateConfirm();
  }

  statusBtn.addEventListener("click", refreshStatus);
  confirmBtn.addEventListener("click", doPublish);
  cancelBtn.addEventListener("click", () => modal.close());
  confirmCheck.addEventListener("change", updateConfirm);

  updateConfirm();
  loadChanges();
  refreshStatus();
  return modal.panel;
}

export function initFolderFlow(deps) {
  const config = deps && typeof deps === "object" ? deps : {};
  const ctx = {
    getProject: typeof config.getProject === "function" ? config.getProject : () => ({}),
    applyProject: typeof config.applyProject === "function" ? config.applyProject : () => {},
    refreshUi: typeof config.refreshUi === "function" ? config.refreshUi : () => {},
    notify: typeof config.notify === "function" ? config.notify : () => {},
    confirm: typeof config.confirm === "function" ? config.confirm : () => true,
    prompt: typeof config.prompt === "function" ? config.prompt : () => null,
    service: config.service || null
  };
  return {
    openFolderPicker: (options) => openFolderPicker(ctx, options),
    importWorkingCopy: (kindHint) => importWorkingCopy(ctx, kindHint),
    saveWorkingCopy: () => saveWorkingCopy(ctx),
    makeWorkingCopyFromProject: () => makeWorkingCopyFromProject(ctx),
    openMergeGuide: () => openMergeGuide(ctx),
    publishToWorkshop: () => publishToWorkshop(ctx),
    getActiveCopy: () => activeCopy
  };
}
