import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc } from 'firebase/firestore';
import * as fs from 'fs';
import * as path from 'path';

// Read config
const configPath = path.resolve('firebase-applet-config.json');
const firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const databaseId = firebaseConfig.firestoreDatabaseId || '(default)';
const db = getFirestore(app, databaseId);

async function check() {
  try {
    const tenantRef = doc(db, 'tenants', 'eng');
    const snap = await getDoc(tenantRef);
    if (snap.exists()) {
      console.log('TENANT_DOC_EXISTS: true');
      console.log('TENANT_DOC_DATA:', JSON.stringify(snap.data(), null, 2));
    } else {
      console.log('TENANT_DOC_EXISTS: false');
    }
    process.exit(0);
  } catch (error) {
    console.error('ERROR:', error);
    process.exit(1);
  }
}

check();
