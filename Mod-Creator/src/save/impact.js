// src/save/impact.js — 按 rules.js 判定改动对存档的影响。

import { IMPACT, SAVE_IMPACT, diffEntry, classifyPackage, maxLevel } from "./rules.js";

const LEVEL_LABELS = {
  compatible: "可无损兼容",
  confirm: "需确认风险后载入",
  repair: "需建独立角色副本",
  reject: "严格拒绝"
};

const DOMAIN_LABELS = {
  manifest: "清单",
  items: "道具",
  buffs: "增益",
  enemies: "敌人",
  encounters: "遭遇",
  "encounter-placements": "遭遇投放",
  maps: "地图",
  bazaars: "坊市",
  adventures: "冒险",
  scripts: "脚本"
};

const ID_FIELDS = {
  items: "numericId",
  buffs: "id",
  enemies: "enemyId",
  encounters: "encounterId",
  maps: "mapId",
  bazaars: "id",
  adventures: "id",
  scripts: "id"
};

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function domainLabel(domain) {
  return DOMAIN_LABELS[domain] || domain;
}

function pickId(entry, field) {
  if (entry == null) {
    return undefined;
  }
  if (entry[field] !== undefined) {
    return entry[field];
  }
  if (isPlainObject(entry.item) && entry.item[field] !== undefined) {
    return entry.item[field];
  }
  if (isPlainObject(entry.enemy) && entry.enemy[field] !== undefined) {
    return entry.enemy[field];
  }
  return undefined;
}

function idOf(entry, domain) {
  if (domain === "encounter-placements") {
    return String(entry && entry.mapId) + "::" + String(entry && entry.regionId);
  }
  const field = ID_FIELDS[domain];
  if (!field) {
    return undefined;
  }
  const id = pickId(entry, field);
  return id === undefined || id === null ? null : id;
}

function reason(code, messageZh, level) {
  return { code, messageZh, level };
}

function levelsOf(reasons) {
  let level = IMPACT.COMPATIBLE;
  for (const item of reasons) {
    level = maxLevel(level, item.level);
  }
  return level;
}

function protectedReason(paths) {
  const detail = paths.length > 0 ? "（" + paths.slice(0, 3).join("、") + "）" : "";
  return reason(
    "protected.changed",
    "触碰受保护指纹，旧档不能无损升级，需按「确认/修复副本」处理，非无损" + detail,
    IMPACT.REPAIR
  );
}

function itemChange(before, after) {
  const result = diffEntry("items", before, after);
  if (before == null && after != null) {
    return { saveImpact: SAVE_IMPACT.ADDITIVE, level: IMPACT.COMPATIBLE, protectedChanged: false, reasons: [reason("items.added", "新增条目，属无损新增，不影响旧档", IMPACT.COMPATIBLE)] };
  }
  if (after == null) {
    return { saveImpact: SAVE_IMPACT.RULESET, level: IMPACT.CONFIRM, protectedChanged: false, reasons: [reason("entry.removed", "删除条目属规则集变更，旧档需确认风险后载入", IMPACT.CONFIRM)] };
  }
  const mode = isPlainObject(after) ? after.mode : undefined;
  if (mode === "override") {
    return { saveImpact: SAVE_IMPACT.RULESET, level: IMPACT.CONFIRM, protectedChanged: false, reasons: [reason("entry.override", "使用 override 覆写官方内容，属规则集变更，旧档需确认风险后载入", IMPACT.CONFIRM)] };
  }
  if (mode === "delete") {
    return { saveImpact: SAVE_IMPACT.RULESET, level: IMPACT.CONFIRM, protectedChanged: false, reasons: [reason("entry.delete", "使用 delete 删除声明，属规则集变更，旧档需确认风险后载入", IMPACT.CONFIRM)] };
  }
  const reasons = [];
  if (result.protectedChanged) {
    reasons.push(protectedReason(result.changedPaths));
  } else if (result.changedPaths.length > 0) {
    reasons.push(reason("content.changed", "仅表现/数值变化（图标、文案、触发方式、角色、效果数值等），可无损兼容", IMPACT.COMPATIBLE));
  } else {
    reasons.push(reason("content.same", "内容无变化", IMPACT.COMPATIBLE));
  }
  return {
    saveImpact: result.category,
    level: levelsOf(reasons),
    protectedChanged: result.protectedChanged,
    reasons
  };
}

function genericChange(domain, before, after) {
  const result = diffEntry(domain, before, after);
  const label = domainLabel(domain);
  if (before == null && after != null) {
    return { saveImpact: SAVE_IMPACT.ADDITIVE, level: IMPACT.COMPATIBLE, protectedChanged: false, reasons: [reason("entry.added", "新增" + label + "条目，属无损新增", IMPACT.COMPATIBLE)] };
  }
  if (after == null) {
    return { saveImpact: SAVE_IMPACT.RULESET, level: IMPACT.CONFIRM, protectedChanged: false, reasons: [reason("entry.removed", "删除" + label + "条目属规则集变更，旧档需确认风险后载入", IMPACT.CONFIRM)] };
  }
  const mode = isPlainObject(after) ? after.mode : undefined;
  if (mode === "override") {
    return { saveImpact: SAVE_IMPACT.RULESET, level: IMPACT.CONFIRM, protectedChanged: false, reasons: [reason("entry.override", label + "使用 override，属规则集变更，旧档需确认风险后载入", IMPACT.CONFIRM)] };
  }
  if (mode === "delete") {
    return { saveImpact: SAVE_IMPACT.RULESET, level: IMPACT.CONFIRM, protectedChanged: false, reasons: [reason("entry.delete", label + "使用 delete，属规则集变更，旧档需确认风险后载入", IMPACT.CONFIRM)] };
  }
  if (result.changedPaths.length === 0) {
    return { saveImpact: SAVE_IMPACT.ADDITIVE, level: IMPACT.COMPATIBLE, protectedChanged: false, reasons: [reason("content.same", "内容无变化", IMPACT.COMPATIBLE)] };
  }
  return { saveImpact: SAVE_IMPACT.RULESET, level: IMPACT.CONFIRM, protectedChanged: false, reasons: [reason("domain.changed", label + "定义变化属规则集变更，旧档需确认风险后载入", IMPACT.CONFIRM)] };
}

