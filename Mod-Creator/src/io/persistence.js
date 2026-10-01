// src/io/persistence.js — IndexedDB 多工程与自动快照存储；Node/隐私模式安全降级。

import { serializeProject, deserializeProject } from "./project-file.js";

const DB_NAME = "pc_mod_creator";
const DB_VERSION = 1;
const STORE = "projects";
const FORMAT_VERSION = 1;
const AUTOSAVE_ID = "__autosave__";

function hasIndexedDB() {
  return typeof indexedDB !== "undefined" && indexedDB !== null;
}

let dbPromise = null;

function openDb() {
  if (!hasIndexedDB()) {
    return Promise.resolve(null);
  }
  if (dbPromise) {
    return dbPromise;
  }
  dbPromise = new Promise((resolve) => {
    let request;
    try {
      request = indexedDB.open(DB_NAME, DB_VERSION);
    } catch {
      resolve(null);
      return;
    }
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
    request.onblocked = () => resolve(null);
  });
  return dbPromise;
}

async function getAllRecords() {
  const db = await openDb();
  if (!db) {
    return [];
  }
  try {
    return await new Promise((resolve) => {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).getAll();
      let result = [];
      req.onsuccess = () => {
        result = Array.isArray(req.result) ? req.result : [];
      };
      tx.oncomplete = () => resolve(result);
      tx.onerror = () => resolve([]);
      tx.onabort = () => resolve([]);
    });
  } catch {
    return [];
  }
}

async function getRecord(key) {
  const db = await openDb();
  if (!db) {
    return undefined;
  }
  try {
    return await new Promise((resolve) => {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).get(key);
      let result;
      req.onsuccess = () => {
        result = req.result;
      };
      tx.oncomplete = () => resolve(result);
      tx.onerror = () => resolve(undefined);
      tx.onabort = () => resolve(undefined);
    });
  } catch {
    return undefined;
  }
}

async function putRecord(record) {
  const db = await openDb();
  if (!db) {
    return false;
  }
  try {
    return await new Promise((resolve) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(record);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
      tx.onabort = () => resolve(false);
    });
  } catch {
    return false;
  }
}

async function deleteRecord(key) {
  const db = await openDb();
  if (!db) {
    return false;
  }
  try {
    return await new Promise((resolve) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).delete(key);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
      tx.onabort = () => resolve(false);
    });
  } catch {
    return false;
  }
}

function normalizeId(id) {
  if (id === null || id === undefined) {
    return null;
  }
  const text = String(id).trim();
  return text.length > 0 ? text : null;
}

function projectName(project, fallback) {
  const manifest = project && project.meta ? project.meta.manifest : null;
  const name = manifest && typeof manifest.name === "string" ? manifest.name.trim() : "";
  return name.length > 0 ? name : fallback;
}

function summaryOf(record) {
  return { id: record.id, name: record.name, updatedAt: record.updatedAt };
}

export async function listProjects() {
  const records = await getAllRecords();
  return records
    .filter((record) => record && record.id && record.id !== AUTOSAVE_ID)
    .map(summaryOf)
    .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
}

export async function saveProject(id, project) {
  const key = normalizeId(id);
  if (!hasIndexedDB() || key === null) {
    return null;
  }
  let data;
  try {
    data = await serializeProject(project);
  } catch {
    return null;
  }
  const record = {
    id: key,
    name: projectName(project, key),
    updatedAt: new Date().toISOString(),
    formatVersion: FORMAT_VERSION,
    data
  };
  if (!(await putRecord(record))) {
    return null;
  }
  return summaryOf(record);
}

export async function loadProject(id) {
  const key = normalizeId(id);
  if (!hasIndexedDB() || key === null) {
    return null;
  }
  const record = await getRecord(key);
  if (!record || typeof record.data !== "string") {
    return null;
  }
  try {
    return await deserializeProject(record.data);
  } catch {
    return null;
  }
}

export async function deleteProject(id) {
  const key = normalizeId(id);
  if (!hasIndexedDB() || key === null) {
    return false;
  }
  return deleteRecord(key);
}

export async function renameProject(id, name) {
  const key = normalizeId(id);
  if (!hasIndexedDB() || key === null) {
    return null;
  }
  const record = await getRecord(key);
  if (!record) {
    return null;
  }
  const next = {
    ...record,
    name: String(name),
    updatedAt: new Date().toISOString()
  };
  if (!(await putRecord(next))) {
    return null;
  }
  return summaryOf(next);
}

export async function getAutosave() {
  return loadProject(AUTOSAVE_ID);
}

export async function setAutosave(project) {
  return saveProject(AUTOSAVE_ID, project);
}

export async function clearAutosave() {
  return deleteProject(AUTOSAVE_ID);
}
