// ============================================================
// FAHMNI DB ROUTER — Universal Firestore-Compatible Local DB
// ============================================================
// This file provides drop-in replacements for ALL Firestore
// functions. On standalone platforms, operations are routed to
// localStorage. On master (fahmni.me/localhost), they pass
// through to real Firebase Firestore.
// ============================================================

import { LocalDbDriver } from './sqliteDriver';

// Re-export everything from firebase/firestore so pages that
// import rare utilities still work
export * from 'firebase/firestore';

// Import the REAL Firebase functions (we'll wrap them)
import {
  collection as _collection,
  doc as _doc,
  getDocs as _getDocs,
  getDoc as _getDoc,
  addDoc as _addDoc,
  setDoc as _setDoc,
  updateDoc as _updateDoc,
  deleteDoc as _deleteDoc,
  onSnapshot as _onSnapshot,
  query as _query,
  where as _where,
  orderBy as _orderBy,
  limit as _limit,
  serverTimestamp as _serverTimestamp,
  Timestamp as _Timestamp,
  writeBatch as _writeBatch,
  deleteField as _deleteField,
  arrayUnion as _arrayUnion,
  arrayRemove as _arrayRemove,
  increment as _increment,
  startAfter as _startAfter,
  endBefore as _endBefore,
  limitToLast as _limitToLast,
  getCountFromServer as _getCountFromServer,
  runTransaction as _runTransaction,
  DocumentReference,
  CollectionReference,
  QuerySnapshot,
  DocumentSnapshot,
  QueryConstraint,
  Firestore,
} from 'firebase/firestore';

import { db, isMasterHost } from './firebase';

// ========== HELPER: Check if standalone mode ==========
const isStandalone = (): boolean => {
  return LocalDbDriver.isSelfHosted();
};

// ========== LOCAL STORAGE ENGINE ==========
const LOCAL_PREFIX = 'fahmni_db_';

const getLocalCollection = (path: string): any[] => {
  try {
    const raw = localStorage.getItem(LOCAL_PREFIX + path);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
};

const saveLocalCollection = (path: string, items: any[]): void => {
  try {
    localStorage.setItem(LOCAL_PREFIX + path, JSON.stringify(items));
  } catch (e) {
    console.warn('[dbRouter] localStorage save failed:', e);
  }
};

const generateId = (): string => {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 10);
};

// ========== LOCAL QUERY ENGINE ==========
interface LocalQueryFilter {
  field: string;
  op: string;
  value: any;
}

interface LocalQueryOrder {
  field: string;
  direction: string;
}

interface LocalQueryConfig {
  collectionPath: string;
  filters: LocalQueryFilter[];
  orders: LocalQueryOrder[];
  limitCount: number | null;
  startAfterDoc: any | null;
  endBeforeDoc: any | null;
  limitToLastCount: number | null;
}

const applyFilters = (items: any[], filters: LocalQueryFilter[]): any[] => {
  return items.filter(item => {
    return filters.every(f => {
      const val = getNestedValue(item, f.field);
      switch (f.op) {
        case '==': return val === f.value;
        case '!=': return val !== f.value;
        case '<': return val < f.value;
        case '<=': return val <= f.value;
        case '>': return val > f.value;
        case '>=': return val >= f.value;
        case 'in': return Array.isArray(f.value) && f.value.includes(val);
        case 'not-in': return Array.isArray(f.value) && !f.value.includes(val);
        case 'array-contains': return Array.isArray(val) && val.includes(f.value);
        case 'array-contains-any': return Array.isArray(val) && Array.isArray(f.value) && f.value.some((v: any) => val.includes(v));
        default: return true;
      }
    });
  });
};

const getNestedValue = (obj: any, path: string): any => {
  return path.split('.').reduce((curr, key) => curr?.[key], obj);
};

const applyOrders = (items: any[], orders: LocalQueryOrder[]): any[] => {
  if (!orders.length) return items;
  return [...items].sort((a, b) => {
    for (const o of orders) {
      const aVal = getNestedValue(a, o.field);
      const bVal = getNestedValue(b, o.field);
      if (aVal === bVal) continue;
      if (aVal === undefined || aVal === null) return 1;
      if (bVal === undefined || bVal === null) return -1;
      const cmp = aVal < bVal ? -1 : 1;
      return o.direction === 'desc' ? -cmp : cmp;
    }
    return 0;
  });
};

