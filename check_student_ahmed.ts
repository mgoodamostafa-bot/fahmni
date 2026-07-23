import { initializeApp } from 'firebase/app';
import { initializeFirestore, doc, getDoc, collection, getDocs, query, where } from 'firebase/firestore';
import fs from 'fs';

const config = JSON.parse(fs.readFileSync('firebase-applet-config.json', 'utf8'));
const appMaster = initializeApp(config);
const dbMaster = initializeFirestore(appMaster, { experimentalForceLongPolling: true }, config.firestoreDatabaseId || '(default)');

async function main() {
  const tenantSnap = await getDoc(doc(dbMaster, 'tenants', 'eng'));
  const tenantData = tenantSnap.data()!;
  console.log('tenantData fields:', Object.keys(tenantData));
  console.log('firebaseConfig field value:', tenantData.firebaseConfig);
  console.log('firebaseConfig type:', typeof tenantData.firebaseConfig);
}

main().catch(console.error);
