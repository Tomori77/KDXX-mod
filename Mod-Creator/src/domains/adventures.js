import { enemies } from "../generated/catalogs.js";

const SCHEMA_FILE = "adventures@1 · adventure.schema.json";
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const SLUG_PATTERN = "^[a-z0-9]+(?:-[a-z0-9]+)*$";
const NODE_ID_RE = /^[a-z0-9]+(?:[_-][a-z0-9]+)*$/;
const NODE_ID_PATTERN = "^[a-z0-9]+(?:[_-][a-z0-9]+)*$";
const ENCOUNTER_ID_RE = /^[a-z0-9]+(?:[.-][a-z0-9]+)+:[a-z0-9]+(?:-[a-z0-9]+)*$/;
const OFFICIAL_MAP_RE = /^map_[0-9]{2,3}$/;

const KINDS = ["flow", "interaction"];
const FLOW_ROOT = ["kind", "id", "name", "startStepId", "steps", "ui"];
const INTERACTION_ROOT = ["kind", "id", "flowId", "mapId", "nodeId", "name", "npc", "cooldownDays"];

const CONDITION_TYPES = [
  { value: "spiritStones", label: "灵石（spiritStones）" },
  { value: "inventoryItem", label: "仓库道具（inventoryItem）" },
  { value: "variable", label: "变量（variable）" },
  { value: "battleWon", label: "已胜战斗（battleWon）" },
  { value: "interactionCompleted", label: "已完成交互（interactionCompleted）" }
];
const EFFECT_TYPES = [
  { value: "spiritStones", label: "灵石（spiritStones）" },
  { value: "giveItem", label: "给予道具（giveItem）" },
  { value: "takeInventoryItem", label: "收取道具（takeInventoryItem）" },
  { value: "setVariable", label: "设置变量（setVariable）" }
];
const CONDITION_TYPE_SET = new Set(CONDITION_TYPES.map((item) => item.value));
const EFFECT_TYPE_SET = new Set(EFFECT_TYPES.map((item) => item.value));

const NPC_OPTIONS = enemies
  .filter((enemy) => enemy.enemyType === "npc")
  .map((enemy) => ({ value: enemy.enemyId, label: enemy.name + "（" + enemy.enemyId + "）" }));
const NPC_IDS = new Set(NPC_OPTIONS.map((option) => option.value));

export const meta = {
  key: "adventures",
  labelZh: "冒险",
  schemaVersion: 1,
  schemaFile: SCHEMA_FILE
};

function error(code, path, messageZh) {
  return { code, path, messageZh, severity: "error" };
}

