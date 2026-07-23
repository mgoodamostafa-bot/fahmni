import { initializeApp } from 'firebase/app';
import { initializeFirestore, doc, getDoc } from 'firebase/firestore';
import fs from 'fs';

const config = JSON.parse(fs.readFileSync('firebase-applet-config.json', 'utf8'));
const app = initializeApp(config);
const db = initializeFirestore(app, { experimentalForceLongPolling: true }, config.firestoreDatabaseId || '(default)');

async function main() {
  const tenantRef = doc(db, 'tenants', 'eng');
  const snap = await getDoc(tenantRef);
  if (snap.exists()) {
    console.log('Tenant Data:', snap.data());
  } else {
    console.log('Tenant "eng" not found');
  }
}

main().catch(console.error);
