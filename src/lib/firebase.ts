import { initializeApp, getApp, getApps, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import {
  initializeFirestore,
  getFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  Firestore
} from 'firebase/firestore';
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

// Safe Firestore initialization helper with long polling fallback and persistent local cache
const getOrInitializeFirestore = (appInstance: FirebaseApp, databaseId: string): Firestore => {
  try {
    return initializeFirestore(appInstance, {
      experimentalForceLongPolling: true,
      localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager(),
      }),
    }, databaseId);
  } catch (error) {
    console.warn(`Firestore already initialized for app "${appInstance.name}", using getFirestore.`);
    return getFirestore(appInstance, databaseId);
  }
};

const databaseId = firebaseConfig.firestoreDatabaseId || '(default)';
export const masterDb = getOrInitializeFirestore(masterApp, databaseId);

// 2. Tenant instances (will be populated dynamically)
export let app: FirebaseApp;
export let auth: Auth;
export let db: Firestore;
export let storage: FirebaseStorage;

// Safe getters to avoid ES module live binding issues in React components
export const getTenantDb = () => db;
export const getTenantAuth = () => auth;
export const getTenantApp = () => app;
export const getTenantStorage = () => storage;

export const initTenantApp = (tenantConfig?: any) => {
  try {
    const masterDbId = firebaseConfig.firestoreDatabaseId || '(default)';
    const tenantDbId = tenantConfig?.firestoreDatabaseId || '(default)';

    // If no config provided, or it's the exact same project AND database, reuse masterApp
    if (
      !tenantConfig ||
      !tenantConfig.apiKey ||
      (tenantConfig.projectId === firebaseConfig.projectId && tenantDbId === masterDbId)
    ) {
      app = masterApp;
      db = masterDb;
    } else {
      if (getApps().some((a) => a.name === 'TENANT')) {
        app = getApp('TENANT');
        const tenantDatabaseId = tenantConfig.firestoreDatabaseId; // Use exactly what config has (even if empty) or undefined
        db = getOrInitializeFirestore(app, tenantDatabaseId || '(default)'); // but pass default to function if undefined
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
