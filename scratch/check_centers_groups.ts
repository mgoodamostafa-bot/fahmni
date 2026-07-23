import { initializeApp } from 'firebase/app';
import { initializeFirestore, collection, getDocs } from 'firebase/firestore';
import fs from 'fs';

const config = JSON.parse(fs.readFileSync('firebase-applet-config.json', 'utf8'));
const app = initializeApp(config);
const db = initializeFirestore(app, { experimentalForceLongPolling: true }, config.firestoreDatabaseId || '(default)');

async function main() {
  console.log('--- Printing Centers ---');
  const centersSnap = await getDocs(collection(db, 'centers'));
  centersSnap.forEach(d => console.log('Center:', d.id, d.data()));

  console.log('--- Printing Groups ---');
  const groupsSnap = await getDocs(collection(db, 'groups'));
  groupsSnap.forEach(d => console.log('Group:', d.id, d.data()));
}

main().catch(console.error);
