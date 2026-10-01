// src/save/rules.js — 存档影响规则表：受保护字段与 saveImpact 分类（纯数据 + 纯函数）。

export const IMPACT = {
  COMPATIBLE: "compatible",
  CONFIRM: "confirm",
  REPAIR: "repair",
  REJECT: "reject"
};

export const SAVE_IMPACT = {
  ADDITIVE: "additive",
  RULESET: "ruleset"
};

export const LEVEL_ORDER = {
  compatible: 0,
  confirm: 1,
  repair: 2,
  reject: 3
};

export const PROTECTED_SPELL_BINDINGS = [
  "sourceScriptureNumericId",
  "unlockLayer",
  "rewardKind"
];

export const PROTECTED_SCRIPTURE_LAYER_FIELDS = [
  "requirements",
  "breakthroughTargetProgress",
  "breakthroughTimeLimitSec",
  "breakthroughCooldownSec",
  "effects"
];

export const SPELL_BINDING_RE = /(^|\.)spell\.(sourceScriptureNumericId|unlockLayer|rewardKind)(\.|$)/;

export const SCRIPTURE_PATH_RE = /scriptureProgression/;

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function change(path, before, after, out) {
  if (before === after) {
    return;
  }
  if (
    before === null ||
    after === null ||
    typeof before !== "object" ||
    typeof after !== "object"
  ) {
    out.push(path);
    return;
  }
  const beforeArray = Array.isArray(before);
  const afterArray = Array.isArray(after);
  if (beforeArray || afterArray) {
    if (!beforeArray || !afterArray || before.length !== after.length) {
      out.push(path);
    }
    if (beforeArray && afterArray) {
      const length = Math.min(before.length, after.length);
      for (let i = 0; i < length; i += 1) {
        change(path + "[" + i + "]", before[i], after[i], out);
      }
    }
    return;
  }
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  for (const key of keys) {
    change(path ? path + "." + key : key, before[key], after[key], out);
  }
}

function changedPaths(before, after) {
  const out = [];
  change("", before, after, out);
  return out;
}

function unwrapItem(entry) {
  if (isPlainObject(entry) && isPlainObject(entry.item)) {
    return entry.item;
  }
  return entry;
}

function effectKindAt(item, index) {
  if (!isPlainObject(item) || !Array.isArray(item.effectList)) {
    return undefined;
  }
  const effect = item.effectList[index];
  return isPlainObject(effect) ? effect.kind : undefined;
}

function hasScriptureProgression(item) {
  if (!isPlainObject(item) || !Array.isArray(item.effectList)) {
    return false;
  }
  return item.effectList.some((effect) => isPlainObject(effect) && effect.kind === "scriptureProgression");
}

function isProtectedItemPath(path, beforeItem, afterItem) {
  if (SPELL_BINDING_RE.test(path)) {
    return true;
  }
  if (SCRIPTURE_PATH_RE.test(path)) {
    return true;
  }
  const match = /^effectList\[(\d+)\]/.exec(path);
  if (match) {
    const index = Number(match[1]);
    const beforeKind = effectKindAt(beforeItem, index);
    const afterKind = effectKindAt(afterItem, index);
    if (beforeKind === "scriptureProgression" || afterKind === "scriptureProgression") {
      return true;
    }
  }
  if (path === "effectList" && (hasScriptureProgression(beforeItem) || hasScriptureProgression(afterItem))) {
    return true;
  }
  return false;
}

function unchanged() {
  return { changedPaths: [], protectedChanged: false, category: SAVE_IMPACT.ADDITIVE };
}

function additive(paths) {
  return { changedPaths: paths, protectedChanged: false, category: SAVE_IMPACT.ADDITIVE };
}

function ruleset(paths, protectedChanged) {
  return {
    changedPaths: paths,
    protectedChanged: Boolean(protectedChanged),
    category: SAVE_IMPACT.RULESET
  };
}

