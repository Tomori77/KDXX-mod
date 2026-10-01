import { domainModules } from "../domains/index.js";

export const INTERFACE_CONSTRAINTS_ZH = [
  "社区接口约束（务必遵守）：",
  "1. 新增道具的 numericId 必须落在社区号段：功法 190001–199999、丹药 390001–399999、法器/宝箱 490001–499999、材料 590001–599999、阵法 690001–699999、符箓 790001–799999、招式 890001–899999、投掷物 990001–999999。",
  "2. 每条效果（effectList 元素）必须在顶层写非空 label；0.1.9 起游戏只读顶层 label，为空则游戏内不显示。",
  "3. 主动招式路径上的 itemRuntimeStatus executor 必须显式写 amount（缺省会按 0 处理，整条 executor 被丢弃而静默失效）；periodicPulse 的敌方状态应写在 periodicPulse.itemRuntimeStatusEffects，executors[].itemRuntimeStatus 的 targetScope 只允许 self。",
  "4. passiveEffect.type = globalOutputModifier 在 0.1.12 运行时无消费、被动无效；需要修为倍率请改用主动 executor temporaryAllCultivationGainMultiplier（amount 为倍率，如 2 表示 ×2）。",
  "5. 招式 spell.unlockLayer 必须 ≥ 2（第 1 层为免费入门层，不授予任何招式）。",
  "6. 功法 scriptureProgression 的每一层写累计值（不是相对上一层的增量）。"
].join("\n");

const BATTLE_MECHANICS_ZH = [
  "《口袋修仙》战斗机制要点：双方各有一个储物袋网格，袋中道具按各自周期自动轮转结算；战斗按每 1 秒一 tick 实时推进，同一秒内的效果按格子从左上到右下顺序结算。",
  "Buff 可叠层且每层独立计时，部分 Buff 互相抵消；功法分层数（scriptureProgression），随修为突破解锁更高层效果与新招式，招式由 sourceScriptureNumericId + unlockLayer 绑定。"
].join("\n");

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function entryId(entry) {
  if (!isPlainObject(entry)) {
    return "";
  }
  if (isPlainObject(entry.item) && entry.item.numericId != null) {
    return String(entry.item.numericId);
  }
  if (entry.numericId != null) {
    return String(entry.numericId);
  }
  if (entry.id != null) {
    return String(entry.id);
  }
  return "";
}

function fallbackSummary(entry) {
  if (!isPlainObject(entry)) {
    return "（条目）";
  }
  const name = entry.name || (isPlainObject(entry.item) ? entry.item.name : "") || entry.id;
  return typeof name === "string" && name ? name : "（条目）";
}

export function summarizeProject(project) {
  const domains = [];
  const entries = [];
  const source = isPlainObject(project) ? project : {};
  const manifest = isPlainObject(source.meta) && isPlainObject(source.meta.manifest) ? source.meta.manifest : null;

  if (manifest) {
    domains.push("manifest");
    const module = domainModules.manifest;
    entries.push({
      domain: "manifest",
      id: manifest.id || "",
      summary: module && typeof module.summarize === "function" ? module.summarize(manifest) : fallbackSummary(manifest)
    });
  }

  const content = isPlainObject(source.content) ? source.content : {};
  for (const domain of Object.keys(content)) {
    if (!Array.isArray(content[domain])) {
      continue;
    }
    domains.push(domain);
    const module = domainModules[domain];
    for (const entry of content[domain]) {
      entries.push({
        domain,
        id: entryId(entry),
        summary: module && typeof module.summarize === "function" ? module.summarize(entry) : fallbackSummary(entry)
      });
    }
  }

  return { domains, entries };
}

function summaryText(summary) {
  const lines = ["工程域：" + (summary.domains.length > 0 ? summary.domains.join(", ") : "无")];
  if (summary.entries.length === 0) {
    lines.push("（当前工程没有任何条目）");
    return lines.join("\n");
  }
  for (const entry of summary.entries) {
    lines.push("- [" + entry.domain + "] " + entry.id + " — " + entry.summary);
  }
  return lines.join("\n");
}

export function buildAdviceMessages(project, userQuestion = "") {
  const summary = summarizeProject(project);
  const system = [
    "你是《口袋修仙》Mod 设计顾问，只输出简体中文建议。",
    BATTLE_MECHANICS_ZH,
    INTERFACE_CONSTRAINTS_ZH,
    "请结合上述战斗机制（双储物袋、每 1 秒一 tick、buff 叠层、功法层数）与接口约束，针对用户工程给出流派方向、数值配平与合规性建议。只依据上下文中的摘要作答，不要臆造工程里不存在的字段。"
  ].join("\n\n");
  const question = typeof userQuestion === "string" ? userQuestion.trim() : "";
  const user = [
    "当前工程精简摘要（非全量 JSON，不含资源与密钥）：",
    summaryText(summary),
    question ? "\n用户问题：" + question : "\n请对该工程给出整体设计建议。"
  ].join("\n");
  return [
    { role: "system", content: system },
    { role: "user", content: user }
  ];
}

export function buildDiffMessages(project, instruction) {
  const summary = summarizeProject(project);
  const system = [
    "你是《口袋修仙》Mod 修改器，只能输出 RFC6902 JSON Patch 数组。",
    "严格要求：只返回一个 JSON 数组，数组元素形如 {\"op\":\"replace\",\"path\":\"/content/items/0/item/name\",\"value\":\"新名称\"}；不要输出任何解释、Markdown 代码块标记或多余文本。",
    "op 只能是 add/remove/replace/move/copy/test 之一；path 必须以 / 开头，使用 RFC6901 JSON Pointer，数组下标用数字。",
    "可被修改的路径示例：/content/items/0/item/effectList、/content/items/0/item/name、/content/items/0/item/description、/content/items/0/item/grade、/content/manifest/name（仅限工程 content 与 meta 内的已有字段）。",
    INTERFACE_CONSTRAINTS_ZH
  ].join("\n");
  const ask = typeof instruction === "string" ? instruction.trim() : "";
  const user = [
    "当前工程精简摘要（非全量 JSON，不含资源与密钥）：",
    summaryText(summary),
    ask ? "\n修改要求：" + ask : "\n请根据工程现状给出改进补丁。"
  ].join("\n");
  return [
    { role: "system", content: system },
    { role: "user", content: user }
  ];
}
