export function createToggle(descriptor, value, onChange) {
  const el = document.createElement("input");
  el.className = "pc-toggle";
  el.type = "checkbox";
  el.checked = value === true;
  el.addEventListener("change", () => {
    onChange(el.checked);
  });
  return el;
}
