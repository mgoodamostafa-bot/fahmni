import { initializeApp } from 'firebase/app';
import { initializeFirestore, collection, getDocs } from 'firebase/firestore';
import fs from 'fs';

const config = JSON.parse(fs.readFileSync('firebase-applet-config.json', 'utf8'));
const app = initializeApp(config);
const db = initializeFirestore(app, { experimentalForceLongPolling: true }, config.firestoreDatabaseId || '(default)');

async function main() {
  console.log('--- Printing ALL tenants in Master DB ---');
  const snap = await getDocs(collection(db, 'tenants'));
  console.log('Total tenants found:', snap.size);
  snap.forEach(d => {
    console.log('Tenant document ID:', d.id, 'Data:', JSON.stringify(d.data(), null, 2));
  });
}

main().catch(console.error);
