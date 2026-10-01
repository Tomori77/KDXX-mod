// tools/e2e-build.mjs — 生成多域合法工程并落盘到 _scratch/e2e-out/<mod-id>/，供官方 validate-mod.ps1 对拍。

import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateSync } from "node:zlib";

import { buildPackage } from "../src/io/export-mod.js";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const MOD_ID = "com.tomori77.mc-e2e";
const OUT_BASE = join(REPO_ROOT, "_scratch", "e2e-out");

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(bytes) {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    crc = CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBytes = Buffer.from(type, "ascii");
  const body = Buffer.concat([typeBytes, data]);
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  body.copy(out, 4);
  out.writeUInt32BE(crc32(body), 8 + data.length);
  return out;
}

function makePng(width, height, rgba) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0;
    for (let x = 0; x < width; x++) {
      const src = (y * width + x) * 4;
      const dst = y * (stride + 1) + 1 + x * 4;
      raw[dst] = rgba[src];
      raw[dst + 1] = rgba[src + 1];
      raw[dst + 2] = rgba[src + 2];
      raw[dst + 3] = rgba[src + 3];
    }
  }
  return Buffer.concat([
    sig,
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0))
  ]);
}

const ICON_128 = new Uint8Array(makePng(128, 128, new Uint8Array(128 * 128 * 4).fill(200)));

const manifest = {
  id: MOD_ID,
  name: "端到端冒烟工程",
  version: "1.0.0",
  modApiVersion: 1,
  enabled: true,
  author: "Mod-Creator",
  description: "多域端到端对拍：items/buffs/enemies/encounters/encounter-placements/maps/bazaars。",
  domains: {
    items: { schemaVersion: 3, path: "items" },
    buffs: { schemaVersion: 1, path: "buffs" },
    enemies: { schemaVersion: 1, path: "enemies" },
    encounters: { schemaVersion: 1, path: "encounters" },
    "encounter-placements": { schemaVersion: 1, path: "encounter-placements" },
    maps: { schemaVersion: 1, path: "maps" },
    bazaars: { schemaVersion: 1, path: "bazaars" }
  }
};

const items = [
  {
    mode: "add",
    item: {
      numericId: 590001,
      iconBasename: "e2e-material",
      name: "端到端灵材",
      description: "冒烟用普通材料。",
      isPublished: true,
      isObtainable: true,
      category: "material",
      grade: "common",
      element: "earth",
      shape: [[1]],
      tags: ["e2e"],
      effectList: []
    }
  },
  {
    mode: "add",
    item: {
      numericId: 190001,
      iconBasename: "e2e-scripture",
      name: "端到端入门诀",
      description: "两层功法，第二层起含突破数值。",
      isPublished: true,
      isObtainable: true,
      category: "scripture",
      grade: "common",
      element: "none",
      shape: [[1]],
      tags: ["e2e"],
      distribution: { channels: ["bazaar"] },
      effectList: [
        {
          kind: "scriptureProgression",
          label: "端到端入门诀·层级",
          scriptureProgression: {
            layers: [
              { effects: { effectList: [] } },
              {
                requirements: { requiredRealmId: "qiRefining", requiredRealmLayer: 1, requiredCultivation: 1 },
                effects: { effectList: [] },
                breakthroughTargetProgress: 100,
                breakthroughTimeLimitSec: 60,
                breakthroughCooldownSec: 60
              },
              {
                requirements: { requiredRealmId: "qiRefining", requiredRealmLayer: 3, requiredCultivation: 1000 },
                effects: { effectList: [] },
                breakthroughTargetProgress: 1000,
                breakthroughTimeLimitSec: 60,
                breakthroughCooldownSec: 60
              }
            ]
          }
        }
      ]
    }
  },
  {
    mode: "add",
    item: {
      numericId: 890001,
      iconBasename: "e2e-spell",
      name: "端到端击",
      description: "绑定端到端入门诀第二层的主动招式。",
      isPublished: true,
      isObtainable: true,
      category: "spell",
      grade: "common",
      element: "none",
      shape: [[1]],
      tags: ["e2e"],
      distribution: { channels: ["scriptureSpellReward"] },
      spell: {
        sourceScriptureNumericId: 190001,
        unlockLayer: 2,
        rewardKind: "choice",
        triggerMode: "active",
        role: "offense",
        activeCast: { cooldownSec: 5 }
      },
      effectList: [
        {
          kind: "effectNote",
          label: "长按释放，消耗 3 点法力，对敌方造成 10 点伤害",
          executors: [
            {
              trigger: "onActiveSpellCast",
              type: "damageHealth",
              amount: 10,
              costs: [{ stat: "mana", amount: 3 }]
            }
          ]
        }
      ]
    }
  }
];