// ========== MOCK DOCUMENT/QUERY SNAPSHOT BUILDERS ==========

const createMockDocSnapshot = (data: any, id: string, path: string): any => ({
  id,
  ref: { id, path: `${path}/${id}`, parent: { path } },
  data: () => data ? { ...data } : undefined,
  exists: () => !!data,
  get: (field: string) => data?.[field],
  metadata: { fromCache: true, hasPendingWrites: false },
});

const createMockQuerySnapshot = (docs: any[]): any => ({
  docs,
  size: docs.length,
  empty: docs.length === 0,
  forEach: (cb: (doc: any) => void) => docs.forEach(cb),
  [Symbol.iterator]: function* () { yield* docs; },
});

// ========== WRAPPED FIRESTORE FUNCTIONS ==========

// --- collection ---
export function collection(dbOrRef: any, ...pathSegments: string[]): any {
  if (!isStandalone()) return (_collection as any)(dbOrRef, ...pathSegments);
  
  const fullPath = pathSegments.join('/');
  return {
    id: pathSegments[pathSegments.length - 1],
    path: fullPath,
    type: 'collection',
    _isLocalCollection: true,
    _collectionPath: fullPath,
    firestore: dbOrRef,
    converter: null,
    parent: null,
    withConverter: () => collection(dbOrRef, ...pathSegments),
  };
}

// --- doc ---
export function doc(dbOrRef: any, ...pathSegments: string[]): any {
  if (!isStandalone()) return (_doc as any)(dbOrRef, ...pathSegments);
  
  const fullPath = pathSegments.join('/');
  const parts = fullPath.split('/');
  const docId = parts[parts.length - 1];
  const collectionPath = parts.slice(0, -1).join('/');
  
  return {
    id: docId,
    path: fullPath,
    type: 'document',
    _isLocalDoc: true,
    _docId: docId,
    _collectionPath: collectionPath,
    firestore: dbOrRef,
    converter: null,
    parent: { path: collectionPath, id: parts[parts.length - 2] || collectionPath },
    withConverter: () => doc(dbOrRef, ...pathSegments),
  };
}

// --- query ---
export function query(ref: any, ...constraints: any[]): any {
  if (!isStandalone()) return (_query as any)(ref, ...constraints);
  
  const config: LocalQueryConfig = {
    collectionPath: ref._collectionPath || ref.path || '',
    filters: [],
    orders: [],
    limitCount: null,
    startAfterDoc: null,
    endBeforeDoc: null,
    limitToLastCount: null,
  };
  
  for (const c of constraints) {
    if (!c) continue;
    if (c._type === 'where') config.filters.push(c);
    else if (c._type === 'orderBy') config.orders.push(c);
    else if (c._type === 'limit') config.limitCount = c.value;
    else if (c._type === 'startAfter') config.startAfterDoc = c;
    else if (c._type === 'endBefore') config.endBeforeDoc = c;
    else if (c._type === 'limitToLast') config.limitToLastCount = c.value;
  }
  
  return {
    ...ref,
    _isLocalQuery: true,
    _queryConfig: config,
    type: 'query',
  };
}

// --- where ---
export function where(field: string, op: string, value: any): any {
  if (!isStandalone()) return _where(field, op as any, value);
  return { _type: 'where', field, op, value };
}

// --- orderBy ---
export function orderBy(field: string, direction: string = 'asc'): any {
  if (!isStandalone()) return _orderBy(field, direction as any);
  return { _type: 'orderBy', field, direction };
}

// --- limit ---
export function limit(n: number): any {
  if (!isStandalone()) return _limit(n);
  return { _type: 'limit', value: n };
}

// --- startAfter ---
export function startAfter(...args: any[]): any {
  if (!isStandalone()) return (_startAfter as any)(...args);
  return { _type: 'startAfter', value: args };
}

// --- endBefore ---
export function endBefore(...args: any[]): any {
  if (!isStandalone()) return (_endBefore as any)(...args);
  return { _type: 'endBefore', value: args };
}

