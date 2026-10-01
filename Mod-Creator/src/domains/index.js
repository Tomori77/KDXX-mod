// src/domains/index.js — 域模块注册表：聚合全部域并导出域清单。

import * as manifest from "./manifest.js";
import * as items from "./items.js";
import * as buffs from "./buffs.js";
import * as enemies from "./enemies.js";
import * as encounters from "./encounters.js";
import * as encounterPlacements from "./encounter-placements.js";
import * as maps from "./maps.js";
import * as bazaars from "./bazaars.js";
import * as adventures from "./adventures.js";
import * as scripts from "./scripts.js";

export const domainModules = {
  manifest,
  items,
  buffs,
  enemies,
  encounters,
  "encounter-placements": encounterPlacements,
  maps,
  bazaars,
  adventures,
  scripts
};

const ORDER = [
  "manifest",
  "items",
  "buffs",
  "enemies",
  "encounters",
  "encounter-placements",
  "maps",
  "bazaars",
  "adventures",
  "scripts"
];

export const domainList = ORDER.map((key) => {
  const module = domainModules[key];
  return {
    key,
    labelZh: module.meta.labelZh,
    schemaVersion: module.meta.schemaVersion,
    available: true,
    module
  };
});