function warning(code, path, messageZh) {
  return { code, path, messageZh, severity: "warning" };
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isBlank(value) {
  return value == null || (typeof value === "string" && value.trim() === "");
}

function isInteger(value) {
  return typeof value === "number" && Number.isInteger(value);
}

function collectEntries(project, domain) {
  if (Array.isArray(project)) {
    return project;
  }
  if (project && isPlainObject(project.content) && Array.isArray(project.content[domain])) {
    return project.content[domain];
  }
  return [];
}

function collectMaps(project) {
  if (project && isPlainObject(project.content) && Array.isArray(project.content.maps)) {
    return project.content.maps;
  }
  return [];
}

function findMapById(maps, mapId) {
  return maps.find((map) => isPlainObject(map) && map.mapId === mapId) || null;
}

function hasUndirectedEdge(edges, from, to) {
  if (!Array.isArray(edges)) {
    return false;
  }
  return edges.some(
    (edge) => isPlainObject(edge) && ((edge.from === from && edge.to === to) || (edge.from === to && edge.to === from))
  );
}

function schema(pointer) {
  return SCHEMA_FILE + (pointer || "");
}

function slugOf(id) {
  if (typeof id !== "string") {
    return "";
  }
  const index = id.lastIndexOf(":");
  return index >= 0 ? id.slice(index + 1) : id;
}

function kindOf(entry) {
  return isPlainObject(entry) && entry.kind === "interaction" ? "interaction" : "flow";
}

export function createEntry(partial = {}) {
  if (isPlainObject(partial) && partial.kind === "interaction") {
    const interactionSkeleton = {
      kind: "interaction",
      id: "",
      flowId: "",
      mapId: "",
      nodeId: "",
      name: "",
      cooldownDays: 1,
      npc: {
        description: "",
        displayTitle: "",
        showQuestMarker: false,
        enemyId: "",
        routeNodeIds: [],
        dwellDays: 30,
        sparEncounterId: "",
        captureEncounterId: "",
        killEncounterId: ""
      }
    };
    const next = { ...interactionSkeleton, ...partial };
    if (isPlainObject(partial.npc)) {
      next.npc = { ...interactionSkeleton.npc, ...partial.npc };
    }
    return next;
  }
  const skeleton = {
    kind: "flow",
    id: "",
    name: "",
    startStepId: "start",
    steps: [{ id: "start", title: "", body: "", terminal: true, options: [] }],
    ui: { layout: "list", tone: "jade", queries: [] }
  };
  return { ...skeleton, ...partial };
}

export function fields() {
  return [
    {
      path: "kind",
      control: "select",
      label: "类型",
      required: true,
      options: [
        { value: "flow", label: "流程（flow）" },
        { value: "interaction", label: "交互（interaction）" }
      ],
      schema: schema("/anyOf/0/properties/kind")
    },
    {
      path: "id",
      control: "text",
      label: "ID（3–160 字，建议 <mod-id>:<slug>）",
      required: true,
      kinds: ["flow", "interaction"],
      schema: schema("/anyOf/0/properties/id")
    },
    {
      path: "name",
      control: "text",
      label: "名称",
      required: true,
      kinds: ["flow"],
      schema: schema("/anyOf/0/properties/name")
    },
    {
      path: "startStepId",
      control: "text",
      label: "起始步骤（startStepId，必须存在于 steps）",
      required: true,
      pattern: SLUG_PATTERN,
      kinds: ["flow"],
      schema: schema("/anyOf/0/properties/startStepId")
    },
    {
      path: "steps",
      control: "json",
      label: "步骤列表（steps，2–32 步；每步 id/title/body/terminal/options，option 含 id/label/nextStepId/conditions/effects）",
      required: true,
      rows: 10,
      kinds: ["flow"],
      schema: schema("/anyOf/0/properties/steps")
    },
    {
      path: "steps[].options[].conditions",
      control: "json",
      label: "选项条件（conditions，最多 16 条；type：spiritStones/inventoryItem/variable/battleWon/interactionCompleted）",
      required: false,
      rows: 4,
      options: CONDITION_TYPES,
      allowedTypes: CONDITION_TYPES.map((item) => item.value),
      kinds: ["flow"],
      schema: schema("/anyOf/0/properties/steps/items/properties/options/items/properties/conditions")
    },
    {
      path: "steps[].options[].effects",
      control: "json",
      label: "选项效果（effects，最多 16 条；type：spiritStones/giveItem/takeInventoryItem/setVariable）",
      required: false,
      rows: 4,
      options: EFFECT_TYPES,
      allowedTypes: EFFECT_TYPES.map((item) => item.value),
      kinds: ["flow"],
      schema: schema("/anyOf/0/properties/steps/items/properties/options/items/properties/effects")
    },
    {
      path: "ui.layout",
      control: "select",
      label: "面板布局（ui.layout）",
      required: false,
      options: [
        { value: "list", label: "列表（list）" },
        { value: "cards", label: "卡片（cards）" }
      ],
      kinds: ["flow"],
      schema: schema("/anyOf/0/properties/ui/properties/layout")
    },
    {
      path: "ui.tone",
      control: "select",
      label: "面板色调（ui.tone）",
      required: false,
      options: [
        { value: "jade", label: "青玉（jade）" },
        { value: "gold", label: "鎏金（gold）" },
        { value: "violet", label: "紫霞（violet）" }
      ],
      kinds: ["flow"],
      schema: schema("/anyOf/0/properties/ui/properties/tone")
    },
    {
      path: "ui.queries",
      control: "multi-select",
      label: "查询行（ui.queries，最多 4 项）",
      required: false,
      options: [
        { value: "spiritStones", label: "灵石（spiritStones）" },
        { value: "realm", label: "境界（realm）" },
        { value: "location", label: "地点（location）" },
        { value: "progress", label: "进度（progress）" }
      ],
      kinds: ["flow"],
      schema: schema("/anyOf/0/properties/ui/properties/queries")
    },
    {
      path: "flowId",
      control: "text",
      label: "引用流程（flowId，必须是同包 flow 的 ID）",
      required: true,
      kinds: ["interaction"],
      schema: schema("/anyOf/1/properties/flowId")
    },
    {
      path: "mapId",
      control: "text",
      label: "地图（mapId，官方大地图 map_XX 或同包地图 ID）",
      required: true,
      kinds: ["interaction"],
      schema: schema("/anyOf/1/properties/mapId")
    },
    {
      path: "nodeId",
      control: "text",
      label: "节点（nodeId，地图内局部节点 ID）",
      required: true,
      pattern: NODE_ID_PATTERN,
      kinds: ["interaction"],
      schema: schema("/anyOf/1/properties/nodeId")
    },
    {
      path: "cooldownDays",
      control: "number",
      label: "冷却天数（cooldownDays，1–36000）",
      required: false,
      min: 1,
      max: 36000,
      step: 1,
      kinds: ["interaction"],
      schema: schema("/anyOf/1/properties/cooldownDays")
    },
    {
      path: "npc.description",
      control: "text",
      label: "NPC 描述（npc.description，必填，1–2000 字）",
      required: true,
      multiline: true,
      rows: 4,
      kinds: ["interaction"],
      schema: schema("/anyOf/1/properties/npc/properties/description")
    },
    {
      path: "npc.displayTitle",
      control: "text",
      label: "身份称谓（npc.displayTitle，1–80 字；非 species）",
      required: false,
      kinds: ["interaction"],
      schema: schema("/anyOf/1/properties/npc/properties/displayTitle")
    },
    {
      path: "npc.showQuestMarker",
      control: "toggle",
      label: "任务标记（npc.showQuestMarker，默认关闭）",
      required: false,
      kinds: ["interaction"],
      schema: schema("/anyOf/1/properties/npc/properties/showQuestMarker")
    },
    {
      path: "npc.enemyId",
      control: "select",
      label: "NPC 身份（npc.enemyId，来自公开 NPC 目录或同包已发布 NPC）",
      required: false,
      options: NPC_OPTIONS,
      kinds: ["interaction"],
      schema: schema("/anyOf/1/properties/npc/properties/enemyId")
    },
    {
      path: "npc.routeNodeIds",
      control: "json",
      label: "巡逻节点（npc.routeNodeIds，2–32 个连续节点，首项须等于驻点 nodeId）",
      required: false,
      rows: 4,
      kinds: ["interaction"],
      schema: schema("/anyOf/1/properties/npc/properties/routeNodeIds")
    },
    {
      path: "npc.dwellDays",
      control: "number",
      label: "驻留天数（npc.dwellDays，1–36000，默认 30）",
      required: false,
      min: 1,
      max: 36000,
      step: 1,
      kinds: ["interaction"],
      schema: schema("/anyOf/1/properties/npc/properties/dwellDays")
    },
    {
      path: "npc.sparEncounterId",
      control: "text",
      label: "切磋遭遇 ID（npc.sparEncounterId，须同包遭遇，allowedMapIds 须含交互地图）",
      required: false,
      kinds: ["interaction"],
      schema: schema("/anyOf/1/properties/npc/properties/sparEncounterId")
    },
    {
      path: "npc.captureEncounterId",
      control: "text",
      label: "擒拿遭遇 ID（npc.captureEncounterId，须同包遭遇，allowedMapIds 须含交互地图）",
      required: false,
      kinds: ["interaction"],
      schema: schema("/anyOf/1/properties/npc/properties/captureEncounterId")
    },
    {
      path: "npc.killEncounterId",
      control: "text",
      label: "击杀遭遇 ID（npc.killEncounterId，须同包遭遇，allowedMapIds 须含交互地图）",
      required: false,
      kinds: ["interaction"],
      schema: schema("/anyOf/1/properties/npc/properties/killEncounterId")
    }
  ];
}

function validateFlowIdValue(entry, results) {
  if (isBlank(entry.id)) {
    results.push(warning("id.required", "id", "尚未填写 id"));
  } else if (typeof entry.id !== "string") {
    results.push(error("id.invalid", "id", "id 必须是字符串"));
  } else if (entry.id.length < 3 || entry.id.length > 160) {
    results.push(error("id.length", "id", "id 长度须为 3–160"));
  }
}

function validateConditions(list, path, results) {
  if (list === undefined || list === null) {
    return;
  }
  if (!Array.isArray(list)) {
    results.push(error("conditions.type", path, "conditions 必须是数组"));
    return;
  }
  if (list.length > 16) {
    results.push(error("conditions.max", path, "conditions 最多 16 条"));
  }
  list.forEach((condition, index) => {
    const itemPath = path + "[" + index + "]";
    if (!isPlainObject(condition)) {
      results.push(error("conditions.item", itemPath, "条件必须是对象"));
      return;
    }
    if (!CONDITION_TYPE_SET.has(condition.type)) {
      results.push(
        error(
          "conditions.type.invalid",
          itemPath + ".type",
          "条件 type 非法（spiritStones/inventoryItem/variable/battleWon/interactionCompleted）"
        )
      );
      return;
    }
    if (condition.type === "spiritStones") {
      if (!isInteger(condition.amount) || condition.amount < 0 || condition.amount > 1000000) {
        results.push(error("conditions.amount", itemPath + ".amount", "amount 须为 0–1000000 的整数"));
      }
    } else if (condition.type === "inventoryItem") {
      if (!isInteger(condition.templateNumericId) || condition.templateNumericId < 1) {
        results.push(error("conditions.templateNumericId", itemPath + ".templateNumericId", "templateNumericId 须为正整数"));
      }
      if (!isInteger(condition.count) || condition.count < 1 || condition.count > 100) {
        results.push(error("conditions.count", itemPath + ".count", "count 须为 1–100 的整数"));
      }
    } else if (condition.type === "variable") {
      if (typeof condition.key !== "string" || !SLUG_RE.test(condition.key)) {
        results.push(error("conditions.key", itemPath + ".key", "key 必须是小写短名"));
      }
      if (typeof condition.equals !== "boolean" && (!isInteger(condition.equals) || condition.equals < -1000000 || condition.equals > 1000000)) {
        results.push(error("conditions.equals", itemPath + ".equals", "equals 须为布尔或 -1000000–1000000 的整数"));
      }
    } else if (condition.type === "battleWon") {
      if (typeof condition.nodeId !== "string" || !NODE_ID_RE.test(condition.nodeId)) {
        results.push(error("conditions.nodeId", itemPath + ".nodeId", "nodeId 非法"));
      }
    } else if (condition.type === "interactionCompleted") {
      if (typeof condition.interactionId !== "string" || condition.interactionId.length < 3 || condition.interactionId.length > 160) {
        results.push(error("conditions.interactionId", itemPath + ".interactionId", "interactionId 长度须为 3–160"));
      }
    }
  });
}

function validateEffects(list, path, results) {
  if (list === undefined || list === null) {
    return;
  }
  if (!Array.isArray(list)) {
    results.push(error("effects.type", path, "effects 必须是数组"));
    return;
  }
  if (list.length > 16) {
    results.push(error("effects.max", path, "effects 最多 16 条"));
  }
  list.forEach((effect, index) => {
    const itemPath = path + "[" + index + "]";
    if (!isPlainObject(effect)) {
      results.push(error("effects.item", itemPath, "效果必须是对象"));
      return;
    }
    if (!EFFECT_TYPE_SET.has(effect.type)) {
      results.push(error("effects.type.invalid", itemPath + ".type", "效果 type 非法（spiritStones/giveItem/takeInventoryItem/setVariable）"));
      return;
    }
    if (effect.type === "spiritStones") {
      if (!isInteger(effect.amount) || effect.amount < -1000000 || effect.amount > 1000000) {
        results.push(error("effects.amount", itemPath + ".amount", "amount 须为 -1000000–1000000 的整数"));
      }
    } else if (effect.type === "giveItem" || effect.type === "takeInventoryItem") {
      if (!isInteger(effect.templateNumericId) || effect.templateNumericId < 1) {
        results.push(error("effects.templateNumericId", itemPath + ".templateNumericId", "templateNumericId 须为正整数"));
      }
      if (!isInteger(effect.count) || effect.count < 1 || effect.count > 100) {
        results.push(error("effects.count", itemPath + ".count", "count 须为 1–100 的整数"));
      }
    } else if (effect.type === "setVariable") {
      if (typeof effect.key !== "string" || !SLUG_RE.test(effect.key)) {
        results.push(error("effects.key", itemPath + ".key", "key 必须是小写短名"));
      }
      if (typeof effect.value !== "boolean" && (!isInteger(effect.value) || effect.value < -1000000 || effect.value > 1000000)) {
        results.push(error("effects.value", itemPath + ".value", "value 须为布尔或 -1000000–1000000 的整数"));
      }
    }
  });
}

function validateSteps(entry, results) {
  const steps = entry.steps;
  const path = "steps";
  if (steps === undefined || steps === null) {
    results.push(error("steps.required", path, "flow 必须提供 steps"));
    return;
  }
  if (!Array.isArray(steps)) {
    results.push(error("steps.type", path, "steps 必须是数组"));
    return;
  }
  if (steps.length > 32) {
    results.push(error("steps.max", path, "steps 最多 32 步"));
  } else if (steps.length < 2) {
    results.push(warning("steps.min", path, "steps 至少 2 步（当前 " + steps.length + " 步，导出前需补足）"));
  }

  const ids = new Set();
  steps.forEach((step, index) => {
    const stepPath = path + "[" + index + "]";
    if (!isPlainObject(step)) {
      results.push(error("steps.item", stepPath, "步骤必须是对象"));
      return;
    }
    if (typeof step.id !== "string" || !SLUG_RE.test(step.id)) {
      results.push(error("steps.id", stepPath + ".id", "步骤 id 必须是小写短名"));
    } else if (ids.has(step.id)) {
      results.push(error("steps.id.duplicate", stepPath + ".id", "步骤 id 重复：" + step.id));
    } else {
      ids.add(step.id);
    }
    if (isBlank(step.title)) {
      results.push(warning("steps.title", stepPath + ".title", "尚未填写步骤标题（title）"));
    } else if (typeof step.title !== "string") {
      results.push(error("steps.title.type", stepPath + ".title", "title 必须是字符串"));
    } else if (step.title.length > 2000) {
      results.push(error("steps.title.max", stepPath + ".title", "title 最多 2000 字"));
    }
    if (isBlank(step.body)) {
      results.push(warning("steps.body", stepPath + ".body", "尚未填写步骤正文（body）"));
    } else if (typeof step.body !== "string") {
      results.push(error("steps.body.type", stepPath + ".body", "body 必须是字符串"));
    } else if (step.body.length > 2000) {
      results.push(error("steps.body.max", stepPath + ".body", "body 最多 2000 字"));
    }
    if (step.terminal !== undefined && typeof step.terminal !== "boolean") {
      results.push(error("steps.terminal", stepPath + ".terminal", "terminal 必须是布尔值"));
    }
    if (step.options !== undefined && step.options !== null) {
      if (!Array.isArray(step.options)) {
        results.push(error("steps.options.type", stepPath + ".options", "options 必须是数组"));
      } else {
        if (step.options.length > 6) {
          results.push(error("steps.options.max", stepPath + ".options", "每个步骤最多 6 个选项"));
        }
        step.options.forEach((option, optionIndex) => {
          const optionPath = stepPath + ".options[" + optionIndex + "]";
          if (!isPlainObject(option)) {
            results.push(error("steps.options.item", optionPath, "选项必须是对象"));
            return;
          }
          if (typeof option.id !== "string" || !SLUG_RE.test(option.id)) {
            results.push(error("steps.options.id", optionPath + ".id", "选项 id 必须是小写短名"));
          }
          if (isBlank(option.label)) {
            results.push(warning("steps.options.label", optionPath + ".label", "尚未填写选项文案（label）"));
          } else if (typeof option.label !== "string") {
            results.push(error("steps.options.label.type", optionPath + ".label", "label 必须是字符串"));
          } else if (option.label.length > 160) {
            results.push(error("steps.options.label.max", optionPath + ".label", "label 最多 160 字"));
          }
          if (isBlank(option.nextStepId)) {
            results.push(error("steps.options.nextStepId", optionPath + ".nextStepId", "选项必须提供 nextStepId"));
          } else if (typeof option.nextStepId !== "string" || !SLUG_RE.test(option.nextStepId)) {
            results.push(error("steps.options.nextStepId.invalid", optionPath + ".nextStepId", "nextStepId 必须是小写短名"));
          }
          validateConditions(option.conditions, optionPath + ".conditions", results);
          validateEffects(option.effects, optionPath + ".effects", results);
        });
      }
    }
  });

  if (!isBlank(entry.startStepId)) {
    if (typeof entry.startStepId !== "string" || !SLUG_RE.test(entry.startStepId)) {
      results.push(error("startStepId.invalid", "startStepId", "startStepId 必须是小写短名"));
    } else if (!ids.has(entry.startStepId)) {
      results.push(error("startStepId.missing", "startStepId", "startStepId 不存在于 steps：" + entry.startStepId));
    }
  }

  if (Array.isArray(steps)) {
    steps.forEach((step, stepIndex) => {
      if (!isPlainObject(step) || !Array.isArray(step.options)) {
        return;
      }
      step.options.forEach((option, optionIndex) => {
        if (!isPlainObject(option)) {
          return;
        }
        const next = option.nextStepId;
        if (typeof next === "string" && next !== "" && !ids.has(next)) {
          results.push(
            error(
              "steps.options.nextStepId.dangling",
              "steps[" + stepIndex + "].options[" + optionIndex + "].nextStepId",
              "nextStepId 不存在于 steps：" + next
            )
          );
        }
      });
    });
  }
}

function validateUi(ui, results) {
  const path = "ui";
  if (ui === undefined || ui === null) {
    return;
  }
  if (!isPlainObject(ui)) {
    results.push(error("ui.type", path, "ui 必须是对象"));
    return;
  }
  if (ui.layout !== undefined && ui.layout !== "list" && ui.layout !== "cards") {
    results.push(error("ui.layout.invalid", path + ".layout", "ui.layout 只能是 list 或 cards"));
  }
  if (ui.tone !== undefined && ui.tone !== "jade" && ui.tone !== "gold" && ui.tone !== "violet") {
    results.push(error("ui.tone.invalid", path + ".tone", "ui.tone 只能是 jade/gold/violet"));
  }
  if (ui.queries !== undefined && ui.queries !== null) {
    if (!Array.isArray(ui.queries)) {
      results.push(error("ui.queries.type", path + ".queries", "ui.queries 必须是数组"));
    } else {
      if (ui.queries.length > 4) {
        results.push(error("ui.queries.max", path + ".queries", "ui.queries 最多 4 项"));
      }
      const allowed = ["spiritStones", "realm", "location", "progress"];
      ui.queries.forEach((query, index) => {
        if (!allowed.includes(query)) {
          results.push(error("ui.queries.invalid", path + ".queries[" + index + "]", "查询行非法：" + query));
        }
      });
    }
  }
}

function validateFlow(entry, results) {
  validateFlowIdValue(entry, results);
  if (isBlank(entry.name)) {
    results.push(warning("name.required", "name", "尚未填写流程名称（name）"));
  } else if (typeof entry.name !== "string") {
    results.push(error("name.invalid", "name", "name 必须是字符串"));
  } else if (entry.name.length > 2000) {
    results.push(error("name.max", "name", "name 最多 2000 字"));
  }
  if (isBlank(entry.startStepId)) {
    results.push(warning("startStepId.required", "startStepId", "尚未填写 startStepId"));
  }
  validateSteps(entry, results);
  validateUi(entry.ui, results);
}

function validateEncounterRef(id, path, mapId, ctx, results) {
  if (isBlank(id)) {
    return;
  }
  if (typeof id !== "string" || !ENCOUNTER_ID_RE.test(id)) {
    results.push(error("encounterId.invalid", path, "遭遇 ID 必须是 <mod-id>:<slug>：" + id));
    return;
  }
  const prefix = id.slice(0, id.lastIndexOf(":"));
  if (typeof ctx.modId === "string" && ctx.modId !== "" && prefix !== ctx.modId) {
    results.push(error("encounterId.namespace", path, "遭遇 ID 必须同包（前缀 " + ctx.modId + "）：" + id));
  }
  if (Array.isArray(ctx.encounterIds) && !ctx.encounterIds.includes(id)) {
    results.push(warning("encounterId.dangling", path, "遭遇不在本包 encounters 中：" + id));
    return;
  }
  if (isPlainObject(ctx.encounterMapIds) && typeof mapId === "string" && mapId !== "") {
    const allowed = ctx.encounterMapIds[id];
    if (Array.isArray(allowed) && !allowed.includes(mapId)) {
      results.push(warning("encounterId.allowedMapIds", path, "遭遇 " + id + " 的 allowedMapIds 未包含交互地图 " + mapId));
    }
  }
}

function validateNpc(npc, mapId, ctx, results) {
  const path = "npc";
  if (!isPlainObject(npc)) {
    results.push(error("npc.type", path, "interaction 必须提供 npc 对象"));
    return;
  }
  if (npc.description === undefined || npc.description === null) {
    results.push(error("npc.description.required", path + ".description", "npc.description 必填"));
  } else if (typeof npc.description !== "string") {
    results.push(error("npc.description.type", path + ".description", "npc.description 必须是字符串"));
  } else if (npc.description.trim() === "") {
    results.push(warning("npc.description.required", path + ".description", "尚未填写 npc.description"));
  } else if (npc.description.length > 2000) {
    results.push(error("npc.description.max", path + ".description", "npc.description 最多 2000 字"));
  }

  if (!isBlank(npc.displayTitle)) {
    if (typeof npc.displayTitle !== "string") {
      results.push(error("npc.displayTitle.type", path + ".displayTitle", "npc.displayTitle 必须是字符串"));
    } else if (npc.displayTitle.length < 1 || npc.displayTitle.length > 80) {
      results.push(error("npc.displayTitle.length", path + ".displayTitle", "npc.displayTitle 长度须为 1–80"));
    }
  }

  if (npc.showQuestMarker !== undefined && npc.showQuestMarker !== null && typeof npc.showQuestMarker !== "boolean") {
    results.push(error("npc.showQuestMarker.type", path + ".showQuestMarker", "npc.showQuestMarker 必须是布尔值"));
  }

  if (!isBlank(npc.enemyId)) {
    if (typeof npc.enemyId !== "string") {
      results.push(error("npc.enemyId.type", path + ".enemyId", "npc.enemyId 必须是字符串"));
    } else if (!NPC_IDS.has(npc.enemyId) && !npc.enemyId.includes(":")) {
      results.push(warning("npc.enemyId.unknown", path + ".enemyId", "npc.enemyId 不在公开 NPC 目录中：" + npc.enemyId));
    }
  }

  if (Array.isArray(npc.routeNodeIds) && npc.routeNodeIds.length === 0) {
    results.push(warning("npc.routeNodeIds.empty", path + ".routeNodeIds", "尚未填写巡逻节点（npc.routeNodeIds，需 2–32 项）"));
  } else if (npc.routeNodeIds !== undefined && npc.routeNodeIds !== null) {
    if (!Array.isArray(npc.routeNodeIds)) {
      results.push(error("npc.routeNodeIds.type", path + ".routeNodeIds", "npc.routeNodeIds 必须是数组"));
    } else {
      if (npc.routeNodeIds.length < 2 || npc.routeNodeIds.length > 32) {
        results.push(error("npc.routeNodeIds.length", path + ".routeNodeIds", "npc.routeNodeIds 数量须为 2–32"));
      }
      npc.routeNodeIds.forEach((nodeId, index) => {
        if (typeof nodeId !== "string" || !NODE_ID_RE.test(nodeId)) {
          results.push(error("npc.routeNodeIds.invalid", path + ".routeNodeIds[" + index + "]", "节点 ID 非法：" + nodeId));
        }
      });
    }
  }

  if (npc.dwellDays !== undefined && npc.dwellDays !== null) {
    if (!isInteger(npc.dwellDays) || npc.dwellDays < 1 || npc.dwellDays > 36000) {
      results.push(error("npc.dwellDays.range", path + ".dwellDays", "npc.dwellDays 须为 1–36000 的整数"));
    }
  }

  validateEncounterRef(npc.sparEncounterId, path + ".sparEncounterId", mapId, ctx, results);
  validateEncounterRef(npc.captureEncounterId, path + ".captureEncounterId", mapId, ctx, results);
  validateEncounterRef(npc.killEncounterId, path + ".killEncounterId", mapId, ctx, results);
}

function validateRouteNodeIds(entry, path, maps, results) {
  const npc = entry.npc;
  if (!isPlainObject(npc) || !Array.isArray(npc.routeNodeIds) || npc.routeNodeIds.length === 0) {
    return;
  }
  const mapId = entry.mapId;
  if (isBlank(mapId) || typeof mapId !== "string") {
    return;
  }
  const routePath = path + ".npc.routeNodeIds";
  const map = findMapById(maps, mapId);
  if (OFFICIAL_MAP_RE.test(mapId) || !map) {
    results.push(
      warning(
        "adventure.routeNodeIds.unknownMap",
        routePath,
        "地图 " + mapId + " 不在本包中（跨包/官方地图无法静态校验巡逻路线）"
      )
    );
    return;
  }
  const nodes = Array.isArray(map.nodes) ? map.nodes : [];
  const nodeIds = new Set();
  nodes.forEach((node) => {
    if (isPlainObject(node) && typeof node.id === "string" && node.id !== "") {
      nodeIds.add(node.id);
    }
  });
  npc.routeNodeIds.forEach((nodeId, index) => {
    if (typeof nodeId === "string" && nodeId !== "" && !nodeIds.has(nodeId)) {
      results.push(
        error(
          "adventure.routeNodeIds.nodeMissing",
          routePath + "[" + index + "]",
          "巡逻节点不存在于地图 " + mapId + "：" + nodeId
        )
      );
    }
  });
  for (let index = 0; index + 1 < npc.routeNodeIds.length; index += 1) {
    const from = npc.routeNodeIds[index];
    const to = npc.routeNodeIds[index + 1];
    if (typeof from !== "string" || typeof to !== "string") {
      continue;
    }
    if (!nodeIds.has(from) || !nodeIds.has(to)) {
      continue;
    }
    if (!hasUndirectedEdge(map.edges, from, to)) {
      results.push(
        error(
          "adventure.routeNodeIds.noEdge",
          routePath + "[" + index + "]",
          "巡逻路线相邻节点必须有连线（" + from + " → " + to + "）"
        )
      );
    }
  }
}

function validateInteraction(entry, ctx, results) {
  validateFlowIdValue(entry, results);
  if (isBlank(entry.flowId)) {
    results.push(warning("flowId.required", "flowId", "尚未填写 flowId（须引用同包 flow）"));
  } else if (typeof entry.flowId !== "string") {
    results.push(error("flowId.type", "flowId", "flowId 必须是字符串"));
  } else if (entry.flowId.length < 3 || entry.flowId.length > 160) {
    results.push(error("flowId.length", "flowId", "flowId 长度须为 3–160"));
  }
  if (isBlank(entry.mapId)) {
    results.push(warning("mapId.required", "mapId", "尚未填写 mapId"));
  } else if (typeof entry.mapId !== "string") {
    results.push(error("mapId.type", "mapId", "mapId 必须是字符串"));
  } else if (entry.mapId.length < 3 || entry.mapId.length > 160) {
    results.push(error("mapId.length", "mapId", "mapId 长度须为 3–160"));
  }
  if (isBlank(entry.nodeId)) {
    results.push(warning("nodeId.required", "nodeId", "尚未填写 nodeId"));
  } else if (typeof entry.nodeId !== "string") {
    results.push(error("nodeId.type", "nodeId", "nodeId 必须是字符串"));
  } else if (!NODE_ID_RE.test(entry.nodeId)) {
    results.push(error("nodeId.invalid", "nodeId", "nodeId 只能含小写字母数字、下划线与短横线"));
  } else if (entry.nodeId.length > 80) {
    results.push(error("nodeId.length", "nodeId", "nodeId 最多 80 字"));
  }
  if (isBlank(entry.name)) {
    results.push(warning("name.required", "name", "尚未填写名称（name）"));
  } else if (typeof entry.name !== "string") {
    results.push(error("name.type", "name", "name 必须是字符串"));
  } else if (entry.name.length > 80) {
    results.push(error("name.max", "name", "name 最多 80 字"));
  }

  if (entry.cooldownDays !== undefined && entry.cooldownDays !== null) {
    if (!isInteger(entry.cooldownDays) || entry.cooldownDays < 1 || entry.cooldownDays > 36000) {
      results.push(error("cooldownDays.range", "cooldownDays", "cooldownDays 须为 1–36000 的整数"));
    }
  }

  validateNpc(entry.npc, entry.mapId, ctx, results);
}

export function validateEntry(entry, ctx = {}) {
  const results = [];
  if (!isPlainObject(entry)) {
    results.push(error("entry.type", "", "条目必须是对象"));
    return results;
  }
  const kind = entry.kind;
  if (!KINDS.includes(kind)) {
    results.push(error("kind.invalid", "kind", "kind 必须是 flow 或 interaction"));
    return results;
  }
  if (kind === "flow") {
    validateFlow(entry, results);
  } else {
    validateInteraction(entry, ctx, results);
  }
  return results;
}

export function validateProject(project, domain = "adventures") {
  const results = [];
  const entries = collectEntries(project, domain);
  const manifest = project && isPlainObject(project.meta) ? project.meta.manifest : null;
  const domains = isPlainObject(manifest) ? manifest.domains : null;
  const hasMapsDomain = isPlainObject(domains) && Object.prototype.hasOwnProperty.call(domains, "maps");
  const flowIds = new Set(
    entries
      .filter((entry) => isPlainObject(entry) && entry.kind === "flow" && typeof entry.id === "string" && entry.id !== "")
      .map((entry) => entry.id)
  );
  const seen = new Map();

  entries.forEach((entry, index) => {
    if (!isPlainObject(entry)) {
      return;
    }
    const path = "content." + domain + "[" + index + "]";
    if (typeof entry.id === "string" && entry.id !== "") {
      if (seen.has(entry.id)) {
        results.push(error("id.duplicate", path + ".id", "ID " + entry.id + " 在本 Mod 内重复声明"));
      } else {
        seen.set(entry.id, index);
      }
    }

    if (entry.kind === "interaction") {
      if (typeof entry.flowId === "string" && entry.flowId !== "" && !flowIds.has(entry.flowId)) {
        results.push(warning("flowId.dangling", path + ".flowId", "交互引用的流程不在本包 flow 中：" + entry.flowId));
      }
      if (typeof entry.mapId === "string" && entry.mapId.includes(":") && !OFFICIAL_MAP_RE.test(entry.mapId) && !hasMapsDomain) {
        results.push(
          warning("maps.notDeclared", path + ".mapId", "投放到自制地图 " + entry.mapId + " 需在 manifest.domains 声明 maps 域")
        );
      }
      validateRouteNodeIds(entry, path, collectMaps(project), results);
    }
  });

  return results;
}

function buildOutput(entry) {
  const kind = kindOf(entry);
  const output = { kind };
  const root = kind === "interaction" ? INTERACTION_ROOT : FLOW_ROOT;
  for (const key of root) {
    if (key === "kind") {
      continue;
    }
    if (entry[key] !== undefined) {
      output[key] = entry[key];
    }
  }
  if (isPlainObject(entry.__raw)) {
    Object.assign(output, entry.__raw);
  }
  return output;
}

function toFile(entry) {
  if (!isPlainObject(entry)) {
    throw new Error("toFiles: 条目必须是对象");
  }
  const id = entry.id;
  if (typeof id !== "string" || id === "") {
    throw new Error("toFiles: 条目缺少 id");
  }
  const slug = slugOf(id);
  if (!SLUG_RE.test(slug)) {
    throw new Error("toFiles: id 短名非法：" + id);
  }
  return { path: "adventures/" + slug + ".json", content: JSON.stringify(buildOutput(entry), null, 2) };
}

export function toFiles(entriesOrEntry, ctx = {}) {
  void ctx;
  const list = Array.isArray(entriesOrEntry) ? entriesOrEntry : [entriesOrEntry];
  return list.map((entry) => toFile(entry));
}

export function fromFiles(files, ctx = {}) {
  void ctx;
  if (!Array.isArray(files)) {
    return [];
  }
  const entries = [];
  for (const file of files) {
    if (!file || typeof file.path !== "string") {
      continue;
    }
    const normalized = file.path.replace(/\\/g, "/");
    if (!/(^|\/)adventures\/[^/]+\.json$/i.test(normalized)) {
      continue;
    }
    let parsed;
    try {
      parsed = JSON.parse(file.content);
    } catch {
      throw new Error("fromFiles: " + normalized + " 不是合法 JSON");
    }
    if (!isPlainObject(parsed)) {
      continue;
    }
    const kind = kindOf(parsed);
    const root = kind === "interaction" ? INTERACTION_ROOT : FLOW_ROOT;
    const entry = { kind };
    for (const key of root) {
      if (key === "kind") {
        continue;
      }
      if (key in parsed) {
        entry[key] = parsed[key];
      }
    }
    const raw = {};
    let hasRaw = false;
    for (const key of Object.keys(parsed)) {
      if (key !== "kind" && !root.includes(key)) {
        raw[key] = parsed[key];
        hasRaw = true;
      }
    }
    if (hasRaw) {
      entry.__raw = raw;
    }
    entries.push(entry);
  }
  return entries;
}

export function summarize(entry) {
  if (!isPlainObject(entry)) {
    return "（无效冒险）";
  }
  const id = typeof entry.id === "string" && entry.id !== "" ? entry.id : "未命名";
  const slug = slugOf(id) || "未命名";
  if (entry.kind === "interaction") {
    const name = entry.name || slug;
    const flowId = entry.flowId || "?";
    const mapId = entry.mapId || "?";
    const nodeId = entry.nodeId || "?";
    return "交互 " + name + "（" + slug + "）→ 流程 " + flowId + " @ " + mapId + "/" + nodeId;
  }
  const name = entry.name || slug;
  const stepCount = Array.isArray(entry.steps) ? entry.steps.length : 0;
  const start = entry.startStepId || "?";
  return "流程 " + name + "（" + slug + "）：" + stepCount + " 步，起点 " + start;
}