// --- runTransaction ---
export async function runTransaction(firestore: any, updateFunction: (transaction: any) => Promise<any>, options?: any): Promise<any> {
  if (!isStandalone()) return _runTransaction(firestore, updateFunction, options);
  
  const mockTransaction = {
    get: async (ref: any) => {
      return await getDoc(ref);
    },
    set: (ref: any, data: any, options?: any) => {
      setDoc(ref, data, options);
      return mockTransaction;
    },
    update: (ref: any, data: any) => {
      updateDoc(ref, data);
      return mockTransaction;
    },
    delete: (ref: any) => {
      deleteDoc(ref);
      return mockTransaction;
    }
  };

  return await updateFunction(mockTransaction);
}

// --- limitToLast ---
export function limitToLast(n: number): any {
  if (!isStandalone()) return _limitToLast(n);
  return { _type: 'limitToLast', value: n };
}

// --- getDocs ---
export async function getDocs(ref: any): Promise<any> {
  if (!isStandalone()) return _getDocs(ref);
  
  const config: LocalQueryConfig = ref._queryConfig || {
    collectionPath: ref._collectionPath || ref.path || '',
    filters: [],
    orders: [],
    limitCount: null,
    startAfterDoc: null,
    endBeforeDoc: null,
    limitToLastCount: null,
  };
  
  let items = getLocalCollection(config.collectionPath);
  items = applyFilters(items, config.filters);
  items = applyOrders(items, config.orders);
  if (config.limitCount) items = items.slice(0, config.limitCount);
  if (config.limitToLastCount) items = items.slice(-config.limitToLastCount);
  
  const docs = items.map(item =>
    createMockDocSnapshot(item, item.id || item.uid || generateId(), config.collectionPath)
  );
  
  return createMockQuerySnapshot(docs);
}

// --- getDoc ---
export async function getDoc(ref: any): Promise<any> {
  if (!isStandalone()) return _getDoc(ref);
  
  const collPath = ref._collectionPath || ref.parent?.path || '';
  const docId = ref._docId || ref.id || '';
  const items = getLocalCollection(collPath);
  const found = items.find(i => (i.id === docId) || (i.uid === docId));
  
  return createMockDocSnapshot(found || null, docId, collPath);
}

// --- addDoc ---
export async function addDoc(ref: any, data: any): Promise<any> {
  if (!isStandalone()) return _addDoc(ref, data);
  
  const collPath = ref._collectionPath || ref.path || '';
  const newId = generateId();
  const now = new Date().toISOString();
  const newItem = {
    ...resolveFieldValues(data),
    id: newId,
    createdAt: now,
    updatedAt: now,
  };
  
  const items = getLocalCollection(collPath);
  items.push(newItem);
  saveLocalCollection(collPath, items);
  
  return {
    id: newId,
    path: `${collPath}/${newId}`,
    parent: ref,
    firestore: ref.firestore,
  };
}

// --- setDoc ---
export async function setDoc(ref: any, data: any, options?: any): Promise<void> {
  if (!isStandalone()) return _setDoc(ref, data, options);
  
  const collPath = ref._collectionPath || ref.parent?.path || '';
  const docId = ref._docId || ref.id || '';
  const items = getLocalCollection(collPath);
  const now = new Date().toISOString();
  const resolved = resolveFieldValues(data);
  
  const idx = items.findIndex(i => (i.id === docId) || (i.uid === docId));
  if (idx >= 0) {
    if (options?.merge) {
      items[idx] = { ...items[idx], ...resolved, id: docId, updatedAt: now };
    } else {
      items[idx] = { ...resolved, id: docId, updatedAt: now };
    }
  } else {
    items.push({ ...resolved, id: docId, createdAt: now, updatedAt: now });
  }
  saveLocalCollection(collPath, items);
}

// --- updateDoc ---
export async function updateDoc(ref: any, data: any): Promise<void> {
  if (!isStandalone()) return _updateDoc(ref, data);
  
  const collPath = ref._collectionPath || ref.parent?.path || '';
  const docId = ref._docId || ref.id || '';
  const items = getLocalCollection(collPath);
  const now = new Date().toISOString();
  const resolved = resolveFieldValues(data);
  
  const idx = items.findIndex(i => (i.id === docId) || (i.uid === docId));
  if (idx >= 0) {
    // Handle deleteField sentinels
    for (const [key, val] of Object.entries(resolved)) {
      if (val && (val as any).__deleteField) {
        delete items[idx][key];
        delete resolved[key];
      }
    }
    items[idx] = { ...items[idx], ...resolved, updatedAt: now };
    saveLocalCollection(collPath, items);
  } else {
    // Create document if it doesn't exist (upsert behavior)
    items.push({ ...resolved, id: docId, createdAt: now, updatedAt: now });
    saveLocalCollection(collPath, items);
  }
}

