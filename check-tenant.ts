import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc } from 'firebase/firestore';
import config from './firebase-applet-config.json' assert { type: 'json' };

const app = initializeApp(config);
const db = getFirestore(app, config.firestoreDatabaseId || '(default)');

async function checkTenant() {
  try {
    const docRef = doc(db, 'tenants', 'hossamalsalhy');
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      console.log('Tenant "hossamalsalhy" found:');
      console.log(JSON.stringify(snap.data(), null, 2));
    } else {
      console.log('Tenant "hossamalsalhy" does NOT exist.');
    }
  } catch (err) {
    console.error('Error fetching tenant:', err);
  }
  process.exit(0);
}

checkTenant();
