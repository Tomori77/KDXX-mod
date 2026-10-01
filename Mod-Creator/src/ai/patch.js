import { domainModules } from "../domains/index.js";

const ALLOWED_OPS = ["add", "remove", "replace", "move", "copy", "test"];
const MISSING = Symbol("missing");

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function clone(value) {
  if (value === undefined) {
    return undefined;
  }
  if (typeof structuredClone === "function") {
    return structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value));
}

function unescapeToken(token) {
  return token.replace(/~1/g, "/").replace(/~0/g, "~");
}

function parsePointer(path) {
  if (typeof path !== "string" || !path.startsWith("/")) {
    throw new Error("JSON Pointer 非法：" + String(path));
  }
  return path
    .slice(1)
    .split("/")
    .map(unescapeToken);
}

function describe(parts) {
  return parts.length === 0 ? "/" : "/" + parts.join("/");
}

function readMember(container, token) {
  if (Array.isArray(container)) {
    if (token === "-") {
      return MISSING;
    }
    if (!/^\d+$/.test(token)) {
      throw new Error("数组下标非法：" + token);
    }
    const index = Number(token);
    return index >= 0 && index < container.length ? container[index] : MISSING;
  }
  if (isPlainObject(container)) {
    return Object.prototype.hasOwnProperty.call(container, token) ? container[token] : MISSING;
  }
  return MISSING;
}

function getByParts(root, parts) {
  let current = root;
  for (const token of parts) {
    const next = readMember(current, token);
    if (next === MISSING) {
      throw new Error("路径不存在：" + describe(parts));
    }
    current = next;
  }
  return current;
}

function getParent(root, parts) {
  return getByParts(root, parts.slice(0, -1));
}

function insertMember(container, token, value) {
  if (Array.isArray(container)) {
    if (token === "-") {
      container.push(value);
      return;
    }
    if (!/^\d+$/.test(token)) {
      throw new Error("数组下标非法：" + token);
    }
    const index = Number(token);
    if (index < 0 || index > container.length) {
      throw new Error("数组下标越界：" + token);
    }
    container.splice(index, 0, value);
    return;
  }
  if (isPlainObject(container)) {
    container[token] = value;
    return;
  }
  throw new Error("父容器不是对象或数组：" + token);
}

function replaceMember(container, token, value) {
  if (Array.isArray(container)) {
    if (token === "-") {
      container.push(value);
      return;
    }
    if (!/^\d+$/.test(token)) {
      throw new Error("数组下标非法：" + token);
    }
    const index = Number(token);
    if (index < 0 || index >= container.length) {
      throw new Error("数组下标越界：" + token);
    }
    container[index] = value;
    return;
  }
  if (isPlainObject(container)) {
    if (!Object.prototype.hasOwnProperty.call(container, token)) {
      throw new Error("要替换的键不存在：" + token);
    }
    container[token] = value;
    return;
  }
  throw new Error("父容器不是对象或数组：" + token);
}

function removeMember(container, token) {
  if (Array.isArray(container)) {
    if (!/^\d+$/.test(token)) {
      throw new Error("数组下标非法：" + token);
    }
    const index = Number(token);
    if (index < 0 || index >= container.length) {
      throw new Error("数组下标越界：" + token);
    }
    return container.splice(index, 1)[0];
  }
  if (isPlainObject(container)) {
    if (!Object.prototype.hasOwnProperty.call(container, token)) {
      throw new Error("要删除的键不存在：" + token);
    }
    const removed = container[token];
    delete container[token];
    return removed;
  }
  throw new Error("父容器不是对象或数组：" + token);
}

function isDeepEqual(a, b) {
  if (a === b) {
    return true;
  }
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((value, index) => isDeepEqual(value, b[index]));
  }
  if (isPlainObject(a) && isPlainObject(b)) {
    const keysA = Object.keys(a);
    const keysB = Object.keys(b);
    return keysA.length === keysB.length && keysA.every((key) => isDeepEqual(a[key], b[key]));
  }
  return false;
}

