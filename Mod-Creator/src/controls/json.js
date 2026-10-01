export function createJson(descriptor, value, onChange) {
  const el = document.createElement("textarea");
  el.className = "pc-json";
  el.rows = descriptor && descriptor.rows != null ? Number(descriptor.rows) : 6;
  el.value = value == null ? "" : JSON.stringify(value, null, 2);
  el.addEventListener("input", () => {
    let parsed;
    try {
      parsed = JSON.parse(el.value);
    } catch {
      el.classList.add("invalid");
      return;
    }
    el.classList.remove("invalid");
    onChange(parsed);
  });
  return el;
}
