import { zhCN } from "../i18n/zh-CN.js";

const COMPATIBLE_FROM_RE = /^(?:(?:>=|<=|>|<|=)\d+\.\d+\.\d+)(?:\s+(?:>=|<=|>|<|=)\d+\.\d+\.\d+)*$/;

export function createSaveCompatibility(descriptor, value, onChange) {
  const box = document.createElement("div");
  box.className = "pc-save-compat";

  const initial = value !== null && typeof value === "object" ? value : null;

  const head = document.createElement("label");
  head.className = "pc-save-compat-enable";
  const toggle = document.createElement("input");
  toggle.type = "checkbox";
  toggle.className = "pc-toggle";
  toggle.checked = initial !== null;
  const enableText = document.createElement("span");
  enableText.textContent = zhCN.saveCompatibility.enable;
  head.appendChild(toggle);
  head.appendChild(enableText);
  box.appendChild(head);

  const body = document.createElement("div");
  body.className = "pc-save-compat-body";
  box.appendChild(body);

  const fromField = document.createElement("label");
  fromField.className = "pc-save-compat-field";
  const fromLabel = document.createElement("span");
  fromLabel.className = "pc-save-compat-label";
  fromLabel.textContent = zhCN.saveCompatibility.compatibleFrom;
  const fromInput = document.createElement("input");
  fromInput.type = "text";
  fromInput.className = "pc-text pc-save-compat-from";
  fromInput.placeholder = zhCN.saveCompatibility.compatibleFromHint;
  fromInput.value = initial && typeof initial.compatibleFrom === "string" ? initial.compatibleFrom : "";
  fromField.appendChild(fromLabel);
  fromField.appendChild(fromInput);
  body.appendChild(fromField);

  const revField = document.createElement("label");
  revField.className = "pc-save-compat-field";
  const revLabel = document.createElement("span");
  revLabel.className = "pc-save-compat-label";
  revLabel.textContent = zhCN.saveCompatibility.contentRevision;
  const revInput = document.createElement("input");
  revInput.type = "number";
  revInput.min = "1";
  revInput.step = "1";
  revInput.className = "pc-number pc-save-compat-revision";
  revInput.value = initial && initial.contentRevision != null ? String(initial.contentRevision) : "";
  revField.appendChild(revLabel);
  revField.appendChild(revInput);
  body.appendChild(revField);

  const hint = document.createElement("div");
  hint.className = "pc-note pc-save-compat-hint";
  hint.textContent = zhCN.saveCompatibility.hint;
  body.appendChild(hint);

  function syncVisibility() {
    body.hidden = !toggle.checked;
  }

  function emit() {
    if (!toggle.checked) {
      return;
    }
    const from = fromInput.value.trim();
    const fromOk = COMPATIBLE_FROM_RE.test(from);
    fromInput.classList.toggle("invalid", !fromOk);
    const revRaw = revInput.value.trim();
    const rev = Number(revRaw);
    const revOk = revRaw !== "" && Number.isInteger(rev) && rev >= 1;
    revInput.classList.toggle("invalid", !revOk);
    if (fromOk && revOk) {
      onChange({ compatibleFrom: from, contentRevision: rev });
    }
  }

  toggle.addEventListener("change", () => {
    syncVisibility();
    if (!toggle.checked) {
      onChange(null);
      return;
    }
    emit();
  });
  fromInput.addEventListener("input", emit);
  revInput.addEventListener("input", emit);

  syncVisibility();
  return box;
}
