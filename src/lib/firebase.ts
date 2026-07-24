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

  // Master host is ONLY localhost/127.0.0.1 or fahmni.me / www.fahmni.me
  if (host === 'localhost' || host === '127.0.0.1' || host === 'fahmni.me' || host === 'www.fahmni.me') {
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
  if (getApps().some((a) => a.name === 'STANDALONE')) {
    app = getApp('STANDALONE');
  } else {
    app = initializeApp(dummyStandaloneConfig, 'STANDALONE');
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
    const isStandalone = !isMaster || (typeof window !== 'undefined' && (
      (window as any).VITE_STANDALONE_MODE === 'true' || 
      import.meta.env.VITE_STANDALONE_MODE === 'true' ||
      tenantConfig?.isStandalone
    ));

    // Only reuse masterApp if we are on the actual Master Host
    if (
      isMaster &&
      (!tenantConfig ||
      !tenantConfig.apiKey ||
      (tenantConfig.projectId === firebaseConfig.projectId && tenantDbId === masterDbId))
    ) {
      app = masterApp;
      db = masterDb;
    } else if (!tenantConfig?.apiKey) {
      // Non-master host (Standalone / Sub-tenant) without custom API key: initialize a 100% DISCONNECTED dummy app
      const dummyConfig = {
        apiKey: 'AIzaSyStandaloneDummyKeyZeroData00000',
        authDomain: 'standalone-isolated-platform.firebaseapp.com',
        projectId: `standalone-isolated-platform-${Date.now()}`,
        storageBucket: 'standalone-isolated-platform.appspot.com',
        messagingSenderId: '000000000000',
        appId: '1:000000000000:web:0000000000000000000000'
      };
      if (getApps().some((a) => a.name === 'STANDALONE')) {
        app = getApp('STANDALONE');
      } else {
        app = initializeApp(dummyConfig, 'STANDALONE');
      }
      db = getOrInitializeFirestore(app, '(default)');
    } else {
      if (getApps().some((a) => a.name === 'TENANT')) {
        app = getApp('TENANT');
        const tenantDatabaseId = tenantConfig.firestoreDatabaseId;
        db = getOrInitializeFirestore(app, tenantDatabaseId || '(default)');
      } else {
        app = initializeApp(tenantConfig, 'TENANT');
        const tenantDatabaseId = tenantConfig.firestoreDatabaseId;
        db = getOrInitializeFirestore(app, tenantDatabaseId || '(default)');
      }
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
  const isStandalone = typeof window !== 'undefined' && (
    (window as any).VITE_STANDALONE_MODE === 'true' || 
    import.meta.env.VITE_STANDALONE_MODE === 'true'
  );

  const tenantId = getCurrentTenantId();
  const currentDb = getTenantDb();
  const globalCollections = ['tenants', 'super_admin', 'system', 'system_releases'];

  // Standalone platforms NEVER touch masterDb
  if (isStandalone) {
    return collection(currentDb || masterDb, colName);
  }

  if (tenantId && currentDb === masterDb && !globalCollections.includes(colName)) {
    return collection(masterDb, 'tenants_data', tenantId, colName);
  }
  return collection(currentDb || masterDb, colName);
};

export const getTenantDoc = (colName: string, docId: string) => {
  const isStandalone = typeof window !== 'undefined' && (
    (window as any).VITE_STANDALONE_MODE === 'true' || 
    import.meta.env.VITE_STANDALONE_MODE === 'true'
  );

  const tenantId = getCurrentTenantId();
  const currentDb = getTenantDb();
  const globalCollections = ['tenants', 'super_admin', 'system', 'system_releases'];

  // Standalone platforms NEVER touch masterDb
  if (isStandalone) {
    return doc(currentDb || masterDb, colName, docId);
  }

  if (tenantId && currentDb === masterDb && !globalCollections.includes(colName)) {
    return doc(masterDb, 'tenants_data', tenantId, colName, docId);
  }
  return doc(currentDb || masterDb, colName, docId);
};