function diffItem(before, after) {
  if (before == null && after == null) {
    return unchanged();
  }
  if (before == null) {
    return additive([]);
  }
  if (after == null) {
    return ruleset(["(removed)"], false);
  }
  const afterMode = isPlainObject(after) ? after.mode : undefined;
  if (afterMode === "override") {
    return ruleset(["(override)"], false);
  }
  if (afterMode === "delete") {
    return ruleset(["(delete)"], false);
  }
  const beforeItem = unwrapItem(before);
  const afterItem = unwrapItem(after);
  const paths = changedPaths(beforeItem, afterItem);
  if (paths.length === 0) {
    return unchanged();
  }
  const protectedChanged = paths.some((path) => isProtectedItemPath(path, beforeItem, afterItem));
  if (protectedChanged) {
    return ruleset(paths, true);
  }
  return additive(paths);
}

function diffGeneric(domain, before, after) {
  void domain;
  if (before == null && after == null) {
    return unchanged();
  }
  if (before == null) {
    return additive([]);
  }
  if (after == null) {
    return ruleset(["(removed)"], false);
  }
  const afterMode = isPlainObject(after) ? after.mode : undefined;
  if (afterMode === "override" || afterMode === "delete") {
    return ruleset(["(override)"], false);
  }
  const paths = changedPaths(before, after);
  if (paths.length === 0) {
    return unchanged();
  }
  return ruleset(paths, false);
}

export function diffEntry(domain, before, after) {
  if (domain === "items") {
    return diffItem(before, after);
  }
  return diffGeneric(domain, before, after);
}

function declaredDomains(domains, project) {
  if (Array.isArray(domains)) {
    return domains.slice();
  }
  if (typeof domains === "string") {
    return [domains];
  }
  if (domains && typeof domains === "object") {
    return Object.keys(domains);
  }
  const manifest = project && isPlainObject(project.meta) ? project.meta.manifest : null;
  if (manifest && isPlainObject(manifest.domains)) {
    return Object.keys(manifest.domains);
  }
  return [];
}

function contentOf(project, domain) {
  if (project && isPlainObject(project.content)) {
    const list = project.content[domain];
    return Array.isArray(list) ? list : [];
  }
  return [];
}

export function classifyPackage(domains, project) {
  const items = contentOf(project, "items");
  const domainSet = new Set(declaredDomains(domains, project));
  const placements = contentOf(project, "encounter-placements");
  const encounters = contentOf(project, "encounters");

  const hasOverride = items.some((entry) => isPlainObject(entry) && entry.mode === "override");
  const hasDelete = items.some((entry) => isPlainObject(entry) && entry.mode === "delete");
  const hasMaps = domainSet.has("maps") || contentOf(project, "maps").length > 0;
  const hasScripts = domainSet.has("scripts") || contentOf(project, "scripts").length > 0;
  const hasFixedSlot =
    placements.some((entry) => isPlainObject(entry) && entry.mode === "overrideFixedNode") ||
    encounters.some(
      (entry) =>
        isPlainObject(entry) &&
        (entry.mode === "overrideTutorial" || entry.mode === "overrideFixedNode")
    );
  const hasScriptureSpellPool = items.some((entry) => {
    if (!isPlainObject(entry) || entry.mode !== "add") {
      return false;
    }
    const item = unwrapItem(entry);
    const distribution = isPlainObject(item) ? item.distribution : null;
    return (
      isPlainObject(distribution) &&
      Array.isArray(distribution.channels) &&
      distribution.channels.includes("scriptureSpellReward")
    );
  });

  const rulesetImpact = hasOverride || hasDelete || hasMaps || hasScripts || hasFixedSlot || hasScriptureSpellPool;
  return {
    saveImpact: rulesetImpact ? SAVE_IMPACT.RULESET : SAVE_IMPACT.ADDITIVE,
    level: rulesetImpact ? IMPACT.CONFIRM : IMPACT.COMPATIBLE
  };
}

export function maxLevel(a, b) {
  const left = LEVEL_ORDER[a];
  const right = LEVEL_ORDER[b];
  if (left === undefined) {
    return b;
  }
  if (right === undefined) {
    return a;
  }
  return left >= right ? a : b;
}