// --- deleteDoc ---
export async function deleteDoc(ref: any): Promise<void> {
  if (!isStandalone()) return _deleteDoc(ref);
  
  const collPath = ref._collectionPath || ref.parent?.path || '';
  const docId = ref._docId || ref.id || '';
  let items = getLocalCollection(collPath);
  items = items.filter(i => i.id !== docId && i.uid !== docId);
  saveLocalCollection(collPath, items);
}

// --- onSnapshot ---
export function onSnapshot(ref: any, optionsOrCallback: any, callbackOrError?: any, errorHandler?: any): () => void {
  if (!isStandalone()) return _onSnapshot(ref, optionsOrCallback, callbackOrError, errorHandler);
  
  // Parse arguments - onSnapshot has multiple overloads
  let callback: (snapshot: any) => void;
  let onError: ((error: any) => void) | undefined;
  
  if (typeof optionsOrCallback === 'function') {
    callback = optionsOrCallback;
    onError = typeof callbackOrError === 'function' ? callbackOrError : undefined;
  } else if (typeof optionsOrCallback === 'object' && typeof callbackOrError === 'function') {
    callback = callbackOrError;
    onError = typeof errorHandler === 'function' ? errorHandler : undefined;
  } else {
    callback = optionsOrCallback?.next || (() => {});
    onError = optionsOrCallback?.error;
  }
  
  // Determine if it's a document or collection snapshot
  const isDocRef = ref._isLocalDoc || ref.type === 'document';
  
  const emit = () => {
    try {
      if (isDocRef) {
        const collPath = ref._collectionPath || ref.parent?.path || '';
        const docId = ref._docId || ref.id || '';
        const items = getLocalCollection(collPath);
        const found = items.find((i: any) => i.id === docId || i.uid === docId);
        callback(createMockDocSnapshot(found || null, docId, collPath));
      } else {
        // Collection or query
        getDocs(ref).then(snapshot => callback(snapshot)).catch(e => onError?.(e));
      }
    } catch (e) {
      onError?.(e);
    }
  };
  
  // Emit immediately
  emit();
  
  // Poll for changes every 2 seconds
  const interval = setInterval(emit, 2000);
  
  // Listen for storage events from other tabs
  const storageHandler = (e: StorageEvent) => {
    if (e.key?.startsWith(LOCAL_PREFIX)) emit();
  };
  window.addEventListener('storage', storageHandler);
  
  // Return unsubscribe function
  return () => {
    clearInterval(interval);
    window.removeEventListener('storage', storageHandler);
  };
}

// --- serverTimestamp ---
export function serverTimestamp(): any {
  if (!isStandalone()) return _serverTimestamp();
  return new Date().toISOString();
}

// --- Timestamp ---
export const Timestamp = _Timestamp;

// --- writeBatch ---
export function writeBatch(firestore?: any): any {
  if (!isStandalone()) return _writeBatch(firestore || db);
  
  const ops: Array<{ type: string; ref: any; data?: any; options?: any }> = [];
  
  return {
    set: (ref: any, data: any, options?: any) => { ops.push({ type: 'set', ref, data, options }); },
    update: (ref: any, data: any) => { ops.push({ type: 'update', ref, data }); },
    delete: (ref: any) => { ops.push({ type: 'delete', ref }); },
    commit: async () => {
      for (const op of ops) {
        if (op.type === 'set') await setDoc(op.ref, op.data, op.options);
        else if (op.type === 'update') await updateDoc(op.ref, op.data);
        else if (op.type === 'delete') await deleteDoc(op.ref);
      }
    },
  };
}

// --- deleteField ---
export function deleteField(): any {
  if (!isStandalone()) return _deleteField();
  return { __deleteField: true };
}