const buffs = [
  {
    id: MOD_ID + ":e2e-buff",
    label: "端到端之气",
    description: "冒烟用自定义 Buff。",
    polarity: "beneficial",
    consumeOn: "time",
    defaultDurationMs: 15000,
    maxStacks: 100,
    defaultStackCap: 100,
    color: "#c9a24a"
  }
];

const enemies = [
  {
    mode: "add",
    enemyId: MOD_ID + ":e2e-beast",
    basedOn: "baifeng_jinyuan",
    patch: {
      name: "端到端妖兽",
      flavor: "冒烟用新增妖兽。"
    }
  }
];

const encounters = [
  {
    encounterId: MOD_ID + ":e2e-battle",
    allowedMapIds: ["map_05"],
    type: "battle",
    title: "端到端伏击",
    body: "冒烟用战斗遭遇。",
    rewards: [{ key: "stones", type: "spiritStones", amount: 8 }],
    options: [{ id: "fight", label: "迎战", action: "startBattle" }],
    battle: { enemyId: "shajia_tuyou" }
  },
  {
    encounterId: MOD_ID + ":e2e-story",
    allowedMapIds: ["map_05"],
    type: "story",
    title: "端到端见闻",
    body: "冒烟用剧情遭遇。",
    rewards: [],
    options: [{ id: "ok", label: "确认", action: "completeEncounter" }]
  }
];

const encounterPlacements = [
  {
    mode: "addToRegionPool",
    mapId: "map_05",
    regionId: "map_05_region_01",
    encounterId: MOD_ID + ":e2e-battle"
  }
];

const maps = [
  {
    mapId: MOD_ID + ":e2e-map",
    displayName: "端到端谷",
    officialBackgroundMapId: "map_05",
    startNodeId: "return",
    entrance: { mapId: "map_01", nodeId: "route-point-2", x: 0.113, y: 0.745 },
    travelDaysPerEdge: 1,
    nodes: [
      { id: "return", kind: "site", name: "归途", x: 0.2, y: 0.5 },
      { id: "passage", kind: "path", name: "洞径", x: 0.5, y: 0.5 },
      { id: "shop", kind: "site", name: "端到端铺", x: 0.75, y: 0.5 }
    ],
    edges: [
      { from: "return", to: "passage" },
      { from: "passage", to: "shop" }
    ],
    pools: []
  }
];

const bazaars = [
  {
    id: MOD_ID + ":e2e-shop",
    mapId: MOD_ID + ":e2e-map",
    nodeId: "shop",
    name: "端到端小铺",
    npcName: "端到端掌柜",
    description: "冒烟用固定坊市。",
    refreshDays: 7,
    offers: [
      {
        id: "offer1",
        label: "活血石",
        templateNumericId: 400001,
        count: 1,
        stock: 1,
        cost: { type: "spiritStones", amount: 5 }
      }
    ]
  }
];

const project = {
  meta: { manifest },
  content: {
    items,
    buffs,
    enemies,
    encounters,
    "encounter-placements": encounterPlacements,
    maps,
    bazaars,
    assets: {
      icons: {
        "e2e-material": { release: ICON_128, runtime: ICON_128 },
        "e2e-scripture": { release: ICON_128, runtime: ICON_128 },
        "e2e-spell": { release: ICON_128, runtime: ICON_128 }
      }
    }
  }
};

const result = await buildPackage(project);
if (result.errors.length > 0) {
  for (const issue of result.errors) {
    console.error("[error] " + issue.code + " " + issue.path + " " + issue.messageZh);
  }
  process.exit(1);
}
for (const issue of result.warnings) {
  console.warn("[warn] " + issue.code + " " + issue.path + " " + issue.messageZh);
}

const outDir = join(OUT_BASE, MOD_ID);
rmSync(OUT_BASE, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });

for (const file of result.files) {
  const target = join(OUT_BASE, file.path);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, file.content);
}

console.log("files: " + result.files.length);
console.log("modDir: " + outDir);
console.log('validate: pwsh -File "<demo>/ModSDK/bin/validate-mod.ps1" -ModDirectory "' + outDir + '" -ReportPath "' + join(REPO_ROOT, "_scratch", "e2e-report.json") + '"');
