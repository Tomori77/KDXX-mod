// tools/smoke-domains.mjs — 永久契约冒烟：校验 src/domains 全部域的 §3.2 接口形状。

import { domainModules } from "../src/domains/index.js";

const MOD_ID = "com.smoke.test";

const EXPORTS = [
  "meta",
  "createEntry",
  "fields",
  "validateEntry",
  "validateProject",
  "toFiles",
  "fromFiles",
  "summarize"
];

const SEEDS = {
  manifest: { id: MOD_ID },
  items: { item: { numericId: 590001 } },
  buffs: { id: MOD_ID + ":smoke" },
  enemies: { enemyId: MOD_ID + ":smoke" },
  encounters: { encounterId: MOD_ID + ":smoke" },
  "encounter-placements": { encounterId: MOD_ID + ":smoke" },
  maps: { mapId: MOD_ID + ":smoke" },
  bazaars: { id: MOD_ID + ":smoke" },
  adventures: { id: MOD_ID + ":smoke" },
  scripts: { id: MOD_ID + ":smoke" }
};

const notes = [];
const failures = [];

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function exportOnce(key, module, entry) {
  if (key === "manifest") {
    return module.toFiles(entry, { modId: MOD_ID });
  }
  return module.toFiles([entry], { modId: MOD_ID });
}

function check(key, label, condition, detail) {
  if (!condition) {
    failures.push("[" + key + "] " + label + (detail ? " — " + detail : ""));
  }
}

for (const [key, module] of Object.entries(domainModules)) {
  check(key, "module 是命名空间对象", isPlainObject(module));

  for (const name of EXPORTS) {
    const value = module[name];
    if (name === "meta") {
      check(key, "meta 是对象", isPlainObject(value), typeof value);
    } else {
      check(key, name + " 是函数", typeof value === "function", typeof value);
    }
  }

  const entry = module.createEntry();
  check(key, "createEntry() 返回对象", isPlainObject(entry), typeof entry);

  const fields = module.fields();
  check(key, "fields() 返回数组", Array.isArray(fields));
  if (Array.isArray(fields)) {
    fields.forEach((field, index) => {
      check(key, "fields()[" + index + "] 含 path/control/label", isPlainObject(field));
      if (isPlainObject(field)) {
        check(key, "fields()[" + index + "].path 是字符串", typeof field.path === "string");
        check(key, "fields()[" + index + "].control 是字符串", typeof field.control === "string");
        check(key, "fields()[" + index + "].label 是字符串", typeof field.label === "string");
      }
    });
  }

  const validation = module.validateEntry(module.createEntry());
  check(key, "validateEntry() 返回数组", Array.isArray(validation));
  if (Array.isArray(validation)) {
    validation.forEach((result, index) => {
      check(key, "validateEntry()[" + index + "] 含 code/path/messageZh/severity", isPlainObject(result));
      if (isPlainObject(result)) {
        check(key, "validateEntry()[" + index + "].code 是字符串", typeof result.code === "string");
        check(key, "validateEntry()[" + index + "].path 是字符串", typeof result.path === "string");
        check(key, "validateEntry()[" + index + "].messageZh 是字符串", typeof result.messageZh === "string");
        check(key, "validateEntry()[" + index + "].severity 是字符串", typeof result.severity === "string");
      }
    });
  }

  const summary = module.summarize(module.createEntry());
  check(
    key,
    "summarize() 返回非空字符串",
    typeof summary === "string" && summary.trim().length > 0,
    JSON.stringify(summary)
  );

  const seeded = module.createEntry(SEEDS[key] || {});
  let files = null;
  try {
    files = exportOnce(key, module, seeded);
  } catch (error) {
    check(key, "toFiles() 不抛错", false, error && error.message);
  }
  if (files !== null) {
    check(key, "toFiles() 返回非空数组", Array.isArray(files) && files.length > 0);
    if (Array.isArray(files)) {
      files.forEach((file, index) => {
        check(key, "toFiles()[" + index + "] 含 path/content", isPlainObject(file));
        if (isPlainObject(file)) {
          check(key, "toFiles()[" + index + "].path 是字符串", typeof file.path === "string");
          check(key, "toFiles()[" + index + "].content 是字符串", typeof file.content === "string");
        }
      });
    }
    try {
      module.fromFiles(files, { modId: MOD_ID });
    } catch (error) {
      check(key, "fromFiles() 回读不抛错", false, error && error.message);
    }
  }

  if (key === "manifest") {
    notes.push("manifest.toFiles 接受单条 entry（非数组），冒烟按单条调用");
  }
  if (key === "items") {
    notes.push("items.createEntry() 的 numericId 为 null，直接 toFiles 会抛错，冒烟注入社区号段 590001");
  }

  if (failures.some((line) => line.startsWith("[" + key + "]"))) {
    console.log(key + ": FAIL");
  } else {
    console.log(key + ": OK");
  }
}

if (notes.length > 0) {
  console.log("");
  console.log("NOTES:");
  for (const note of notes) {
    console.log("  - " + note);
  }
}

if (failures.length > 0) {
  console.log("");
  console.log("FAILURES (" + failures.length + "):");
  for (const line of failures) {
    console.log("  " + line);
  }
  process.exit(1);
}

console.log("");
console.log("smoke: all domains OK");
process.exit(0);
