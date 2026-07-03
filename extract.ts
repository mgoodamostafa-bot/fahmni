import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc } from 'firebase/firestore';
import * as fs from 'fs';
import config from './firebase-applet-config.json' assert { type: 'json' };

const app = initializeApp(config);
const db = getFirestore(app, config.firestoreDatabaseId || '(default)');

async function checkTenant() {
  try {
    const docRef = doc(db, 'tenants', 'eng');
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      const data = snap.data();
      fs.writeFileSync('out.json', JSON.stringify(data.firebaseConfig || {}, null, 2));
    }
  } catch (err) {
    console.error('Error fetching tenant:', err);
  }
  process.exit(0);
}

checkTenant();