function applyOne(root, op) {
  if (!isPlainObject(op) || typeof op.op !== "string") {
    throw new Error("补丁操作必须是含 op 字段的对象");
  }
  const parts = parsePointer(op.path);
  switch (op.op) {
    case "add": {
      if (!Object.prototype.hasOwnProperty.call(op, "value")) {
        throw new Error("add 操作缺少 value");
      }
      if (parts.length === 0) {
        return clone(op.value);
      }
      insertMember(getParent(root, parts), parts[parts.length - 1], clone(op.value));
      return root;
    }
    case "remove": {
      if (parts.length === 0) {
        throw new Error("remove 不能作用于根");
      }
      removeMember(getParent(root, parts), parts[parts.length - 1]);
      return root;
    }
    case "replace": {
      if (parts.length === 0) {
        return clone(op.value);
      }
      replaceMember(getParent(root, parts), parts[parts.length - 1], clone(op.value));
      return root;
    }
    case "test": {
      if (!isDeepEqual(getByParts(root, parts), op.value)) {
        throw new Error("test 断言失败：" + describe(parts));
      }
      return root;
    }
    case "move": {
      const from = parsePointer(op.from);
      if (isDeepEqual(from, parts)) {
        return root;
      }
      const fromDesc = describe(from);
      const pathDesc = describe(parts);
      if (pathDesc.startsWith(fromDesc + "/")) {
        throw new Error("move 不能把路径移动到自己的子路径：" + fromDesc);
      }
      const moved = parts.length === 0 ? clone(root) : removeMember(getParent(root, from), from[from.length - 1]);
      if (parts.length === 0) {
        return moved;
      }
      insertMember(getParent(root, parts), parts[parts.length - 1], moved);
      return root;
    }
    case "copy": {
      if (typeof op.from !== "string") {
        throw new Error("copy 操作缺少 from");
      }
      const from = parsePointer(op.from);
      const copied = clone(getByParts(root, from));
      if (parts.length === 0) {
        return copied;
      }
      insertMember(getParent(root, parts), parts[parts.length - 1], copied);
      return root;
    }
    default:
      throw new Error("不支持的补丁操作：" + op.op);
  }
}

function applyOperations(project, ops) {
  if (!Array.isArray(ops)) {
    throw new Error("补丁必须是操作数组");
  }
  let result = clone(project);
  for (const op of ops) {
    result = applyOne(result, op);
  }
  return result;
}

function valueAt(root, op) {
  try {
    const parts = parsePointer(op.path);
    return parts.length === 0 ? root : getByParts(root, parts);
  } catch {
    return undefined;
  }
}

export function parsePatch(text) {
  if (typeof text !== "string") {
    throw new Error("模型输出不是文本，无法解析为 JSON Patch");
  }
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : text;
  let parsed = null;
  try {
    parsed = JSON.parse(candidate.trim());
  } catch {
    const start = candidate.indexOf("[");
    const end = candidate.lastIndexOf("]");
    if (start >= 0 && end > start) {
      try {
        parsed = JSON.parse(candidate.slice(start, end + 1));
      } catch {
        parsed = null;
      }
    }
  }
  if (parsed === null) {
    throw new Error("无法从模型输出中解析出合法 JSON Patch：请确认返回的是 JSON 数组");
  }
  if (!Array.isArray(parsed)) {
    throw new Error("JSON Patch 必须是数组，实际为 " + (isPlainObject(parsed) ? "对象" : typeof parsed));
  }
  return parsed;
}

function reachable(project, pointer, allowMissingLeaf) {
  const parts = parsePointer(pointer);
  if (parts.length === 0) {
    return;
  }
  const limit = allowMissingLeaf ? parts.length - 1 : parts.length;
  let current = project;
  for (let i = 0; i < limit; i += 1) {
    const next = readMember(current, parts[i]);
    if (next === MISSING) {
      throw new Error("父路径不存在：" + describe(parts.slice(0, i + 1)));
    }
    current = next;
  }
}

