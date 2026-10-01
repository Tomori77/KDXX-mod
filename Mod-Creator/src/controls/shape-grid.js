import { zhCN } from "../i18n/zh-CN.js";

export const shapeGridLabels = zhCN.shapeGrid;

const HARD_MAX = 10;

function clampSize(candidate) {
  if (Number.isInteger(candidate) && candidate >= 1) {
    return Math.min(candidate, HARD_MAX);
  }
  return HARD_MAX;
}

function normalize(value, maxRows, maxCols) {
  if (!Array.isArray(value) || value.length === 0) {
    return [[0]];
  }
  const rows = value.slice(0, maxRows);
  let width = 1;
  for (const row of rows) {
    if (Array.isArray(row) && row.length > 0) {
      width = row.length;
      break;
    }
  }
  if (width > maxCols) {
    width = maxCols;
  }
  return rows.map((row) => {
    const source = Array.isArray(row) ? row : [];
    const next = [];
    for (let c = 0; c < width; c += 1) {
      next.push(source[c] ? 1 : 0);
    }
    return next;
  });
}

function clone(matrix) {
  return matrix.map((row) => row.slice());
}

export function createShapeGrid(descriptor, value, onChange) {
  const spec = descriptor || {};
  const maxRows = clampSize(spec.maxRows != null ? spec.maxRows : spec.max);
  const maxCols = clampSize(spec.maxCols != null ? spec.maxCols : spec.max);

  let matrix = normalize(value, maxRows, maxCols);

  const root = document.createElement("div");
  root.className = "pc-shape-grid";

  const toolbar = document.createElement("div");
  toolbar.className = "pc-shape-grid-toolbar";
  root.appendChild(toolbar);

  const grid = document.createElement("div");
  grid.className = "pc-shape-grid-cells";
  root.appendChild(grid);

  const actions = [
    { key: "clear", label: shapeGridLabels.clear, run: () => fill(0) },
    { key: "selectAll", label: shapeGridLabels.selectAll, run: () => fill(1) },
    { key: "addRow", label: shapeGridLabels.addRow, run: addRow },
    { key: "addCol", label: shapeGridLabels.addCol, run: addCol },
    { key: "removeRow", label: shapeGridLabels.removeRow, run: removeRow },
    { key: "removeCol", label: shapeGridLabels.removeCol, run: removeCol },
  ];

  const controls = {};
  for (const action of actions) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "pc-shape-grid-btn";
    button.dataset.action = action.key;
    button.textContent = action.label;
    button.addEventListener("click", action.run);
    toolbar.appendChild(button);
    controls[action.key] = button;
  }

  function emit() {
    onChange(clone(matrix));
  }

  function rows() {
    return matrix.length;
  }

  function cols() {
    return matrix[0].length;
  }

  function fill(bit) {
    matrix = matrix.map((row) => row.map(() => bit));
    emit();
    render();
  }

  function addRow() {
    if (rows() >= maxRows) {
      return;
    }
    matrix.push(new Array(cols()).fill(0));
    emit();
    render();
  }

  function addCol() {
    if (cols() >= maxCols) {
      return;
    }
    matrix.forEach((row) => row.push(0));
    emit();
    render();
  }

  function removeRow() {
    if (rows() <= 1) {
      return;
    }
    matrix.pop();
    emit();
    render();
  }

  function removeCol() {
    if (cols() <= 1) {
      return;
    }
    matrix.forEach((row) => row.pop());
    emit();
    render();
  }

  function toggleCell(r, c) {
    matrix[r][c] = matrix[r][c] ? 0 : 1;
    emit();
    const el = grid.querySelector(
      '.pc-shape-cell[data-row="' + r + '"][data-col="' + c + '"]'
    );
    if (el) {
      el.classList.toggle("on", matrix[r][c] === 1);
      el.setAttribute("aria-pressed", matrix[r][c] === 1 ? "true" : "false");
    }
  }

  function render() {
    grid.textContent = "";
    grid.style.gridTemplateColumns = "repeat(" + cols() + ", var(--pc-shape-cell, 22px))";
    for (let r = 0; r < rows(); r += 1) {
      for (let c = 0; c < cols(); c += 1) {
        const cell = document.createElement("button");
        cell.type = "button";
        cell.className = "pc-shape-cell" + (matrix[r][c] ? " on" : "");
        cell.dataset.row = String(r);
        cell.dataset.col = String(c);
        cell.setAttribute("aria-pressed", matrix[r][c] ? "true" : "false");
        cell.addEventListener("click", () => toggleCell(r, c));
        grid.appendChild(cell);
      }
    }
    controls.addRow.disabled = rows() >= maxRows;
    controls.removeRow.disabled = rows() <= 1;
    controls.addCol.disabled = cols() >= maxCols;
    controls.removeCol.disabled = cols() <= 1;
    controls.clear.disabled = false;
    controls.selectAll.disabled = false;
  }

  render();
  return root;
}
