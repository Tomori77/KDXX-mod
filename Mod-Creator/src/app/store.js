// src/app/store.js — 全局订阅式状态，唯一可变真相；含撤销/重做快照。

import { VERSION } from "../generated/VERSION.js";
import { reducers } from "./actions.js";

const HISTORY_LIMIT = 100;

const CONTENT_DOMAINS = [
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

export function createInitialState() {
  const content = {};
  for (const domain of CONTENT_DOMAINS) {
    content[domain] = [];
  }
  content.assets = { icons: {} };
  return {
    meta: {
      manifest: {
        id: "",
        name: "",
        version: "1.0.0",
        modApiVersion: VERSION.sdkVersion,
        enabled: true,
        author: "",
        description: "",
        saveCompatibility: null,
        domains: {}
      },
      sdkVersion: VERSION.sdkVersion,
      generatorVersion: VERSION.generator
    },
    content,
    ui: { activeDomain: null, selectedId: null, dirty: false, warnings: [] },
    history: { past: [], future: [] }
  };
}

function cloneValue(value) {
  try {
    return structuredClone(value);
  } catch {
    return fallbackClone(value);
  }
}

function fallbackClone(value) {
  if (Array.isArray(value)) {
    return value.map(fallbackClone);
  }
  if (value !== null && typeof value === "object") {
    const proto = Object.getPrototypeOf(value);
    if (proto !== Object.prototype && proto !== null) {
      return value;
    }
    const out = {};
    for (const key of Object.keys(value)) {
      out[key] = fallbackClone(value[key]);
    }
    return out;
  }
  return value;
}

function snapshot(state) {
  return cloneValue({ meta: state.meta, content: state.content, ui: state.ui });
}

let state = createInitialState();
const subscribers = new Set();

export function getState() {
  return state;
}

function notify() {
  for (const fn of Array.from(subscribers)) {
    fn(state);
  }
}

function commitSnapshotHistory(past, currentSnapshot) {
  const nextPast = [...past, currentSnapshot];
  if (nextPast.length > HISTORY_LIMIT) {
    nextPast.splice(0, nextPast.length - HISTORY_LIMIT);
  }
  return nextPast;
}

export function dispatch(action) {
  if (!action || typeof action.type !== "string") {
    throw new Error("dispatch: action 必须是含 type 的对象");
  }
  const reducer = reducers[action.type];
  if (!reducer) {
    throw new Error("dispatch: 未知 action type: " + action.type);
  }
  const next = reducer(state, action);
  if (next === state) {
    return state;
  }
  const past = commitSnapshotHistory(state.history.past, snapshot(state));
  state = { ...next, history: { past, future: [] } };
  notify();
  return state;
}

export function subscribe(fn) {
  if (typeof fn !== "function") {
    throw new Error("subscribe: 需要函数");
  }
  subscribers.add(fn);
  return function unsubscribe() {
    subscribers.delete(fn);
  };
}

export function undo() {
  const past = state.history.past;
  if (past.length === 0) {
    return false;
  }
  const previous = past[past.length - 1];
  const currentSnapshot = snapshot(state);
  state = {
    ...previous,
    history: {
      past: past.slice(0, -1),
      future: [currentSnapshot, ...state.history.future]
    }
  };
  notify();
  return true;
}

export function redo() {
  const future = state.history.future;
  if (future.length === 0) {
    return false;
  }
  const nextProject = future[0];
  const currentSnapshot = snapshot(state);
  const past = commitSnapshotHistory(state.history.past, currentSnapshot);
  state = {
    ...nextProject,
    history: { past, future: future.slice(1) }
  };
  notify();
  return true;
}

export function reset(nextState) {
  const base = nextState === undefined ? createInitialState() : cloneValue(nextState);
  state = { ...base, history: { past: [], future: [] } };
  notify();
  return state;
}
