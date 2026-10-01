import { getSettings, setSettings, isConfigured } from "./settings.js";
import { chat, streamChat } from "./client.js";
import {
  buildAdviceMessages,
  buildDiffMessages,
  summarizeProject,
  INTERFACE_CONSTRAINTS_ZH
} from "./prompt.js";
import { parsePatch, previewDiff, applyPatch } from "./patch.js";
import { zhCN } from "../i18n/zh-CN.js";

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

function stringifyValue(value) {
  if (value === undefined) {
    return zhCN.aiMissingValue;
  }
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function errorMessage(error) {
  return error && error.message ? error.message : String(error);
}

function createField(labelText, input, hintText) {
  const field = createEl("label", "pc-ai-field");
  field.appendChild(createEl("span", "pc-ai-field-label", labelText));
  field.appendChild(input);
  if (hintText) {
    field.appendChild(createEl("span", "pc-ai-hint", hintText));
  }
  return field;
}

function changeItem(change) {
  const item = createEl("div", "pc-diff-item");
  const head = createEl("div", "pc-diff-head");
  head.appendChild(createEl("span", "pc-diff-op", String(change.op || "")));
  head.appendChild(createEl("code", "pc-diff-path", String(change.path || "")));
  item.appendChild(head);
  const pair = createEl("div", "pc-diff-values");
  const before = createEl("div", "pc-diff-before");
  before.appendChild(createEl("span", "pc-diff-label", zhCN.aiBefore));
  before.appendChild(createEl("pre", "pc-diff-pre", stringifyValue(change.before)));
  const after = createEl("div", "pc-diff-after");
  after.appendChild(createEl("span", "pc-diff-label", zhCN.aiAfter));
  after.appendChild(createEl("pre", "pc-diff-pre", stringifyValue(change.after)));
  pair.appendChild(before);
  pair.appendChild(after);
  item.appendChild(pair);
  return item;
}

export function openAiPanel(mode = "advice", deps = {}) {
  if (typeof document === "undefined") {
    return null;
  }
  const getProject = typeof deps.getProject === "function" ? deps.getProject : () => ({});
  const applyProject = typeof deps.applyProject === "function" ? deps.applyProject : () => {};
  const currentMode = mode === "diff" ? "diff" : "advice";

  let settings = getSettings();
  let pendingOps = null;
  let busy = false;

  const overlay = createEl("div", "pc-ai-overlay");
  const panel = createEl("div", "pc-ai-panel");
  overlay.appendChild(panel);

  const header = createEl("div", "pc-ai-header");
  header.appendChild(
    createEl("h2", "pc-ai-title", currentMode === "diff" ? zhCN.aiDiffTitle : zhCN.aiAdviceTitle)
  );
  const closeBtn = createEl("button", "pc-ai-close", zhCN.aiClose);
  header.appendChild(closeBtn);
  panel.appendChild(header);

  const summary = summarizeProject(getProject());
  const summaryEl = createEl("div", "pc-ai-summary");
  summaryEl.appendChild(createEl("h3", null, zhCN.aiSummaryTitle));
  summaryEl.appendChild(
    createEl(
      "p",
      "pc-ai-summary-line",
      zhCN.aiDomains + "：" + (summary.domains.length > 0 ? summary.domains.join("、") : zhCN.none)
    )
  );
  summaryEl.appendChild(createEl("p", "pc-ai-summary-line", zhCN.aiEntries + "：" + summary.entries.length));
  const summaryLines = createEl("div", "pc-ai-summary-lines");
  if (summary.entries.length === 0) {
    summaryLines.appendChild(createEl("p", "pc-ai-hint", zhCN.aiSummaryEmpty));
  } else {
    for (const entry of summary.entries) {
      summaryLines.appendChild(
        createEl("p", "pc-ai-summary-entry", "[" + entry.domain + "] " + entry.id + " — " + entry.summary)
      );
    }
  }
  summaryEl.appendChild(summaryLines);
  panel.appendChild(summaryEl);

  const constraintsEl = createEl("details", "pc-ai-constraints");
  constraintsEl.appendChild(createEl("summary", null, zhCN.aiConstraintsTitle));
  constraintsEl.appendChild(createEl("pre", "pc-ai-constraints-text", INTERFACE_CONSTRAINTS_ZH));
  panel.appendChild(constraintsEl);

  const settingsEl = createEl("details", "pc-ai-settings");
  settingsEl.appendChild(createEl("summary", null, zhCN.aiSettings));
  const baseUrlInput = createEl("input", "pc-ai-input");
  baseUrlInput.type = "text";
  baseUrlInput.value = settings.baseUrl || "";
  baseUrlInput.placeholder = zhCN.aiBaseUrlPlaceholder;
  const apiKeyInput = createEl("input", "pc-ai-input");
  apiKeyInput.type = "password";
  apiKeyInput.value = settings.apiKey || "";
  apiKeyInput.autocomplete = "off";
  const modelInput = createEl("input", "pc-ai-input");
  modelInput.type = "text";
  modelInput.value = settings.model || "";
  modelInput.placeholder = zhCN.aiModelPlaceholder;
  const temperatureInput = createEl("input", "pc-ai-input");
  temperatureInput.type = "number";
  temperatureInput.min = "0";
  temperatureInput.max = "2";
  temperatureInput.step = "0.1";
  temperatureInput.value = String(typeof settings.temperature === "number" ? settings.temperature : 0.7);

  settingsEl.appendChild(createField(zhCN.aiBaseUrl, baseUrlInput));
  settingsEl.appendChild(createField(zhCN.aiApiKey, apiKeyInput, zhCN.aiApiKeyHint));
  settingsEl.appendChild(createField(zhCN.aiModel, modelInput));
  settingsEl.appendChild(createField(zhCN.aiTemperature, temperatureInput));

  const settingsActions = createEl("div", "pc-ai-actions");
  const saveBtn = createEl("button", "pc-ai-btn pc-ai-primary", zhCN.aiSaveSettings);
  const settingsStatus = createEl("span", "pc-ai-hint", "");
  settingsActions.appendChild(saveBtn);
  settingsActions.appendChild(settingsStatus);
  settingsEl.appendChild(settingsActions);
  panel.appendChild(settingsEl);

  const sendNotice = createEl("p", "pc-ai-notice", zhCN.aiSecurityNotice);
  panel.appendChild(sendNotice);

  const questionInput = createEl("textarea", "pc-ai-input pc-ai-textarea");
  const instructionInput = createEl("textarea", "pc-ai-input pc-ai-textarea");
  if (currentMode === "diff") {
    instructionInput.placeholder = zhCN.aiInstructionPlaceholder;
    panel.appendChild(createField(zhCN.aiInstructionLabel, instructionInput));
  } else {
    questionInput.placeholder = zhCN.aiQuestionPlaceholder;
    panel.appendChild(createField(zhCN.aiQuestionLabel, questionInput));
  }

  const runActions = createEl("div", "pc-ai-actions");
  const runBtn = createEl(
    "button",
    "pc-ai-btn pc-ai-primary",
    currentMode === "diff" ? zhCN.aiGenerateDiff : zhCN.aiGetAdvice
  );
  runBtn.disabled = true;
  runActions.appendChild(runBtn);
  panel.appendChild(runActions);

  const errorEl = createEl("p", "pc-ai-error");
  errorEl.hidden = true;
  panel.appendChild(errorEl);

  const resultEl = createEl("pre", "pc-ai-result");
  panel.appendChild(resultEl);

  const applyActions = createEl("div", "pc-ai-actions");
  const applyBtn = createEl("button", "pc-ai-btn pc-ai-primary", zhCN.aiApply);
  applyBtn.disabled = true;
  const cancelBtn = createEl("button", "pc-ai-btn", zhCN.aiCancel);
  const copyBtn = createEl("button", "pc-ai-btn", zhCN.aiCopy);
  copyBtn.hidden = currentMode === "diff";
  if (currentMode === "diff") {
    applyActions.appendChild(applyBtn);
    applyActions.appendChild(cancelBtn);
  } else {
    applyActions.appendChild(copyBtn);
    applyActions.appendChild(cancelBtn);
  }
  panel.appendChild(applyActions);

  function showError(message) {
    errorEl.textContent = message;
    errorEl.hidden = false;
  }

  function clearError() {
    errorEl.textContent = "";
    errorEl.hidden = true;
  }

  function refreshConfigured() {
    runBtn.disabled = busy || !isConfigured(settings);
    if (!isConfigured(settings)) {
      settingsStatus.textContent = zhCN.aiNotConfigured;
    } else {
      settingsStatus.textContent = "";
    }
  }

  function setBusy(next) {
    busy = next;
    runBtn.disabled = next || !isConfigured(settings);
    saveBtn.disabled = next;
    if (next) {
      resultEl.textContent = zhCN.aiLoading;
    }
  }

  function readSettingsFromInputs() {
    return {
      baseUrl: baseUrlInput.value.trim(),
      apiKey: apiKeyInput.value,
      model: modelInput.value.trim(),
      temperature: Number(temperatureInput.value)
    };
  }

  saveBtn.addEventListener("click", () => {
    settings = setSettings(readSettingsFromInputs());
    baseUrlInput.value = settings.baseUrl || "";
    apiKeyInput.value = settings.apiKey || "";
    modelInput.value = settings.model || "";
    temperatureInput.value = String(settings.temperature);
    clearError();
    refreshConfigured();
  });

  baseUrlInput.addEventListener("input", refreshConfigured);
  modelInput.addEventListener("input", refreshConfigured);

  async function runAdvice() {
    clearError();
    setBusy(true);
    resultEl.textContent = "";
    const messages = buildAdviceMessages(getProject(), questionInput.value);
    const onDelta = (delta) => {
      resultEl.textContent += delta;
    };
    try {
      if (typeof streamChat === "function") {
        await streamChat(messages, { settings }, onDelta);
      } else {
        resultEl.textContent = await chat(messages, { settings });
      }
    } catch (error) {
      showError(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  async function runDiff() {
    clearError();
    pendingOps = null;
    applyBtn.disabled = true;
    resultEl.textContent = "";
    setBusy(true);
    const messages = buildDiffMessages(getProject(), instructionInput.value);
    try {
      const text = await chat(messages, { settings });
      const ops = parsePatch(text);
      const preview = previewDiff(getProject(), ops);
      resultEl.textContent = "";
      const changesEl = createEl("div", "pc-diff-changes");
      changesEl.appendChild(createEl("h3", null, zhCN.aiPreview));
      if (preview.changes.length === 0) {
        changesEl.appendChild(createEl("p", "pc-ai-hint", zhCN.aiNoChanges));
      } else {
        for (const change of preview.changes) {
          changesEl.appendChild(changeItem(change));
        }
      }
      resultEl.appendChild(changesEl);
      pendingOps = ops;
      applyBtn.disabled = ops.length === 0;
    } catch (error) {
      showError(errorMessage(error));
      applyBtn.disabled = true;
    } finally {
      setBusy(false);
    }
  }

  function runApply() {
    clearError();
    if (!pendingOps) {
      return;
    }
    try {
      const next = applyPatch(getProject(), pendingOps);
      applyProject(next);
      close();
    } catch (error) {
      showError(zhCN.aiApplyFailed + "：" + errorMessage(error));
    }
  }

  runBtn.addEventListener("click", () => {
    if (currentMode === "diff") {
      runDiff();
    } else {
      runAdvice();
    }
  });

  applyBtn.addEventListener("click", runApply);

  function close() {
    overlay.remove();
    document.removeEventListener("keydown", onKeyDown);
  }

  copyBtn.addEventListener("click", async () => {
    const text = resultEl.textContent || "";
    try {
      if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
        await navigator.clipboard.writeText(text);
      } else {
        throw new Error("clipboard unavailable");
      }
      copyBtn.textContent = zhCN.aiCopied;
      setTimeout(() => {
        copyBtn.textContent = zhCN.aiCopy;
      }, 1500);
    } catch {
      copyBtn.textContent = zhCN.aiCopyFailed;
      setTimeout(() => {
        copyBtn.textContent = zhCN.aiCopy;
      }, 1500);
    }
  });

  cancelBtn.addEventListener("click", close);
  closeBtn.addEventListener("click", close);
  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) {
      close();
    }
  });

  function onKeyDown(event) {
    if (event.key === "Escape") {
      close();
    }
  }
  document.addEventListener("keydown", onKeyDown);

  if (!isConfigured(settings)) {
    settingsEl.open = true;
  }
  refreshConfigured();
  document.body.appendChild(overlay);
  return panel;
}
