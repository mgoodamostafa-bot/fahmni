import { initializeApp, getApp, getApps, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { initializeFirestore, getFirestore, Firestore, collection, doc } from 'firebase/firestore';
import { getStorage, FirebaseStorage } from 'firebase/storage';
import jsonConfig from '../../firebase-applet-config.json';

const getEnvVar = (key: string, viteKey: string) => {
  if (typeof import.meta !== 'undefined' && import.meta.env && (import.meta.env as any)[viteKey] !== undefined) {
    return (import.meta.env as any)[viteKey];
  }
  if (typeof process !== 'undefined' && process.env && process.env[key] !== undefined) {
    return process.env[key];
  }
  return undefined;
};

const envConfig = {
  apiKey: getEnvVar('NEXT_PUBLIC_FIREBASE_API_KEY', 'VITE_FIREBASE_API_KEY'),
  projectId: getEnvVar('NEXT_PUBLIC_FIREBASE_PROJECT_ID', 'VITE_FIREBASE_PROJECT_ID'),
  appId: getEnvVar('NEXT_PUBLIC_FIREBASE_APP_ID', 'VITE_FIREBASE_APP_ID'),
  authDomain: getEnvVar('NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN', 'VITE_FIREBASE_AUTH_DOMAIN'),
  firestoreDatabaseId: getEnvVar('NEXT_PUBLIC_FIREBASE_DATABASE_ID', 'VITE_FIREBASE_DATABASE_ID') || (jsonConfig as any).firestoreDatabaseId || '(default)',
  storageBucket: getEnvVar('NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET', 'VITE_FIREBASE_STORAGE_BUCKET'),
  messagingSenderId: getEnvVar('NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID', 'VITE_FIREBASE_MESSAGING_SENDER_ID'),
};

const hasEnvConfig = envConfig.apiKey && envConfig.projectId;

if (!hasEnvConfig) {
  console.warn(
    '⚠️ SECURITY: Using firebase-applet-config.json. Set VITE_FIREBASE_* env vars for production.'
  );
} else {
  console.log('✅ Firebase initialized from environment variables.');
}

const firebaseConfig: any = hasEnvConfig ? envConfig : jsonConfig;

let masterApp: FirebaseApp;
if (!getApps().length) {
  masterApp = initializeApp(firebaseConfig);
} else {
  masterApp = getApp();
}

// Safe Firestore initialization helper with long polling fallback
const getOrInitializeFirestore = (appInstance: FirebaseApp, databaseId: string): Firestore => {
  try {
    return initializeFirestore(appInstance, {
      experimentalForceLongPolling: true,
    }, databaseId);
  } catch (error) {
    console.warn(`Firestore already initialized for app "${appInstance.name}", using getFirestore.`);
    return getFirestore(appInstance, databaseId);
  }
};

const databaseId = firebaseConfig.firestoreDatabaseId || '(default)';
export const masterDb = getOrInitializeFirestore(masterApp, databaseId);

export const isMasterHost = (): boolean => {
  if (typeof window === 'undefined') return true;
  const host = window.location.hostname;
  const isExplicitStandalone = (window as any).VITE_STANDALONE_MODE === 'true' || import.meta.env.VITE_STANDALONE_MODE === 'true';
  if (isExplicitStandalone) return false;

  // Master host includes localhost (and subdomains like xxx.localhost) AND fahmni.me (and subdomains like xxx.fahmni.me)
  if (
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host.endsWith('.localhost') ||
    host === 'fahmni.me' ||
    host.endsWith('.fahmni.me')
  ) {
    return true;
  }
  return false;
};

const dummyStandaloneConfig = {
  apiKey: 'AIzaSyStandaloneDummyKeyZeroData00000',
  authDomain: 'standalone-isolated-platform.firebaseapp.com',
  projectId: 'standalone-isolated-platform-local',
  storageBucket: 'standalone-isolated-platform.appspot.com',
  messagingSenderId: '000000000000',
  appId: '1:000000000000:web:0000000000000000000000'
};

// 2. Tenant instances (populated dynamically and isolated by host by default)
export let app: FirebaseApp;
export let auth: Auth;
export let db: Firestore;
export let storage: FirebaseStorage;

if (isMasterHost()) {
  app = masterApp;
  db = masterDb;
} else {
  if (getApps().some((a) => a.name === 'TENANT_HOST')) {
    app = getApp('TENANT_HOST');
  } else {
    app = initializeApp(firebaseConfig, 'TENANT_HOST');
  }
  db = getOrInitializeFirestore(app, '(default)');
}
auth = getAuth(app);
storage = getStorage(app);

// Safe getters to avoid ES module live binding issues in React components
export const getTenantDb = () => db;
export const getTenantAuth = () => auth;
export const getTenantApp = () => app;
export const getTenantStorage = () => storage;

export const initTenantApp = (tenantConfig?: any) => {
  try {
    const masterDbId = firebaseConfig.firestoreDatabaseId || '(default)';
    const tenantDbId = tenantConfig?.firestoreDatabaseId || '(default)';

    const isMaster = isMasterHost();

    // Only reuse masterApp if we are on the actual Master Host
    if (
      isMaster &&
      (!tenantConfig ||
      !tenantConfig.apiKey ||
      (tenantConfig.projectId === firebaseConfig.projectId && tenantDbId === masterDbId))
    ) {
      app = masterApp;
      db = masterDb;
    } else if (tenantConfig && tenantConfig.apiKey) {
      if (getApps().some((a) => a.name === 'TENANT')) {
        app = getApp('TENANT');
        const tenantDatabaseId = tenantConfig.firestoreDatabaseId;
        db = getOrInitializeFirestore(app, tenantDatabaseId || '(default)');
      } else {
        app = initializeApp(tenantConfig, 'TENANT');
        const tenantDatabaseId = tenantConfig.firestoreDatabaseId;
        db = getOrInitializeFirestore(app, tenantDatabaseId || '(default)');
      }
    } else {
      // Non-master host without custom API key: use dedicated tenant host app instance
      if (getApps().some((a) => a.name === 'TENANT_HOST')) {
        app = getApp('TENANT_HOST');
      } else {
        app = initializeApp(firebaseConfig, 'TENANT_HOST');
      }
      db = getOrInitializeFirestore(app, '(default)');
    }
    auth = getAuth(app);
    storage = getStorage(app);
    console.log('🔥 [SYSTEM VERIFIED] TENANT DATABASE INITIALIZED');
  } catch (error) {
    console.error('Error initializing tenant app', error);
  }
};

export const getCurrentTenantId = (): string | null => {
  if (typeof window === 'undefined') return null;
  const w = window as any;
  if (w.VITE_TENANT_ID && w.VITE_TENANT_ID !== 'master') return w.VITE_TENANT_ID;
  if (w.VITE_TENANT_DATA?.subdomain && w.VITE_TENANT_DATA.subdomain !== 'master') return w.VITE_TENANT_DATA.subdomain;

  const host = window.location.hostname;
  if (host === 'localhost' || host === '127.0.0.1' || host.includes('fahmni.me')) {
    const parts = host.split('.');
    if (parts.length > 2 && parts[0] !== 'www' && parts[0] !== 'admin') {
      return parts[0];
    }
    return null;
  }

  if (host.includes('vercel.app') || host.includes('netlify.app') || (host.includes('.') && !host.includes('fahmni.me'))) {
    const part = host.split('.')[0];
    return part || 'standalone_app';
  }

  return null;
};

export const getTenantCollection = (colName: string) => {
  const isMaster = isMasterHost();
  const tenantId = getCurrentTenantId();
  const currentDb = getTenantDb() || masterDb;
  const globalCollections = ['tenants', 'super_admin', 'system', 'system_releases'];

  // Non-master domains (like Vercel standalone deployments) ALWAYS isolate collections under tenants_data/tenantId/
  if (!isMaster && tenantId && !globalCollections.includes(colName)) {
    return collection(currentDb, 'tenants_data', tenantId, colName);
  }

  if (tenantId && currentDb === masterDb && !globalCollections.includes(colName)) {
    return collection(masterDb, 'tenants_data', tenantId, colName);
  }
  return collection(currentDb, colName);
};

export const getTenantDoc = (colName: string, docId: string) => {
  const isMaster = isMasterHost();
  const tenantId = getCurrentTenantId();
  const currentDb = getTenantDb() || masterDb;
  const globalCollections = ['tenants', 'super_admin', 'system', 'system_releases'];

  // Non-master domains (like Vercel standalone deployments) ALWAYS isolate docs under tenants_data/tenantId/
  if (!isMaster && tenantId && !globalCollections.includes(colName)) {
    return doc(currentDb, 'tenants_data', tenantId, colName, docId);
  }

  if (tenantId && currentDb === masterDb && !globalCollections.includes(colName)) {
    return doc(masterDb, 'tenants_data', tenantId, colName, docId);
  }
  return doc(currentDb, colName, docId);
};
