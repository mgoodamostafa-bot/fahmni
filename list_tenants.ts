import { initializeApp } from 'firebase/app';
import { initializeFirestore, doc, getDoc, collection, getDocs } from 'firebase/firestore';
import fs from 'fs';

const config = JSON.parse(fs.readFileSync('firebase-applet-config.json', 'utf8'));
const appMaster = initializeApp(config);
const dbMaster = initializeFirestore(appMaster, { experimentalForceLongPolling: true }, config.firestoreDatabaseId || '(default)');

async function main() {
  console.log('--- Listing all tenants in tenants collection ---');
  const snap = await getDocs(collection(dbMaster, 'tenants'));
  console.log('Total tenants found:', snap.size);
  snap.forEach(d => {
    console.log('Tenant Doc ID:', d.id);
    console.log('Tenant Data:', JSON.stringify(d.data(), null, 2));
  });
}

main().catch(console.error);
