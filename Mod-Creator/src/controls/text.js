export function createText(descriptor, value, onChange) {
  const el = document.createElement(descriptor && descriptor.multiline ? "textarea" : "input");
  el.className = "pc-text";
  if (descriptor && descriptor.multiline) {
    el.rows = descriptor.rows != null ? Number(descriptor.rows) : 4;
  } else {
    el.type = "text";
  }
  if (descriptor && descriptor.placeholder != null) {
    el.placeholder = String(descriptor.placeholder);
  }
  if (descriptor && descriptor.maxLength != null) {
    el.maxLength = Number(descriptor.maxLength);
  }
  el.value = value == null ? "" : String(value);
  const pattern = descriptor && descriptor.pattern ? new RegExp(descriptor.pattern) : null;
  el.addEventListener("input", () => {
    const raw = el.value;
    if (pattern && !pattern.test(raw)) {
      el.classList.add("invalid");
      return;
    }
    el.classList.remove("invalid");
    onChange(raw);
  });
  return el;
}
