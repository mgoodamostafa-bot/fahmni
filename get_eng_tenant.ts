import { initializeApp } from 'firebase/app';
import { initializeFirestore, doc, getDoc } from 'firebase/firestore';
import fs from 'fs';

const config = JSON.parse(fs.readFileSync('firebase-applet-config.json', 'utf8'));
const appMaster = initializeApp(config);
const dbMaster = initializeFirestore(appMaster, { experimentalForceLongPolling: true }, config.firestoreDatabaseId || '(default)');

async function main() {
  const tenantSnap = await getDoc(doc(dbMaster, 'tenants', 'eng'));
  console.log('Tenant eng details:');
  console.log(JSON.stringify(tenantSnap.data(), null, 2));
}

main().catch(console.error);