// --- arrayUnion ---
export function arrayUnion(...elements: any[]): any {
  if (!isStandalone()) return _arrayUnion(...elements);
  return { __arrayUnion: true, elements };
}

// --- arrayRemove ---
export function arrayRemove(...elements: any[]): any {
  if (!isStandalone()) return _arrayRemove(...elements);
  return { __arrayRemove: true, elements };
}

// --- increment ---
export function increment(n: number): any {
  if (!isStandalone()) return _increment(n);
  return { __increment: true, value: n };
}

// --- getCountFromServer ---
export async function getCountFromServer(ref: any): Promise<any> {
  if (!isStandalone()) return _getCountFromServer(ref);
  const snapshot = await getDocs(ref);
  return {
    data: () => ({ count: snapshot.size }),
  };
}

// ========== FIELD VALUE RESOLVER ==========
const resolveFieldValues = (data: any): any => {
  if (!data || typeof data !== 'object') return data;
  const result: any = {};
  for (const [key, value] of Object.entries(data)) {
    if (value && typeof value === 'object') {
      if ((value as any).__arrayUnion) {
        // Merge arrays: existing + new unique elements
        result[key] = { __arrayUnion: true, elements: (value as any).elements };
      } else if ((value as any).__arrayRemove) {
        result[key] = { __arrayRemove: true, elements: (value as any).elements };
      } else if ((value as any).__increment) {
        result[key] = { __increment: true, value: (value as any).value };
      } else if ((value as any).__deleteField) {
        result[key] = value;
      } else if (value instanceof Date) {
        result[key] = value.toISOString();
      } else if (Array.isArray(value)) {
        result[key] = value;
      } else {
        result[key] = resolveFieldValues(value);
      }
    } else {
      result[key] = value;
    }
  }
  return result;
};

// ========== BACKUP & RESTORE ==========

/**
 * Export ALL local database collections as a single JSON string
 */
export const exportFullBackup = (): string => {
  const backup: Record<string, any[]> = {};
  const prefix = LOCAL_PREFIX;
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith(prefix)) {
      const collName = key.substring(prefix.length);
      try {
        backup[collName] = JSON.parse(localStorage.getItem(key) || '[]');
      } catch { backup[collName] = []; }
    }
  }
  // Also include auth data
  const authKeys = ['fahmni_local_users', 'fahmni_current_user', 'fahmni_auth_user'];
  for (const k of authKeys) {
    try {
      const val = localStorage.getItem(k);
      if (val) backup[`__auth__${k}`] = JSON.parse(val);
    } catch {}
  }
  return JSON.stringify(backup, null, 2);
};

/**
 * Download full backup as a .json file
 */
export const downloadBackup = (platformName: string = 'fahmni'): void => {
  const data = exportFullBackup();
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const date = new Date().toISOString().split('T')[0];
  a.download = `${platformName}_backup_${date}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

/**
 * Restore full backup from a JSON string
 */
export const restoreFromBackup = (jsonString: string): { success: boolean; collections: number; records: number; error?: string } => {
  try {
    const backup = JSON.parse(jsonString);
    let collections = 0;
    let records = 0;
    
    for (const [key, value] of Object.entries(backup)) {
      if (key.startsWith('__auth__')) {
        // Restore auth keys
        const authKey = key.replace('__auth__', '');
        localStorage.setItem(authKey, JSON.stringify(value));
      } else {
        const items = Array.isArray(value) ? value : [];
        localStorage.setItem(LOCAL_PREFIX + key, JSON.stringify(items));
        records += items.length;
      }
      collections++;
    }
    
    return { success: true, collections, records };
  } catch (e: any) {
    return { success: false, collections: 0, records: 0, error: e.message };
  }
};

/**
 * Get database statistics
 */
export const getDbStats = (): { collections: string[]; totalRecords: number; sizeKB: number } => {
  const collections: string[] = [];
  let totalRecords = 0;
  let totalSize = 0;
  
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith(LOCAL_PREFIX)) {
      const collName = key.substring(LOCAL_PREFIX.length);
      collections.push(collName);
      const val = localStorage.getItem(key) || '[]';
      totalSize += val.length;
      try {
        totalRecords += JSON.parse(val).length;
      } catch {}
    }
  }
  
  return { collections, totalRecords, sizeKB: Math.round(totalSize / 1024) };
};