export function assessChange(domain, beforeEntry, afterEntry) {
  if (domain === "manifest") {
    const before = isPlainObject(beforeEntry) ? beforeEntry : {};
    const after = isPlainObject(afterEntry) ? afterEntry : {};
    const reasons = [];
    const beforeSave = before.saveCompatibility;
    const afterSave = after.saveCompatibility;
    if (JSON.stringify(beforeSave) !== JSON.stringify(afterSave)) {
      if (afterSave != null) {
        reasons.push(reason("saveCompatibility.changed", "改动存档兼容声明 saveCompatibility，属规则集变更，旧档需确认风险后载入", IMPACT.CONFIRM));
      } else {
        reasons.push(reason("saveCompatibility.removed", "移除存档兼容声明 saveCompatibility，旧档可能被拒绝载入", IMPACT.REPAIR));
      }
    }
    if (reasons.length === 0) {
      return { level: IMPACT.COMPATIBLE, saveImpact: SAVE_IMPACT.ADDITIVE, protectedChanged: false, reasons: [reason("manifest.same", "清单无影响存档的变化", IMPACT.COMPATIBLE)] };
    }
    return { level: levelsOf(reasons), saveImpact: SAVE_IMPACT.RULESET, protectedChanged: false, reasons };
  }
  const result = domain === "items" ? itemChange(beforeEntry, afterEntry) : genericChange(domain, beforeEntry, afterEntry);
  return {
    level: result.level,
    saveImpact: result.saveImpact,
    protectedChanged: result.protectedChanged,
    reasons: result.reasons
  };
}

function declaredDomains(project) {
  const manifest = project && isPlainObject(project.meta) ? project.meta.manifest : null;
  const set = new Set();
  if (manifest && isPlainObject(manifest.domains)) {
    for (const key of Object.keys(manifest.domains)) {
      set.add(key);
    }
  }
  if (project && isPlainObject(project.content)) {
    for (const key of Object.keys(project.content)) {
      if (key === "assets") {
        continue;
      }
      const list = project.content[key];
      if (Array.isArray(list) && list.length > 0) {
        set.add(key);
      }
    }
  }
  return Array.from(set);
}

function contentOf(project, domain) {
  if (project && isPlainObject(project.content)) {
    const list = project.content[domain];
    return Array.isArray(list) ? list : [];
  }
  return [];
}

export function assessProject(project) {
  const domains = declaredDomains(project);
  const items = [];

  for (const domain of domains) {
    for (const entry of contentOf(project, domain)) {
      const change = assessChange(domain, null, entry);
      items.push({
        domain,
        id: idOf(entry, domain),
        level: change.level,
        saveImpact: change.saveImpact,
        protectedChanged: change.protectedChanged,
        reasons: change.reasons
      });
    }
  }

  const manifest = project && isPlainObject(project.meta) ? project.meta.manifest : null;
  if (manifest && manifest.saveCompatibility != null) {
    items.push({
      domain: "manifest",
      id: "manifest",
      level: IMPACT.CONFIRM,
      saveImpact: SAVE_IMPACT.RULESET,
      protectedChanged: false,
      reasons: [reason("saveCompatibility.declared", "已声明 saveCompatibility，旧档按声明范围与 contentRevision 判级", IMPACT.CONFIRM)]
    });
  }

  const packageClass = classifyPackage(domains, project);
  let level = packageClass.level;
  let saveImpact = packageClass.saveImpact;
  for (const item of items) {
    level = maxLevel(level, item.level);
    if (item.saveImpact === SAVE_IMPACT.RULESET) {
      saveImpact = SAVE_IMPACT.RULESET;
    }
  }

  return { saveImpact, level, items };
}

function countReasons(items, level) {
  return items.filter((item) => item.level === level).length;
}

export function assessExport(project) {
  const result = assessProject(project);
  const level = result.level;
  const parts = [];
  if (result.saveImpact === SAVE_IMPACT.ADDITIVE) {
    parts.push("本包为纯新增（additive），旧档可创建兼容副本后载入");
  } else {
    parts.push("本包含规则集变更（override/delete/maps/scripts/固定槽替换等），不适用「创建兼容副本」，旧档门禁严格");
  }
  parts.push("综合判定：" + LEVEL_LABELS[level]);
  const protectedCount = result.items.filter((item) => item.protectedChanged).length;
  if (protectedCount > 0) {
    parts.push("其中 " + protectedCount + " 项触碰受保护指纹，旧档不能无损升级");
  }
  return {
    level,
    saveImpact: result.saveImpact,
    items: result.items,
    summaryZh: parts.join("；") + "。"
  };
}

export { LEVEL_LABELS };
