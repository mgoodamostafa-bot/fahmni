import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { initializeFirestore, collection, getDocs, query, where } from 'firebase/firestore';
import fs from 'fs';

const config = JSON.parse(fs.readFileSync('firebase-applet-config.json', 'utf8'));
const app = initializeApp(config);
const auth = getAuth(app);
const db = initializeFirestore(app, { experimentalForceLongPolling: true }, config.firestoreDatabaseId || '(default)');

async function main() {
  console.log('1. Attempting silent authentication...');
  try {
    const creds = await signInWithEmailAndPassword(auth, 'parent_viewer@fahmni.me', 'parent123456');
    console.log('Auth successful! UID:', creds.user.uid);
  } catch (err: any) {
    console.error('Auth failed:', err.message);
  }

  const studentUid = 'aKqJ0uJ02V8Oq'; // Ahmed Mohamed

  // 2. Query attendance
  console.log('2. Querying attendance...');
  try {
    const q = query(collection(db, 'attendance'), where('studentUid', '==', studentUid));
    const snap = await getDocs(q);
    console.log('Attendance docs:', snap.size);
    snap.forEach(d => console.log(d.id, d.data()));
  } catch (err: any) {
    console.error('Attendance query failed:', err.message);
  }

  // 3. Query payments
  console.log('3. Querying center_payments...');
  try {
    const q = query(collection(db, 'center_payments'), where('studentUid', '==', studentUid));
    const snap = await getDocs(q);
    console.log('Payments docs:', snap.size);
    snap.forEach(d => console.log(d.id, d.data()));
  } catch (err: any) {
    console.error('Payments query failed:', err.message);
  }
}

main().catch(console.error);
