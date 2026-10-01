export function createNumber(descriptor, value, onChange) {
  const el = document.createElement("input");
  el.className = "pc-number";
  el.type = "number";
  if (descriptor.min != null) {
    el.min = String(descriptor.min);
  }
  if (descriptor.max != null) {
    el.max = String(descriptor.max);
  }
  if (descriptor.step != null) {
    el.step = String(descriptor.step);
  }
  el.value = value == null ? "" : String(value);
  el.addEventListener("input", () => {
    const raw = el.value;
    if (raw === "") {
      el.classList.remove("invalid");
      onChange(raw === "" ? null : raw);
      return;
    }
    const num = Number(raw);
    if (!Number.isFinite(num)) {
      el.classList.add("invalid");
      return;
    }
    if (descriptor.min != null && num < descriptor.min) {
      el.classList.add("invalid");
      return;
    }
    if (descriptor.max != null && num > descriptor.max) {
      el.classList.add("invalid");
      return;
    }
    el.classList.remove("invalid");
    onChange(num);
  });
  return el;
}
