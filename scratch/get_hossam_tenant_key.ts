import { initializeApp } from 'firebase/app';
import { initializeFirestore, doc, getDoc } from 'firebase/firestore';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import fs from 'fs';

const config = JSON.parse(fs.readFileSync('firebase-applet-config.json', 'utf8'));
const app = initializeApp(config);
const db = initializeFirestore(
  app,
  { experimentalForceLongPolling: true },
  config.firestoreDatabaseId || '(default)'
);
const auth = getAuth(app);

async function main() {
  await signInWithEmailAndPassword(auth, 'teacher_test@fahmni.com', 'password123');
  const snap = await getDoc(doc(db, 'tenants', 'hossamalsalhy'));
  if (snap.exists()) {
    console.log('hossamalsalhy tenant data:', snap.data());
  } else {
    console.log('Tenant hossamalsalhy doc not found');
  }
  process.exit(0);
}

main().catch(console.error);
