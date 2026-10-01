// src/save/notify.js — 存档影响提醒 UI：非阻断横幅与导出前汇总（DOM，浏览器）。

import { LEVEL_LABELS, assessExport } from "./impact.js";
import { LEVEL_ORDER } from "./rules.js";

const FALLBACK_LABELS = {
  compatible: "可无损兼容",
  confirm: "需确认风险后载入",
  repair: "需建独立角色副本",
  reject: "严格拒绝"
};

function levelText(level) {
  return LEVEL_LABELS[level] || FALLBACK_LABELS[level] || "未知影响";
}

function resolveLevel(assessment) {
  const level = assessment && assessment.level;
  if (LEVEL_ORDER[level] !== undefined) {
    return level;
  }
  return "compatible";
}

function worstReason(reasons) {
  let worst = null;
  for (const reason of reasons) {
    const order = LEVEL_ORDER[reason.level] || 0;
    const worstOrder = worst ? LEVEL_ORDER[worst.level] || 0 : -1;
    if (order > worstOrder) {
      worst = reason;
    }
  }
  return worst;
}

function summaryText(assessment, level, reasons) {
  if (assessment && typeof assessment.summaryZh === "string" && assessment.summaryZh) {
    return assessment.summaryZh;
  }
  const base = levelText(level);
  const worst = worstReason(reasons);
  if (!worst || !worst.messageZh) {
    return base;
  }
  return base + "：" + worst.messageZh;
}

function formatItemLine(item) {
  const label = levelText(item.level);
  const idText = item.id == null ? "" : " · " + String(item.id);
  return "[" + label + "] " + (item.domain || "") + idText;
}

export function createImpactBanner(assessment) {
  if (typeof document === "undefined") {
    return null;
  }
  const level = resolveLevel(assessment);
  const banner = document.createElement("div");
  banner.className = "pc-impact pc-impact-" + level;
  banner.setAttribute("role", "status");

  const head = document.createElement("div");
  head.className = "pc-impact-head";

  const badge = document.createElement("span");
  badge.className = "pc-impact-badge";
  badge.textContent = levelText(level);
  head.appendChild(badge);

  const summary = document.createElement("span");
  summary.className = "pc-impact-summary";
  const reasons = Array.isArray(assessment && assessment.reasons) ? assessment.reasons : [];
  summary.textContent = summaryText(assessment, level, reasons);
  head.appendChild(summary);

  const saveImpact = assessment && assessment.saveImpact;
  if (saveImpact) {
    const tag = document.createElement("span");
    tag.className = "pc-impact-tag";
    tag.textContent = saveImpact === "additive" ? "纯新增 additive" : "规则集 ruleset";
    head.appendChild(tag);
  }

  if (reasons.length > 0) {
    const details = document.createElement("ul");
    details.className = "pc-impact-details";
    details.hidden = true;
    for (const reason of reasons) {
      const li = document.createElement("li");
      li.className = "pc-impact-reason";
      const code = document.createElement("span");
      code.className = "pc-impact-code";
      code.textContent = reason.code || "";
      const text = document.createElement("span");
      text.className = "pc-impact-message";
      text.textContent = reason.messageZh || "";
      li.appendChild(code);
      li.appendChild(text);
      details.appendChild(li);
    }

    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "pc-impact-toggle";
    toggle.textContent = "详情（" + reasons.length + "）";
    toggle.addEventListener("click", () => {
      details.hidden = !details.hidden;
    });
    head.appendChild(toggle);
    banner.appendChild(head);
    banner.appendChild(details);
  } else {
    banner.appendChild(head);
  }

  return banner;
}

function detailsFromItems(items) {
  const reasons = [];
  for (const item of items) {
    const itemReasons = Array.isArray(item.reasons) ? item.reasons : [];
    if (itemReasons.length === 0) {
      reasons.push({ code: "item", messageZh: formatItemLine(item), level: item.level });
      continue;
    }
    for (const reason of itemReasons) {
      reasons.push(reason);
    }
  }
  return reasons;
}

export function summarizeForExport(project) {
  const assessment = assessExport(project);
  const composite = {
    level: assessment.level,
    saveImpact: assessment.saveImpact,
    summaryZh: assessment.summaryZh,
    reasons: detailsFromItems(assessment.items || [])
  };
  const element = createImpactBanner(composite);
  return { element, text: assessment.summaryZh };
}

export function warnImpact(assessment) {
  if (typeof document === "undefined") {
    return null;
  }
  let host = document.getElementById("pc-impact");
  if (!host) {
    if (!document.body) {
      return null;
    }
    host = document.createElement("div");
    host.id = "pc-impact";
    host.className = "pc-impact-host";
    document.body.appendChild(host);
  }
  host.className = "pc-impact-host";
  host.textContent = "";
  if (!assessment) {
    return null;
  }
  host.dataset.level = resolveLevel(assessment);
  const banner = createImpactBanner(assessment);
  if (banner) {
    host.appendChild(banner);
  }
  return host;
}
