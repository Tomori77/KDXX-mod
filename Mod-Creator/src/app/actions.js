// src/app/actions.js — action 创建器与纯 reducer 表。

const ENTRY_ID_FIELDS = {
  items: "numericId",
  buffs: "id",
  enemies: "enemyId",
  encounters: "encounterId",
  maps: "mapId",
  bazaars: "id",
  adventures: "id",
  scripts: "id"
};

function pickId(entry, field) {
  if (entry == null) {
    return undefined;
  }
  if (entry[field] !== undefined) {
    return entry[field];
  }
  if (entry.item && entry.item[field] !== undefined) {
    return entry.item[field];
  }
  if (entry.enemy && entry.enemy[field] !== undefined) {
    return entry.enemy[field];
  }
  return undefined;
}

export function idOf(entry, domain) {
  if (domain === "encounter-placements") {
    return String(entry && entry.mapId) + "::" + String(entry && entry.regionId);
  }
  const field = ENTRY_ID_FIELDS[domain];
  if (!field) {
    return undefined;
  }
  return pickId(entry, field);
}

export function setManifest(patch) {
  return { type: "SET_MANIFEST", patch };
}

export function setManifestDomain(domain, definition = {}) {
  return {
    type: "SET_MANIFEST_DOMAIN",
    domain,
    schemaVersion: definition.schemaVersion,
    path: definition.path
  };
}

export function removeManifestDomain(domain) {
  return { type: "REMOVE_MANIFEST_DOMAIN", domain };
}

export function addEntry(domain, entry) {
  return { type: "ADD_ENTRY", domain, entry };
}

export function updateEntry(domain, id, patch) {
  return { type: "UPDATE_ENTRY", domain, id, patch };
}

export function removeEntry(domain, id) {
  return { type: "REMOVE_ENTRY", domain, id };
}

export function replaceEntries(domain, entries) {
  return { type: "REPLACE_ENTRIES", domain, entries };
}

export function setAsset(basename, asset) {
  return { type: "SET_ASSET", basename, asset };
}

export function removeAsset(basename) {
  return { type: "REMOVE_ASSET", basename };
}

export function setUi(patch) {
  return { type: "SET_UI", patch };
}

export function addWarning(warning) {
  return { type: "ADD_WARNING", warning };
}

export function clearWarnings() {
  return { type: "CLEAR_WARNINGS" };
}

function domainList(state, domain) {
  const list = state.content[domain];
  return Array.isArray(list) ? list : [];
}

function reduceSetManifest(state, action) {
  return {
    ...state,
    meta: {
      ...state.meta,
      manifest: { ...state.meta.manifest, ...action.patch }
    }
  };
}

function reduceSetManifestDomain(state, action) {
  return {
    ...state,
    meta: {
      ...state.meta,
      manifest: {
        ...state.meta.manifest,
        domains: {
          ...state.meta.manifest.domains,
          [action.domain]: {
            schemaVersion: action.schemaVersion,
            path: action.path
          }
        }
      }
    }
  };
}

function reduceRemoveManifestDomain(state, action) {
  const domains = { ...state.meta.manifest.domains };
  delete domains[action.domain];
  return {
    ...state,
    meta: {
      ...state.meta,
      manifest: { ...state.meta.manifest, domains }
    }
  };
}

function reduceAddEntry(state, action) {
  return {
    ...state,
    content: {
      ...state.content,
      [action.domain]: [...domainList(state, action.domain), action.entry]
    }
  };
}

function reduceUpdateEntry(state, action) {
  const list = domainList(state, action.domain);
  const next = list.map((entry) =>
    idOf(entry, action.domain) === action.id ? { ...entry, ...action.patch } : entry
  );
  return {
    ...state,
    content: { ...state.content, [action.domain]: next }
  };
}

function reduceRemoveEntry(state, action) {
  const list = domainList(state, action.domain).filter(
    (entry) => idOf(entry, action.domain) !== action.id
  );
  return {
    ...state,
    content: { ...state.content, [action.domain]: list }
  };
}

function reduceReplaceEntries(state, action) {
  return {
    ...state,
    content: { ...state.content, [action.domain]: [...action.entries] }
  };
}

function reduceSetAsset(state, action) {
  return {
    ...state,
    content: {
      ...state.content,
      assets: {
        ...state.content.assets,
        icons: { ...state.content.assets.icons, [action.basename]: action.asset }
      }
    }
  };
}

function reduceRemoveAsset(state, action) {
  const icons = { ...state.content.assets.icons };
  delete icons[action.basename];
  return {
    ...state,
    content: {
      ...state.content,
      assets: { ...state.content.assets, icons }
    }
  };
}

function reduceSetUi(state, action) {
  return { ...state, ui: { ...state.ui, ...action.patch } };
}

function reduceAddWarning(state, action) {
  return { ...state, ui: { ...state.ui, warnings: [...state.ui.warnings, action.warning] } };
}

function reduceClearWarnings(state) {
  return { ...state, ui: { ...state.ui, warnings: [] } };
}

export const reducers = {
  SET_MANIFEST: reduceSetManifest,
  SET_MANIFEST_DOMAIN: reduceSetManifestDomain,
  REMOVE_MANIFEST_DOMAIN: reduceRemoveManifestDomain,
  ADD_ENTRY: reduceAddEntry,
  UPDATE_ENTRY: reduceUpdateEntry,
  REMOVE_ENTRY: reduceRemoveEntry,
  REPLACE_ENTRIES: reduceReplaceEntries,
  SET_ASSET: reduceSetAsset,
  REMOVE_ASSET: reduceRemoveAsset,
  SET_UI: reduceSetUi,
  ADD_WARNING: reduceAddWarning,
  CLEAR_WARNINGS: reduceClearWarnings
};
