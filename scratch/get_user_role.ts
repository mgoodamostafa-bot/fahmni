import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { initializeFirestore, collection, query, where, getDocs } from 'firebase/firestore';
import fs from 'fs';

const config = JSON.parse(fs.readFileSync('firebase-applet-config.json', 'utf8'));
const app = initializeApp(config);
const auth = getAuth(app);
const db = initializeFirestore(app, { experimentalForceLongPolling: true }, config.firestoreDatabaseId || '(default)');

async function main() {
  await signInWithEmailAndPassword(auth, 'parent_viewer@fahmni.me', 'parent123456');
  const q = query(collection(db, 'users'), where('email', '==', 'mostafagooda3@gmail.com'));
  const snap = await getDocs(q);
  if (snap.empty) {
    console.log('User not found.');
  } else {
    console.log('User data:', JSON.stringify(snap.docs[0].data(), null, 2));
  }
}

main().catch(console.error);