export function validatePatch(project, ops) {
  const errors = [];
  const push = (op, path, messageZh) => errors.push({ op, path, messageZh });
  if (!Array.isArray(ops)) {
    return { ok: false, errors: [{ op: null, path: "", messageZh: "补丁必须是操作数组" }] };
  }
  ops.forEach((op, index) => {
    const label = isPlainObject(op) && typeof op.op === "string" ? op.op : "op[" + index + "]";
    const path = isPlainObject(op) && typeof op.path === "string" ? op.path : "";
    if (!isPlainObject(op)) {
      push(label, "", "第 " + index + " 个操作必须是对象");
      return;
    }
    if (!ALLOWED_OPS.includes(op.op)) {
      push(label, path, "不支持的 op：" + String(op.op) + "（仅限 " + ALLOWED_OPS.join("/") + "）");
    }
    if (typeof op.path !== "string" || !op.path.startsWith("/")) {
      push(label, path, "path 必须是以 / 开头的 JSON Pointer");
    } else {
      try {
        const allowMissingLeaf = op.op === "add" || op.op === "move" || op.op === "copy";
        reachable(project, op.path, allowMissingLeaf);
      } catch (err) {
        push(label, path, err.message);
      }
    }
    if (op.op === "add" && !Object.prototype.hasOwnProperty.call(op, "value")) {
      push(label, path, "add 操作缺少 value");
    }
    if (op.op === "move" || op.op === "copy") {
      if (typeof op.from !== "string" || !op.from.startsWith("/")) {
        push(label, path, op.op + " 操作必须提供以 / 开头的 from");
      } else {
        try {
          reachable(project, op.from, false);
        } catch (err) {
          push(label, path, err.message);
        }
      }
    }
  });
  return { ok: errors.length === 0, errors };
}

export function previewDiff(project, ops) {
  const before = clone(project);
  const changes = [];
  let after;
  try {
    after = applyOperations(before, ops);
  } catch (err) {
    throw new Error("无法应用补丁预览：" + (err && err.message ? err.message : String(err)));
  }
  for (const op of ops) {
    if (!isPlainObject(op)) {
      continue;
    }
    changes.push({
      op: op.op,
      path: op.path,
      before: valueAt(before, op),
      after: valueAt(after, op)
    });
  }
  return { before, after, changes };
}

function collectInvolved(project, ops) {
  const involved = new Map();
  const addDomain = (domain, index) => {
    if (!domain) {
      return;
    }
    if (!involved.has(domain)) {
      involved.set(domain, new Set());
    }
    if (index != null) {
      involved.get(domain).add(index);
    }
  };
  const inspect = (pointer) => {
    let parts;
    try {
      parts = parsePointer(pointer);
    } catch {
      return;
    }
    if (parts[0] === "content" && parts.length >= 3 && /^\d+$/.test(parts[2])) {
      addDomain(parts[1], Number(parts[2]));
    } else if (parts[0] === "content" && parts.length >= 2) {
      addDomain(parts[1], null);
    } else if (parts[0] === "meta" && parts[1] === "manifest") {
      addDomain("manifest", null);
    }
    return parts;
  };

  for (const op of ops) {
    if (!isPlainObject(op)) {
      continue;
    }
    inspect(op.path);
    if (typeof op.from === "string") {
      inspect(op.from);
    }
  }
  return involved;
}

function validateAfter(project, ops) {
  const involved = collectInvolved(project, ops);
  const errors = [];
  for (const [domain, indices] of involved) {
    const module = domainModules[domain];
    if (!module || typeof module.validateEntry !== "function") {
      continue;
    }
    if (domain === "manifest") {
      const manifest = project && isPlainObject(project.meta) ? project.meta.manifest : null;
      for (const issue of module.validateEntry(manifest)) {
        if (issue.severity === "error") {
          errors.push({ code: issue.code, path: "meta.manifest" + (issue.path ? "." + issue.path : ""), messageZh: issue.messageZh });
        }
      }
      continue;
    }
    const list = isPlainObject(project.content) && Array.isArray(project.content[domain]) ? project.content[domain] : [];
    for (const index of indices) {
      if (index < 0 || index >= list.length) {
        continue;
      }
      for (const issue of module.validateEntry(list[index])) {
        if (issue.severity === "error") {
          errors.push({ code: issue.code, path: "content." + domain + "[" + index + "]" + (issue.path ? "." + issue.path : ""), messageZh: issue.messageZh });
        }
      }
    }
  }
  return errors;
}

export function applyPatch(project, ops) {
  const next = applyOperations(project, ops);
  const errors = validateAfter(next, ops);
  if (errors.length > 0) {
    const detail = errors
      .slice(0, 5)
      .map((err) => err.path + "：" + err.messageZh)
      .join("；");
    throw new Error(
      "补丁应用后校验未通过（" + errors.length + " 项错误）：" + detail + "。请先 previewDiff 确认，修正后再应用。"
    );
  }
  return next;
}
