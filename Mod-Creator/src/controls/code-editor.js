import { zhCN } from "../i18n/zh-CN.js";

const DEFAULT_MAX_BYTES = 256 * 1024;
const UTF8 = new TextEncoder();

function utf8Bytes(text) {
  return UTF8.encode(text).length;
}

export function createCodeEditor(descriptor, value, onChange) {
  const maxBytes =
    descriptor && descriptor.maxBytes != null ? Number(descriptor.maxBytes) : DEFAULT_MAX_BYTES;
  const rows = descriptor && descriptor.rows != null ? Number(descriptor.rows) : 18;

  const root = document.createElement("div");
  root.className = "pc-code-editor";

  const gutter = document.createElement("pre");
  gutter.className = "pc-code-gutter";
  gutter.setAttribute("aria-hidden", "true");

  const area = document.createElement("textarea");
  area.className = "pc-code";
  area.rows = rows;
  area.spellcheck = false;
  area.wrap = "off";
  if (descriptor && descriptor.placeholder != null) {
    area.placeholder = String(descriptor.placeholder);
  }
  area.value = value == null ? "" : String(value);

  const status = document.createElement("div");
  status.className = "pc-code-status";
  const charEl = document.createElement("span");
  charEl.className = "pc-code-count";
  const byteEl = document.createElement("span");
  byteEl.className = "pc-code-count";
  const hintEl = document.createElement("span");
  hintEl.className = "pc-code-hint";
  hintEl.textContent = zhCN.codeEditor.sandboxHint;
  status.appendChild(charEl);
  status.appendChild(byteEl);
  status.appendChild(hintEl);

  root.appendChild(gutter);
  root.appendChild(area);
  root.appendChild(status);

  function renderGutter() {
    const lines = area.value.split("\n").length;
    const numbers = [];
    for (let i = 1; i <= lines; i += 1) {
      numbers.push(String(i));
    }
    gutter.textContent = numbers.join("\n");
  }

  function renderStatus() {
    const text = area.value;
    const bytes = utf8Bytes(text);
    const over = bytes > maxBytes;
    charEl.textContent = zhCN.codeEditor.charCount.replace("{n}", String(text.length));
    byteEl.textContent = zhCN.codeEditor.byteCount
      .replace("{n}", String(bytes))
      .replace("{max}", String(maxBytes));
    byteEl.classList.toggle("invalid", over);
    area.classList.toggle("invalid", over);
    return over;
  }

  area.addEventListener("scroll", () => {
    gutter.scrollTop = area.scrollTop;
  });

  area.addEventListener("keydown", (event) => {
    if (event.key !== "Tab") {
      return;
    }
    event.preventDefault();
    const start = area.selectionStart;
    const end = area.selectionEnd;
    area.setRangeText("  ", start, end, "end");
    area.dispatchEvent(new Event("input"));
  });

  area.addEventListener("input", () => {
    renderGutter();
    const over = renderStatus();
    onChange(area.value, over);
  });

  renderGutter();
  renderStatus();

  return root;
}
